import { CssBaseline } from '@mui/material'
import { ThemeProvider } from '@mui/material/styles'

import MainLayout from './layouts/MainLayout'
import { v2Theme } from './theme'

export default function V2Shell() {
  return (
    <ThemeProvider theme={v2Theme}>
      <CssBaseline />
      <MainLayout />
    </ThemeProvider>
  )
}
