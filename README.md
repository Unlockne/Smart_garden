# Smart Garden – Week 1 Starter Kit

Repo này là **skeleton chạy được** theo nội dung `plan_week1_md` (Week 1: foundation & project skeleton).

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

> Week 1 skeleton **chạy được không cần PostgreSQL** (đang trả mock data). Khi sang Week 2 bạn chỉ cần nối DB theo các biến trong `.env`.

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

## API có sẵn (Week 1)

- `GET /health`
- `GET /api/v1/sensors/latest`
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
