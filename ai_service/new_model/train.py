import pandas as pd
import numpy as np
import joblib
import tensorflow as tf

# =====================================================
# GPU ACCELERATION CHECK (DirectML / TF 2.10)
# =====================================================
gpus = tf.config.list_physical_devices('GPU')
if gpus:
    try:
        for gpu in gpus:
            tf.config.experimental.set_memory_growth(gpu, True)
        print(f"\n========================================")
        print(f"✅ NVIDIA GPU DETECTED & ENGAGED!")
        print(f"Hardware: {gpus[0].name}")
        print(f"========================================\n")
    except RuntimeError as e:
        print(e)
else:
    print("\n⚠️ No GPU detected. Falling back to CPU.\n")

from sklearn.model_selection import train_test_split
from sklearn.preprocessing import LabelEncoder, StandardScaler
from sklearn.utils.class_weight import compute_class_weight
from sklearn.metrics import classification_report

from tensorflow.keras.models import Model
from tensorflow.keras.layers import Dense, Dropout, BatchNormalization, Input, Add
from tensorflow.keras.callbacks import EarlyStopping, ReduceLROnPlateau, ModelCheckpoint
from tensorflow.keras.optimizers import Adam
from tensorflow.keras.losses import CategoricalCrossentropy
from tensorflow.keras.utils import to_categorical

# =====================================================
# LOAD & PREPARE DATA
# =====================================================
print("Loading dataset...")
df = pd.read_csv("isl_landmarks_clean.csv")

X = df.iloc[:, :-1].values
y = df.iloc[:, -1].values

print(f"Dataset Shape: {X.shape}")

# Encode Labels
encoder = LabelEncoder()
y_encoded = encoder.fit_transform(y)
joblib.dump(encoder, "label_encoder.pkl")
num_classes = len(np.unique(y_encoded))

# Scale Features
scaler = StandardScaler()
X = scaler.fit_transform(X)
joblib.dump(scaler, "scaler.pkl")

# Generate Balanced Class Weights
weights = compute_class_weight(
    class_weight="balanced",
    classes=np.unique(y_encoded),
    y=y_encoded
)
class_weights = dict(enumerate(weights))

# Train / Test Split
y_cat = to_categorical(y_encoded)
X_train, X_test, y_train, y_test = train_test_split(
    X, y_cat, test_size=0.20, random_state=42, stratify=y_encoded
)

print(f"Train Samples: {len(X_train)} | Test Samples: {len(X_test)}")

# =====================================================
# THE ULTIMATE RESIDUAL MLP (Swish Edition)
# =====================================================
inputs = Input(shape=(126,))

# --- BLOCK 1: Massive Feature Extraction (512) ---
x1 = Dense(512, activation="swish")(inputs)
x1 = BatchNormalization()(x1)
x1 = Dropout(0.30)(x1)

x2 = Dense(512, activation="swish")(x1)
x2 = BatchNormalization()(x2)
x2 = Dropout(0.30)(x2)

# Skip Connection 1
res1 = Add()([x1, x2])

# --- BLOCK 2: Geometric Compression (256) ---
x3 = Dense(256, activation="swish")(res1)
x3 = BatchNormalization()(x3)
x3 = Dropout(0.25)(x3)

x4 = Dense(256, activation="swish")(x3)
x4 = BatchNormalization()(x4)
x4 = Dropout(0.25)(x4)

# Skip Connection 2
res2 = Add()([x3, x4])

# --- BLOCK 3: Final Pattern Recognition (128) ---
x5 = Dense(128, activation="swish")(res2)
x5 = BatchNormalization()(x5)
x5 = Dropout(0.20)(x5)

# --- OUTPUT LAYER ---
outputs = Dense(num_classes, activation="softmax")(x5)

model = Model(inputs=inputs, outputs=outputs)

# =====================================================
# COMPILE
# =====================================================
model.compile(
    optimizer=Adam(learning_rate=0.001),
    loss=CategoricalCrossentropy(label_smoothing=0.1),
    metrics=["accuracy"]
)
model.summary()

# =====================================================
# CALLBACKS (The Safety Net)
# =====================================================
callbacks = [
    EarlyStopping(
        monitor="val_loss",
        patience=15,
        restore_best_weights=True,
        verbose=1
    ),
    ReduceLROnPlateau(
        monitor="val_loss",
        factor=0.5,
        patience=4,
        min_lr=1e-6,
        verbose=1
    ),
    ModelCheckpoint(
        "best_isl_model.keras",
        monitor="val_accuracy",
        save_best_only=True,
        verbose=1
    )
]

# =====================================================
# COMMENCE GPU TRAINING
# =====================================================
print("\nIgniting Training Sequence...\n")
history = model.fit(
    X_train,
    y_train,
    validation_split=0.20,
    epochs=150,
    batch_size=64, 
    class_weight=class_weights,
    callbacks=callbacks,
    verbose=1
)

# =====================================================
# FINAL EVALUATION
# =====================================================
print("\nEvaluating Best Weights on Test Data...\n")
loss, acc = model.evaluate(X_test, y_test, verbose=1)
print(f"\n========================================")
print(f"🔥 FINAL TEST ACCURACY: {acc*100:.2f}%")
print(f"========================================\n")

print("\nDetailed Classification Report:")
y_pred = model.predict(X_test)
y_pred_classes = np.argmax(y_pred, axis=1)
y_true_classes = np.argmax(y_test, axis=1)
print(classification_report(y_true_classes, y_pred_classes, target_names=encoder.classes_))

# =====================================================
# EXPORT PIPELINE
# =====================================================
model.save("final_isl_model.keras")

converter = tf.lite.TFLiteConverter.from_keras_model(model)
tflite_model = converter.convert()
with open("final_isl_model.tflite", "wb") as f:
    f.write(tflite_model)

print("\nSystem Offline. All assets successfully saved.")