import { Box, Card, CardContent, Grid, Typography } from '@mui/material'
import axios from 'axios'
import { useEffect, useState } from 'react'

type SensorLatest = {
  recorded_at: string
  air_temperature: number
  air_humidity: number
  soil_moisture: number
  light_level: number
}

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://127.0.0.1:8000/api/v1'

export default function DashboardPage() {
  const [data, setData] = useState<SensorLatest | null>(null)
  const [lastUpdated, setLastUpdated] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let alive = true

    const fetchLatest = async () => {
      try {
        const res = await axios.get<SensorLatest>(`${API_BASE_URL}/sensors/latest`)
        if (!alive) return
        setData(res.data)
        setLastUpdated(new Date().toLocaleString())
        setError(null)
      } catch {
        if (!alive) return
        setError('Cannot fetch latest sensor data')
      }
    }

    void fetchLatest()
    const t = window.setInterval(() => void fetchLatest(), 5000)

    return () => {
      alive = false
      window.clearInterval(t)
    }
  }, [])

  return (
    <Box>
      <Typography variant="h5" sx={{ mb: 2 }}>
        Dashboard
      </Typography>

      <Typography variant="body2" color={error ? 'error' : 'text.secondary'} sx={{ mb: 2 }}>
        {error ? error : `Updated at: ${lastUpdated ?? '--'}`}
      </Typography>

      <Grid container spacing={2}>
        <Grid item xs={12} md={3}>
          <Card>
            <CardContent>
              <Typography color="text.secondary">Air Temperature</Typography>
              <Typography variant="h4">{data ? `${data.air_temperature}°C` : '--'}</Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={3}>
          <Card>
            <CardContent>
              <Typography color="text.secondary">Air Humidity</Typography>
              <Typography variant="h4">{data ? `${data.air_humidity}%` : '--'}</Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={3}>
          <Card>
            <CardContent>
              <Typography color="text.secondary">Soil Moisture</Typography>
              <Typography variant="h4">{data ? `${data.soil_moisture}%` : '--'}</Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={3}>
          <Card>
            <CardContent>
              <Typography color="text.secondary">Light Level</Typography>
              <Typography variant="h4">{data ? `${data.light_level}` : '--'}</Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  )
}
