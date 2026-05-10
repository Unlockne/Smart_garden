import axios from 'axios'

export const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL ?? 'http://127.0.0.1:8000/api/v1'

export const apiClient = axios.create({
  baseURL: API_BASE_URL,
})

export type Mode = 'manual' | 'auto' | 'ai'

export type SensorLatest = {
  recorded_at: string
  air_temperature: number
  air_humidity: number
  soil_moisture: number
  light_level: number
}

export type SensorRow = SensorLatest & {
  device_id?: string | null
  source: string
}

export type DeviceState = {
  recorded_at: string
  pump_state: boolean
  fan_state: boolean
  light_state: boolean
  mode: Mode
}

export type ControlLogRow = {
  id: number
  created_at: string
  target_device: string
  action: string
  actor_type: string
  reason: string
  status: string
  note?: string | null
}

export type ClassifyResponse = {
  plant_key: string
  display_name: string
  predicted_class: string | null
  plant_group: string | null
  confidence: number
}

export type PlantProfile = {
  plant_name: string
  plant_group: string
  soil_threshold_min: number
  soil_threshold_target: number
  temp_threshold_max: number
  light_threshold_min: number
  watering_duration_sec: number
  care_summary: string
}

export type RecommendApiResponse = {
  plant_key: string
  display_name: string
  actions: Array<{ target_device: string; action: string; reason: string }>
  safety_passed: boolean
  safety_reason: string | null
}

export type AIDecisionApiRow = {
  id: number | string
  created_at: string
  step: string
  output_json: string
  safety_passed: boolean
  safety_reason: string | null
  execution_note: string | null
}

export const sensorsApi = {
  latest: () => apiClient.get<SensorLatest>('/sensors/latest').then((r) => r.data),
  history: (limit = 20) =>
    apiClient.get<SensorRow[]>(`/sensors/history?limit=${limit}`).then((r) => r.data),
}

export const devicesApi = {
  state: () => apiClient.get<DeviceState>('/devices/state').then((r) => r.data),
  control: (target_device: 'pump' | 'fan' | 'light', action: 'on' | 'off') =>
    apiClient
      .post('/devices/control', {
        target_device,
        action,
        actor_type: 'user',
        reason: 'manual control from dashboard',
      })
      .then((r) => r.data),
}

export const systemApi = {
  setMode: (mode: Mode) =>
    apiClient.post('/system/mode', { mode }).then((r) => r.data),
}

export const logsApi = {
  control: (limit = 10) =>
    apiClient.get<ControlLogRow[]>(`/logs/control?limit=${limit}`).then((r) => r.data),
}

export const aiApi = {
  classifyImage: (file: File) => {
    const fd = new FormData()
    fd.append('file', file)
    return apiClient
      .post<ClassifyResponse>('/ai/classify/image', fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      .then((r) => r.data)
  },
  profile: (plantKey: string) =>
    apiClient
      .get<PlantProfile>(`/ai/profile/${encodeURIComponent(plantKey)}`)
      .then((r) => r.data),
  recommend: (plant_key: string, sensor: SensorLatest, device_id = 'web-ui') =>
    apiClient
      .post<RecommendApiResponse>('/ai/recommend', { plant_key, sensor, device_id })
      .then((r) => r.data),
  decisions: (limit = 10) =>
    apiClient
      .get<AIDecisionApiRow[]>(`/ai/decisions?limit=${limit}`)
      .then((r) => r.data),
}
