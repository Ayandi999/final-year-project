import os
import datetime
import json
from collections import Counter
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

        # Log incoming JSON coordinates to logs/input_coordinates.jsonl
        try:
            log_dir = os.path.join(BASE_DIR, "logs")
            os.makedirs(log_dir, exist_ok=True)
            input_log_path = os.path.join(log_dir, "input_coordinates.jsonl")
            with open(input_log_path, "a", encoding="utf-8") as f:
                log_entry = {
                    "timestamp": datetime.datetime.now().isoformat(),
                    "frames_count": len(frames),
                    "frames": frames
                }
                f.write(json.dumps(log_entry) + "\n")
        except Exception:
            pass

        # 2. Scale preprocessing using NumPy
        frames_np = np.array(frames, dtype=np.float32)  # (1, 5, 126) or (5, 126)
        if scaler is not None and "mean" in scaler and "scale" in scaler:
            mean = np.array(scaler["mean"], dtype=np.float32)
            scale = np.array(scaler["scale"], dtype=np.float32)
            if frames_np.shape[-1] == mean.shape[-1] and frames_np.shape[-1] == scale.shape[-1]:
                safe_scale = np.where(scale == 0, 1.0, scale)
                frames_np = (frames_np - mean) / safe_scale

        # Flatten to 2D regardless of batch dimensions
        if frames_np.ndim == 3:
            frames_np = frames_np.reshape(-1, 126)

        # 3. Model Inference (Direct call for low-overhead real-time prediction)
        predictions_tensor = model(frames_np, training=False)
        if hasattr(predictions_tensor, "numpy"):
            predictions_np = predictions_tensor.numpy()
        elif hasattr(predictions_tensor, "cpu"):
            predictions_np = predictions_tensor.cpu().detach().numpy()
        else:
            predictions_np = np.array(predictions_tensor)
            
        # 4. Map outputs using labels.json and majority agreement
        words = []
        threshold = 0.75
        
        # predictions_np shape: (num_frames, num_classes)
        for i, frame_preds in enumerate(predictions_np):
            best_idx = int(np.argmax(frame_preds))
            max_score = float(frame_preds[best_idx])
            word = labels.get(str(best_idx), "unknown")
            
            if max_score > threshold:
                if word and word != "unknown":
                    words.append(word)
                    
        # Majority agreement check: require at least 3 frames out of 5 to agree
        result_words = []
        if words:
            if len(predictions_np) == 1:
                result_words = words
            else:
                most_common = Counter(words).most_common(1)[0]
                word_name, agree_count = most_common
                if agree_count >= 3:  # At least 3 frames agree
                    result_words = [word_name]

        # Log predictions to logs/predictions.jsonl
        try:
            log_dir = os.path.join(BASE_DIR, "logs")
            os.makedirs(log_dir, exist_ok=True)
            prediction_log_path = os.path.join(log_dir, "predictions.jsonl")
            with open(prediction_log_path, "a", encoding="utf-8") as f:
                frame_logs = []
                for i, frame_preds in enumerate(predictions_np):
                    best_idx = int(np.argmax(frame_preds))
                    max_score = float(frame_preds[best_idx])
                    word = labels.get(str(best_idx), "unknown")
                    frame_logs.append({
                        "frame_index": i,
                        "class_index": best_idx,
                        "word": word,
                        "confidence": max_score
                    })
                
                log_entry = {
                    "timestamp": datetime.datetime.now().isoformat(),
                    "frames_predicted": frame_logs,
                    "result_words": result_words
                }
                f.write(json.dumps(log_entry) + "\n")
        except Exception:
            pass
                    
        return JsonResponse({
            "success": True,
            "data": result_words
        })
        
    except Exception as e:
        return JsonResponse({"success": False, "error": str(e)}, status=500)
