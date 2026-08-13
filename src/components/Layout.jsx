import { Outlet, useLocation } from 'react-router-dom'
import Navbar from './Navbar.jsx'
import Footer from './Footer.jsx'

/**
 * Σελίδες που θέλουν όλο το πλάτος και δεν μπαίνουν στο `.container` των 960px.
 * Ορίζουν μόνες τους το μέγιστο πλάτος και τα περιθώριά τους.
 */
const WIDE_ROUTES = ['/lab']

export default function Layout() {
  const { pathname } = useLocation()
  const wide = WIDE_ROUTES.some((r) => pathname === r || pathname.endsWith(r))

  return (
    <div className="app">
      <Navbar />
      <main className="app__main">
        {wide ? <Outlet /> : <div className="container"><Outlet /></div>}
      </main>
      <Footer />
    </div>
  )
}
