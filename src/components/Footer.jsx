export default function Footer() {
  const year = new Date().getFullYear()
  return (
    <footer className="footer">
      <div className="container footer__inner">
        <span>© {year} Nick</span>
        <span>Built with React + Vite</span>
      </div>
    </footer>
  )
}
