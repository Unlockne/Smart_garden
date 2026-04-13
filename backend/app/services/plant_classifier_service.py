"""Load Keras plant classifier và inference ảnh (theo ml/BACKEND.md)."""

from __future__ import annotations

import json
import os
from io import BytesIO
from pathlib import Path
from typing import Any

# Giảm log TensorFlow trước khi import
os.environ.setdefault("TF_CPP_MIN_LOG_LEVEL", "2")

_model: Any = None
_labels_info: dict[str, Any] | None = None
_load_error: str | None = None


def ml_runtime_status(*, model_path: str, labels_path: str, enabled: bool) -> dict[str, Any]:
    """Trả về trạng thái ML cho /health (không load nặng nếu tắt)."""
    if not enabled:
        return {"enabled": False, "ready": False, "error": None, "model_path": model_path}
    mp = Path(model_path)
    lp = Path(labels_path)
    if not mp.is_file():
        return {"enabled": True, "ready": False, "error": f"Missing model file: {mp}", "model_path": str(mp)}
    if not lp.is_file():
        return {"enabled": True, "ready": False, "error": f"Missing labels file: {lp}", "model_path": str(mp)}
    if _load_error:
        return {"enabled": True, "ready": False, "error": _load_error, "model_path": str(mp)}
    global _model
    if _model is not None:
        return {"enabled": True, "ready": True, "error": None, "model_path": str(mp)}
    return {"enabled": True, "ready": False, "error": None, "model_path": str(mp)}


def _ensure_loaded(model_path: str, labels_path: str) -> None:
    global _model, _labels_info, _load_error
    if _load_error:
        raise RuntimeError(_load_error)
    if _model is not None and _labels_info is not None:
        return

    mp = Path(model_path)
    lp = Path(labels_path)
    if not mp.is_file():
        raise FileNotFoundError(f"Không tìm thấy model: {mp}")
    if not lp.is_file():
        raise FileNotFoundError(f"Không tìm thấy labels: {lp}")

    try:
        from tensorflow import keras
    except ImportError as e:
        _load_error = f"TensorFlow chưa được cài đặt: {e}"
        raise RuntimeError(_load_error) from e

    try:
        _model = keras.models.load_model(str(mp))
        with open(lp, "r", encoding="utf-8") as f:
            _labels_info = json.load(f)
    except Exception as e:
        _load_error = str(e)
        _model = None
        _labels_info = None
        raise RuntimeError(f"Không load được model: {e}") from e


def predict_image(image_bytes: bytes, *, model_path: str, labels_path: str) -> dict[str, Any]:
    """
    Trả về dict: predicted_plant, plant_group, confidence, all_probabilities
    (class names theo labels.json).
    """
    _ensure_loaded(model_path, labels_path)
    assert _model is not None and _labels_info is not None

    import numpy as np
    from PIL import Image, ImageOps
    from tensorflow import keras

    labels = _labels_info
    class_names: list[str] = labels["class_names"]
    name_to_group: dict[str, str] = labels.get("name_to_group", {})
    input_size = labels.get("input_size", [224, 224])
    img_size = (int(input_size[0]), int(input_size[1]))

    img = Image.open(BytesIO(image_bytes)).convert("RGB")
    img = ImageOps.fit(img, img_size, Image.Resampling.LANCZOS)
    img_array = keras.utils.img_to_array(img)
    img_batch = np.expand_dims(img_array, axis=0)

    preds = _model.predict(img_batch, verbose=0)[0]
    top_idx = int(np.argmax(preds))
    predicted_plant = class_names[top_idx]
    confidence = float(preds[top_idx])
    plant_group = name_to_group.get(predicted_plant, "unknown")
    all_probs = {name: float(preds[i]) for i, name in enumerate(class_names)}

    return {
        "predicted_plant": predicted_plant,
        "plant_group": plant_group,
        "confidence": round(confidence, 4),
        "all_probabilities": {k: round(v, 4) for k, v in all_probs.items()},
    }
