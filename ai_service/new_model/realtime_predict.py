import cv2
import numpy as np
import mediapipe as mp
import joblib
import tensorflow as tf
from collections import deque

# ==================================================
# LOAD TFLITE MODEL & PREPROCESSORS
# ==================================================
print("Loading TFLite Model...")
interpreter = tf.lite.Interpreter(model_path="final_isl_model.tflite")
interpreter.allocate_tensors()

input_details = interpreter.get_input_details()
output_details = interpreter.get_output_details()

print("Loading Scaler and Encoder...")
scaler = joblib.load("scaler.pkl")
label_encoder = joblib.load("label_encoder.pkl")

# ==================================================
# INITIALIZE MEDIAPIPE
# ==================================================
mp_hands = mp.solutions.hands
mp_draw = mp.solutions.drawing_utils

hands = mp_hands.Hands(
    static_image_mode=False,
    max_num_hands=2,
    min_detection_confidence=0.7,
    min_tracking_confidence=0.7
)

# ==================================================
# SMOOTHING BUFFER
# ==================================================
# Stores the last 10 predictions to prevent text flickering
predictions = deque(maxlen=10)

# ==================================================
# START WEBCAM
# ==================================================
cap = cv2.VideoCapture(0)
print("Webcam initialized. Press ESC to exit.")

while True:
    success, frame = cap.read()
    if not success:
        print("Ignoring empty camera frame.")
        continue

    # Flip the frame horizontally for a selfie-view display
    frame = cv2.flip(frame, 1)
    rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
    
    # Process the frame to find hands
    results = hands.process(rgb)

    if results.multi_hand_landmarks:
        row = []
        
        # Extract coordinates for up to 2 hands
        for hand_landmarks in results.multi_hand_landmarks[:2]:
            for lm in hand_landmarks.landmark:
                row.extend([lm.x, lm.y, lm.z])

        # Pad with zeros if only one hand is detected (to reach 126 features)
        while len(row) < 126:
            row.append(0.0)
        row = row[:126]

        # Prepare the data array
        X = np.array(row, dtype=np.float32).reshape(1, -1)
        X = scaler.transform(X).astype(np.float32)

        # ==================================================
        # TFLITE INFERENCE
        # ==================================================
        interpreter.set_tensor(input_details[0]['index'], X)
        interpreter.invoke()
        probs = interpreter.get_tensor(output_details[0]['index'])[0]

        class_id = np.argmax(probs)
        confidence = probs[class_id]
        label = label_encoder.inverse_transform([class_id])[0]

        # Add to rolling buffer for majority voting
        predictions.append(label)
        smooth_label = max(set(predictions), key=predictions.count)

        # Draw the hand skeleton on the frame
        for hand_landmarks in results.multi_hand_landmarks:
            mp_draw.draw_landmarks(
                frame,
                hand_landmarks,
                mp_hands.HAND_CONNECTIONS
            )

        # ==================================================
        # DISPLAY RESULTS
        # ==================================================
        if confidence > 0.85: # Require 85% confidence to display
            cv2.putText(
                frame,
                f"{smooth_label} ({confidence*100:.1f}%)",
                (20, 50),
                cv2.FONT_HERSHEY_SIMPLEX,
                1.2,
                (0, 255, 0),
                3
            )
        else:
            cv2.putText(
                frame,
                "Sign not recognized",
                (20, 50),
                cv2.FONT_HERSHEY_SIMPLEX,
                1,
                (0, 165, 255),
                2
            )

    # Show the video feed
    cv2.imshow("ISL Real-Time Translation", frame)

    # Press ESC to cleanly exit
    if cv2.waitKey(1) == 27:
        break

# Clean up
cap.release()
cv2.destroyAllWindows()