import { createTheme } from '@mui/material/styles'

const PRIMARY = '#16A34A'
const PRIMARY_DARK = '#15803D'
const PRIMARY_LIGHT = '#22C55E'
const BG_PAGE = '#F0FDF4'
const BG_SIDEBAR = '#DCFCE7'
const TEXT_PRIMARY = '#0F172A'
const TEXT_SECONDARY = '#475569'

export const v2Theme = createTheme({
  palette: {
    mode: 'light',
    primary: {
      main: PRIMARY,
      dark: PRIMARY_DARK,
      light: PRIMARY_LIGHT,
      contrastText: '#FFFFFF',
    },
    success: { main: '#16A34A' },
    warning: { main: '#F59E0B' },
    error: { main: '#DC2626' },
    background: {
      default: BG_PAGE,
      paper: '#FFFFFF',
    },
    text: {
      primary: TEXT_PRIMARY,
      secondary: TEXT_SECONDARY,
    },
    divider: '#DCFCE7',
  },
  shape: {
    borderRadius: 16,
  },
  typography: {
    fontFamily:
      'Inter, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
    h4: { fontWeight: 700 },
    h5: { fontWeight: 700 },
    h6: { fontWeight: 700 },
    button: { textTransform: 'none', fontWeight: 600 },
  },
  components: {
    MuiCssBaseline: {
      styleOverrides: {
        body: { backgroundColor: BG_PAGE },
      },
    },
    MuiCard: {
      styleOverrides: {
        root: {
          borderRadius: 20,
          boxShadow: '0 1px 2px rgba(15,23,42,0.04), 0 1px 3px rgba(15,23,42,0.06)',
          border: '1px solid #E2E8F0',
        },
      },
    },
    MuiButton: {
      styleOverrides: {
        root: { borderRadius: 999, paddingInline: 18, paddingBlock: 8 },
        containedPrimary: {
          boxShadow: 'none',
          '&:hover': { boxShadow: 'none', backgroundColor: PRIMARY_DARK },
        },
      },
    },
    MuiChip: {
      styleOverrides: {
        root: { borderRadius: 999, fontWeight: 600 },
      },
    },
    MuiTableCell: {
      styleOverrides: {
        head: { fontWeight: 700, color: TEXT_SECONDARY, backgroundColor: '#F8FAFC' },
      },
    },
  },
})

export const v2Tokens = {
  bgPage: BG_PAGE,
  bgSidebar: BG_SIDEBAR,
  primary: PRIMARY,
  primaryDark: PRIMARY_DARK,
  primaryLight: PRIMARY_LIGHT,
  cardBorder: '#E2E8F0',
  softGreen: '#ECFDF5',
}
