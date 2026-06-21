import { BrowserRouter as Router, Routes, Route } from 'react-router-dom'
import Layout from '@/components/Layout'
import Home from '@/pages/Home'
import Import from '@/pages/Import'
import Verify from '@/pages/Verify'
import Report from '@/pages/Report'

export default function App() {
  return (
    <Router>
      <Routes>
        <Route element={<Layout />}>
          <Route path="/" element={<Home />} />
          <Route path="/import" element={<Import />} />
          <Route path="/verify/:waybillId" element={<Verify />} />
          <Route path="/report/:waybillId" element={<Report />} />
        </Route>
      </Routes>
    </Router>
  )
}
