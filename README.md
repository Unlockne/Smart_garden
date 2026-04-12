# Smart Garden – Week 3

Repo này là **skeleton chạy được** theo nội dung `plan_week1_md` (Week 1: foundation & project skeleton).

Repo hiện đã được cập nhật để phục vụ **Week 3 (manual control + auto mode + logs)** theo `plan/plan_week3.md`.

## Yêu cầu

- Windows 10/11
- Python 3.10+ (khuyến nghị 3.11)
- Node.js 18+ (khuyến nghị 20)

## Chạy Backend (FastAPI)

### 1) Tạo môi trường ảo + cài dependencies

Mở PowerShell tại thư mục repo và chạy:

```powershell
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r backend\requirements.txt
```

### 2) (Tuỳ chọn) cấu hình env

Copy file env mẫu:

```powershell
copy backend\.env.example backend\.env
```

Backend Week 2 có 2 chế độ:

- **Không cần PostgreSQL**: mặc định dùng SQLite file `smart_garden.db` (tự tạo) để demo history nhanh.
- **Dùng PostgreSQL**: set `DATABASE_URL` hoặc set `POSTGRES_*` trong `backend/.env`.

Adafruit IO polling (tuỳ chọn):

- set `ENABLE_ADAFRUIT_POLLING=true`
- set `ADAFRUIT_IO_USERNAME`, `ADAFRUIT_IO_KEY`, `ADAFRUIT_FEED_KEY`

Adafruit IO command feed (Week 3):

- backend sẽ publish command xuống feed `ADAFRUIT_COMMAND_FEED_KEY` (mặc định `smart-garden-commands`)
- firmware cần subscribe feed này để điều khiển relay

### 3) Run server

```powershell
python -m uvicorn app.main:app --app-dir backend --reload --host 127.0.0.1 --port 8000
```

Mở:

- `http://127.0.0.1:8000/health`
- Swagger: `http://127.0.0.1:8000/docs`

## Chạy Frontend (React + Vite + TS)

### 1) Cài dependencies

```powershell
cd frontend
npm install
```

### 2) (Tuỳ chọn) cấu hình API base url

Copy env mẫu:

```powershell
copy .env.example .env
```

### 3) Run dev server

```powershell
npm run dev
```

Mở:

- `http://localhost:5173`

## AI / ML (nhận diện cây bằng ảnh)

Backend load `ml/models/plant_classifier.keras` + `labels.json` (lazy, lần đầu gọi inference). Cần cài đủ `backend/requirements.txt` (có TensorFlow; lần đầu `pip install` có thể lâu).

**Biến môi trường (tuỳ chọn):** `ENABLE_ML_INFERENCE`, `ML_MODEL_PATH`, `ML_LABELS_PATH` — xem `backend/.env.example`.

**Endpoint:**

- `POST /api/v1/ai/classify` — JSON, gợi ý text (`hint`), không cần ảnh (fallback).
- `POST /api/v1/ai/classify/image` — `multipart/form-data`: field `file` (ảnh), tuỳ chọn `device_id` (form).
- `POST /api/v1/plants/recognize` — multipart ảnh, trả `{ "success", "data" }` như `ml/BACKEND.md`.
- `GET /health` — thêm object `ml` (enabled / ready / model_path).

**Test nhanh (PowerShell, server đang chạy cổng 8000):**

```powershell
# Classify có ảnh (đổi đường dẫn tới file jpg/png thật)
curl.exe -X POST "http://127.0.0.1:8000/api/v1/ai/classify/image" `
  -F "file=@C:\path\to\plant.jpg"

# Định dạng doc ML
curl.exe -X POST "http://127.0.0.1:8000/api/v1/plants/recognize" `
  -F "file=@C:\path\to\plant.jpg"
```

**Kết quả mong đợi:** `method: "keras"` (hoặc `plants/recognize`: `success: true`), `predicted_plant` là một trong `FloweringPlant` / `LeafyPlant` / `Succulents`, `plant_key` map sang profile seed: `fern` / `basil` / `aloe`. Xem log tại `GET /api/v1/ai/decisions`.

## API có sẵn (Week 3)

- `GET /health`
- `GET /api/v1/sensors/latest`
- `GET /api/v1/sensors/history?limit=20`
- `GET /api/v1/devices/state`
- `POST /api/v1/devices/control`
- `POST /api/v1/system/mode`
- `GET /api/v1/system/status`
- `POST /api/v1/internal/mock-ingest`
- `GET /api/v1/logs/control`
- `GET /api/v1/logs/system-decisions`

### Mock ingest để test nhanh (khi chưa có Adafruit IO)

Gửi 1 record mẫu vào DB:

```powershell
curl -X POST http://127.0.0.1:8000/api/v1/internal/mock-ingest `
  -H "Content-Type: application/json" `
  -d '{"air_temperature":29.8,"air_humidity":70.2,"soil_moisture":35.0,"light_level":380.0,"device_id":"mock-device"}'
```

## Cấu trúc thư mục

```text
Smart_gardent/
  backend/
    app/
      main.py
  frontend/
    index.html
    package.json
    vite.config.ts
    src/
      main.tsx
      App.tsx
      layouts/
      pages/
```
