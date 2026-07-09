import os
import cv2
import pandas as pd
import mediapipe as mp

# =====================================================
# CONFIGURATION
# =====================================================
# The folder containing your 39 augmented subfolders
DATASET_DIR = r"C:\ML_Dataset\DATASET_AUGMENTED"

# Where you want to save the final structured CSV file
OUTPUT_CSV = r"C:\ML_Dataset\hand_landmarks.csv"

# =====================================================
# SETUP MODEL (Standard Import)
# =====================================================
mp_hands = mp.solutions.hands

# We set max_num_hands=2 to capture both single and double-hand signs
hands = mp_hands.Hands(
    static_image_mode=True, 
    max_num_hands=2, 
    min_detection_confidence=0.5
)

# =====================================================
# GENERATE CSV HEADERS Dynamically
# =====================================================
# 2 hands * 21 landmarks * 3 coordinates (x, y, z) = 126 features
headers = []
for hand_idx in ["left", "right"]:  
    for i in range(21):
        headers.extend([f"{hand_idx}_hand_joint_{i}_x", f"{hand_idx}_hand_joint_{i}_y", f"{hand_idx}_hand_joint_{i}_z"])
headers.append("label") 

# =====================================================
# EXTRACTION LOOP
# =====================================================
def extract_dataset_landmarks():
    data_rows = []
    
    if not os.path.exists(DATASET_DIR):
        print(f"Error: Dataset directory not found at {DATASET_DIR}")
        return

    classes = [d for d in os.listdir(DATASET_DIR) if os.path.isdir(os.path.join(DATASET_DIR, d))]
    print(f"Found {len(classes)} classes to process.\n")

    for class_idx, folder_name in enumerate(classes, 1):
        folder_path = os.path.join(DATASET_DIR, folder_name)
        image_files = [f for f in os.listdir(folder_path) if f.lower().endswith(('.png', '.jpg', '.jpeg'))]
        
        print(f"[{class_idx}/{len(classes)}] Extracting landmarks from '{folder_name}' ({len(image_files)} images)...")
        
        for img_name in image_files:
            img_path = os.path.join(folder_path, img_name)
            
            # Read image and convert to RGB (MediaPipe requirement)
            img = cv2.imread(img_path)
            if img is None:
                continue
            img_rgb = cv2.cvtColor(img, cv2.COLOR_BGR2RGB)
            
            # Process image via MediaPipe
            results = hands.process(img_rgb)
            
            # Temporary storage for coordinates of up to 2 detected hands
            img_features = []
            
            if results.multi_hand_landmarks:
                # Loop through detected hands (up to 2)
                for hand_landmarks in results.multi_hand_landmarks[:2]:
                    for landmark in hand_landmarks.landmark:
                        img_features.extend([landmark.x, landmark.y, landmark.z])
                
                # If only 1 hand was detected, pad the remaining 63 elements with 0.0
                if len(results.multi_hand_landmarks) == 1:
                    img_features.extend([0.0] * 63)
            else:
                # If no hands are detected at all, skip the image
                continue
                
            # Append the folder name as the classification label
            img_features.append(folder_name)
            data_rows.append(img_features)

    # =====================================================
    # SAVE DATA TO CSV
    # =====================================================
    print(f"\nProcessing complete! Saving landmarks to CSV...")
    df = pd.DataFrame(data_rows, columns=headers)
    df.to_csv(OUTPUT_CSV, index=False)
    print(f"Success! CSV file created at: {OUTPUT_CSV}")
    print(f"Total structured samples saved: {len(df)}")

if __name__ == "__main__":
    extract_dataset_landmarks()
    hands.close()