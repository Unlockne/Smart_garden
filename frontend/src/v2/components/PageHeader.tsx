import { Box, Button, Stack, Typography } from '@mui/material'
import { ReactNode } from 'react'

import { ContactIcon, SyncIcon } from './Icons'

type Props = {
  title: string
  subtitle?: string
  onSync?: () => void
  syncing?: boolean
  rightSlot?: ReactNode
}

export default function PageHeader({ title, subtitle, onSync, syncing, rightSlot }: Props) {
  return (
    <Stack
      direction={{ xs: 'column', md: 'row' }}
      justifyContent="space-between"
      alignItems={{ xs: 'flex-start', md: 'center' }}
      spacing={2}
      sx={{ mb: 3 }}
    >
      <Box>
        <Typography variant="h4">{title}</Typography>
        {subtitle ? (
          <Typography variant="body1" color="text.secondary" sx={{ mt: 0.5 }}>
            {subtitle}
          </Typography>
        ) : null}
      </Box>

      <Stack direction="row" spacing={1.5} alignItems="center">
        {rightSlot}
        <Button
          variant="outlined"
          color="inherit"
          startIcon={<ContactIcon />}
          sx={{ bgcolor: '#fff', borderColor: '#E2E8F0' }}
        >
          Contact support
        </Button>
        <Button
          variant="contained"
          startIcon={<SyncIcon />}
          onClick={onSync}
          disabled={syncing}
        >
          Sync latest data
        </Button>
      </Stack>
    </Stack>
  )
}
