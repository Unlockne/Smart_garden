import {
  Box,
  Card,
  CardContent,
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
import { Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'

import { sensorsApi, type SensorRow } from '../api'
import PageHeader from '../components/PageHeader'
import { v2Tokens } from '../theme'

export default function HistoryPageV2() {
  const [rows, setRows] = useState<SensorRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchHistory = async () => {
    try {
      const data = await sensorsApi.history(20)
      setRows(data)
      setError(null)
    } catch {
      setError('Cannot fetch history')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void fetchHistory()
    const t = window.setInterval(() => void fetchHistory(), 2000)
    return () => window.clearInterval(t)
  }, [])

  const chartData = useMemo(
    () =>
      [...rows].reverse().map((r) => ({
        time: new Date(r.recorded_at).toLocaleTimeString(),
        temp: r.air_temperature,
        humidity: r.air_humidity,
        soil: r.soil_moisture,
        light: r.light_level,
      })),
    [rows],
  )

  return (
    <Box>
      <PageHeader
        title="Sensor History"
        subtitle="Latest 20 sensor records, refreshed every 2s"
        onSync={() => void fetchHistory()}
      />

      {loading ? (
        <Stack direction="row" alignItems="center" spacing={2} sx={{ p: 4 }}>
          <CircularProgress size={20} />
          <Typography color="text.secondary">Loading...</Typography>
        </Stack>
      ) : error ? (
        <Typography color="error">{error}</Typography>
      ) : (
        <Stack spacing={2}>
          <Card>
            <CardContent>
              <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
                <Typography variant="h6">Sensor data trends</Typography>
                <Stack direction="row" spacing={2}>
                  <LegendDot color={v2Tokens.primary} label="Temp" />
                  <LegendDot color="#0EA5E9" label="Humidity" />
                  <LegendDot color="#7C3AED" label="Soil" />
                  <LegendDot color="#F59E0B" label="Light" />
                </Stack>
              </Stack>
              <Box sx={{ width: '100%', height: 280 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chartData}>
                    <XAxis dataKey="time" hide />
                    <YAxis tick={{ fontSize: 12 }} />
                    <Tooltip />
                    <Line type="monotone" dataKey="temp" stroke={v2Tokens.primary} dot={false} strokeWidth={2} />
                    <Line type="monotone" dataKey="humidity" stroke="#0EA5E9" dot={false} strokeWidth={2} />
                    <Line type="monotone" dataKey="soil" stroke="#7C3AED" dot={false} strokeWidth={2} />
                    <Line type="monotone" dataKey="light" stroke="#F59E0B" dot={false} strokeWidth={2} />
                  </LineChart>
                </ResponsiveContainer>
              </Box>
            </CardContent>
          </Card>

          <Card>
            <CardContent>
              <Typography variant="h6" sx={{ mb: 2 }}>
                Recent records
              </Typography>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Recorded At</TableCell>
                    <TableCell align="right">Temp (°C)</TableCell>
                    <TableCell align="right">Humidity (%)</TableCell>
                    <TableCell align="right">Soil (%)</TableCell>
                    <TableCell align="right">Light</TableCell>
                    <TableCell>Source</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {rows.map((r) => (
                    <TableRow key={r.recorded_at}>
                      <TableCell>{new Date(r.recorded_at).toLocaleString()}</TableCell>
                      <TableCell align="right">{r.air_temperature}</TableCell>
                      <TableCell align="right">{r.air_humidity}</TableCell>
                      <TableCell align="right">{r.soil_moisture}</TableCell>
                      <TableCell align="right">{r.light_level}</TableCell>
                      <TableCell>{r.source}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </Stack>
      )}
    </Box>
  )
}

function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <Stack direction="row" spacing={0.75} alignItems="center">
      <Box sx={{ width: 8, height: 8, borderRadius: 999, bgcolor: color }} />
      <Typography variant="caption" color="text.secondary">
        {label}
      </Typography>
    </Stack>
  )
}
