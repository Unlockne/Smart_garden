import { Box, Card, CardContent, Stack, Switch, Typography } from '@mui/material'
import { ReactNode } from 'react'

import { v2Tokens } from '../theme'

type Props = {
  icon: ReactNode
  label: string
  state: boolean
  onChange: (next: boolean) => void
  disabled?: boolean
}

export default function DeviceCard({ icon, label, state, onChange, disabled }: Props) {
  return (
    <Card sx={{ flex: 1 }}>
      <CardContent sx={{ p: 2 }}>
        <Stack direction="row" alignItems="center" spacing={2}>
          <Box
            sx={{
              width: 44,
              height: 44,
              borderRadius: 2,
              bgcolor: v2Tokens.softGreen,
              color: v2Tokens.primary,
              display: 'grid',
              placeItems: 'center',
            }}
          >
            {icon}
          </Box>
          <Box sx={{ flexGrow: 1 }}>
            <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
              {label}
            </Typography>
          </Box>
          <Stack alignItems="center">
            <Switch
              checked={state}
              onChange={(_, v) => onChange(v)}
              disabled={disabled}
              color="primary"
            />
            <Typography
              variant="caption"
              sx={{
                color: state ? v2Tokens.primaryDark : 'text.secondary',
                fontWeight: 700,
                mt: -0.5,
              }}
            >
              Status: {state ? 'ON' : 'OFF'}
            </Typography>
          </Stack>
        </Stack>
      </CardContent>
    </Card>
  )
}
