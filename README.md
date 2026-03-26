# Smart Garden – Week 1 Starter Kit

Repo này là **skeleton chạy được** theo nội dung `plan_week1_md` (Week 1: foundation & project skeleton).

## Week 2 – Lấy data thật (Adafruit IO MQTT -> Backend -> Web)

Week 2 backend sẽ:

- **Subscribe MQTT** các feed sensor trên Adafruit IO
- Khi có message, backend **lưu vào SQLite** (`backend/app/data.db`)
- Frontend đọc:
  - `GET /api/v1/sensors/latest`
  - `GET /api/v1/sensors/history?limit=50`

Yêu cầu: bạn có **Adafruit IO Username + Key** và đã tạo các feeds.

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

> Nếu bạn đã cài dependencies từ Week 1, Week 2 có thêm package MQTT nên vẫn chạy lại lệnh `pip install -r backend\requirements.txt` để cập nhật.

### 2) (Tuỳ chọn) cấu hình env

Copy file env mẫu:

```powershell
copy backend\.env.example backend\.env
```

Mở `backend/.env` và điền tối thiểu:

```env
ADAFRUIT_IO_USERNAME=...
ADAFRUIT_IO_KEY=...
```

Và đảm bảo bạn đã tạo các feed trùng tên (mặc định):

- `air-temperature`
- `air-humidity`
- `soil-moisture`
- `light-level`

Control feeds (để web bấm bật/tắt gửi xuống thiết bị) mặc định:

- `pump-control`
- `fan-control`
- `light-control`

> Week 1 skeleton **chạy được không cần PostgreSQL** (đang trả mock data). Khi sang Week 2 bạn chỉ cần nối DB theo các biến trong `.env`.

> Week 2 hiện tại backend dùng **SQLite** để chạy local nhanh. File DB nằm ở `backend/app/data.db`.

### 3) Run server

```powershell
python -m uvicorn app.main:app --app-dir backend --reload --host 127.0.0.1 --port 8000
```

Mở:

- `http://127.0.0.1:8000/health`
- Swagger: `http://127.0.0.1:8000/docs`

### 4) Verify data lên được backend

1) Mở Adafruit IO Dashboard, thử **publish số** vào feed (ví dụ `soil-moisture` = `55`).

> Lưu ý: backend đang parse payload thành `float`, nên payload nên là **số** (vd: `55`, `30.2`).

2) Gọi thử API:

- `http://127.0.0.1:8000/api/v1/sensors/latest`
- `http://127.0.0.1:8000/api/v1/sensors/history?limit=50`

Nếu đã nhận được dữ liệu mới, bạn sẽ thấy `recorded_at` update và history có thêm dòng.

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

### Verify data lên web

- Vào page `Dashboard` để xem `latest`
- Vào page `History` để xem bảng + chart

## API có sẵn (Week 1)

- `GET /health`
- `GET /api/v1/sensors/latest`
- `GET /api/v1/sensors/history`
- `GET /api/v1/devices/state`
- `POST /api/v1/devices/control`

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
