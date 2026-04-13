## 1. Yêu cầu hệ thống và Thư viện định tuyến
Môi trường backend cần cài đặt các thư viện sau để có thể load và predict qua Keras/TensorFlow:
```bash
pip install ml/requirements.txt
```

## 2. Các File 

- **`models/plant_classifier.keras`**: Trọng số mô hình đã được fine-tuned.
- **`models/labels.json`**: File map giúp chuyển đổi index kết quả dự đoán của model sang chuỗi (class names & category).


## 3. Code ví dụ để gọi model và xử lý ảnh



```python
import os
import json
import numpy as np
from io import BytesIO
from PIL import Image

# 1. Ẩn bớt warning logs không cần thiết của TensorFlow
os.environ["TF_CPP_MIN_LOG_LEVEL"] = "2"
import tensorflow as tf
from tensorflow import keras

# (Ví dụ Backend đang dùng FastAPI)
from fastapi import FastAPI, UploadFile, File

app = FastAPI(title="Smart Garden - Plant Recognition API")

# ========================================================
# CONFIG & LOAD MODEL IN MEMORY (Chỉ load 1 lần lúc startup)
# ========================================================
MODEL_PATH = "models/plant_classifier.keras"
LABELS_PATH = "models/labels.json"

print("[INFO] Đang tải mô hình...")
model = keras.models.load_model(MODEL_PATH)

with open(LABELS_PATH, "r", encoding="utf-8") as f:
    labels_info = json.load(f)

CLASS_NAMES = labels_info["class_names"]
NAME_TO_GROUP = labels_info["name_to_group"]

IMG_SIZE = tuple(labels_info.get("input_size", [224, 224]))

print("[INFO] Sẵn sàng phục vụ!")

# ========================================================
# Hàm xử lý và đưa ra dự đoán ảnh
# ========================================================
def predict_image(image_bytes: bytes) -> dict:
    # 1. Đọc ảnh từ byte stream và ép kiểu về RGB (tránh lỗi nếu user gửi ảnh PNG có nền trong suốt RGBA)
    img = Image.open(BytesIO(image_bytes)).convert("RGB")
    
    # 2. XỬ LÝ KÍCH THƯỚC 
    from PIL import ImageOps
    img = ImageOps.fit(img, IMG_SIZE, Image.Resampling.LANCZOS)
    
    # 3. Ép kiểu ảnh (Pillow Object) về Numpy Array. Kích thước giờ đang là (224, 224, 3)
    img_array = keras.utils.img_to_array(img)
    
    # 4. Thêm chiều 
    img_batch = np.expand_dims(img_array, axis=0)     
    
    # 5. Đưa dữ liệu qua mạng neuron
    preds = model.predict(img_batch, verbose=0)[0]
    
    # 6. Parse kết quả
    top_idx = int(np.argmax(preds))
    predicted_plant = CLASS_NAMES[top_idx]
    confidence = float(preds[top_idx])
    
    # Map sang thực vật nhóm tương ứng
    plant_group = NAME_TO_GROUP.get(predicted_plant, "unknown")
    all_probs = {name: float(preds[i]) for i, name in enumerate(CLASS_NAMES)}
    
    return {
        "predicted_plant": predicted_plant, 
        "plant_group": plant_group,         
        "confidence": round(confidence, 4),
        "all_probabilities": {k: round(v, 4) for k, v in all_probs.items()}
    }


# Hàm này trả ra một dictionay dạng:
{
    "predicted_plant": "Succulents", # Tên thực vật được dự đoán
    "plant_group": "succulent", # Nhóm thực vật
    "confidence": 0.95, # Tỉ lệ dự đoán của model: (0 -> 1)
    "all_probabilities": {
        "Succulents": 0.95,
        "Cactus": 0.03,
        "Flower": 0.02
    } # Tỉ lệ dự đoán của model cho cả 3 loại thực vật
}


# ========================================================
# Ví dụ endpoint nhận request nè:))
# ========================================================
@app.post("/api/v1/plants/recognize")
async def recognize_plant(file: UploadFile = File(...)):
    # Validate nhẹ extension
    if not file.filename.lower().endswith(('.png', '.jpg', '.jpeg', '.webp')):
        return {"success": False, "error": "Định dạng file không được hỗ trợ"}
        
    image_bytes = await file.read()
    
    try:
        inference_result = predict_image(image_bytes)
        
        #Fix cứng thì xử lý ở đây, điều kiện gì đó dựa theo output của inference_result
        # VD: inference_result["confidence"] < 0.7 ...

        # Trả về kết quả
        return {
            "success": True, 
            "data": inference_result
        }
    except Exception as e:
        return {"success": False, "error": str(e)}
```