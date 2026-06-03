import 'dotenv/config'
import { app } from "./app";
import path from 'path'
import fs from 'fs'
import * as tf from '@tensorflow/tfjs'
import http from 'node:http'
import { initSocket } from "./socket/socket.service";

const server = http.createServer(app);

const PORT = process.env.PORT || 8083;
export let model: tf.LayersModel | null = null;
const currenDir = import.meta.dirname;

export let labels: Record<string, string> = {
  "0": "congratulations",
  "1": "good morning",
  "2": "happy birthday",
  "3": "how are you",
  "4": "i need help"
};
export let scaler: { mean: number[]; scale: number[] } | null = null;

async function loadModelMeta() {
  const modelDir = path.join(currenDir, '..', 'model');
  const labelsPath = path.join(modelDir, 'labels.json');
  const scalerPath = path.join(modelDir, 'scaler.json');
  
  if (fs.existsSync(labelsPath)) {
    try {
      labels = JSON.parse(fs.readFileSync(labelsPath, 'utf8'));
      console.log(`[MODEL META] Loaded ${Object.keys(labels).length} labels dynamically.`);
    } catch (e: any) {
      console.error('[MODEL META ERROR] Failed to load labels.json:', e.message);
    }
  } else {
    console.log('[MODEL META] labels.json not found, using default 5 labels.');
  }
  
  if (fs.existsSync(scalerPath)) {
    try {
      scaler = JSON.parse(fs.readFileSync(scalerPath, 'utf8'));
      console.log('[MODEL META] Loaded scaler.json dynamically.');
    } catch (e: any) {
      console.error('[MODEL META ERROR] Failed to load scaler.json:', e.message);
    }
  } else {
    console.log('[MODEL META] scaler.json not found, coordinate scaling disabled.');
  }
}

// Custom IO Handler to read the model directly from local disk safely in Pure JS mode
function localFileIO(jsonPath: string) {
    return {
        load: async () => {
            const modelJsonRaw = fs.readFileSync(jsonPath, 'utf8');
            const modelJson = JSON.parse(modelJsonRaw);

            // Keras 3 compatibility patch for TensorFlow.js InputLayer
            if (modelJson.modelTopology && modelJson.modelTopology.model_config) {
                const config = modelJson.modelTopology.model_config.config;
                if (config && Array.isArray(config.layers)) {
                    config.layers.forEach((layer: any) => {
                        if (layer.class_name === 'InputLayer' && layer.config) {
                            if (layer.config.batch_shape) {
                                layer.config.batch_input_shape = layer.config.batch_shape;
                                layer.config.batchInputShape = layer.config.batch_shape;
                            }
                        }
                    });
                }
            }

            // Keras 3 compatibility patch to strip 'sequential/' prefix from weight names
            if (modelJson.weightsManifest && Array.isArray(modelJson.weightsManifest)) {
                modelJson.weightsManifest.forEach((manifest: any) => {
                    if (manifest.weights && Array.isArray(manifest.weights)) {
                        manifest.weights.forEach((weight: any) => {
                            if (weight.name && weight.name.startsWith('sequential/')) {
                                weight.name = weight.name.substring('sequential/'.length);
                            }
                        });
                    }
                });
            }
            
            // Derive the weights path (.bin) based on the model.json location
            const modelDir = path.dirname(jsonPath);
            const weightPaths = modelJson.weightsManifest[0].paths.map((p: string) => 
                path.join(modelDir, p)
            );
            
            // Read binary weights into a combined buffer ArrayBuffer
            const weightBuffers = weightPaths.map((p: string) => fs.readFileSync(p));
            const combinedWeights = Buffer.concat(weightBuffers);

            return {
                modelTopology: modelJson.modelTopology,
                weightSpecs: modelJson.weightsManifest[0].weights,
                weightData: combinedWeights.buffer.slice(
                    combinedWeights.byteOffset, 
                    combinedWeights.byteOffset + combinedWeights.byteLength
                ) as ArrayBuffer
            };
        }
    };
}

async function startServer() {
    try {
        await loadModelMeta();
        const modelPath = path.join(currenDir, '..', 'model', 'model.json');
        model = await tf.loadLayersModel(localFileIO(modelPath));
        console.log('Model loaded successfully')

        initSocket(server);

        server.listen(PORT, () => {
            console.log(`Server is running on port ${PORT}`)
        })
    } catch (error) {
        console.error("Failed to start server:", error);
    }
}
startServer()