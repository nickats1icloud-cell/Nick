/**
 * Σχέδια των πλακετών.
 *
 * Κάθε πλακέτα ζωγραφίζεται σε SVG με τις πραγματικές της αναλογίες (το
 * viewBox είναι τα χιλιοστά της), το χρώμα της πλακέτας, τη θέση του USB, το
 * τσιπ και τις σειρές ακροδεκτών. Έτσι όταν αλλάζεις πλακέτα βλέπεις αμέσως
 * ότι το Teensy είναι μακρύ και στενό, το Uno κοντόχοντρο και το Pico πράσινο
 * με το BOOTSEL του.
 *
 * Είναι σχέδια, όχι φωτογραφίες: παραμένουν καθαρά σε κάθε μέγεθος και δεν
 * κουβαλάνε άδειες χρήσης τρίτων.
 */

/** Σειρά επαφών κατά μήκος μιας ακμής. */
function Header({ x, y, count, spacing = 2.54, vertical = true, gold = '#d4af37' }) {
  return (
    <g>
      {Array.from({ length: count }, (_, i) => (
        <circle
          key={i}
          cx={vertical ? x : x + i * spacing}
          cy={vertical ? y + i * spacing : y}
          r={0.85}
          fill="#111"
          stroke={gold}
          strokeWidth="0.55"
        />
      ))}
    </g>
  )
}

/** Ολοκληρωμένο κύκλωμα με ποδαράκια. */
function Chip({ x, y, w, h, label, pins = 7 }) {
  return (
    <g>
      <rect x={x} y={y} width={w} height={h} rx="0.6" fill="#15171c" />
      <circle cx={x + 1.6} cy={y + 1.6} r="0.6" fill="#3a3f4a" />
      {Array.from({ length: pins }, (_, i) => (
        <g key={i}>
          <rect x={x - 0.8} y={y + 1.4 + i * ((h - 2.8) / (pins - 1))} width="0.8" height="0.5" fill="#9ca3af" />
          <rect x={x + w} y={y + 1.4 + i * ((h - 2.8) / (pins - 1))} width="0.8" height="0.5" fill="#9ca3af" />
        </g>
      ))}
      {label && (
        <text x={x + w / 2} y={y + h / 2 + 1} textAnchor="middle" fill="#4b5563" style={{ font: '2px monospace' }}>
          {label}
        </text>
      )}
    </g>
  )
}

/**
 * Μεταλλική υποδοχή USB.
 *
 * Οι συντεταγμένες περνάνε από Number(): αν έρθουν ως συμβολοσειρές από το
 * JSX, το `x + w * 0.2` θα έκανε συνένωση κειμένου και το εσωτερικό άνοιγμα
 * θα προσγειωνόταν στη γωνία της πλακέτας.
 */
function Usb(props) {
  const x = Number(props.x)
  const y = Number(props.y)
  const w = Number(props.w)
  const h = Number(props.h)
  const type = props.type || 'micro'
  return (
    <g>
      <rect x={x} y={y} width={w} height={h} rx="0.6" fill="#b8bcc4" stroke="#8b9099" strokeWidth="0.3" />
      <rect x={x + w * 0.2} y={y + h * 0.3} width={w * 0.6} height={h * 0.45} rx="0.3" fill="#3f444d" />
      {type === 'b' && <rect x={x + 1} y={y + h - 1.2} width={w - 2} height="1.2" fill="#9aa0a8" />}
    </g>
  )
}

function Led({ x, y, color }) {
  return <rect x={x} y={y} width="1.6" height="0.9" rx="0.2" fill={color} />
}

function Silk({ x, y, text, size = 2.4, fill = 'rgba(255,255,255,0.62)', anchor = 'middle' }) {
  return (
    <text x={x} y={y} textAnchor={anchor} fill={fill} style={{ font: `600 ${size}px system-ui, sans-serif` }}>
      {text}
    </text>
  )
}

/* ------------------------------------------------------------------ */
/* Οι πλακέτες — viewBox = πλάτος × μήκος σε χιλιοστά                  */
/* ------------------------------------------------------------------ */

function ProMicro() {
  return (
    <svg viewBox="-1.5 -1.5 21 36" className="brd__svg" role="img" aria-label="Arduino Pro Micro">
      <rect x="0" y="0" width="18" height="33" rx="1" fill="#b32127" />
      <rect x="0.6" y="0.6" width="16.8" height="31.8" rx="0.8" fill="none" stroke="rgba(255,255,255,0.18)" strokeWidth="0.3" />
      <Usb x="5.5" y="-0.4" w="7" h="3.4" />
      <Chip x={6} y={12} w={6} h={6} pins={6} />
      <rect x="4.2" y="6.5" width="3" height="2" rx="0.3" fill="#1c1f26" />
      <rect x="11" y="6.5" width="2.6" height="2" rx="0.3" fill="#1c1f26" />
      <Led x={7.4} y={20.5} color="#f59e0b" />
      <Led x={9.4} y={20.5} color="#22c55e" />
      <Silk x={9} y={25} text="PRO MICRO" size={1.9} />
      <Silk x={9} y={27.6} text="32U4 · 5V" size={1.5} fill="rgba(255,255,255,0.4)" />
      <Header x={1.7} y={2.6} count={12} />
      <Header x={16.3} y={2.6} count={12} />
    </svg>
  )
}

function Leonardo() {
  return (
    <svg viewBox="-2 -2 57 73" className="brd__svg" role="img" aria-label="Arduino Leonardo">
      <path
        d="M2 0 h49 a2 2 0 0 1 2 2 v52 l-6 6 v9 a2 2 0 0 1 -2 2 h-43 a2 2 0 0 1 -2 -2 v-67 a2 2 0 0 1 2 -2 z"
        fill="#00979c"
      />
      <Usb x="2" y="-1" w="12" h="7" type="b" />
      <rect x="1.5" y="52" width="13" height="9" rx="1" fill="#15171c" />
      <Silk x={8} y={64.5} text="POWER" size={2} fill="rgba(255,255,255,0.35)" />
      <Chip x={20} y={30} w={13} h={13} label="32U4" pins={9} />
      <rect x="38" y="18" width="6" height="4" rx="0.5" fill="#1c1f26" />
      <Led x={34} y={12} color="#f59e0b" />
      <Led x={37} y={12} color="#22c55e" />
      <Led x={40} y={12} color="#ef4444" />
      <Silk x={30} y={57} text="LEONARDO" size={3.4} />
      <circle cx="4.5" cy="26" r="1.6" fill="#0b0d12" />
      <circle cx="49" cy="15" r="1.6" fill="#0b0d12" />
      <circle cx="49" cy="49" r="1.6" fill="#0b0d12" />
      <Header x={2.6} y={9} count={7} />
      <Header x={2.6} y={30} count={6} />
      <Header x={50.4} y={4} count={10} />
      <Header x={50.4} y={34} count={8} />
    </svg>
  )
}

function Uno() {
  return (
    <svg viewBox="-2 -2 57 73" className="brd__svg" role="img" aria-label="Arduino Uno">
      <path
        d="M2 0 h49 a2 2 0 0 1 2 2 v52 l-6 6 v9 a2 2 0 0 1 -2 2 h-43 a2 2 0 0 1 -2 -2 v-67 a2 2 0 0 1 2 -2 z"
        fill="#00979c"
      />
      <Usb x="2" y="-1" w="13" h="8" type="b" />
      <rect x="1.5" y="52" width="13" height="9" rx="1" fill="#15171c" />
      <rect x="17" y="28" width="20" height="7" rx="0.8" fill="#1a1d24" />
      <Silk x={27} y={32.6} text="ATMEGA328P" size={2} fill="rgba(255,255,255,0.45)" />
      {Array.from({ length: 14 }, (_, i) => (
        <rect key={i} x={17.6 + i * 1.4} y={27.2} width="0.7" height="0.9" fill="#9ca3af" />
      ))}
      {Array.from({ length: 14 }, (_, i) => (
        <rect key={i} x={17.6 + i * 1.4} y={34.9} width="0.7" height="0.9" fill="#9ca3af" />
      ))}
      <Led x={34} y={12} color="#f59e0b" />
      <Led x={37} y={12} color="#22c55e" />
      <Silk x={30} y={57} text="UNO" size={4.2} />
      <circle cx="4.5" cy="26" r="1.6" fill="#0b0d12" />
      <circle cx="49" cy="15" r="1.6" fill="#0b0d12" />
      <Header x={2.6} y={9} count={8} />
      <Header x={2.6} y={32} count={6} />
      <Header x={50.4} y={4} count={10} />
      <Header x={50.4} y={34} count={8} />
    </svg>
  )
}

function Nano() {
  return (
    <svg viewBox="-1.5 -1.5 21 48" className="brd__svg" role="img" aria-label="Arduino Nano">
      <rect x="0" y="0" width="18" height="45" rx="1" fill="#123a5e" />
      <rect x="0.6" y="0.6" width="16.8" height="43.8" rx="0.8" fill="none" stroke="rgba(255,255,255,0.16)" strokeWidth="0.3" />
      <Usb x="5" y="-0.6" w="8" h="4" />
      <rect x="4" y="6" width="10" height="6" rx="0.6" fill="#1a1d24" />
      <Silk x={9} y={10} text="CH340" size={1.7} fill="rgba(255,255,255,0.4)" />
      <Chip x={4.5} y={20} w={9} h={9} label="328P" pins={7} />
      <Led x={6} y={15} color="#22c55e" />
      <Led x={10.4} y={15} color="#f59e0b" />
      <Silk x={9} y={35} text="NANO" size={2.6} />
      <rect x="6.6" y="38" width="4.8" height="3.4" rx="0.5" fill="#1c1f26" />
      <Silk x={9} y={43.5} text="ICSP" size={1.4} fill="rgba(255,255,255,0.3)" />
      <Header x={1.7} y={2.4} count={15} />
      <Header x={16.3} y={2.4} count={15} />
    </svg>
  )
}

function Pico() {
  return (
    <svg viewBox="-2.5 -2 26 56" className="brd__svg" role="img" aria-label="Raspberry Pi Pico">
      <rect x="0" y="0" width="21" height="51" rx="2.5" fill="#14532d" />
      <rect x="0.7" y="0.7" width="19.6" height="49.6" rx="2" fill="none" stroke="rgba(255,255,255,0.18)" strokeWidth="0.3" />
      <Usb x="6.5" y="-0.8" w="8" h="4" />
      <rect x="5.9" y="5.2" width="9.2" height="3.4" rx="1.7" fill="#e5e7eb" />
      <Silk x={10.5} y={7.7} text="BOOTSEL" size={1.55} fill="#14532d" />
      <Chip x={6.5} y={20} w={8} h={8} label="RP2040" pins={7} />
      <rect x="7" y="32" width="7" height="4.5" rx="0.5" fill="#1a1d24" />
      <Silk x={10.5} y={35.2} text="FLASH" size={1.5} fill="rgba(255,255,255,0.4)" />
      <Led x={13.5} y={16} color="#22c55e" />
      <Silk x={10.5} y={42} text="Raspberry Pi" size={1.9} />
      <Silk x={10.5} y={45} text="Pico" size={2.4} />
      {/* Οι εγκοπές στα άκρα (castellated) */}
      {Array.from({ length: 20 }, (_, i) => (
        <g key={i}>
          <circle cx="0" cy={3 + i * 2.54} r="1" fill="#0b0d12" />
          <circle cx="21" cy={3 + i * 2.54} r="1" fill="#0b0d12" />
        </g>
      ))}
      <Header x={2} y={3} count={20} />
      <Header x={19} y={3} count={20} />
    </svg>
  )
}

function Esp32() {
  return (
    <svg viewBox="-1.5 -1.5 31 54" className="brd__svg" role="img" aria-label="ESP32 DevKit v1">
      <rect x="0" y="0" width="28" height="51" rx="1" fill="#16181d" />
      <rect x="0.6" y="0.6" width="26.8" height="49.8" rx="0.8" fill="none" stroke="rgba(255,255,255,0.14)" strokeWidth="0.3" />
      <Usb x="10" y="-0.7" w="8" h="4" />
      {/* Η μεταλλική θωράκιση του WROOM */}
      <rect x="5.5" y="6" width="17" height="16" rx="0.8" fill="#c8ccd2" stroke="#9aa0a8" strokeWidth="0.3" />
      <rect x="6.4" y="6.9" width="15.2" height="14.2" rx="0.5" fill="none" stroke="#9aa0a8" strokeWidth="0.25" />
      <Silk x={14} y={13} text="ESP32" size={2.6} fill="#3f444d" />
      <Silk x={14} y={16.5} text="WROOM-32" size={1.7} fill="#5b616b" />
      {/* Κεραία PCB */}
      <path d="M8 2.5 h12 M9 3.6 h10 M10 4.7 h8" stroke="#c8ccd2" strokeWidth="0.5" fill="none" />
      <rect x="8" y="26" width="5" height="3" rx="0.4" fill="#1f232a" />
      <rect x="15" y="26" width="5" height="3" rx="0.4" fill="#1f232a" />
      <Silk x={10.5} y={31.5} text="EN" size={1.5} fill="rgba(255,255,255,0.4)" />
      <Silk x={17.5} y={31.5} text="BOOT" size={1.5} fill="rgba(255,255,255,0.4)" />
      <Led x={12} y={34} color="#ef4444" />
      <Led x={15} y={34} color="#3b82f6" />
      <Silk x={14} y={41} text="DEVKIT V1" size={2.3} />
      <Header x={1.8} y={3} count={15} />
      <Header x={26.2} y={3} count={15} />
    </svg>
  )
}

function Teensy() {
  return (
    <svg viewBox="-1.5 -1.5 21 64" className="brd__svg" role="img" aria-label="Teensy 4.1">
      <rect x="0" y="0" width="18" height="61" rx="1" fill="#0f5132" />
      <rect x="0.6" y="0.6" width="16.8" height="59.8" rx="0.8" fill="none" stroke="rgba(255,255,255,0.16)" strokeWidth="0.3" />
      <Usb x="5" y="-0.6" w="8" h="4" />
      <Chip x={4} y={9} w={10} h={10} label="RT1062" pins={8} />
      <rect x="5" y="22" width="8" height="4" rx="0.4" fill="#1a1d24" />
      <Silk x={9} y={25} text="FLASH" size={1.5} fill="rgba(255,255,255,0.4)" />
      {/* Υποδοχή microSD */}
      <rect x="4.5" y="29" width="9" height="6" rx="0.5" fill="#b8bcc4" />
      <Silk x={9} y={33} text="SD" size={1.8} fill="#4b5563" />
      <Led x={8.2} y={38} color="#f59e0b" />
      <Silk x={9} y={45} text="TEENSY" size={2.2} />
      <Silk x={9} y={48.4} text="4.1" size={2.6} />
      <Silk x={9} y={52} text="PJRC.COM" size={1.4} fill="rgba(255,255,255,0.35)" />
      {/* Επαφές Ethernet στην άκρη */}
      <rect x="5" y="56" width="8" height="3" rx="0.4" fill="#1a1d24" />
      <Header x={1.7} y={2.4} count={24} />
      <Header x={16.3} y={2.4} count={24} />
    </svg>
  )
}

const ART = {
  'pro-micro': ProMicro,
  leonardo: Leonardo,
  uno: Uno,
  nano: Nano,
  pico: Pico,
  esp32: Esp32,
  teensy41: Teensy,
}

/**
 * @param {string} boardId  id πλακέτας
 * @param {string} className  προαιρετική κλάση περιτυλίγματος
 */
export default function BoardArt({ boardId, className = '' }) {
  const Art = ART[boardId]
  if (!Art) return null
  return (
    <div className={`brd ${className}`.trim()} aria-hidden="false">
      <Art />
    </div>
  )
}
