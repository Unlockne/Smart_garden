import { CssBaseline } from '@mui/material'
import { Route, Routes } from 'react-router-dom'

import AppLayout from './layouts/AppLayout'
import DashboardPage from './pages/DashboardPage'
import ControlPage from './pages/ControlPage'
import HistoryPage from './pages/HistoryPage'
import AIPage from './pages/AIPage'

export default function App() {
  return (
    <>
      <CssBaseline />
      <Routes>
        <Route element={<AppLayout />}>
          <Route path="/" element={<DashboardPage />} />
          <Route path="/control" element={<ControlPage />} />
          <Route path="/history" element={<HistoryPage />} />
          <Route path="/ai" element={<AIPage />} />
        </Route>
      </Routes>
    </>
  )
}
