Chuẩn. Dưới đây là bản **“Action Checklist Tuần 4” cực chi tiết theo từng người + từng file cần tạo/sửa** để nhóm có thể bám vào làm ngay.

Mình viết theo giả định repo của bạn đang đi gần giống khung đã chốt từ tuần 1: **frontend React + Vite**, **backend FastAPI**, **firmware ESP32/YOLO:bit**, và tuần 4 sẽ bổ sung **AI classify → plant profile → recommendation → AI mode qua safety rules**. Hướng này phù hợp vì transfer learning giúp tận dụng mô hình pretrained để làm image classification nhanh hơn khi thời gian và dữ liệu hạn chế [Source](https://www.tensorflow.org/tutorials/images/transfer_learning). Nếu cần dataset tham chiếu, PlantVillage là một nguồn phổ biến với 54,303 ảnh trên 38 lớp, nhưng tuần 4 chỉ nên rút gọn thành vài nhóm cây phục vụ MVP [Source](https://www.tensorflow.org/datasets/catalog/plant_village). Luồng AI mode vẫn đi theo đường lệnh điều khiển qua Adafruit IO MQTT như các tuần trước, vốn phù hợp cho publish/subscribe giữa backend và thiết bị IoT [Source](https://io.adafruit.com/api/docs/mqtt.html). Toàn bộ vẫn bám kiến trúc phân lớp thiết bị → cloud/backend → frontend đã chốt từ đầu [Source](https://www.genspark.ai/api/files/s/HL0PvxQ5)

---

# Action Checklist Tuần 4 – AI Highlight

## 1) Mục tiêu cuối tuần 4

Đến cuối tuần 4, nhóm phải có được flow này:

**Upload ảnh cây hoặc chọn cây thủ công → backend classify hoặc nhận plant selection → lấy plant profile → sinh AI recommendation → chạy safety check → nếu hợp lệ thì cho phép AI mode gửi lệnh → lưu log AI decision → frontend hiển thị giải thích**

---

## 2) Quy ước phối hợp trước khi làm

Để tuần 4 không bị “mỗi người làm một kiểu”, cả nhóm nên chốt trước 4 thứ sau:

| Hạng mục | Giá trị nên chốt |
|---|---|
| Số lớp cây MVP | 3–5 lớp |
| Fallback | Dropdown chọn cây thủ công |
| Tên mode | `manual`, `auto`, `ai` |
| API AI chính | `/ai/classify-plant`, `/ai/profile/{plant}`, `/ai/recommend`, `/logs/ai-decisions` |

### Branch khuyến nghị
| Thành viên | Branch |
|---|---|
| Embedded/IoT | `feature/week4-firmware-ai-safety` |
| Backend | `feature/week4-backend-ai` |
| Frontend | `feature/week4-frontend-ai-page` |
| AI/Docs | `feature/week4-ai-model-and-docs` |

---

## 3) Bản đồ file tổng thể cần tạo/sửa

Nếu repo đang theo khung cũ, tuần 4 gần như sẽ đụng vào các file dưới đây.

### 3.1. Backend
| File | Tạo/Sửa | Mục đích |
|---|---|---|
| `backend/app/main.py` | Sửa | đăng ký router AI |
| `backend/app/core/config.py` | Sửa | thêm config model, upload dir, AI mode flags |
| `backend/.env.example` | Sửa | thêm biến môi trường cho AI |
| `backend/app/models/plant_profile.py` | Tạo | model profile cây |
| `backend/app/models/ai_decision.py` | Tạo | model log quyết định AI |
| `backend/app/models/__init__.py` | Sửa | export model mới |
| `backend/app/schemas/ai.py` | Tạo | request/response schema cho AI APIs |
| `backend/app/routers/ai.py` | Tạo | router AI endpoints |
| `backend/app/routers/logs.py` | Sửa | thêm API lấy AI logs |
| `backend/app/routers/system.py` hoặc file mode hiện tại | Sửa | hỗ trợ mode `ai` |
| `backend/app/services/plant_classifier.py` | Tạo | load model + inference |
| `backend/app/services/profile_service.py` | Tạo | lấy profile theo cây |
| `backend/app/services/recommendation_service.py` | Tạo | sinh recommendation |
| `backend/app/services/safety_service.py` | Tạo | kiểm tra an toàn |
| `backend/app/services/ai_mode_service.py` | Tạo | orchestration AI mode |
| `backend/app/services/control_service.py` | Sửa | cho AI gọi send command |
| `backend/app/services/adafruit_service.py` | Sửa | publish lệnh do AI sinh ra |
| `backend/app/utils/image_preprocess.py` | Tạo | resize / normalize ảnh |
| `backend/app/seeds/plant_profiles.json` | Tạo | dữ liệu seed plant profiles |
| `backend/app/scripts/seed_plant_profiles.py` | Tạo | script seed dữ liệu |
| `backend/tests/test_ai_api.py` | Tạo | test API AI |
| `backend/tests/test_safety_service.py` | Tạo | test safety rules |
| `backend/tests/test_recommendation_service.py` | Tạo | test recommendation |
| `backend/alembic/versions/*_add_ai_tables.py` | Tạo nếu có migration | tạo bảng mới |

### 3.2. Frontend
| File | Tạo/Sửa | Mục đích |
|---|---|---|
| `frontend/src/pages/AIPage.tsx` | Tạo/Sửa | trang AI chính |
| `frontend/src/api/ai.ts` | Tạo | gọi API AI |
| `frontend/src/api/system.ts` | Sửa | hỗ trợ mode `ai` |
| `frontend/src/types/ai.ts` | Tạo | type cho classify/profile/recommend/log |
| `frontend/src/hooks/useAI.ts` | Tạo | quản lý state AI page |
| `frontend/src/components/ai/ImageUploadCard.tsx` | Tạo | upload ảnh |
| `frontend/src/components/ai/PlantSelector.tsx` | Tạo | fallback chọn cây |
| `frontend/src/components/ai/ClassificationResultCard.tsx` | Tạo | hiển thị kết quả model |
| `frontend/src/components/ai/PlantProfileCard.tsx` | Tạo | hiển thị profile cây |
| `frontend/src/components/ai/RecommendationCard.tsx` | Tạo | hiển thị khuyến nghị AI |
| `frontend/src/components/ai/SafetyStatusChip.tsx` | Tạo | badge allowed/blocked |
| `frontend/src/components/ai/DecisionHistoryTable.tsx` | Tạo | bảng AI logs |
| `frontend/src/routes/index.tsx` hoặc file router | Sửa | thêm route AI page |
| `frontend/src/App.tsx` | Sửa | gắn route/layout |
| `frontend/src/mock/plantProfiles.ts` | Tạo | fallback mock |
| `frontend/src/mock/aiDecisionHistory.ts` | Tạo | fallback mock |
| `frontend/src/pages/ControlPage.tsx` | Sửa | thêm hiển thị mode AI hoặc disable manual |
| `frontend/src/pages/DashboardPage.tsx` | Sửa nhẹ | hiển thị quick AI status nếu muốn |

### 3.3. Firmware
| File | Tạo/Sửa | Mục đích |
|---|---|---|
| `firmware/src/main.cpp` | Sửa | hỗ trợ command từ AI mode |
| `firmware/include/config.h` | Sửa | config mode/timeout nếu cần |
| `firmware/include/pins.h` | Sửa nếu thiếu | map relay pin rõ ràng |
| `firmware/src/command_handler.cpp` | Tạo nếu tách file | parse command AI |
| `firmware/include/command_handler.h` | Tạo nếu tách file | khai báo handler |
| `firmware/src/mqtt_handler.cpp` | Sửa nếu đã có | nhận command AI |
| `firmware/src/safety_guard.cpp` | Tạo tùy chọn | thêm timeout cơ bản ở firmware |

### 3.4. AI / Docs / Data
| File | Tạo/Sửa | Mục đích |
|---|---|---|
| `ml/train_plant_classifier.py` | Tạo | train baseline model |
| `ml/inference_test.py` | Tạo | test model local |
| `ml/requirements.txt` | Tạo | dependency cho train/inference |
| `ml/datasets/README.md` | Tạo | mô tả dataset và label mapping |
| `ml/models/plant_classifier.keras` hoặc `.h5` | Tạo | model đã train |
| `ml/models/labels.json` | Tạo | mapping class index → plant name |
| `ml/notebooks/experiment_week4.ipynb` | Tạo nếu cần | notebook thử nghiệm |
| `docs/week4-ai-plan.md` | Tạo | tài liệu kỹ thuật tuần 4 |
| `docs/ai-data-contract.md` | Tạo | contract classify/profile/recommend |
| `docs/ai-demo-script.md` | Tạo | kịch bản demo |
| `docs/ai-test-checklist.md` | Tạo | test case tuần 4 |

---

# 4) Checklist chi tiết theo từng thành viên

---

## THÀNH VIÊN 1 – Embedded / IoT

### 4.1. Mục tiêu của bạn trong tuần 4
Bạn không làm AI model, nhưng bạn là người đảm bảo rằng **AI mode nếu được cho phép thì thiết bị thật phản hồi đúng và an toàn**.

### 4.2. File phải tạo/sửa

| File | Việc cần làm |
|---|---|
| `firmware/src/main.cpp` | thêm nhánh xử lý command từ mode `ai` |
| `firmware/include/config.h` | thêm config timeout/guard nếu cần |
| `firmware/include/pins.h` | xác nhận mapping relay cho pump/fan/light |
| `firmware/src/command_handler.cpp` | tách logic parse command nếu code đang rối |
| `firmware/include/command_handler.h` | khai báo các hàm xử lý command |
| `firmware/src/mqtt_handler.cpp` | nếu đã tách MQTT riêng, thêm parse trường `mode`, `reason` |

### 4.3. Checklist công việc cực chi tiết

#### A. Chuẩn hóa format command nhận từ backend
- [ ] xác nhận firmware nhận được các field:
  - `target_device`
  - `action`
  - `mode`
  - `reason`
- [ ] nếu `mode == "ai"` thì vẫn đi qua logic relay như tuần 3
- [ ] log ra serial đầy đủ:
  - target_device
  - action
  - mode
  - reason

#### B. Tăng độ an toàn ở firmware
- [ ] thêm guard không cho pump bật vô hạn
- [ ] nếu command lỗi format thì bỏ qua
- [ ] nếu `target_device` không hợp lệ thì bỏ qua
- [ ] nếu `action` không phải `on/off` thì bỏ qua
- [ ] nếu relay vừa được bật gần đây thì in warning để debug

#### C. Chuẩn bị hàm tiện ích
Nên có các hàm sau:
- [ ] `handle_command(payload)`
- [ ] `set_pump(bool on)`
- [ ] `set_fan(bool on)`
- [ ] `set_light(bool on)`
- [ ] `is_command_valid(...)`

#### D. Nếu còn thời gian
- [ ] publish lại trạng thái actuator sau khi nhận command
- [ ] thêm `last_command_mode` để debug trên serial/LCD
- [ ] hiển thị ngắn trên LCD: `AI:PUMP ON`

### 4.4. Definition of Done riêng cho bạn
- [ ] command AI từ backend xuống relay chạy đúng
- [ ] serial log đọc được lý do lệnh
- [ ] pump có basic timeout guard
- [ ] test tối thiểu 3 lệnh:
  - AI bật pump
  - AI bật fan
  - AI bật light

### 4.5. Handoff cho ai
Bạn cần bàn giao cho:
- **Backend**: xác nhận format command firmware chấp nhận
- **QA/Docs**: video hoặc serial log chứng minh AI command chạy thật

---

## THÀNH VIÊN 2 – Backend / Database

### 5.1. Mục tiêu của bạn trong tuần 4
Bạn là người “đỡ” toàn bộ logic AI của hệ thống. Bạn phải làm cho backend có thể:
- nhận ảnh hoặc plant selection,
- classify hoặc nhận cây fallback,
- lấy profile,
- sinh recommendation,
- safety check,
- nếu AI mode bật thì gửi command,
- lưu AI logs.

### 5.2. File phải tạo/sửa

#### File bắt buộc
| File | Tạo/Sửa | Việc cụ thể |
|---|---|---|
| `backend/app/main.py` | Sửa | include router AI |
| `backend/app/core/config.py` | Sửa | thêm `MODEL_PATH`, `UPLOAD_DIR`, `AI_ENABLED` |
| `backend/.env.example` | Sửa | thêm env AI |
| `backend/app/models/plant_profile.py` | Tạo | ORM model plant profile |
| `backend/app/models/ai_decision.py` | Tạo | ORM model ai decision |
| `backend/app/models/__init__.py` | Sửa | import model mới |
| `backend/app/schemas/ai.py` | Tạo | schema request/response |
| `backend/app/routers/ai.py` | Tạo | AI APIs |
| `backend/app/routers/logs.py` | Sửa | expose AI logs |
| `backend/app/services/plant_classifier.py` | Tạo | load model + predict |
| `backend/app/services/profile_service.py` | Tạo | get profile theo plant |
| `backend/app/services/recommendation_service.py` | Tạo | recommendation text + action |
| `backend/app/services/safety_service.py` | Tạo | safety rules |
| `backend/app/services/ai_mode_service.py` | Tạo | orchestration |
| `backend/app/services/control_service.py` | Sửa | cho AI tái sử dụng send command |
| `backend/app/services/adafruit_service.py` | Sửa | support publish command with mode=ai |
| `backend/app/seeds/plant_profiles.json` | Tạo | dữ liệu profile |
| `backend/app/scripts/seed_plant_profiles.py` | Tạo | seed profile vào DB |
| `backend/tests/test_ai_api.py` | Tạo | test endpoints |
| `backend/tests/test_safety_service.py` | Tạo | test block/allow |

#### File nên có nếu dùng migration
| File | Việc |
|---|---|
| `backend/alembic/versions/*_add_plant_profiles_ai_decisions.py` | tạo bảng mới |
| `backend/app/models/base.py` hoặc nơi đăng ký metadata | đảm bảo include model mới |

### 5.3. Checklist công việc cực chi tiết

#### A. Config & environment
- [ ] thêm `MODEL_PATH`
- [ ] thêm `UPLOAD_DIR`
- [ ] thêm `AI_FALLBACK_ENABLED=true`
- [ ] thêm `MAX_PUMP_DURATION_SEC`
- [ ] thêm `MAX_PUMP_PER_HOUR`
- [ ] thêm `LOW_CONFIDENCE_THRESHOLD`

#### B. Tạo model database
**`plant_profile.py`**
- [ ] `id`
- [ ] `plant_name`
- [ ] `plant_group`
- [ ] `soil_threshold_min`
- [ ] `soil_threshold_target`
- [ ] `temp_threshold_max`
- [ ] `light_threshold_min`
- [ ] `watering_duration_sec`
- [ ] `notes`
- [ ] `care_summary`

**`ai_decision.py`**
- [ ] `id`
- [ ] `created_at`
- [ ] `predicted_plant`
- [ ] `confidence`
- [ ] `profile_used`
- [ ] `sensor_snapshot`
- [ ] `recommendation`
- [ ] `action_suggested`
- [ ] `safety_checked`
- [ ] `allowed_to_execute`
- [ ] `execution_result`
- [ ] `explanation`

#### C. Seed profile data
**`plant_profiles.json`**
- [ ] tạo ít nhất 3 profile
  - cactus/succulent
  - herb
  - leafy plant
- [ ] mỗi profile có đủ thresholds
- [ ] notes viết ngắn gọn cho demo

**`seed_plant_profiles.py`**
- [ ] script đọc JSON
- [ ] insert nếu chưa có
- [ ] tránh duplicate seed

#### D. Viết AI schemas
**`schemas/ai.py`**
- [ ] `PlantClassificationResponse`
- [ ] `PlantProfileResponse`
- [ ] `RecommendationRequest`
- [ ] `RecommendationResponse`
- [ ] `AIDecisionResponse`

#### E. Viết classifier service
**`services/plant_classifier.py`**
- [ ] `load_model()`
- [ ] `predict(image_path)`
- [ ] trả `plant_name`, `plant_group`, `confidence`
- [ ] nếu model lỗi → raise controlled error
- [ ] nếu confidence thấp → flag low confidence

#### F. Viết profile service
**`services/profile_service.py`**
- [ ] `get_profile_by_plant_name()`
- [ ] `get_default_profile_by_group()`
- [ ] fallback nếu plant name không có exact match

#### G. Viết recommendation service
**`services/recommendation_service.py`**
- [ ] lấy latest sensor data
- [ ] so sánh với thresholds
- [ ] sinh:
  - recommendation
  - action_suggested
  - explanation
- [ ] xử lý các case:
  - soil thấp
  - nhiệt độ cao
  - ánh sáng thấp
  - không cần action

#### H. Viết safety service
**`services/safety_service.py`**
- [ ] `allow_pump_action(...)`
- [ ] `allow_fan_action(...)`
- [ ] `allow_light_action(...)`
- [ ] check số lần pump trong 1 giờ
- [ ] check mode hiện tại phải là `ai`
- [ ] check sensor snapshot hợp lệ
- [ ] trả:
  - `allowed`
  - `reason`
  - `safety_checked=true`

#### I. Viết orchestration AI mode
**`services/ai_mode_service.py`**
- [ ] nhận plant + sensor snapshot
- [ ] gọi recommendation service
- [ ] gọi safety service
- [ ] nếu allowed thì gọi control service
- [ ] lưu AI decision log
- [ ] trả result cho router

#### J. Router AI
**`routers/ai.py`**
- [ ] `POST /api/v1/ai/classify-plant`
- [ ] `GET /api/v1/ai/profile/{plant_name}`
- [ ] `POST /api/v1/ai/recommend`
- [ ] có path nhận fallback `plant_name` thủ công nếu không upload ảnh

#### K. Logs router
**`routers/logs.py`**
- [ ] thêm `GET /api/v1/logs/ai-decisions`
- [ ] hỗ trợ query limit
- [ ] trả newest first

#### L. System mode router
**file mode/system hiện tại**
- [ ] chấp nhận `mode = ai`
- [ ] nếu mode đổi sang ai thì response rõ ràng
- [ ] nếu mode không hợp lệ thì reject

#### M. Tests
**`test_ai_api.py`**
- [ ] test classify success
- [ ] test classify fallback
- [ ] test recommend success
- [ ] test invalid plant
- [ ] test ai log listing

**`test_safety_service.py`**
- [ ] case allowed
- [ ] case blocked by pump frequency
- [ ] case blocked by invalid sensor
- [ ] case blocked by wrong mode

### 5.4. API contract bạn phải chốt với frontend
| Endpoint | Input | Output tối thiểu |
|---|---|---|
| `POST /api/v1/ai/classify-plant` | image file | predicted plant, group, confidence |
| `GET /api/v1/ai/profile/{plant}` | plant name | profile object |
| `POST /api/v1/ai/recommend` | plant + optional sensor snapshot | recommendation + explanation + safety |
| `GET /api/v1/logs/ai-decisions` | limit | list logs |

### 5.5. Definition of Done riêng cho bạn
- [ ] backend chạy được full AI APIs
- [ ] profile seed xong
- [ ] recommendation + safety hoạt động
- [ ] AI mode gửi command được nếu allowed
- [ ] DB có ai_decision logs
- [ ] test pass cơ bản

### 5.6. Handoff cho ai
Bạn cần bàn giao cho:
- **Frontend**: swagger hoặc sample JSON responses
- **Firmware**: xác nhận format command khi AI được phép execute
- **AI member**: path model + labels mapping

---

## THÀNH VIÊN 3 – Frontend

### 6.1. Mục tiêu của bạn trong tuần 4
Bạn biến phần AI thành thứ **nhìn thấy được, hiểu được, demo được**. Người xem không quan tâm model nằm đâu nếu UI không kể được câu chuyện.

### 6.2. File phải tạo/sửa

| File | Tạo/Sửa | Việc cụ thể |
|---|---|---|
| `frontend/src/pages/AIPage.tsx` | Tạo/Sửa | dựng toàn bộ flow AI |
| `frontend/src/api/ai.ts` | Tạo | API functions cho classify/profile/recommend/logs |
| `frontend/src/api/system.ts` | Sửa | thêm đổi mode `ai` |
| `frontend/src/types/ai.ts` | Tạo | type definitions |
| `frontend/src/hooks/useAI.ts` | Tạo | quản lý state, loading, errors |
| `frontend/src/components/ai/ImageUploadCard.tsx` | Tạo | upload ảnh |
| `frontend/src/components/ai/PlantSelector.tsx` | Tạo | fallback selector |
| `frontend/src/components/ai/ClassificationResultCard.tsx` | Tạo | predicted plant/confidence |
| `frontend/src/components/ai/PlantProfileCard.tsx` | Tạo | thresholds/care summary |
| `frontend/src/components/ai/RecommendationCard.tsx` | Tạo | recommendation/explanation |
| `frontend/src/components/ai/SafetyStatusChip.tsx` | Tạo | allowed/blocked badge |
| `frontend/src/components/ai/DecisionHistoryTable.tsx` | Tạo | hiển thị AI logs |
| `frontend/src/routes/index.tsx` | Sửa | thêm route AI page |
| `frontend/src/App.tsx` | Sửa | gắn layout |
| `frontend/src/pages/ControlPage.tsx` | Sửa | disable manual nếu đang mode ai |
| `frontend/src/mock/plantProfiles.ts` | Tạo | mock fallback |
| `frontend/src/mock/aiDecisionHistory.ts` | Tạo | mock fallback |

### 6.3. Checklist công việc cực chi tiết

#### A. Type definitions
**`types/ai.ts`**
- [ ] `PlantClassificationResult`
- [ ] `PlantProfile`
- [ ] `RecommendationResult`
- [ ] `AIDecisionLog`
- [ ] `AIPageState`

#### B. API client
**`api/ai.ts`**
- [ ] `classifyPlant(file)`
- [ ] `getPlantProfile(plantName)`
- [ ] `getRecommendation(payload)`
- [ ] `getAIDecisionLogs(limit)`
- [ ] xử lý lỗi backend đẹp

#### C. Hook quản lý state
**`hooks/useAI.ts`**
- [ ] state `selectedFile`
- [ ] state `predictedPlant`
- [ ] state `selectedPlant`
- [ ] state `profile`
- [ ] state `recommendation`
- [ ] state `logs`
- [ ] state `loading`
- [ ] state `error`
- [ ] helper `runFallbackFlow(plantName)`

#### D. Dựng AI Page
**`pages/AIPage.tsx`**
- [ ] block upload ảnh
- [ ] block chọn cây fallback
- [ ] block kết quả classify
- [ ] block profile
- [ ] block recommendation
- [ ] block AI mode toggle
- [ ] block decision history
- [ ] loading skeleton
- [ ] error alert

#### E. Image upload
**`ImageUploadCard.tsx`**
- [ ] drag/drop hoặc button chọn file
- [ ] preview ảnh
- [ ] button “Analyze Plant”
- [ ] validate file type ảnh
- [ ] validate file size cơ bản

#### F. Fallback selector
**`PlantSelector.tsx`**
- [ ] dropdown 3–5 cây
- [ ] button “Use this plant”
- [ ] nếu classify fail thì hiện selector nổi bật hơn
- [ ] nếu confidence thấp, gợi ý user chuyển sang selector

#### G. Result card
**`ClassificationResultCard.tsx`**
- [ ] hiển thị predicted plant
- [ ] hiển thị plant group
- [ ] hiển thị confidence %
- [ ] nếu confidence thấp thì badge warning

#### H. Profile card
**`PlantProfileCard.tsx`**
- [ ] soil threshold
- [ ] target soil
- [ ] max temp
- [ ] min light
- [ ] watering duration
- [ ] care summary

#### I. Recommendation card
**`RecommendationCard.tsx`**
- [ ] hiển thị current sensor snapshot
- [ ] hiển thị recommendation text
- [ ] hiển thị explanation
- [ ] hiển thị action suggested
- [ ] hiển thị safety status chip

#### J. Safety chip
**`SafetyStatusChip.tsx`**
- [ ] badge xanh nếu allowed
- [ ] badge vàng/đỏ nếu blocked
- [ ] tooltip hoặc text giải thích ngắn

#### K. Decision history
**`DecisionHistoryTable.tsx`**
- [ ] columns:
  - time
  - plant
  - action
  - allowed/blocked
  - explanation
- [ ] lấy 5–10 dòng gần nhất
- [ ] sort newest first

#### L. Control page integration
**`ControlPage.tsx`**
- [ ] nếu mode = ai thì disable manual toggles
- [ ] hiển thị banner “AI mode active”
- [ ] nếu user muốn manual thì yêu cầu switch về manual

### 6.4. UX bắt buộc phải có
- [ ] loading khi classify
- [ ] loading khi get recommendation
- [ ] toast khi bật AI mode
- [ ] toast khi AI action bị block
- [ ] fallback nếu backend AI lỗi
- [ ] không để trang trắng khi chưa có ảnh

### 6.5. Definition of Done riêng cho bạn
- [ ] AI page hoàn chỉnh về luồng
- [ ] classify hoặc fallback đều dùng được
- [ ] profile + recommendation hiển thị rõ
- [ ] logs hiển thị rõ
- [ ] mode AI phản ánh đúng trong UI

### 6.6. Handoff cho ai
Bạn cần bàn giao cho:
- **QA/Docs**: screenshot đẹp cho báo cáo
- **Backend**: báo lỗi contract nếu response field lệch
- **Demo lead**: AI page là trang show chính cho tuần 4

---

## THÀNH VIÊN 4 – AI / Integration / Docs

### 7.1. Mục tiêu của bạn trong tuần 4
Bạn là người tạo “phần lõi học thuật” cho AI highlight: dataset, baseline model, labels mapping, script inference, test ảnh demo, tài liệu và kịch bản trình bày.

### 7.2. File phải tạo/sửa

| File | Tạo/Sửa | Việc cụ thể |
|---|---|---|
| `ml/train_plant_classifier.py` | Tạo | train model baseline |
| `ml/inference_test.py` | Tạo | test model với ảnh local |
| `ml/requirements.txt` | Tạo | dependency |
| `ml/models/plant_classifier.keras` | Tạo | model xuất ra |
| `ml/models/labels.json` | Tạo | mapping labels |
| `ml/datasets/README.md` | Tạo | nguồn dữ liệu, mapping lớp |
| `ml/notebooks/experiment_week4.ipynb` | Tạo nếu cần | thử nghiệm |
| `docs/week4-ai-plan.md` | Tạo | kế hoạch AI |
| `docs/ai-data-contract.md` | Tạo | contract giữa AI model-backend-frontend |
| `docs/ai-test-checklist.md` | Tạo | test scenarios |
| `docs/ai-demo-script.md` | Tạo | script trình bày demo |
| `backend/app/seeds/plant_profiles.json` | Phối hợp sửa | mapping model class sang profile |
| `backend/app/services/plant_classifier.py` | Phối hợp | giúp backend load model đúng |

### 7.3. Checklist công việc cực chi tiết

#### A. Chốt label mapping
- [ ] chọn 3–5 lớp cây
- [ ] định nghĩa tên lớp chuẩn dùng chung backend/frontend/docs
- [ ] tạo `labels.json`
- [ ] ánh xạ class index → plant name → plant group

Ví dụ:
```json
{
  "0": "Cactus",
  "1": "Herb",
  "2": "LeafyPlant"
}
```

#### B. Chuẩn bị dataset
**`ml/datasets/README.md`**
- [ ] ghi nguồn dữ liệu
- [ ] ghi số lượng ảnh mỗi lớp
- [ ] ghi cách chia train/val/test
- [ ] ghi các lớp cuối cùng dùng cho MVP

#### C. Viết script train
**`train_plant_classifier.py`**
- [ ] load dataset
- [ ] resize ảnh
- [ ] data augmentation nhẹ
- [ ] load pretrained base model
- [ ] train classification head
- [ ] evaluate
- [ ] save model
- [ ] save labels

#### D. Viết script test inference
**`inference_test.py`**
- [ ] load model
- [ ] predict một ảnh
- [ ] in ra top label
- [ ] in confidence
- [ ] test ít nhất 3 ảnh demo

#### E. Chuẩn bị ảnh demo
- [ ] tạo thư mục `ml/demo_test_images/`
- [ ] chuẩn bị ít nhất 1–2 ảnh sạch cho mỗi lớp
- [ ] đặt tên file rõ ràng để demo

#### F. Tài liệu AI
**`docs/week4-ai-plan.md`**
- [ ] mô tả AI scope
- [ ] mô tả model chọn
- [ ] mô tả fallback selector
- [ ] mô tả safety rules

**`docs/ai-data-contract.md`**
- [ ] classify response
- [ ] profile response
- [ ] recommend response
- [ ] error response

**`docs/ai-test-checklist.md`**
- [ ] classify đúng ảnh mẫu
- [ ] confidence thấp
- [ ] ảnh lỗi
- [ ] fallback chọn cây
- [ ] AI action allowed
- [ ] AI action blocked

**`docs/ai-demo-script.md`**
- [ ] opening line
- [ ] bước upload/chọn cây
- [ ] bước hiển thị profile
- [ ] bước giải thích recommendation
- [ ] bước show safety block/allow

#### G. Phối hợp integration
- [ ] bàn giao model path cho backend
- [ ] bàn giao labels.json cho backend
- [ ] thống nhất tên cây với frontend dropdown
- [ ] kiểm tra output inference khớp contract

### 7.4. Definition of Done riêng cho bạn
- [ ] model baseline hoặc fallback flow sẵn sàng
- [ ] labels mapping rõ ràng
- [ ] ảnh demo chuẩn bị xong
- [ ] tài liệu AI đủ cho report + demo
- [ ] backend load được model hoặc nhận output model đúng

### 7.5. Handoff cho ai
Bạn cần bàn giao cho:
- **Backend**: model file + labels + expected input size
- **Frontend**: danh sách tên cây hiển thị
- **Nhóm demo**: ảnh mẫu + script nói

---

# 5) Checklist integration theo file – thứ tự merge tốt nhất

Đây là thứ tự merge để tránh nghẽn:

## Bước 1 – AI member + Backend chốt contract
- [ ] `ml/models/labels.json`
- [ ] `backend/app/seeds/plant_profiles.json`
- [ ] `docs/ai-data-contract.md`

## Bước 2 – Backend làm APIs stub trước
- [ ] `backend/app/routers/ai.py`
- [ ] `backend/app/schemas/ai.py`
- [ ] `backend/app/services/profile_service.py`
- [ ] response mock trước nếu model chưa xong

## Bước 3 – Frontend dựng UI bằng mock API
- [ ] `frontend/src/pages/AIPage.tsx`
- [ ] `frontend/src/mock/*.ts`
- [ ] `frontend/src/components/ai/*`

## Bước 4 – AI member bàn giao model
- [ ] `ml/models/plant_classifier.keras`
- [ ] `ml/models/labels.json`

## Bước 5 – Backend nối model thật
- [ ] `backend/app/services/plant_classifier.py`
- [ ] `backend/app/routers/ai.py`

## Bước 6 – Safety + AI mode
- [ ] `backend/app/services/safety_service.py`
- [ ] `backend/app/services/ai_mode_service.py`
- [ ] `backend/app/services/control_service.py`

## Bước 7 – Firmware nhận command AI
- [ ] `firmware/src/main.cpp`
- [ ] `firmware/src/command_handler.cpp`

---

# 6) Checklist theo ngày – siêu thực dụng

## Day 1
| Người | Việc |
|---|---|
| Member 1 | review command format từ tuần 3, chuẩn bị nhánh firmware AI |
| Member 2 | tạo model DB + schemas + router AI stub |
| Member 3 | dựng khung AIPage + components trống |
| Member 4 | chốt 3–5 lớp cây + labels mapping + dataset plan |

## Day 2
| Người | Việc |
|---|---|
| Member 1 | thêm parse `mode=ai` |
| Member 2 | seed plant_profiles + API profile |
| Member 3 | upload UI + selector UI + mock card |
| Member 4 | train baseline model hoặc chuẩn bị fallback chắc chắn |

## Day 3
| Người | Việc |
|---|---|
| Member 1 | test command AI với mock payload |
| Member 2 | API classify + recommend |
| Member 3 | nối API classify/profile mock/thật |
| Member 4 | inference test + labels bàn giao backend |

## Day 4
| Người | Việc |
|---|---|
| Member 1 | verify relay khi AI allowed |
| Member 2 | safety service + ai_decision log |
| Member 3 | recommendation card + decision history |
| Member 4 | viết docs AI flow + test checklist |

## Day 5
| Người | Việc |
|---|---|
| Member 1 | test timeout guard pump |
| Member 2 | ai mode orchestration end-to-end |
| Member 3 | mode AI toggle + blocked/allowed badges |
| Member 4 | chuẩn bị ảnh demo + script demo |

## Day 6
| Người | Việc |
|---|---|
| Member 1 | integration test firmware |
| Member 2 | fix bug contract/backend logs |
| Member 3 | polish UI + loading/error states |
| Member 4 | cập nhật báo cáo tuần 4 |

## Day 7
| Người | Việc |
|---|---|
| Cả nhóm | demo nội bộ full flow + quay video backup |

---

# 7) Checklist nghiệm thu cuối tuần 4

## Backend
- [ ] `classify-plant` hoạt động hoặc fallback không lỗi
- [ ] profile API hoạt động
- [ ] recommendation API hoạt động
- [ ] ai mode gọi được safety service
- [ ] ai_decision log ghi được

## Frontend
- [ ] AI page không có vùng trắng
- [ ] upload ảnh ổn
- [ ] dropdown fallback ổn
- [ ] profile card đẹp, đủ dữ liệu
- [ ] recommendation có explanation
- [ ] decision history hiển thị đúng

## Firmware
- [ ] nhận command mode `ai`
- [ ] relay phản hồi đúng
- [ ] guard cơ bản cho pump

## AI/Data
- [ ] model hoặc fallback hoàn chỉnh
- [ ] labels mapping thống nhất
- [ ] ảnh demo sạch, dễ nhận

---

# 8) Checklist demo tuần 4

Buổi demo tuần 4 nên đi đúng flow này:

1. [ ] mở AI Page  
2. [ ] upload ảnh cây  
3. [ ] hiển thị predicted plant + confidence  
4. [ ] nếu cần, bấm fallback chọn cây  
5. [ ] hiển thị plant profile  
6. [ ] hiển thị latest sensor snapshot  
7. [ ] hiển thị recommendation + explanation  
8. [ ] bật AI mode  
9. [ ] show action allowed hoặc blocked  
10. [ ] mở AI decision history/log  

---

# 9) 4 file quan trọng nhất nếu nhóm bị thiếu thời gian

Nếu cuối tuần 4 bị gấp, ưu tiên sống chết làm xong 4 cụm này trước:

### Backend sống còn
- `backend/app/routers/ai.py`
- `backend/app/services/recommendation_service.py`
- `backend/app/services/safety_service.py`
- `backend/app/seeds/plant_profiles.json`

### Frontend sống còn
- `frontend/src/pages/AIPage.tsx`
- `frontend/src/components/ai/RecommendationCard.tsx`
- `frontend/src/components/ai/PlantSelector.tsx`

### AI sống còn
- `ml/models/labels.json`
- 1 model baseline hoặc fallback selector ổn

### Firmware sống còn
- `firmware/src/main.cpp` nhận được command mode ai

Nếu chỉ đủ thời gian cho bản an toàn nhất, hãy giữ:
**selector thủ công + profile + recommendation + safety + log**  
Còn classify ảnh có thể để mức “bonus”.

---

# 10) Gợi ý commit chia nhỏ để dễ merge

| Commit | Nội dung |
|---|---|
| `feat: add plant profile and ai decision models` | backend DB |
| `feat: add ai router and schemas` | backend API |
| `feat: implement recommendation and safety services` | backend logic |
| `feat: add ai page and upload flow` | frontend |
| `feat: add plant selector fallback and profile cards` | frontend |
| `feat: add ai mode command handling for firmware` | firmware |
| `docs: add ai week4 plan and test checklist` | docs |
| `chore: add baseline plant classifier and labels mapping` | ml |

---

# 11) Câu chốt để nhóm nhớ trong tuần 4

**Tuần 4 không phải làm AI “khủng”, mà là làm AI “nói được, giải thích được, demo được, và không gây nguy hiểm khi điều khiển thiết bị”.**
