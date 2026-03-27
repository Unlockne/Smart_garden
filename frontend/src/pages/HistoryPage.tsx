import { Box, Card, CardContent, Typography } from '@mui/material'

export default function HistoryPage() {
  return (
    <Box>
      <Typography variant="h5" sx={{ mb: 2 }}>
        History
      </Typography>

      <Card>
        <CardContent>
          <Typography color="text.secondary">
            Week 1 skeleton: history table/chart sẽ nối ở Week 2.
          </Typography>
        </CardContent>
      </Card>
    </Box>
  )
}
