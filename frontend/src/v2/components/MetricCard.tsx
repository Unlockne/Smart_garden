import { Box, Card, CardContent, Stack, Typography } from '@mui/material'
import { ReactNode } from 'react'

import { v2Tokens } from '../theme'

type Props = {
  icon: ReactNode
  label: string
  value: string
  caption?: string
  iconBg?: string
  iconColor?: string
}

export default function MetricCard({
  icon,
  label,
  value,
  caption,
  iconBg = v2Tokens.softGreen,
  iconColor = v2Tokens.primary,
}: Props) {
  return (
    <Card sx={{ height: '100%' }}>
      <CardContent sx={{ p: 2.5 }}>
        <Stack direction="row" spacing={1.5} alignItems="flex-start">
          <Box
            sx={{
              width: 40,
              height: 40,
              borderRadius: 2,
              bgcolor: iconBg,
              color: iconColor,
              display: 'grid',
              placeItems: 'center',
              flexShrink: 0,
            }}
          >
            {icon}
          </Box>
          <Box sx={{ minWidth: 0 }}>
            <Typography variant="caption" color="text.secondary">
              {label}
            </Typography>
            <Typography variant="h6" sx={{ lineHeight: 1.2, mt: 0.25 }}>
              {value}
            </Typography>
            {caption ? (
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
                {caption}
              </Typography>
            ) : null}
          </Box>
        </Stack>
      </CardContent>
    </Card>
  )
}
