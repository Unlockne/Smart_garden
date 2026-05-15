"""
Smart Garden – Plant Classifier Training Script
================================================
Transfer Learning with MobileNetV2 for 3-class plant classification.

Usage:
    python ml/train_plant_classifier.py

Expected dataset structure:
    ml/datasets/train/{Succulents, FloweringPlant, LeafyPlant}/
    ml/datasets/val/{Succulents, FloweringPlant, LeafyPlant}/

Output:
    ml/models/plant_classifier.keras
    ml/models/labels.json  (already created, verified at runtime)
    ml/models/training_history.png
"""

import json
import os
import sys

import matplotlib

matplotlib.use("Agg")  
import matplotlib.pyplot as plt
import numpy as np
import tensorflow as tf
from tensorflow import keras
from tensorflow.keras import layers

# ──────────────────────────────────────────────
# 1.  CONFIG
# ──────────────────────────────────────────────
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DATASET_DIR = os.path.join(BASE_DIR, "datasets")
TRAIN_DIR = os.path.join(DATASET_DIR, "train")
VAL_DIR = os.path.join(DATASET_DIR, "val")
MODEL_DIR = os.path.join(BASE_DIR, "models")
LABELS_PATH = os.path.join(MODEL_DIR, "labels.json")
MODEL_SAVE_PATH = os.path.join(MODEL_DIR, "plant_classifier.keras")
HISTORY_IMG_PATH = os.path.join(MODEL_DIR, "training_history.png")

IMG_SIZE = (224, 224)
BATCH_SIZE = 32
INITIAL_EPOCHS = 15        # Phase 1: train head only
FINE_TUNE_EPOCHS = 10      # Phase 2: unfreeze top layers
FINE_TUNE_AT = 100         # Layer index from which to unfreeze in MobileNetV2
INITIAL_LR = 1e-3
FINE_TUNE_LR = 1e-5


def verify_dataset():
    """Check that the dataset directories exist and contain at least some images."""
    for split_name, split_dir in [("train", TRAIN_DIR), ("val", VAL_DIR)]:
        if not os.path.isdir(split_dir):
            print(f"[ERROR] Missing {split_name} directory: {split_dir}")
            print("Please create the dataset following ml/datasets/README.md")
            sys.exit(1)
        class_dirs = [
            d for d in os.listdir(split_dir)
            if os.path.isdir(os.path.join(split_dir, d))
        ]
        if len(class_dirs) == 0:
            print(f"[ERROR] No class sub-folders in {split_dir}")
            sys.exit(1)
        print(f"[OK] {split_name}: found {len(class_dirs)} classes → {class_dirs}")


# ──────────────────────────────────────────────
# 2.  DATA LOADING
# ──────────────────────────────────────────────
def load_datasets():
    """Load train & val datasets using keras.utils.image_dataset_from_directory."""
    train_ds = keras.utils.image_dataset_from_directory(
        TRAIN_DIR,
        image_size=IMG_SIZE,
        batch_size=BATCH_SIZE,
        label_mode="categorical",
        shuffle=True,
        seed=42,
    )
    val_ds = keras.utils.image_dataset_from_directory(
        VAL_DIR,
        image_size=IMG_SIZE,
        batch_size=BATCH_SIZE,
        label_mode="categorical",
        shuffle=False,
    )
    class_names = train_ds.class_names
    num_classes = len(class_names)
    print(f"[INFO] Classes detected: {class_names} ({num_classes} classes)")

    # Performance: prefetch
    AUTOTUNE = tf.data.AUTOTUNE
    train_ds = train_ds.prefetch(buffer_size=AUTOTUNE)
    val_ds = val_ds.prefetch(buffer_size=AUTOTUNE)

    return train_ds, val_ds, class_names, num_classes


# ──────────────────────────────────────────────
# 3.  DATA AUGMENTATION
# ──────────────────────────────────────────────
def build_augmentation():
    """Light augmentation to improve generalisation on small datasets."""
    return keras.Sequential(
        [
            layers.RandomFlip("horizontal_and_vertical"),
            layers.RandomRotation(0.25),
            layers.RandomZoom(0.2),
            layers.RandomContrast(0.2),
            layers.RandomBrightness(0.2),
        ],
        name="data_augmentation",
    )


# ──────────────────────────────────────────────
# 4.  MODEL BUILDING
# ──────────────────────────────────────────────
def build_model(num_classes: int):
    """
    Build a MobileNetV2-based classifier.

    Architecture:
        Input (224×224×3)
        → Data Augmentation
        → MobileNetV2 Preprocessing
        → MobileNetV2 (frozen base)
        → GlobalAveragePooling2D
        → Dense(128, relu)
        → Dropout(0.3)
        → Dense(num_classes, softmax)
    """
    # --- Input ---
    inputs = keras.Input(shape=(*IMG_SIZE, 3), name="input_image")

    # --- Augmentation ---
    x = build_augmentation()(inputs)

    # --- Preprocessing (MobileNetV2 expects [-1, 1]) ---
    x = layers.Rescaling(scale=1.0/127.5, offset=-1.0, name="mobilenet_preprocess")(x)

    # --- Base model (frozen) ---
    base_model = keras.applications.MobileNetV2(
        input_shape=(*IMG_SIZE, 3),
        include_top=False,
        weights="imagenet",
    )
    base_model.trainable = False

    x = base_model(x, training=False)

    # --- Classification head ---
    x = layers.GlobalAveragePooling2D(name="gap")(x)
    x = layers.Dense(128, activation="relu", name="dense_head")(x)
    x = layers.Dropout(0.5, name="dropout_head")(x)
    outputs = layers.Dense(num_classes, activation="softmax", name="predictions")(x)

    model = keras.Model(inputs, outputs, name="plant_classifier")
    return model, base_model


# ──────────────────────────────────────────────
# 5.  TRAINING
# ──────────────────────────────────────────────
def train_phase1(model, train_ds, val_ds):
    """Phase 1 – Train classification head only (base frozen)."""
    print("\n" + "=" * 60)
    print("PHASE 1: Training classification head (base frozen)")
    print("=" * 60)

    model.compile(
        optimizer=keras.optimizers.Adam(learning_rate=INITIAL_LR),
        loss="categorical_crossentropy",
        metrics=["accuracy"],
    )
    model.summary()

    history = model.fit(
        train_ds,
        validation_data=val_ds,
        epochs=INITIAL_EPOCHS,
        callbacks=[
            keras.callbacks.EarlyStopping(
                monitor="val_accuracy", patience=5, restore_best_weights=True
            ),
        ],
    )
    return history


def train_phase2(model, base_model, train_ds, val_ds, initial_history):
    """Phase 2 – Unfreeze top layers of base model for fine-tuning."""
    print("\n" + "=" * 60)
    print(f"PHASE 2: Fine-tuning (unfreezing from layer {FINE_TUNE_AT})")
    print("=" * 60)

    base_model.trainable = True
    for layer in base_model.layers[:FINE_TUNE_AT]:
        layer.trainable = False

    model.compile(
        optimizer=keras.optimizers.Adam(learning_rate=FINE_TUNE_LR),
        loss="categorical_crossentropy",
        metrics=["accuracy"],
    )

    total_epochs = INITIAL_EPOCHS + FINE_TUNE_EPOCHS
    history_fine = model.fit(
        train_ds,
        validation_data=val_ds,
        initial_epoch=len(initial_history.history["accuracy"]),
        epochs=total_epochs,
        callbacks=[
            keras.callbacks.EarlyStopping(
                monitor="val_accuracy", patience=5, restore_best_weights=True
            ),
        ],
    )
    return history_fine


# ──────────────────────────────────────────────
# 6.  EVALUATION & SAVING
# ──────────────────────────────────────────────
def evaluate_and_save(model, val_ds, class_names, hist1, hist2):
    """Evaluate model, save model & training curves."""
    print("\n" + "=" * 60)
    print("EVALUATION")
    print("=" * 60)
    loss, acc = model.evaluate(val_ds)
    print(f"Validation accuracy: {acc:.4f}")
    print(f"Validation loss:     {loss:.4f}")

    # --- Save model ---
    os.makedirs(MODEL_DIR, exist_ok=True)
    model.save(MODEL_SAVE_PATH)
    print(f"[SAVED] Model → {MODEL_SAVE_PATH}")

    # --- Update labels.json with detected class order ---
    labels = {
        "index_to_name": {str(i): name for i, name in enumerate(class_names)},
        "name_to_group": {
            "Succulents": "succulent",
            "FloweringPlant": "flowering",
            "LeafyPlant": "leafy_ornamental",
        },
        "class_names": class_names,
        "num_classes": len(class_names),
        "input_size": list(IMG_SIZE),
        "description": "3-class plant classifier for Smart Garden MVP.",
    }
    with open(LABELS_PATH, "w", encoding="utf-8") as f:
        json.dump(labels, f, indent=2, ensure_ascii=False)
    print(f"[SAVED] Labels → {LABELS_PATH}")

    # --- Plot training curves ---
    phase1_actual_epochs = len(hist1.history["accuracy"])
    _plot_history(hist1, hist2, phase1_actual_epochs)

    return acc, loss


def _plot_history(hist1, hist2, phase1_epochs: int):
    """Plot and save accuracy / loss curves."""
    acc = hist1.history["accuracy"] + hist2.history.get("accuracy", [])
    val_acc = hist1.history["val_accuracy"] + hist2.history.get("val_accuracy", [])
    loss = hist1.history["loss"] + hist2.history.get("loss", [])
    val_loss = hist1.history["val_loss"] + hist2.history.get("val_loss", [])

    epochs_range = range(1, len(acc) + 1)
    fig, (ax1, ax2) = plt.subplots(1, 2, figsize=(14, 5))

    ax1.plot(epochs_range, acc, label="Train Accuracy")
    ax1.plot(epochs_range, val_acc, label="Val Accuracy")
    ax1.axvline(x=phase1_epochs, color="gray", linestyle="--", label="Fine-tune start")
    ax1.set_title("Accuracy")
    ax1.set_xlabel("Epoch")
    ax1.legend()
    ax1.grid(True, alpha=0.3)

    ax2.plot(epochs_range, loss, label="Train Loss")
    ax2.plot(epochs_range, val_loss, label="Val Loss")
    ax2.axvline(x=phase1_epochs, color="gray", linestyle="--", label="Fine-tune start")
    ax2.set_title("Loss")
    ax2.set_xlabel("Epoch")
    ax2.legend()
    ax2.grid(True, alpha=0.3)

    plt.tight_layout()
    plt.savefig(HISTORY_IMG_PATH, dpi=150)
    plt.close()
    print(f"[SAVED] Training curves → {HISTORY_IMG_PATH}")


# ──────────────────────────────────────────────
# 7.  MAIN
# ──────────────────────────────────────────────
def main():
    print("=" * 60)
    print("Smart Garden – Plant Classifier Training")
    print("Model: MobileNetV2 (Transfer Learning)")
    print(f"TensorFlow {tf.__version__}")
    print("=" * 60)

    # Check GPU
    gpus = tf.config.list_physical_devices("GPU")
    print(f"[INFO] GPUs available: {len(gpus)}")
    if gpus:
        for gpu in gpus:
            print(f"       → {gpu}")

    # Verify dataset
    verify_dataset()

    # Load data
    train_ds, val_ds, class_names, num_classes = load_datasets()

    # Build model
    model, base_model = build_model(num_classes)

    # Phase 1: Train head
    hist1 = train_phase1(model, train_ds, val_ds)

    # Phase 2: Fine-tune
    hist2 = train_phase2(model, base_model, train_ds, val_ds, hist1)

    # Evaluate & save
    acc, loss = evaluate_and_save(model, val_ds, class_names, hist1, hist2)

    print("\n" + "=" * 60)
    print("TRAINING COMPLETE")
    print(f"  Final val accuracy: {acc:.4f}")
    print(f"  Model saved to:     {MODEL_SAVE_PATH}")
    print(f"  Labels saved to:    {LABELS_PATH}")
    print("=" * 60)


if __name__ == "__main__":
    main()
