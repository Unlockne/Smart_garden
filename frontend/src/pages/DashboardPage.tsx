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

  useEffect(() => {
    let alive = true
    axios
      .get<SensorLatest>(`${API_BASE_URL}/sensors/latest`)
      .then((res) => {
        if (alive) setData(res.data)
      })
      .catch(() => {
        if (alive) setData(null)
      })

    return () => {
      alive = false
    }
  }, [])

  return (
    <Box>
      <Typography variant="h5" sx={{ mb: 2 }}>
        Dashboard
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
