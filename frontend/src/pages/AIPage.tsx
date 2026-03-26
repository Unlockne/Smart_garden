import { Box, Card, CardContent, Typography } from '@mui/material'

export default function AIPage() {
  return (
    <Box>
      <Typography variant="h5" sx={{ mb: 2 }}>
        AI
      </Typography>

      <Card>
        <CardContent>
          <Typography color="text.secondary">
            Week 1 skeleton: AI classify/profile endpoints sẽ mock/implement ở các tuần sau.
          </Typography>
        </CardContent>
      </Card>
    </Box>
  )
}
