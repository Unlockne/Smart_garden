import { CssBaseline } from '@mui/material'
import { Route, Routes } from 'react-router-dom'

import AppLayout from './layouts/AppLayout'
import DashboardPage from './pages/DashboardPage'
import ControlPage from './pages/ControlPage'
import HistoryPage from './pages/HistoryPage'
import AIPage from './pages/AIPage'
import AnalyticsPage from './pages/AnalyticsPage'

import V2Shell from './v2/V2Shell'
import DashboardPageV2 from './v2/pages/DashboardPageV2'
import ControlPageV2 from './v2/pages/ControlPageV2'
import HistoryPageV2 from './v2/pages/HistoryPageV2'
import AIPageV2 from './v2/pages/AIPageV2'

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

        <Route path="/v2" element={<V2Shell />}>
          <Route index element={<DashboardPageV2 />} />
          <Route path="control" element={<ControlPageV2 />} />
          <Route path="history" element={<HistoryPageV2 />} />
          <Route path="ai" element={<AIPageV2 />} />
        </Route>
        
        <Route path="/analytics" element={<AnalyticsPage />} />
      </Routes>
    </>
  )
}
