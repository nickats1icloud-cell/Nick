/**
 * Εικονίδια εξαρτημάτων.
 *
 * Γραμμικά SVG αντί για emoji: τα emoji αλλάζουν σχήμα και χρώμα ανά
 * λειτουργικό σύστημα, δεν παίρνουν το χρώμα του κειμένου και δείχνουν
 * πρόχειρα σε εργαλείο μηχανικής. Όλα σχεδιάζονται σε πλέγμα 24×24 με
 * `currentColor`, οπότε κληρονομούν το χρώμα από το περιβάλλον τους.
 */

const S = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.7, strokeLinecap: 'round', strokeLinejoin: 'round' }

const ICONS = {
  button: (
    <>
      <rect x="3" y="3" width="18" height="18" rx="4" {...S} />
      <circle cx="12" cy="12" r="5" {...S} />
    </>
  ),
  toggle: (
    <>
      <rect x="6" y="2.5" width="12" height="19" rx="3" {...S} />
      <circle cx="12" cy="8" r="2.6" {...S} />
      <path d="M12 10.6v8" {...S} />
    </>
  ),
  lever: (
    <>
      <rect x="3" y="13" width="18" height="7" rx="2" {...S} />
      <path d="M5 13 19 5" {...S} />
      <circle cx="19" cy="5" r="2" {...S} />
    </>
  ),
  knob: (
    <>
      <circle cx="12" cy="12" r="7.5" {...S} />
      <path d="M12 4.5v3M19.5 12h-3M12 19.5v-3M4.5 12h3" {...S} />
      <path d="M12 12 15 9" {...S} />
    </>
  ),
  dial: (
    <>
      <circle cx="12" cy="12" r="8" {...S} />
      <path d="M12 12 12 6.5" {...S} />
      <path d="M6 18 8 16M18 18 16 16" {...S} />
    </>
  ),
  grid: (
    <>
      <rect x="3" y="3" width="18" height="18" rx="2.5" {...S} />
      <path d="M9 3v18M15 3v18M3 9h18M3 15h18" {...S} />
    </>
  ),
  magnet: (
    <>
      <path d="M6 4v8a6 6 0 0 0 12 0V4" {...S} />
      <path d="M3 4h6M15 4h6M6 10h6M15 10h6" {...S} />
    </>
  ),
  scale: (
    <>
      <path d="M12 3v16M6 19h12" {...S} />
      <path d="M4 8h16" {...S} />
      <path d="M4 8 1.5 14a3 3 0 0 0 5 0z" {...S} />
      <path d="M20 8l2.5 6a3 3 0 0 1-5 0z" {...S} />
    </>
  ),
  chip: (
    <>
      <rect x="6" y="6" width="12" height="12" rx="1.5" {...S} />
      <path d="M9 3v3M15 3v3M9 18v3M15 18v3M3 9h3M3 15h3M18 9h3M18 15h3" {...S} />
    </>
  ),
  strip: (
    <>
      <rect x="2" y="8" width="20" height="8" rx="2" {...S} />
      <circle cx="7" cy="12" r="1.6" {...S} />
      <circle cx="12" cy="12" r="1.6" {...S} />
      <circle cx="17" cy="12" r="1.6" {...S} />
    </>
  ),
  bulb: (
    <>
      <path d="M12 3a6 6 0 0 0-3 11.2V17h6v-2.8A6 6 0 0 0 12 3z" {...S} />
      <path d="M10 20h4" {...S} />
    </>
  ),
  digits: (
    <>
      <rect x="2.5" y="5" width="19" height="14" rx="2" {...S} />
      <path d="M7 9v6M12 9v6M17 9v6" {...S} />
      <path d="M7 9h5M7 12h5" {...S} />
    </>
  ),
  screen: (
    <>
      <rect x="2.5" y="4" width="19" height="13" rx="2" {...S} />
      <path d="M9 20h6M12 17v3" {...S} />
      <path d="M6 8h5M6 11h8" {...S} />
    </>
  ),
  gauge: (
    <>
      <path d="M4 17a8 8 0 1 1 16 0" {...S} />
      <path d="M12 17 16 10" {...S} />
      <circle cx="12" cy="17" r="1.4" {...S} />
    </>
  ),
  servo: (
    <>
      <rect x="4" y="10" width="13" height="10" rx="1.5" {...S} />
      <circle cx="10.5" cy="7" r="2.5" {...S} />
      <path d="M10.5 7 20 4" {...S} />
    </>
  ),
  fan: (
    <>
      <circle cx="12" cy="12" r="9" {...S} />
      <circle cx="12" cy="12" r="2" {...S} />
      <path d="M12 10c0-4 1-6 3-6s2 3-1 5M14 12c4 0 6 1 6 3s-3 2-5-1M12 14c0 4-1 6-3 6s-2-3 1-5M10 12c-4 0-6-1-6-3s3-2 5 1" {...S} />
    </>
  ),
  waves: (
    <>
      <rect x="8" y="7" width="8" height="10" rx="2" {...S} />
      <path d="M4.5 8.5a7 7 0 0 0 0 7M2 6a11 11 0 0 0 0 12M19.5 8.5a7 7 0 0 1 0 7M22 6a11 11 0 0 1 0 12" {...S} />
    </>
  ),
  speaker: (
    <>
      <path d="M4 9.5h3.5L12 5.5v13L7.5 14.5H4z" {...S} />
      <path d="M16 9.5a4 4 0 0 1 0 5M18.5 7a7.5 7.5 0 0 1 0 10" {...S} />
    </>
  ),
  plug: (
    <>
      <path d="M9 3v5M15 3v5" {...S} />
      <path d="M5.5 8h13v3a6.5 6.5 0 0 1-13 0z" {...S} />
      <path d="M12 17.5V21" {...S} />
    </>
  ),
  converter: (
    <>
      <rect x="3" y="6" width="18" height="12" rx="2" {...S} />
      <path d="M7 12h4M9 10l2 2-2 2" {...S} />
      <path d="M13 12h4" {...S} />
    </>
  ),
  transistor: (
    <>
      <circle cx="12" cy="12" r="8.5" {...S} />
      <path d="M8 8v8M8 12h3.5M11.5 9l4-2.5M11.5 15l4 2.5" {...S} />
    </>
  ),
  shift: (
    <>
      <path d="M8 20V6M8 6 5 9M8 6l3 3" {...S} />
      <path d="M16 4v14M16 18l3-3M16 18l-3-3" {...S} />
    </>
  ),
  resistor: (
    <>
      <path d="M2 12h3l2-4 3 8 3-8 3 8 2-4h3" {...S} />
    </>
  ),
  diode: (
    <>
      <path d="M2 12h6M16 12h6" {...S} />
      <path d="M8 6.5v11L16 12z" {...S} />
      <path d="M16 6.5v11" {...S} />
    </>
  ),
  capacitor: (
    <>
      <path d="M2 12h8M14 12h8" {...S} />
      <path d="M10 5v14M14 5v14" {...S} />
    </>
  ),
  board: (
    <>
      <rect x="4" y="3" width="16" height="18" rx="2" {...S} />
      <rect x="9" y="9" width="6" height="6" rx="1" {...S} />
      <path d="M4 7h2M4 11h2M4 15h2M18 7h2M18 11h2M18 15h2" {...S} />
    </>
  ),
}

/**
 * @param {string} name  κλειδί εικονιδίου (το πεδίο `icon` του εξαρτήματος)
 * @param {number} size  πλευρά σε px
 */
export default function PartIcon({ name, size = 18, className = '' }) {
  const glyph = ICONS[name] || ICONS.chip
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      className={`picon ${className}`.trim()}
      aria-hidden="true"
      focusable="false"
    >
      {glyph}
    </svg>
  )
}
