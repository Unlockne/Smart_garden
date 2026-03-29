import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  CircularProgress,
  Divider,
  FormControlLabel,
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
import { useEffect, useMemo, useState } from 'react'

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://127.0.0.1:8000/api/v1'

type Mode = 'manual' | 'auto' | 'ai'

type DeviceState = {
  recorded_at: string
  pump_state: boolean
  fan_state: boolean
  light_state: boolean
  mode: Mode
}

type ControlLogRow = {
  id: number
  created_at: string
  target_device: string
  action: string
  actor_type: string
  reason: string
  status: string
  note?: string | null
}

async function sendControl(target_device: 'pump' | 'fan' | 'light', action: 'on' | 'off') {
  return axios.post(`${API_BASE_URL}/devices/control`, {
    target_device,
    action,
    actor_type: 'user',
    reason: 'manual control from dashboard',
  })
}

async function setMode(mode: Mode) {
  return axios.post(`${API_BASE_URL}/system/mode`, { mode })
}

export default function ControlPage() {
  const [state, setState] = useState<DeviceState | null>(null)
  const [logs, setLogs] = useState<ControlLogRow[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [info, setInfo] = useState<string | null>(null)

  const manualDisabled = useMemo(() => state?.mode === 'auto', [state?.mode])

  useEffect(() => {
    let alive = true

    const fetchAll = async () => {
      try {
        const [stRes, logsRes] = await Promise.all([
          axios.get<DeviceState>(`${API_BASE_URL}/devices/state`),
          axios.get<ControlLogRow[]>(`${API_BASE_URL}/logs/control?limit=10`),
        ])

        if (!alive) return
        setState(stRes.data)
        setLogs(logsRes.data)
        setError(null)
      } catch {
        if (!alive) return
        setError('Cannot fetch device state/logs')
      } finally {
        if (!alive) return
        setLoading(false)
      }
    }

    void fetchAll()
    const t = window.setInterval(() => void fetchAll(), 5000)

    return () => {
      alive = false
      window.clearInterval(t)
    }
  }, [])

  const onToggle = async (target: 'pump' | 'fan' | 'light', nextOn: boolean) => {
    setBusy(true)
    setInfo(null)
    try {
      await sendControl(target, nextOn ? 'on' : 'off')
      setInfo('Command sent successfully')
    } catch {
      setError('Failed to send command')
    } finally {
      setBusy(false)
    }
  }

  const onModeSwitch = async (next: Mode) => {
    setBusy(true)
    setInfo(null)
    try {
      await setMode(next)
      setInfo(`Mode switched to ${next}`)
    } catch {
      setError('Failed to switch mode')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Box>
      <Typography variant="h5" sx={{ mb: 2 }}>
        Control
      </Typography>

      <Card>
        <CardContent>
          {loading ? (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <CircularProgress size={20} />
              <Typography color="text.secondary">Loading...</Typography>
            </Box>
          ) : (
            <>
              {error ? <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert> : null}
              {info ? <Alert severity="success" sx={{ mb: 2 }}>{info}</Alert> : null}

              <Typography sx={{ mb: 1 }} color="text.secondary">
                Current status
              </Typography>

              <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} sx={{ mb: 2 }}>
                <Typography>Mode: <b>{state?.mode ?? '--'}</b></Typography>
                <Typography>Pump: <b>{state?.pump_state ? 'ON' : 'OFF'}</b></Typography>
                <Typography>Fan: <b>{state?.fan_state ? 'ON' : 'OFF'}</b></Typography>
                <Typography>Light: <b>{state?.light_state ? 'ON' : 'OFF'}</b></Typography>
              </Stack>

              <Typography sx={{ mb: 1 }} color="text.secondary">
                Mode switch
              </Typography>

              <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} sx={{ mb: 2 }}>
                <Button disabled={busy} variant={state?.mode === 'manual' ? 'contained' : 'outlined'} onClick={() => void onModeSwitch('manual')}>
                  Manual
                </Button>
                <Button disabled={busy} variant={state?.mode === 'auto' ? 'contained' : 'outlined'} onClick={() => void onModeSwitch('auto')}>
                  Auto
                </Button>
                <Button disabled variant={state?.mode === 'ai' ? 'contained' : 'outlined'}>
                  AI (coming soon)
                </Button>
              </Stack>

              <Divider sx={{ my: 2 }} />

              <Typography sx={{ mb: 1 }} color="text.secondary">
                Manual control
              </Typography>

              {manualDisabled ? (
                <Alert severity="warning" sx={{ mb: 2 }}>
                  Manual control is disabled while Auto mode is enabled.
                </Alert>
              ) : null}

              <Stack direction={{ xs: 'column', md: 'row' }} spacing={3} sx={{ mb: 3 }}>
                <FormControlLabel
                  control={
                    <Switch
                      checked={state?.pump_state ?? false}
                      onChange={(_, v) => void onToggle('pump', v)}
                      disabled={busy || manualDisabled}
                    />
                  }
                  label="Pump"
                />

                <FormControlLabel
                  control={
                    <Switch
                      checked={state?.fan_state ?? false}
                      onChange={(_, v) => void onToggle('fan', v)}
                      disabled={busy || manualDisabled}
                    />
                  }
                  label="Fan"
                />

                <FormControlLabel
                  control={
                    <Switch
                      checked={state?.light_state ?? false}
                      onChange={(_, v) => void onToggle('light', v)}
                      disabled={busy || manualDisabled}
                    />
                  }
                  label="Light"
                />
              </Stack>

              <Typography sx={{ mb: 1 }} color="text.secondary">
                Recent control logs
              </Typography>

              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Time</TableCell>
                    <TableCell>Device</TableCell>
                    <TableCell>Action</TableCell>
                    <TableCell>Actor</TableCell>
                    <TableCell>Status</TableCell>
                    <TableCell>Reason</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {logs.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell>{new Date(r.created_at).toLocaleString()}</TableCell>
                      <TableCell>{r.target_device}</TableCell>
                      <TableCell>{r.action}</TableCell>
                      <TableCell>{r.actor_type}</TableCell>
                      <TableCell>{r.status}</TableCell>
                      <TableCell>{r.reason}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </>
          )}
        </CardContent>
      </Card>
    </Box>
  )
}
