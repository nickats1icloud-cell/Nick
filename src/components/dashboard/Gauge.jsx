/**
 * Στρογγυλό αναλογικό όργανο σε SVG με βελόνα, υποδιαιρέσεις και ζώνη redline.
 * Χρησιμοποιείται για στροφόμετρο και ταχύμετρο.
 */

const START_ANGLE = 135 // κάτω-αριστερά
const SWEEP = 270 // μοίρες συνολικής διαδρομής

function polar(cx, cy, r, angleDeg) {
  const a = (angleDeg * Math.PI) / 180
  return { x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) }
}

function valueToAngle(value, max) {
  const ratio = Math.min(1, Math.max(0, value / max))
  return START_ANGLE + ratio * SWEEP
}

export default function Gauge({
  value,
  max,
  majorStep,
  redlineFrom,
  label,
  unit,
  digits = 0,
  size = 320,
  accent = '#ff3b30',
}) {
  const cx = size / 2
  const cy = size / 2
  const r = size / 2 - 18
  const tickOuter = r
  const tickInnerMajor = r - 18
  const tickInnerMinor = r - 10

  const ticks = []
  const labels = []
  const majorCount = Math.round(max / majorStep)
  for (let i = 0; i <= majorCount; i++) {
    const v = i * majorStep
    const angle = valueToAngle(v, max)
    const inRed = redlineFrom != null && v >= redlineFrom
    const o = polar(cx, cy, tickOuter, angle)
    const inn = polar(cx, cy, tickInnerMajor, angle)
    ticks.push(
      <line
        key={`maj-${i}`}
        x1={o.x}
        y1={o.y}
        x2={inn.x}
        y2={inn.y}
        stroke={inRed ? accent : '#e8edf5'}
        strokeWidth={3}
        strokeLinecap="round"
      />,
    )
    const lp = polar(cx, cy, tickInnerMajor - 16, angle)
    labels.push(
      <text
        key={`lab-${i}`}
        x={lp.x}
        y={lp.y}
        fill={inRed ? accent : '#cdd6e4'}
        fontSize={size * 0.052}
        fontWeight="600"
        textAnchor="middle"
        dominantBaseline="central"
      >
        {v / (majorStep >= 1000 ? 1000 : 1)}
      </text>,
    )

    // minor ticks
    if (i < majorCount) {
      for (let j = 1; j < 5; j++) {
        const mv = v + (j * majorStep) / 5
        const ma = valueToAngle(mv, max)
        const mo = polar(cx, cy, tickOuter, ma)
        const mi = polar(cx, cy, tickInnerMinor, ma)
        ticks.push(
          <line
            key={`min-${i}-${j}`}
            x1={mo.x}
            y1={mo.y}
            x2={mi.x}
            y2={mi.y}
            stroke={mv >= (redlineFrom ?? Infinity) ? accent : '#6b7587'}
            strokeWidth={1.5}
          />,
        )
      }
    }
  }

  // Redline arc
  let redArc = null
  if (redlineFrom != null) {
    const a0 = valueToAngle(redlineFrom, max)
    const a1 = valueToAngle(max, max)
    const p0 = polar(cx, cy, r + 4, a0)
    const p1 = polar(cx, cy, r + 4, a1)
    const large = a1 - a0 > 180 ? 1 : 0
    redArc = (
      <path
        d={`M ${p0.x} ${p0.y} A ${r + 4} ${r + 4} 0 ${large} 1 ${p1.x} ${p1.y}`}
        fill="none"
        stroke={accent}
        strokeWidth={4}
        strokeLinecap="round"
      />
    )
  }

  const needleAngle = valueToAngle(value, max)
  const tip = polar(cx, cy, r - 6, needleAngle)
  const tail = polar(cx, cy, -22, needleAngle)

  return (
    <svg viewBox={`0 0 ${size} ${size}`} className="gauge" role="img" aria-label={label}>
      <defs>
        <radialGradient id={`face-${label}`} cx="50%" cy="42%" r="75%">
          <stop offset="0%" stopColor="#20242e" />
          <stop offset="100%" stopColor="#0b0d11" />
        </radialGradient>
      </defs>

      <circle cx={cx} cy={cy} r={r + 8} fill="#05070a" stroke="#2a2f3a" strokeWidth="2" />
      <circle cx={cx} cy={cy} r={r} fill={`url(#face-${label})`} />

      {redArc}
      {ticks}
      {labels}

      <text
        x={cx}
        y={cy + r * 0.42}
        fill="#9aa3b2"
        fontSize={size * 0.05}
        fontWeight="600"
        textAnchor="middle"
        letterSpacing="1"
      >
        {label}
      </text>
      <text
        x={cx}
        y={cy + r * 0.42 + size * 0.07}
        fill="#6b7587"
        fontSize={size * 0.038}
        textAnchor="middle"
      >
        {unit}
      </text>

      {/* digital readout */}
      <text
        x={cx}
        y={cy - r * 0.28}
        fill="#e8edf5"
        fontSize={size * 0.11}
        fontWeight="700"
        textAnchor="middle"
        fontFamily="'Courier New', monospace"
      >
        {value.toFixed(digits)}
      </text>

      {/* needle */}
      <g
        style={{
          transition: 'transform 0.06s linear',
          transformOrigin: `${cx}px ${cy}px`,
        }}
      >
        <polygon
          points={`${tail.x},${tail.y} ${tip.x},${tip.y}`}
          stroke={accent}
          strokeWidth={4}
          strokeLinecap="round"
        />
        <line
          x1={cx}
          y1={cy}
          x2={tip.x}
          y2={tip.y}
          stroke={accent}
          strokeWidth={4}
          strokeLinecap="round"
        />
        <line
          x1={cx}
          y1={cy}
          x2={tail.x}
          y2={tail.y}
          stroke={accent}
          strokeWidth={6}
          strokeLinecap="round"
        />
      </g>
      <circle cx={cx} cy={cy} r={size * 0.04} fill="#1a1d24" stroke={accent} strokeWidth="3" />
    </svg>
  )
}
