import {
  Alert,
  Box,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Typography,
} from '@mui/material'
import { useEffect, useMemo, useState } from 'react'

import {
  devicesApi,
  logsApi,
  systemApi,
  type ControlLogRow,
  type DeviceState,
  type Mode,
} from '../api'
import DeviceCard from '../components/DeviceCard'
import {
  BrainIcon,
  CheckCircleIcon,
  FanIcon,
  GearIcon,
  HandIcon,
  LightIcon,
  WaterDropIcon,
} from '../components/Icons'
import ModeButton from '../components/ModeButton'
import PageHeader from '../components/PageHeader'

export default function ControlPageV2() {
  const [state, setState] = useState<DeviceState | null>(null)
  const [logs, setLogs] = useState<ControlLogRow[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [info, setInfo] = useState<string | null>(null)

  const manualDisabled = useMemo(() => state?.mode !== 'manual', [state?.mode])

  const fetchAll = async () => {
    try {
      const [s, l] = await Promise.all([devicesApi.state(), logsApi.control(10)])
      setState(s)
      setLogs(l)
      setError(null)
    } catch {
      setError('Cannot fetch device state/logs')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void fetchAll()
    const t = window.setInterval(() => void fetchAll(), 5000)
    return () => window.clearInterval(t)
  }, [])

  const onToggle = async (target: 'pump' | 'fan' | 'light', nextOn: boolean) => {
    setBusy(true)
    setInfo(null)
    try {
      await devicesApi.control(target, nextOn ? 'on' : 'off')
      setInfo('Command sent successfully')
      await fetchAll()
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
      await systemApi.setMode(next)
      setInfo(`Mode switched to ${next.toUpperCase()}`)
      await fetchAll()
    } catch {
      setError('Failed to switch mode')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Box>
      <PageHeader title="Garden Device Control Center" onSync={() => void fetchAll()} />

      {error ? <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert> : null}
      {info ? <Alert severity="success" sx={{ mb: 2 }}>{info}</Alert> : null}

      {loading ? (
        <Stack direction="row" alignItems="center" spacing={2} sx={{ p: 4 }}>
          <CircularProgress size={20} />
          <Typography color="text.secondary">Loading...</Typography>
        </Stack>
      ) : (
        <Stack spacing={2}>
          <Card>
            <CardContent>
              <Typography variant="h6" sx={{ mb: 2 }}>
                System Mode
              </Typography>
              <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
                <ModeButton
                  active={state?.mode === 'manual'}
                  icon={<HandIcon />}
                  label="Manual Mode"
                  description="Direct device control"
                  onClick={() => void onModeSwitch('manual')}
                  disabled={busy}
                />
                <ModeButton
                  active={state?.mode === 'auto'}
                  icon={<GearIcon />}
                  label="Auto Mode"
                  description="Threshold-based rules"
                  onClick={() => void onModeSwitch('auto')}
                  disabled={busy}
                />
                <ModeButton
                  active={state?.mode === 'ai'}
                  icon={<BrainIcon />}
                  label="AI Mode"
                  description="Smart recommendations"
                  onClick={() => void onModeSwitch('ai')}
                  disabled={busy}
                />
              </Stack>
            </CardContent>
          </Card>

          <Card>
            <CardContent>
              <Typography variant="h6" sx={{ mb: 2 }}>
                Manual Device Control
              </Typography>
              {manualDisabled ? (
                <Alert severity="info" sx={{ mb: 2 }}>
                  Manual control is available only in Manual mode.
                </Alert>
              ) : null}
              <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
                <DeviceCard
                  icon={<WaterDropIcon />}
                  label="Water Pump"
                  state={state?.pump_state ?? false}
                  onChange={(v) => void onToggle('pump', v)}
                  disabled={busy || manualDisabled}
                />
                <DeviceCard
                  icon={<FanIcon />}
                  label="Cooling Fan"
                  state={state?.fan_state ?? false}
                  onChange={(v) => void onToggle('fan', v)}
                  disabled={busy || manualDisabled}
                />
                <DeviceCard
                  icon={<LightIcon />}
                  label="Grow Lights"
                  state={state?.light_state ?? false}
                  onChange={(v) => void onToggle('light', v)}
                  disabled={busy || manualDisabled}
                />
              </Stack>
            </CardContent>
          </Card>

          <Card>
            <CardContent>
              <Typography variant="h6" sx={{ mb: 2 }}>
                Recent Control Logs
              </Typography>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Time</TableCell>
                    <TableCell>Device</TableCell>
                    <TableCell>Action</TableCell>
                    <TableCell>Actor</TableCell>
                    <TableCell>Status</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {logs.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5}>
                        <Typography color="text.secondary">No control logs yet.</Typography>
                      </TableCell>
                    </TableRow>
                  ) : (
                    logs.map((r) => (
                      <TableRow key={r.id}>
                        <TableCell>{new Date(r.created_at).toLocaleTimeString()}</TableCell>
                        <TableCell sx={{ textTransform: 'capitalize' }}>{r.target_device}</TableCell>
                        <TableCell>{`Turned ${r.action.toUpperCase()}`}</TableCell>
                        <TableCell sx={{ textTransform: 'capitalize' }}>{r.actor_type}</TableCell>
                        <TableCell>
                          <Chip
                            size="small"
                            color={r.status === 'success' ? 'success' : 'warning'}
                            icon={<CheckCircleIcon sx={{ fontSize: 16 }} />}
                            label={r.status}
                            sx={{ textTransform: 'capitalize' }}
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
      )}
    </Box>
  )
}
