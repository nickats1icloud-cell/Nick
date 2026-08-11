import { Routes, Route } from 'react-router-dom'
import Layout from './components/Layout.jsx'
import Home from './pages/Home.jsx'
import About from './pages/About.jsx'
import Dashboard from './pages/Dashboard.jsx'
import Podcast from './pages/Podcast.jsx'
import NotFound from './pages/NotFound.jsx'
import ChampionshipProvider from './components/champ/ChampionshipProvider.jsx'
import ChampLayout from './components/champ/ChampLayout.jsx'
import Overview from './pages/champ/Overview.jsx'
import Calendar from './pages/champ/Calendar.jsx'
import Teams from './pages/champ/Teams.jsx'
import TeamPage from './pages/champ/TeamPage.jsx'
import Planner from './pages/champ/Planner.jsx'
import Results from './pages/champ/Results.jsx'
import StandingsPage from './pages/champ/StandingsPage.jsx'
import Admin from './pages/champ/Admin.jsx'

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Layout />}>
        <Route index element={<Home />} />
        <Route path="dashboard" element={<Dashboard />} />
        <Route path="podcast" element={<Podcast />} />

        {/* Το management system του πρωταθλήματος: όλα τα sub-pages μοιράζονται
            το ίδιο state μέσα από τον ChampionshipProvider. */}
        <Route
          path="championship"
          element={
            <ChampionshipProvider>
              <ChampLayout />
            </ChampionshipProvider>
          }
        >
          <Route index element={<Overview />} />
          <Route path="calendar" element={<Calendar />} />
          <Route path="teams" element={<Teams />} />
          <Route path="teams/:teamId" element={<TeamPage />} />
          <Route path="planner" element={<Planner />} />
          <Route path="planner/:eventId" element={<Planner />} />
          <Route path="planner/:eventId/:teamId" element={<Planner />} />
          <Route path="results" element={<Results />} />
          <Route path="standings" element={<StandingsPage />} />
          <Route path="admin" element={<Admin />} />
        </Route>

        <Route path="about" element={<About />} />
        <Route path="*" element={<NotFound />} />
      </Route>
    </Routes>
  )
}
