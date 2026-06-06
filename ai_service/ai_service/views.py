import os
import json
import numpy as np
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from rest_framework.decorators import api_view
import tensorflow as tf
import keras
import h5py

# Disable TensorFlow logs
os.environ['TF_CPP_MIN_LOG_LEVEL'] = '3'

# Resolve paths
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
MODEL_DIR = os.path.join(BASE_DIR, 'model')

model_path = os.path.join(MODEL_DIR, "model.keras")
config_path = os.path.join(MODEL_DIR, "config.json")
weights_path = os.path.join(MODEL_DIR, "model.weights.h5")
labels_path = os.path.join(MODEL_DIR, "labels.json")
scaler_path = os.path.join(MODEL_DIR, "scaler.json")

# Global variables for model metadata
model = None
labels = {}
scaler = None

def load_model_and_metadata():
    global model, labels, scaler
    
    # 1. Load Labels
    if os.path.exists(labels_path):
        try:
            with open(labels_path, 'r', encoding='utf-8') as f:
                labels = json.load(f)
            print(f"[MODEL INIT] Loaded {len(labels)} labels dynamically.")
        except Exception as e:
            print(f"[MODEL INIT ERROR] Failed to load labels.json: {e}")
            
    # 2. Load Scaler
    if os.path.exists(scaler_path):
        try:
            with open(scaler_path, 'r', encoding='utf-8') as f:
                scaler = json.load(f)
            print("[MODEL INIT] Loaded scaler.json dynamically.")
        except Exception as e:
            print(f"[MODEL INIT ERROR] Failed to load scaler.json: {e}")
            
    # 3. Load Model (Version-agnostic Keras 2 / 3 fallback with manual H5 mapping)
    is_keras3 = keras.__version__.startswith('3')
    print(f"[MODEL INIT] Keras version: {keras.__version__} (Keras 3: {is_keras3})")
    
    if is_keras3:
        try:
            if os.path.exists(model_path):
                model = keras.models.load_model(model_path)
                print(f"[MODEL INIT] Loaded unified Keras 3 model from {model_path}")
            elif os.path.exists(config_path) and os.path.exists(weights_path):
                with open(config_path, 'r', encoding='utf-8') as f:
                    config = json.load(f)
                model = keras.saving.deserialize_keras_object(config)
                model.load_weights(weights_path)
                print(f"[MODEL INIT] Loaded Keras 3 model config and weights successfully.")
        except Exception as e:
            print(f"[MODEL INIT ERROR] Keras 3 loader failed: {e}")
    else:
        try:
            if os.path.exists(model_path):
                model = tf.keras.models.load_model(model_path)
                print(f"[MODEL INIT] Loaded Keras 2 model from {model_path}")
            elif os.path.exists(config_path) and os.path.exists(weights_path):
                with open(config_path, 'r', encoding='utf-8') as f:
                    config = json.load(f)
                
                # Patch config for Keras 2 compatibility
                layers = config.get('config', {}).get('layers', [])
                for layer in layers:
                    if 'config' in layer:
                        if 'batch_shape' in layer['config']:
                            layer['config']['batch_input_shape'] = layer['config'].pop('batch_shape')
                        if isinstance(layer['config'].get('dtype'), dict):
                            layer['config']['dtype'] = layer['config']['dtype'].get('config', {}).get('name', 'float32')
                
                if isinstance(config.get('config', {}).get('dtype'), dict):
                    config['config']['dtype'] = config['config']['dtype'].get('config', {}).get('name', 'float32')
                
                # Reconstruct sequential structure
                model = tf.keras.Sequential.from_config(config['config'])
                
                # Manually map Keras 3 variable group datasets to Keras 2 layer weights
                with h5py.File(weights_path, 'r') as h5f:
                    if 'layers' not in h5f:
                        raise KeyError("No 'layers' group found in weights file")
                    layers_group = h5f['layers']
                    for layer in model.layers:
                        layer_name = layer.name
                        if layer_name in layers_group:
                            group = layers_group[layer_name]
                            if 'vars' in group:
                                vars_group = group['vars']
                                var_keys = sorted(vars_group.keys(), key=int)
                                weights = [vars_group[vk][:] for vk in var_keys]
                                if weights:
                                    layer.set_weights(weights)
                print("[MODEL INIT] Loaded Keras 3 model into Keras 2 and mapped weights successfully!")
        except Exception as e:
            print(f"[MODEL INIT ERROR] Legacy TensorFlow loader failed: {e}")

# Initial load
load_model_and_metadata()

@csrf_exempt
@api_view(['POST'])
def predict(request):
    if model is None:
        return JsonResponse({"success": False, "error": "Model not loaded"}, status=503)
        
    try:
        # 1. Parse payload
        frames = request.data.get('frames', [])
        if not frames:
            return JsonResponse({"success": False, "error": "No frames provided"}, status=400)
            
        # If it is a 1D flat array (a single frame), convert it to a 2D array [frames]
        if isinstance(frames, list) and len(frames) > 0 and not isinstance(frames[0], list):
            frames = [frames]
            
        # Write received JSON input payload to a debug file for logging
        try:
            debug_file_path = os.path.join(BASE_DIR, "debug_input.json")
            with open(debug_file_path, "w", encoding="utf-8") as df:
                json.dump({"frames": frames}, df)
        except Exception as e:
            print(f"[DEBUG LOG ERROR] Failed to write debug input file: {e}")

        # 2. Scale preprocessing using NumPy
        frames_np = np.array(frames, dtype=np.float32)
        if scaler is not None and "mean" in scaler and "scale" in scaler:
            mean = np.array(scaler["mean"], dtype=np.float32)
            scale = np.array(scaler["scale"], dtype=np.float32)
            if frames_np.shape[-1] == mean.shape[-1] and frames_np.shape[-1] == scale.shape[-1]:
                safe_scale = np.where(scale == 0, 1.0, scale)
                frames_np = (frames_np - mean) / safe_scale
                
        # 3. Model Inference
        predictions = model.predict(frames_np, verbose=0)
        
        # Convert prediction back to numpy array in case it is a PyTorch tensor
        if hasattr(predictions, "numpy"):
            predictions_np = predictions.numpy()
        elif hasattr(predictions, "cpu"):
            predictions_np = predictions.cpu().detach().numpy()
        else:
            predictions_np = np.array(predictions)
            
        # 4. Map outputs using labels.json and thresholding (exactly as Node.js did)
        best_word = None
        highest_conf = 0.0
        threshold = 0.55
        
        # predictions_np shape: (num_frames, num_classes)
        print(f"\n[INFERENCE] Input shape: {frames_np.shape}")
        for i, frame_preds in enumerate(predictions_np):
            best_idx = int(np.argmax(frame_preds))
            max_score = float(frame_preds[best_idx])
            word = labels.get(str(best_idx), "unknown")
            print(f"  Frame {i}: Prediction='{word}' (Class {best_idx}), Confidence={max_score:.4f}")
            
            if max_score > threshold:
                if word and word != "unknown":
                    if max_score > highest_conf:
                        highest_conf = max_score
                        best_word = word
                    
        result_words = [best_word] if best_word is not None else []
        print(f"[INFERENCE RESULT] Output Word (Highest Conf): {result_words} (Confidence: {highest_conf:.4f})")
                    
        return JsonResponse({
            "success": True,
            "data": result_words
        })
        
    except Exception as e:
        print(f"[PREDICT ERROR] {e}")
        return JsonResponse({"success": False, "error": str(e)}, status=500)
