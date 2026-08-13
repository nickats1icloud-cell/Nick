import { NavLink } from 'react-router-dom'

export default function Navbar() {
  return (
    <header className="navbar">
      <div className="container navbar__inner">
        <NavLink to="/" className="navbar__brand">
          <img src={`${import.meta.env.BASE_URL}vite.svg`} alt="" />
          <span>Nick</span>
        </NavLink>
        <nav className="navbar__links">
          <NavLink to="/" end>
            Home
          </NavLink>
          <NavLink to="/dashboard">Καντράν</NavLink>
          <NavLink to="/lab">Εργαστήριο</NavLink>
          <NavLink to="/podcast">Podcast</NavLink>
          <NavLink to="/about">About</NavLink>
        </nav>
      </div>
    </header>
  )
}
