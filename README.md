# Smart Garden – Week 1 Starter Kit

Repo này là **skeleton chạy được** theo nội dung `plan_week1_md` (Week 1: foundation & project skeleton).

Repo hiện đã được cập nhật để phục vụ **Week 2 (data pipeline + DB + history)** theo `plan/plan_week2.md`.

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

## API có sẵn (Week 2)

- `GET /health`
- `GET /api/v1/sensors/latest`
- `GET /api/v1/sensors/history?limit=20`
- `GET /api/v1/devices/state`
- `POST /api/v1/devices/control`
- `GET /api/v1/system/status`
- `POST /api/v1/internal/mock-ingest`

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
