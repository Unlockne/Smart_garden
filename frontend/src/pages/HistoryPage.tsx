import { Box, Card, CardContent, Table, TableBody, TableCell, TableHead, TableRow, Typography } from '@mui/material'
import axios from 'axios'
import { useEffect, useMemo, useState } from 'react'
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'

type SensorHistoryItem = {
  recorded_at: string
  air_temperature?: number | null
  air_humidity?: number | null
  soil_moisture?: number | null
  light_level?: number | null
}

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://127.0.0.1:8000/api/v1'

export default function HistoryPage() {
  const [items, setItems] = useState<SensorHistoryItem[]>([])

  useEffect(() => {
    let alive = true

    axios
      .get<SensorHistoryItem[]>(`${API_BASE_URL}/sensors/history`, { params: { limit: 50 } })
      .then((res) => {
        if (!alive) return
        setItems(res.data)
      })
      .catch(() => {
        if (!alive) return
        setItems([])
      })

    return () => {
      alive = false
    }
  }, [])

  const chartData = useMemo(() => {
    return [...items]
      .reverse()
      .map((it) => ({
        ...it,
        time: new Date(it.recorded_at).toLocaleTimeString(),
      }))
  }, [items])

  return (
    <Box>
      <Typography variant="h5" sx={{ mb: 2 }}>
        History
      </Typography>

      <Card>
        <CardContent>
          <Typography sx={{ mb: 2 }} color="text.secondary">
            Latest 50 sensor readings (from backend)
          </Typography>

          <Box sx={{ height: 280, width: '100%', mb: 3 }}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData} margin={{ top: 10, right: 20, bottom: 10, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="time" />
                <YAxis />
                <Tooltip />
                <Line type="monotone" dataKey="soil_moisture" stroke="#1976d2" dot={false} />
                <Line type="monotone" dataKey="air_temperature" stroke="#d32f2f" dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </Box>

          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Recorded at</TableCell>
                <TableCell align="right">Temp (°C)</TableCell>
                <TableCell align="right">Humidity (%)</TableCell>
                <TableCell align="right">Soil (%)</TableCell>
                <TableCell align="right">Light</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {items.map((row) => (
                <TableRow key={row.recorded_at}>
                  <TableCell>{new Date(row.recorded_at).toLocaleString()}</TableCell>
                  <TableCell align="right">{row.air_temperature ?? '--'}</TableCell>
                  <TableCell align="right">{row.air_humidity ?? '--'}</TableCell>
                  <TableCell align="right">{row.soil_moisture ?? '--'}</TableCell>
                  <TableCell align="right">{row.light_level ?? '--'}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </Box>
  )
}
