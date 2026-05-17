import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Grid,
  LinearProgress,
  Stack,
  Switch,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Typography,
} from '@mui/material'
import axios from 'axios'
import { ChangeEvent, useEffect, useMemo, useState } from 'react'

import {
  aiApi,
  devicesApi,
  sensorsApi,
  systemApi,
  type AIDecisionApiRow,
  type ClassifyResponse,
  type Mode,
  type PlantProfile,
  type RecommendApiResponse,
  type SensorLatest,
} from '../api'
import { CheckCircleIcon, UploadIcon } from '../components/Icons'
import PageHeader from '../components/PageHeader'
import { v2Tokens } from '../theme'

type RecommendUi = {
  recommendation: string
  action_suggested: string
  explanation: string
  allowed_to_execute: boolean
}

type DecisionRow = {
  id: number | string
  created_at: string
  recommendation: string
  action_suggested: string
  allowed_to_execute: boolean
}

const PROFILE_FALLBACK: Record<string, PlantProfile> = {
  FloweringPlant: { plant_name: 'Cây ra hoa (FloweringPlant)', plant_group: 'flowering', soil_threshold_min: 40, soil_threshold_target: 75, temp_threshold_max: 32, light_threshold_min: 150, watering_duration_sec: 6, care_summary: 'Needs balanced moisture and bright light for flowering.' },
  LeafyPlant: { plant_name: 'Cây lá (LeafyPlant)', plant_group: 'leafy_ornamental', soil_threshold_min: 45, soil_threshold_target: 80, temp_threshold_max: 30, light_threshold_min: 100, watering_duration_sec: 6, care_summary: 'Prefers higher moisture and moderate filtered light.' },
  Succulents: { plant_name: 'Cây mọng nước (Succulents)', plant_group: 'succulent', soil_threshold_min: 15, soil_threshold_target: 50, temp_threshold_max: 35, light_threshold_min: 250, watering_duration_sec: 5, care_summary: 'Needs dry soil and strong direct light.' },
}

function endpointMissing(err: unknown) {
  return axios.isAxiosError(err) && (err.response?.status === 404 || err.response?.status === 405)
}

function recommendFallback(profile: PlantProfile, sensor: SensorLatest): RecommendUi {
  if (sensor.soil_moisture < profile.soil_threshold_min) {
    return {
      recommendation: `Soil moisture is below minimum threshold for ${profile.plant_name}.`,
      action_suggested: 'pump_on_short',
      explanation: `Soil moisture ${sensor.soil_moisture} < min ${profile.soil_threshold_min}.`,
      allowed_to_execute: true,
    }
  }
  if (sensor.air_temperature > profile.temp_threshold_max) {
    return {
      recommendation: `Temperature is high for ${profile.plant_name}.`,
      action_suggested: 'fan_on',
      explanation: `Temperature ${sensor.air_temperature} > max ${profile.temp_threshold_max}.`,
      allowed_to_execute: true,
    }
  }
  return {
    recommendation: `${profile.plant_name} is currently in a safe range.`,
    action_suggested: 'none',
    explanation: 'Current sensor values are within profile thresholds.',
    allowed_to_execute: true,
  }
}

function mapRecommendToUi(payload: RecommendApiResponse): RecommendUi {
  if (payload.actions.length === 0) {
    return {
      recommendation: `${payload.display_name} is currently in a safe range.`,
      action_suggested: 'none',
      explanation: payload.safety_reason ?? 'No action suggested by AI.',
      allowed_to_execute: payload.safety_passed,
    }
  }
  const actionList = payload.actions.map((a) => `${a.target_device}_${a.action}`).join(', ')
  const reasonList = payload.actions.map((a) => `- ${a.reason}`).join('\n')
  return {
    recommendation: `${payload.display_name}: AI suggested ${payload.actions.length} action(s).`,
    action_suggested: actionList,
    explanation: payload.safety_reason ? `${reasonList}\nSafety note: ${payload.safety_reason}` : reasonList,
    allowed_to_execute: payload.safety_passed,
  }
}

function mapDecisionLog(log: AIDecisionApiRow): DecisionRow {
  let parsed: Record<string, unknown> = {}
  try {
    const obj = JSON.parse(log.output_json)
    if (obj && typeof obj === 'object') parsed = obj as Record<string, unknown>
  } catch {
    parsed = {}
  }
  const parsedActions = Array.isArray(parsed.actions) ? parsed.actions : []
  const actionList = parsedActions
    .map((a) => {
      if (!a || typeof a !== 'object') return ''
      const item = a as Record<string, unknown>
      return `${String(item.target_device ?? 'unknown')}_${String(item.action ?? 'unknown')}`
    })
    .filter(Boolean)
    .join(', ')

  const recommendation =
    typeof parsed.recommendation === 'string'
      ? parsed.recommendation
      : typeof parsed.display_name === 'string'
        ? `${parsed.display_name}`
        : `Step: ${log.step}`
  const action_suggested =
    typeof parsed.action_suggested === 'string' ? parsed.action_suggested : actionList || 'none'
  const allowed_to_execute =
    typeof parsed.allowed_to_execute === 'boolean'
      ? parsed.allowed_to_execute
      : typeof parsed.safety_passed === 'boolean'
        ? parsed.safety_passed
        : log.safety_passed

  return { id: log.id, created_at: log.created_at, recommendation, action_suggested, allowed_to_execute }
}

function getGreeting() {
  const h = new Date().getHours()
  if (h < 12) return 'Morning'
  if (h < 17) return 'Afternoon'
  if (h < 22) return 'Evening'
  return 'Night'
}

export default function AIPageV2() {
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [classification, setClassification] = useState<ClassifyResponse | null>(null)
  const [profile, setProfile] = useState<PlantProfile | null>(null)
  const [recommendation, setRecommendation] = useState<RecommendUi | null>(null)
  const [history, setHistory] = useState<DecisionRow[]>([])
  const [latestSensor, setLatestSensor] = useState<SensorLatest | null>(null)
  const [mode, setMode] = useState<Mode>('manual')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [info, setInfo] = useState<string | null>(null)
  const [fallbackUsed, setFallbackUsed] = useState(false)

  const lowConfidence = useMemo(
    () => (classification ? classification.confidence < 0.6 : false),
    [classification],
  )

  useEffect(() => {
    let alive = true
    const load = async () => {
      try {
        const [s, d] = await Promise.all([sensorsApi.latest(), devicesApi.state()])
        if (!alive) return
        setLatestSensor(s)
        setMode(d.mode)
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
        const rows = await aiApi.decisions(10)
        if (!alive) return
        setHistory(rows.map(mapDecisionLog))
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

  const onFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0] ?? null
    setSelectedFile(f)
    setError(null)
    if (previewUrl) URL.revokeObjectURL(previewUrl)
    setPreviewUrl(f ? URL.createObjectURL(f) : null)
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
      const data = await aiApi.classifyImage(selectedFile)
      setClassification(data)
      setFallbackUsed(false)
      try {
        const p = await aiApi.profile(data.plant_key)
        setProfile(p)
      } catch {
        setProfile(PROFILE_FALLBACK[data.plant_key] ?? null)
      }
    } catch (err) {
      const fallbackKey = 'FloweringPlant'
      setClassification({
        plant_key: fallbackKey,
        display_name: fallbackKey,
        predicted_class: fallbackKey,
        plant_group: PROFILE_FALLBACK[fallbackKey].plant_group,
        confidence: 0.55,
      })
      setProfile(PROFILE_FALLBACK[fallbackKey])
      setFallbackUsed(true)
      if (!endpointMissing(err)) setInfo('Classify failed, fallback plant is used')
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
      return
    }
    const plantKey = classification?.plant_key
    if (!plantKey) {
      setError('Please classify image first')
      return
    }
    setLoading(true)
    setError(null)
    try {
      const res = await aiApi.recommend(plantKey, latestSensor)
      setRecommendation(mapRecommendToUi(res))
      setFallbackUsed(false)
    } catch (err) {
      if (profile) setRecommendation(recommendFallback(profile, latestSensor))
      setFallbackUsed(true)
      if (!endpointMissing(err)) setInfo('Recommend failed, fallback result is shown')
    } finally {
      setLoading(false)
    }
  }

  const onToggleAi = async (checked: boolean) => {
    const next: Mode = checked ? 'ai' : 'manual'
    setLoading(true)
    try {
      await systemApi.setMode(next)
      setMode(next)
      setInfo(`Mode switched to ${next.toUpperCase()}`)
    } catch {
      setError('Cannot switch system mode')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Box>
      <PageHeader title="AI Plant Analysis & Care Tips" subtitle={`${getGreeting()}, Hello!`} />

      <Stack spacing={2} sx={{ mb: 2 }}>
        {error ? <Alert severity="error">{error}</Alert> : null}
        {info ? <Alert severity="info">{info}</Alert> : null}
        {fallbackUsed ? (
          <Alert severity="warning">AI endpoint chưa sẵn sàng đầy đủ, đang dùng fallback để demo flow.</Alert>
        ) : null}
      </Stack>

      <Grid container spacing={2}>
        <Grid item xs={12} md={5}>
          <Stack spacing={2}>
            <Card>
              <CardContent>
                <Typography variant="h6" sx={{ mb: 2 }}>
                  Image Upload
                </Typography>
                <Box
                  sx={{
                    border: '2px dashed #CBD5E1',
                    borderRadius: 4,
                    p: 4,
                    textAlign: 'center',
                    bgcolor: '#F8FAFC',
                  }}
                >
                  <UploadIcon sx={{ fontSize: 32, color: 'text.secondary' }} />
                  <Typography variant="subtitle1" sx={{ mt: 1 }}>
                    Drag &amp; Drop Image
                  </Typography>
                  <Button component="label" sx={{ textTransform: 'none' }}>
                    or Browse Files
                    <input hidden type="file" accept="image/*" onChange={onFileChange} />
                  </Button>
                  <Typography variant="caption" color="text.secondary" display="block">
                    {selectedFile ? selectedFile.name : 'No file selected'}
                  </Typography>
                  <Button
                    variant="contained"
                    onClick={() => void onClassify()}
                    disabled={loading || !selectedFile}
                    sx={{ mt: 2 }}
                  >
                    Classify Plant
                  </Button>
                </Box>
              </CardContent>
            </Card>

            <Card>
              <CardContent>
                <Typography variant="h6" sx={{ mb: 2 }}>
                  Classification Result
                </Typography>
                {classification ? (
                  <Stack spacing={1.5}>
                    {previewUrl ? (
                      <Box
                        component="img"
                        src={previewUrl}
                        alt="Uploaded"
                        sx={{
                          width: '100%',
                          maxHeight: 220,
                          objectFit: 'cover',
                          borderRadius: 3,
                        }}
                      />
                    ) : (
                      <Box
                        sx={{
                          width: '100%',
                          height: 180,
                          borderRadius: 3,
                          bgcolor: v2Tokens.softGreen,
                        }}
                      />
                    )}
                    <Stack direction="row" alignItems="center" justifyContent="space-between">
                      <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
                        {classification.display_name}
                      </Typography>
                      <Chip
                        size="small"
                        color={lowConfidence ? 'warning' : 'success'}
                        label={`${(classification.confidence * 100).toFixed(0)}% Confidence`}
                      />
                    </Stack>
                    {classification.plant_group ? (
                      <Typography variant="caption" color="text.secondary">
                        Group: {classification.plant_group}
                      </Typography>
                    ) : null}
                  </Stack>
                ) : (
                  <Typography color="text.secondary">No classification yet.</Typography>
                )}
              </CardContent>
            </Card>
          </Stack>
        </Grid>

        <Grid item xs={12} md={7}>
          <Stack spacing={2}>
            <Card>
              <CardContent>
                <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
                  <Typography variant="h6">Plant Profile &amp; AI Recommendation</Typography>
                  <Stack direction="row" alignItems="center" spacing={1}>
                    <Typography variant="caption" color="text.secondary">
                      AI Mode
                    </Typography>
                    <Switch
                      checked={mode === 'ai'}
                      onChange={(_, c) => void onToggleAi(c)}
                      disabled={loading}
                      color="primary"
                    />
                  </Stack>
                </Stack>

                {profile ? (
                  <Stack spacing={2}>
                    <Box>
                      <Typography variant="caption" color="text.secondary">
                        Target Soil Moisture: {profile.soil_threshold_min}%-{profile.soil_threshold_target}%
                      </Typography>
                      <LinearProgress
                        variant="determinate"
                        value={Math.min(profile.soil_threshold_target, 100)}
                        sx={{ height: 8, borderRadius: 999, mt: 0.5 }}
                      />
                    </Box>
                    <Box>
                      <Typography variant="caption" color="text.secondary">
                        Target Temperature: max {profile.temp_threshold_max}°C
                      </Typography>
                      <LinearProgress
                        variant="determinate"
                        value={Math.min(profile.temp_threshold_max * 2.5, 100)}
                        color="success"
                        sx={{ height: 8, borderRadius: 999, mt: 0.5 }}
                      />
                    </Box>
                  </Stack>
                ) : (
                  <Typography color="text.secondary">Profile not loaded yet.</Typography>
                )}

                <Box sx={{ mt: 2 }}>
                  <Button
                    variant="contained"
                    startIcon={<CheckCircleIcon />}
                    onClick={() => void onRecommend()}
                    disabled={loading || !classification}
                  >
                    Generate recommendation
                  </Button>
                </Box>

                {recommendation ? (
                  <Box
                    sx={{
                      mt: 2,
                      p: 2,
                      borderRadius: 3,
                      bgcolor: v2Tokens.softGreen,
                      border: `1px solid ${v2Tokens.primary}33`,
                    }}
                  >
                    <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 0.5 }}>
                      {recommendation.recommendation}
                    </Typography>
                    <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap', color: 'text.secondary' }}>
                      {recommendation.explanation}
                    </Typography>
                    <Stack direction="row" spacing={1} sx={{ mt: 1 }}>
                      <Chip size="small" label={`Action: ${recommendation.action_suggested}`} />
                      <Chip
                        size="small"
                        color={recommendation.allowed_to_execute ? 'success' : 'warning'}
                        label={recommendation.allowed_to_execute ? 'Safety: Allowed' : 'Safety: Blocked'}
                      />
                    </Stack>
                  </Box>
                ) : null}
              </CardContent>
            </Card>

            <Card>
              <CardContent>
                <Typography variant="h6" sx={{ mb: 2 }}>
                  AI Decision History
                </Typography>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Date</TableCell>
                      <TableCell>Recommendation</TableCell>
                      <TableCell>Action</TableCell>
                      <TableCell>Status</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {history.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={4}>
                          <Typography color="text.secondary">No AI decisions yet.</Typography>
                        </TableCell>
                      </TableRow>
                    ) : (
                      history.map((row) => (
                        <TableRow key={row.id}>
                          <TableCell>{new Date(row.created_at).toLocaleDateString()}</TableCell>
                          <TableCell>{row.recommendation}</TableCell>
                          <TableCell>{row.action_suggested}</TableCell>
                          <TableCell>
                            <Chip
                              size="small"
                              color={row.allowed_to_execute ? 'success' : 'warning'}
                              label={row.allowed_to_execute ? 'Allowed' : 'Blocked'}
                            />
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </Stack>
        </Grid>
      </Grid>
    </Box>
  )
}
