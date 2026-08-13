import { Routes, Route } from 'react-router-dom'
import Layout from './components/Layout.jsx'
import Home from './pages/Home.jsx'
import About from './pages/About.jsx'
import Dashboard from './pages/Dashboard.jsx'
import Podcast from './pages/Podcast.jsx'
import SimLab from './pages/SimLab.jsx'
import WiringLab from './pages/WiringLab.jsx'
import NotFound from './pages/NotFound.jsx'

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Layout />}>
        <Route index element={<Home />} />
        <Route path="dashboard" element={<Dashboard />} />
        <Route path="podcast" element={<Podcast />} />
        <Route path="lab" element={<SimLab />} />
        <Route path="lab/wiring" element={<WiringLab />} />
        <Route path="about" element={<About />} />
        <Route path="*" element={<NotFound />} />
      </Route>
    </Routes>
  )
}
