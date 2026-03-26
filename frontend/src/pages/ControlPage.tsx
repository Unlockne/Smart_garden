import { Box, Button, Card, CardContent, Stack, Typography } from '@mui/material'
import axios from 'axios'

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://127.0.0.1:8000/api/v1'

async function sendControl(target_device: 'pump' | 'fan' | 'light', action: 'on' | 'off') {
  await axios.post(`${API_BASE_URL}/devices/control`, {
    target_device,
    action,
    actor_type: 'user',
    reason: 'manual control from dashboard',
  })
}

export default function ControlPage() {
  return (
    <Box>
      <Typography variant="h5" sx={{ mb: 2 }}>
        Control
      </Typography>

      <Card>
        <CardContent>
          <Typography sx={{ mb: 2 }} color="text.secondary">
            Manual toggles (Week 1 skeleton)
          </Typography>

          <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
            <Button variant="contained" onClick={() => void sendControl('pump', 'on')}>
              Pump ON
            </Button>
            <Button variant="outlined" onClick={() => void sendControl('pump', 'off')}>
              Pump OFF
            </Button>

            <Button variant="contained" onClick={() => void sendControl('fan', 'on')}>
              Fan ON
            </Button>
            <Button variant="outlined" onClick={() => void sendControl('fan', 'off')}>
              Fan OFF
            </Button>

            <Button variant="contained" onClick={() => void sendControl('light', 'on')}>
              Light ON
            </Button>
            <Button variant="outlined" onClick={() => void sendControl('light', 'off')}>
              Light OFF
            </Button>
          </Stack>
        </CardContent>
      </Card>
    </Box>
  )
}
