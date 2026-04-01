import {
  Box,
  Card,
  CardContent,
  CircularProgress,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Typography,
} from '@mui/material'
import axios from 'axios'
import { useEffect, useMemo, useState } from 'react'
import { Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'

type SensorRow = {
  recorded_at: string
  air_temperature: number
  air_humidity: number
  soil_moisture: number
  light_level: number
  device_id?: string | null
  source: string
}

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://127.0.0.1:8000/api/v1'

export default function HistoryPage() {
  const [rows, setRows] = useState<SensorRow[]>([])
  const [loading, setLoading] = useState<boolean>(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let alive = true

    const fetchHistory = async () => {
      try {
        const res = await axios.get<SensorRow[]>(`${API_BASE_URL}/sensors/history?limit=20`)
        if (!alive) return
        setRows(res.data)
        setError(null)
      } catch {
        if (!alive) return
        setError('Cannot fetch history')
      } finally {
        if (!alive) return
        setLoading(false)
      }
    }

    void fetchHistory()
    const t = window.setInterval(() => void fetchHistory(), 2000)

    return () => {
      alive = false
      window.clearInterval(t)
    }
  }, [])

  const chartData = useMemo(() => {
    return [...rows]
      .reverse()
      .map((r) => ({
        time: new Date(r.recorded_at).toLocaleTimeString(),
        air_temperature: r.air_temperature,
        soil_moisture: r.soil_moisture,
        light_level: r.light_level,
      }))
  }, [rows])

  return (
    <Box>
      <Typography variant="h5" sx={{ mb: 2 }}>
        History
      </Typography>

      <Card>
        <CardContent>
          {loading ? (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <CircularProgress size={20} />
              <Typography color="text.secondary">Loading...</Typography>
            </Box>
          ) : error ? (
            <Typography color="error">{error}</Typography>
          ) : (
            <>
              <Typography color="text.secondary" sx={{ mb: 2 }}>
                Latest 20 records
              </Typography>

              <Box sx={{ width: '100%', height: 240, mb: 2 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chartData}>
                    <XAxis dataKey="time" hide />
                    <YAxis />
                    <Tooltip />
                    <Line type="monotone" dataKey="air_temperature" stroke="#1976d2" dot={false} name="Nhiệt độ" />
                    <Line type="monotone" dataKey="soil_moisture" stroke="#2e7d32" dot={false} name="Độ ẩm đất" />
                    <Line type="monotone" dataKey="light_level" stroke="#ed6c02" dot={false} name="Ánh sáng" />
                  </LineChart>
                </ResponsiveContainer>
              </Box>

              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Recorded At</TableCell>
                    <TableCell align="right">Temp (°C)</TableCell>
                    <TableCell align="right">Air Hum (%)</TableCell>
                    <TableCell align="right">Soil (%)</TableCell>
                    <TableCell align="right">Light</TableCell>
                    <TableCell>Device</TableCell>
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
                      <TableCell>{r.device_id ?? '--'}</TableCell>
                      <TableCell>{r.source}</TableCell>
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
