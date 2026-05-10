import { Avatar, Box, Stack, Tooltip, Typography } from '@mui/material'
import { ReactNode } from 'react'
import { Outlet, useLocation, useNavigate } from 'react-router-dom'

import { v2Tokens } from '../theme'
import {
  AIIcon,
  ControlIcon,
  DashboardIcon,
  HistoryIcon,
  LeafIcon,
} from '../components/Icons'

const SIDEBAR_WIDTH = 88

type NavItem = {
  path: string
  label: string
  icon: ReactNode
}

const NAV_ITEMS: NavItem[] = [
  { path: '/v2', label: 'Dashboard', icon: <DashboardIcon /> },
  { path: '/v2/control', label: 'Control', icon: <ControlIcon /> },
  { path: '/v2/history', label: 'History', icon: <HistoryIcon /> },
  { path: '/v2/ai', label: 'AI', icon: <AIIcon /> },
]

function NavButton({
  item,
  active,
  onClick,
}: {
  item: NavItem
  active: boolean
  onClick: () => void
}) {
  return (
    <Tooltip title={item.label} placement="right">
      <Stack
        component="button"
        onClick={onClick}
        alignItems="center"
        spacing={0.5}
        sx={{
          width: 64,
          py: 1.2,
          border: 'none',
          cursor: 'pointer',
          bgcolor: active ? '#fff' : 'transparent',
          borderRadius: 3,
          color: active ? v2Tokens.primaryDark : '#334155',
          boxShadow: active ? '0 1px 3px rgba(15,23,42,0.08)' : 'none',
          transition: 'all 0.2s',
          '&:hover': { bgcolor: '#fff' },
        }}
      >
        <Box sx={{ fontSize: 22, display: 'flex' }}>{item.icon}</Box>
        <Typography variant="caption" sx={{ fontWeight: 600, fontSize: 11 }}>
          {item.label}
        </Typography>
      </Stack>
    </Tooltip>
  )
}

export default function MainLayout() {
  const navigate = useNavigate()
  const location = useLocation()

  const isActive = (path: string) => {
    if (path === '/v2') return location.pathname === '/v2' || location.pathname === '/v2/'
    return location.pathname === path
  }

  return (
    <Box sx={{ display: 'flex', minHeight: '100vh', bgcolor: v2Tokens.bgPage }}>
      <Stack
        sx={{
          width: SIDEBAR_WIDTH,
          bgcolor: v2Tokens.bgSidebar,
          py: 2,
          alignItems: 'center',
          gap: 1,
          position: 'sticky',
          top: 0,
          height: '100vh',
          zIndex: 1200,
        }}
      >
        <Box
          sx={{
            width: 44,
            height: 44,
            borderRadius: 2,
            bgcolor: v2Tokens.primary,
            color: '#fff',
            display: 'grid',
            placeItems: 'center',
            mb: 1,
          }}
        >
          <LeafIcon />
        </Box>

        <Stack spacing={0.5} alignItems="center" sx={{ flexGrow: 1, mt: 1 }}>
          {NAV_ITEMS.map((it) => (
            <NavButton
              key={it.path}
              item={it}
              active={isActive(it.path)}
              onClick={() => navigate(it.path)}
            />
          ))}
        </Stack>

        <Tooltip title="Account" placement="right">
          <Avatar
            sx={{ width: 40, height: 40, bgcolor: v2Tokens.primary }}
            alt="User"
          >
            U
          </Avatar>
        </Tooltip>
      </Stack>

      <Box component="main" sx={{ flexGrow: 1, p: { xs: 2, md: 3 } }}>
        <Outlet />
      </Box>
    </Box>
  )
}
