import { Box, Button, Stack, Typography } from '@mui/material'
import { ReactNode } from 'react'

import { v2Tokens } from '../theme'

type Props = {
  active: boolean
  icon: ReactNode
  label: string
  description?: string
  onClick: () => void
  disabled?: boolean
}

export default function ModeButton({
  active,
  icon,
  label,
  description,
  onClick,
  disabled,
}: Props) {
  return (
    <Button
      onClick={onClick}
      disabled={disabled}
      fullWidth
      sx={{
        flex: 1,
        py: 2,
        borderRadius: 4,
        border: '2px solid',
        borderColor: active ? v2Tokens.primary : '#E2E8F0',
        bgcolor: active ? v2Tokens.softGreen : '#fff',
        color: active ? v2Tokens.primaryDark : '#334155',
        '&:hover': {
          bgcolor: active ? v2Tokens.softGreen : '#F8FAFC',
          borderColor: v2Tokens.primary,
        },
      }}
    >
      <Stack direction="row" spacing={1.5} alignItems="center">
        <Box
          sx={{
            width: 36,
            height: 36,
            borderRadius: 2,
            bgcolor: active ? v2Tokens.primary : '#F1F5F9',
            color: active ? '#fff' : '#64748B',
            display: 'grid',
            placeItems: 'center',
          }}
        >
          {icon}
        </Box>
        <Box sx={{ textAlign: 'left' }}>
          <Typography variant="subtitle1" sx={{ fontWeight: 700, lineHeight: 1.2 }}>
            {label}
          </Typography>
          {description ? (
            <Typography variant="caption" color="text.secondary">
              {description}
            </Typography>
          ) : null}
        </Box>
      </Stack>
    </Button>
  )
}
