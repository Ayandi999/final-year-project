import cv2  # Import OpenCV for image processing
import numpy as np  # Import NumPy for numerical operations
import mediapipe as mp  # Import MediaPipe for hand detection
import os  # Import OS for file and folder operations
from concurrent.futures import ThreadPoolExecutor, as_completed  # For multithreading

# Import the MediaPipe Hands solution
mp_hands = mp.solutions.hands
    
# Initialize the Hands model
# static_image_mode=True → treat input as single images (not video stream)
# max_num_hands=2 → detect up to 2 hands
hands = mp_hands.Hands(static_image_mode=True, max_num_hands=2)


def crop_both_hands(image_path):
    """
    Reads an image, detects both hands using MediaPipe,
    crops the bounding box containing both hands, converts it to HSV color space,
    resizes to 128x128, and returns the processed image.
    Returns None if no hands are detected.
    """

    # Read the image from the given path
    image = cv2.imread(image_path)

    # If the image cannot be read (wrong path or invalid file), return None
    if image is None:
        return None

    # Convert the image from BGR (default in OpenCV) to RGB (required by MediaPipe)
    image_rgb = cv2.cvtColor(image, cv2.COLOR_BGR2RGB)

    # Detect hand landmarks using MediaPipe
    results = hands.process(image_rgb)

    # If no hand landmarks are detected, return None
    if not results.multi_hand_landmarks:
        return None

    # Get image dimensions (height, width, color channels)
    img_h, img_w, _ = image.shape

    # Lists to store all landmark pixel coordinates
    x_all, y_all = [], []

    # Loop through each detected hand
    for hand_landmarks in results.multi_hand_landmarks:
        # Loop through all 21 landmarks of the hand
        for lm in hand_landmarks.landmark:
            # Convert normalized coordinates (0-1) to pixel values
            x_all.append(int(lm.x * img_w))
            y_all.append(int(lm.y * img_h))

    # Define bounding box with padding (20px), ensuring it stays within image bounds
    x_min, x_max = max(min(x_all) - 20, 0), min(max(x_all) + 20, img_w)
    y_min, y_max = max(min(y_all) - 20, 0), min(max(y_all) + 20, img_h)

    # Crop the image around both hands
    hand_crop = image[y_min:y_max, x_min:x_max]

    # Resize the cropped HSV image to 128x128 pixels
    resized = cv2.resize(hand_crop, (128, 128))

    # Return the final processed image
    return resized


def copy_all_files(src_folder, dst_folder, front_name):
    """
    Processes all images in a given source folder.
    For each image:
        - Detects and crops hands using crop_both_hands()
        - Converts to HSV and resizes
        - Saves the processed image into destination folder
    The saved file names are prefixed with `front_name`.
    """

    # Check if source folder exists
    if not os.path.exists(src_folder):
        print(f"Source folder '{src_folder}' does not exist.")
        return

    # If destination folder does not exist, create it
    if not os.path.exists(dst_folder):
        os.makedirs(dst_folder)

    # Loop over all files in the source folder
    for filename in os.listdir(src_folder):
        # Build the complete source file path
        src_file = os.path.join(src_folder, filename)

        # Define the destination file path (prefix front_name)
        dst_file = os.path.join(dst_folder, front_name + " " + filename)

        # Crop hands from the image
        hand = crop_both_hands(src_file)

        # If hands detected, save the processed image
        if hand is not None:
            cv2.imwrite(dst_file, hand)


def copy_all_folders(src_main_folder, dst_main_folder, front_name):
    """
    Processes all subfolders inside a source main folder in parallel (multithreading).
    For each subfolder:
        - Calls copy_all_files() to process all images inside
        - Saves results in a corresponding subfolder in destination
    """

    # Check if main source folder exists
    if not os.path.exists(src_main_folder):
        print(f"Source folder '{src_main_folder}' does not exist.")
        return

    # If main destination folder does not exist, create it
    if not os.path.exists(dst_main_folder):
        os.makedirs(dst_main_folder)

    # Collect list of subfolders inside source main folder
    subfolders = [f for f in os.listdir(src_main_folder) if os.path.isdir(os.path.join(src_main_folder, f))]

    # Use ThreadPoolExecutor to process multiple subfolders in parallel
    with ThreadPoolExecutor() as executor:
        futures = []  # List to store async tasks

        # Submit each subfolder processing as a separate thread
        for foldername in subfolders:
            src_folder = os.path.join(src_main_folder, foldername)
            dst_folder = os.path.join(dst_main_folder, foldername)
            futures.append(executor.submit(copy_all_files, src_folder, dst_folder, front_name))

        # Wait for all threads to complete and check for errors
        for future in as_completed(futures):
            future.result()  # If any exception occurs inside, it will raise here


# ---------------- Run on datasets ---------------- #

src="D:/final_project/newDB/Static gestures of Indian Sign Language (ISL) for English Alphabet, Hindi Vowels and Numerals/ISL Images/1. Kids ISL images/Kids ISL images in Full Sleeves/English Alphabet"
dst="E:/Dipayan work/hsv_dataset"

copy_all_folders(src,dst,"kids full")

src="D:/final_project/newDB/Static gestures of Indian Sign Language (ISL) for English Alphabet, Hindi Vowels and Numerals/ISL Images/1. Kids ISL images/Kids ISL images in Half Sleeves/English Alphabet"

copy_all_folders(src,dst,"kids half")

src="D:/final_project/newDB/Static gestures of Indian Sign Language (ISL) for English Alphabet, Hindi Vowels and Numerals/ISL Images/2. Teenagers ISL Images/Teenagers ISL images in Full Sleeves/English Alphabet"

copy_all_folders(src,dst,"Teenagers full")

src="D:/final_project/newDB/Static gestures of Indian Sign Language (ISL) for English Alphabet, Hindi Vowels and Numerals/ISL Images/2. Teenagers ISL Images/Teenagers ISL images in Half Sleeves/English Alphabet"

copy_all_folders(src,dst,"Teenagers half")

src="D:/final_project/newDB/Static gestures of Indian Sign Language (ISL) for English Alphabet, Hindi Vowels and Numerals/ISL Images/3. Adults ISL Images/Adults ISL images in Full Sleeves/English Alphabet"

copy_all_folders(src,dst,"Adults full")

src="D:/final_project/newDB/Static gestures of Indian Sign Language (ISL) for English Alphabet, Hindi Vowels and Numerals/ISL Images/3. Adults ISL Images/Adults ISL images in Half Sleeves/English Alphabet"

copy_all_folders(src,dst,"Adults half")
