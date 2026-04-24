import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  FormControlLabel,
  MenuItem,
  Stack,
  Switch,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from '@mui/material'
import axios from 'axios'
import { ChangeEvent, useEffect, useMemo, useState } from 'react'

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://127.0.0.1:8000/api/v1'

type Mode = 'manual' | 'auto' | 'ai'

type SensorSnapshot = {
  air_temperature: number
  air_humidity: number
  soil_moisture: number
  light_level: number
}

type DeviceState = { mode: Mode }

type ClassifyResponse = {
  plant_key: string
  display_name: string
  predicted_class: string | null
  plant_group: string | null
  confidence: number
}

type PlantProfile = {
  plant_name: string
  plant_group: string
  soil_threshold_min: number
  soil_threshold_target: number
  temp_threshold_max: number
  light_threshold_min: number
  watering_duration_sec: number
  care_summary: string
}

type RecommendResponse = {
  recommendation: string
  action_suggested: string
  explanation: string
  safety_checked: boolean
  allowed_to_execute: boolean
}

type RecommendApiResponse = {
  plant_key: string
  display_name: string
  actions: Array<{
    target_device: string
    action: string
    reason: string
  }>
  safety_passed: boolean
  safety_reason: string | null
}

type AIDecisionApiRow = {
  id: number | string
  created_at: string
  step: string
  output_json: string
  safety_passed: boolean
  safety_reason: string | null
  execution_note: string | null
}

type DecisionRow = {
  id: number | string
  created_at: string
  recommendation: string
  action_suggested: string
  allowed_to_execute: boolean
  explanation: string
}

const PLANT_OPTIONS = ['Cactus', 'Mint', 'Monstera', 'Peace Lily', 'Rose'] as const

const PROFILE_FALLBACK: Record<string, PlantProfile> = {
  Cactus: { plant_name: 'Cactus', plant_group: 'succulent', soil_threshold_min: 20, soil_threshold_target: 35, temp_threshold_max: 34, light_threshold_min: 500, watering_duration_sec: 5, care_summary: 'Needs dry soil and strong light' },
  Mint: { plant_name: 'Mint', plant_group: 'herb', soil_threshold_min: 40, soil_threshold_target: 55, temp_threshold_max: 32, light_threshold_min: 350, watering_duration_sec: 6, care_summary: 'Prefers moderate moisture and bright indirect light' },
  Monstera: { plant_name: 'Monstera', plant_group: 'leafy ornamental', soil_threshold_min: 35, soil_threshold_target: 50, temp_threshold_max: 33, light_threshold_min: 300, watering_duration_sec: 6, care_summary: 'Prefers medium moisture and filtered light' },
  'Peace Lily': { plant_name: 'Peace Lily', plant_group: 'moisture-loving', soil_threshold_min: 45, soil_threshold_target: 60, temp_threshold_max: 31, light_threshold_min: 260, watering_duration_sec: 7, care_summary: 'Needs higher soil moisture and low-to-medium light' },
  Rose: { plant_name: 'Rose', plant_group: 'flowering', soil_threshold_min: 38, soil_threshold_target: 52, temp_threshold_max: 33, light_threshold_min: 450, watering_duration_sec: 6, care_summary: 'Requires bright light and balanced soil moisture' },
}

const groupByPlant: Record<string, string> = {
  Cactus: 'succulent',
  Mint: 'herb',
  Monstera: 'leafy ornamental',
  'Peace Lily': 'moisture-loving',
  Rose: 'flowering',
}

function endpointMissing(err: unknown) {
  return axios.isAxiosError(err) && (err.response?.status === 404 || err.response?.status === 405)
}

function recommendFallback(profile: PlantProfile, sensor: SensorSnapshot): RecommendResponse {
  if (sensor.soil_moisture < profile.soil_threshold_min) {
    return {
      recommendation: `Soil moisture is below minimum threshold for ${profile.plant_name}.`,
      action_suggested: 'pump_on_short',
      explanation: `Soil moisture ${sensor.soil_moisture} < min ${profile.soil_threshold_min}.`,
      safety_checked: true,
      allowed_to_execute: true,
    }
  }
  if (sensor.air_temperature > profile.temp_threshold_max) {
    return {
      recommendation: `Temperature is high for ${profile.plant_name}.`,
      action_suggested: 'fan_on',
      explanation: `Temperature ${sensor.air_temperature} > max ${profile.temp_threshold_max}.`,
      safety_checked: true,
      allowed_to_execute: true,
    }
  }
  return {
    recommendation: `${profile.plant_name} is currently in a safe range.`,
    action_suggested: 'none',
    explanation: 'Current sensor values are within profile thresholds.',
    safety_checked: true,
    allowed_to_execute: true,
  }
}

function mapRecommendToUi(payload: RecommendApiResponse): RecommendResponse {
  if (payload.actions.length === 0) {
    return {
      recommendation: `${payload.display_name} is currently in a safe range.`,
      action_suggested: 'none',
      explanation: payload.safety_reason ?? 'No action suggested by AI.',
      safety_checked: true,
      allowed_to_execute: payload.safety_passed,
    }
  }

  const actionList = payload.actions.map((a) => `${a.target_device}_${a.action}`).join(', ')
  const reasonList = payload.actions.map((a) => `- ${a.reason}`).join('\n')
  return {
    recommendation: `${payload.display_name}: AI suggested ${payload.actions.length} action(s).`,
    action_suggested: actionList,
    explanation: payload.safety_reason ? `${reasonList}\nSafety note: ${payload.safety_reason}` : reasonList,
    safety_checked: true,
    allowed_to_execute: payload.safety_passed,
  }
}

function mapDecisionLogToRow(log: AIDecisionApiRow): DecisionRow {
  let parsed: Record<string, unknown> = {}
  try {
    const obj = JSON.parse(log.output_json)
    if (obj && typeof obj === 'object') parsed = obj as Record<string, unknown>
  } catch {
    parsed = {}
  }

  const parsedActions = Array.isArray(parsed.actions) ? parsed.actions : []
  const actionFromList = parsedActions
    .map((a) => {
      if (!a || typeof a !== 'object') return ''
      const item = a as Record<string, unknown>
      return `${String(item.target_device ?? 'unknown')}_${String(item.action ?? 'unknown')}`
    })
    .filter(Boolean)
    .join(', ')

  const reasonFromList = parsedActions
    .map((a) => {
      if (!a || typeof a !== 'object') return ''
      const item = a as Record<string, unknown>
      return item.reason ? `- ${String(item.reason)}` : ''
    })
    .filter(Boolean)
    .join('\n')

  const recommendation =
    typeof parsed.recommendation === 'string'
      ? parsed.recommendation
      : typeof parsed.display_name === 'string'
        ? `${parsed.display_name}`
        : `Step: ${log.step}`
  const action_suggested = typeof parsed.action_suggested === 'string' ? parsed.action_suggested : actionFromList || 'none'
  const explanation =
    typeof parsed.explanation === 'string'
      ? parsed.explanation
      : reasonFromList || log.safety_reason || log.execution_note || 'No details.'
  const allowed_to_execute =
    typeof parsed.allowed_to_execute === 'boolean'
      ? parsed.allowed_to_execute
      : typeof parsed.safety_passed === 'boolean'
        ? parsed.safety_passed
        : log.safety_passed

  return {
    id: log.id,
    created_at: log.created_at,
    recommendation,
    action_suggested,
    allowed_to_execute,
    explanation,
  }
}

export default function AIPage() {
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [selectedPlant, setSelectedPlant] = useState('')
  const [classification, setClassification] = useState<ClassifyResponse | null>(null)
  const [profile, setProfile] = useState<PlantProfile | null>(null)
  const [recommendation, setRecommendation] = useState<RecommendResponse | null>(null)
  const [history, setHistory] = useState<DecisionRow[]>([])
  const [latestSensor, setLatestSensor] = useState<SensorSnapshot | null>(null)
  const [mode, setMode] = useState<Mode>('manual')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [info, setInfo] = useState<string | null>(null)
  const [fallbackUsed, setFallbackUsed] = useState(false)

  const lowConfidence = useMemo(() => (classification ? classification.confidence < 0.6 : false), [classification])

  useEffect(() => {
    let alive = true
    const load = async () => {
      try {
        const [sensorRes, stateRes] = await Promise.all([
          axios.get<SensorSnapshot>(`${API_BASE_URL}/sensors/latest`),
          axios.get<DeviceState>(`${API_BASE_URL}/devices/state`),
        ])
        if (!alive) return
        setLatestSensor(sensorRes.data)
        setMode(stateRes.data.mode)
      } catch {
        if (!alive) return
        setError('Cannot load sensor/state data')
      }
    }
    void load()
    const t = window.setInterval(() => void load(), 6000)
    return () => {
      alive = false
      window.clearInterval(t)
    }
  }, [])

  useEffect(() => {
    let alive = true

    const loadHistory = async () => {
      try {
        const res = await axios.get<AIDecisionApiRow[]>(`${API_BASE_URL}/ai/decisions?limit=10`)
        if (!alive) return
        const mapped = res.data.map(mapDecisionLogToRow)
        setHistory(mapped)
      } catch {
        if (!alive) return
        setHistory([])
      }
    }
    void loadHistory()
    const t = window.setInterval(() => void loadHistory(), 6000)
    return () => {
      alive = false
      window.clearInterval(t)
    }
  }, [])

  const onFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    setSelectedFile(event.target.files?.[0] ?? null)
    setError(null)
  }

  const onClassify = async () => {
    if (!selectedFile) {
      setError('Please upload image first')
      return
    }
    setLoading(true)
    setError(null)
    setInfo(null)
    try {
      const fd = new FormData()
      fd.append('file', selectedFile)
      const res = await axios.post<ClassifyResponse>(`${API_BASE_URL}/ai/classify/image`, fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      setClassification(res.data)
      setSelectedPlant(res.data.plant_key)
      setFallbackUsed(false)
    } catch (err) {
      const plant = PLANT_OPTIONS[0]
      setClassification({
        plant_key: plant,
        display_name: plant,
        predicted_class: plant,
        plant_group: groupByPlant[plant],
        confidence: 0.55,
      })
      setSelectedPlant(plant)
      setFallbackUsed(true)
      if (!endpointMissing(err)) setInfo('Classify failed, fallback plant is used')
    } finally {
      setLoading(false)
    }
  }

  const onSelectPlant = (plant: string) => {
    setSelectedPlant(plant)
    setClassification({
      plant_key: plant,
      display_name: plant,
      predicted_class: plant,
      plant_group: groupByPlant[plant],
      confidence: 1,
    })
    setFallbackUsed(true)
  }

  const onGetProfile = async () => {
    if (!selectedPlant) {
      setError('Please select plant first')
      return
    }
    setLoading(true)
    setError(null)
    try {
      const res = await axios.get<PlantProfile>(`${API_BASE_URL}/ai/profile/${encodeURIComponent(selectedPlant)}`)
      setProfile(res.data)
      setFallbackUsed(false)
    } catch {
      setProfile(PROFILE_FALLBACK[selectedPlant])
      setFallbackUsed(true)
    } finally {
      setLoading(false)
    }
  }

  const onRecommend = async () => {
    if (!latestSensor) {
      setError('Sensor data is not ready yet')
      return
    }
    if (mode !== 'ai') {
      setError('Please switch system mode to AI before generating AI recommendation')
      setInfo('AI recommend API is only used when mode=AI')
      return
    }
    const plantKey = classification?.plant_key || selectedPlant
    if (!plantKey) {
      setError('Please classify image (or select plant) first')
      return
    }
    setLoading(true)
    setError(null)
    try {
      const res = await axios.post<RecommendApiResponse>(`${API_BASE_URL}/ai/recommend`, {
        plant_key: plantKey,
        sensor: latestSensor,
        device_id: 'web-ui',
      })
      setRecommendation(mapRecommendToUi(res.data))
      setFallbackUsed(false)
    } catch (err) {
      if (profile) setRecommendation(recommendFallback(profile, latestSensor))
      setFallbackUsed(true)
      if (!endpointMissing(err)) setInfo('Recommend failed, fallback result is shown')
    } finally {
      setLoading(false)
    }
  }

  const onToggleAiMode = async (checked: boolean) => {
    const nextMode: Mode = checked ? 'ai' : 'manual'
    setLoading(true)
    try {
      await axios.post(`${API_BASE_URL}/system/mode`, { mode: nextMode })
      setMode(nextMode)
      setInfo(`Mode switched to ${nextMode.toUpperCase()}`)
    } catch {
      setError('Cannot switch system mode')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Box>
      <Typography variant="h5" sx={{ mb: 2 }}>
        AI Highlight - Week 4
      </Typography>
      <Stack spacing={2}>
        {error ? <Alert severity="error">{error}</Alert> : null}
        {info ? <Alert severity="info">{info}</Alert> : null}
        {fallbackUsed ? <Alert severity="warning">AI endpoint chưa sẵn sàng đầy đủ, đang dùng fallback để demo flow.</Alert> : null}

        <Card>
          <CardContent>
            <Typography variant="h6" sx={{ mb: 1 }}>Image upload</Typography>
            <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
              <Button variant="outlined" component="label" disabled={loading}>
                Upload image
                <input hidden type="file" accept="image/*" onChange={onFileChange} />
              </Button>
              <Button variant="contained" onClick={() => void onClassify()} disabled={loading || !selectedFile}>Classify plant</Button>
              {/* <TextField select label="Select plant manually" size="small" value={selectedPlant} onChange={(e) => onSelectPlant(e.target.value)} sx={{ minWidth: 220 }}>
                {PLANT_OPTIONS.map((plant) => (
                  <MenuItem key={plant} value={plant}>{plant}</MenuItem>
                ))}
              </TextField> */}
            </Stack>
            <Typography color="text.secondary" sx={{ mt: 1 }}>Uploaded file: {selectedFile?.name ?? '--'}</Typography>
          </CardContent>
        </Card>

        <Card>
          <CardContent>
            <Typography variant="h6" sx={{ mb: 1 }}>Classification result</Typography>
            {classification ? (
              <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
                <Typography>Plant: <b>{classification.display_name}</b></Typography>
                <Typography>Plant key: <b>{classification.plant_key}</b></Typography>
                <Typography>Group: <b>{classification.plant_group ?? '--'}</b></Typography>
                <Typography>Confidence: <b>{(classification.confidence * 100).toFixed(1)}%</b></Typography>
                {lowConfidence ? <Chip color="warning" label="Low confidence - manual confirmation recommended" /> : <Chip color="success" label="Confidence OK" />}
              </Stack>
            ) : <Typography color="text.secondary">No classification yet.</Typography>}
          </CardContent>
        </Card>

        <Card>
          <CardContent>
            <Typography variant="h6" sx={{ mb: 1 }}>Plant profile + recommendation</Typography>
            <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} sx={{ mb: 2 }}>
              {/* <Button variant="contained" onClick={() => void onGetProfile()} disabled={loading || !selectedPlant}>Load profile</Button> */}
              {/* <Button variant="contained" color="secondary" onClick={() => void onRecommend()} disabled={loading || !profile}>Generate recommendation</Button> */}
              <Button variant="outlined" color="secondary" onClick={() => void onRecommend()} disabled={loading}>Generate recommendation (manual)</Button>
            </Stack>
            <Typography color="text.secondary" sx={{ mb: 1 }}>
              In AI mode, backend auto-checks latest sensor data and auto-applies safe actions. This button is only for manual trigger.
            </Typography>

            {profile ? (
              <Table size="small" sx={{ mb: 1 }}>
                <TableBody>
                  <TableRow><TableCell>Plant</TableCell><TableCell>{profile.plant_name}</TableCell></TableRow>
                  <TableRow><TableCell>Soil</TableCell><TableCell>{profile.soil_threshold_min}% - target {profile.soil_threshold_target}%</TableCell></TableRow>
                  <TableRow><TableCell>Temp max</TableCell><TableCell>{profile.temp_threshold_max}°C</TableCell></TableRow>
                  <TableRow><TableCell>Light min</TableCell><TableCell>{profile.light_threshold_min}</TableCell></TableRow>
                  <TableRow><TableCell>Care summary</TableCell><TableCell>{profile.care_summary}</TableCell></TableRow>
                </TableBody>
              </Table>
            ) : <Typography color="text.secondary">Profile not loaded.</Typography>}

            <Typography color="text.secondary" sx={{ mt: 1 }}>
              Sensor snapshot: temp {latestSensor?.air_temperature ?? '--'}°C, humidity {latestSensor?.air_humidity ?? '--'}%, soil {latestSensor?.soil_moisture ?? '--'}%, light {latestSensor?.light_level ?? '--'}
            </Typography>
            {recommendation ? (
              <Stack spacing={1} sx={{ mt: 1 }}>
                <Typography>Recommendation: <b>{recommendation.recommendation}</b></Typography>
                <Typography>Action: <b>{recommendation.action_suggested}</b></Typography>
                <Typography sx={{ whiteSpace: 'pre-wrap' }}>Explanation: {recommendation.explanation}</Typography>
                <Chip color={recommendation.allowed_to_execute ? 'success' : 'warning'} label={recommendation.allowed_to_execute ? 'Safety: Allowed' : 'Safety: Blocked'} sx={{ width: 'fit-content' }} />
              </Stack>
            ) : null}
          </CardContent>
        </Card>

        <Card>
          <CardContent>
            <Typography variant="h6" sx={{ mb: 1 }}>AI mode + decision history</Typography>
            <FormControlLabel control={<Switch checked={mode === 'ai'} onChange={(_, c) => void onToggleAiMode(c)} disabled={loading} />} label={`Current mode: ${mode.toUpperCase()}`} />
            <Table size="small" sx={{ mt: 1 }}>
              <TableHead>
                <TableRow>
                  <TableCell>Time</TableCell>
                  <TableCell>Recommendation</TableCell>
                  <TableCell>Action</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell>Explanation</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {history.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5}>No AI decision logs yet.</TableCell>
                  </TableRow>
                ) : (
                  history.map((row) => (
                    <TableRow key={row.id}>
                      <TableCell>{new Date(row.created_at).toLocaleString()}</TableCell>
                      <TableCell>{row.recommendation}</TableCell>
                      <TableCell>{row.action_suggested}</TableCell>
                      <TableCell>{row.allowed_to_execute ? 'Allowed' : 'Blocked'}</TableCell>
                      <TableCell sx={{ whiteSpace: 'pre-wrap' }}>{row.explanation}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </Stack>
    </Box>
  )
}
