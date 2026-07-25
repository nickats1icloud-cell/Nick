import { useEffect, useRef, useState } from 'react'
import Gauge from './dashboard/Gauge'

const IDLE_RPM = 900
const REV_RPM = 6200

// Μέγιστη κλίση της κάρτας, σε μοίρες ανά άξονα.
const MAX_TILT = 9

/**
 * Ζωντανεύει τη βελόνα του mini-γκάζι μέσα στο hero card: ανεβαίνει προς το
 * redline και ξαναπέφτει στο ρελαντί σε βρόγχο, σαν ένα "rev" demo.
 */
function useIdleRev() {
  const [rpm, setRpm] = useState(IDLE_RPM)
  const dirRef = useRef(1)

  useEffect(() => {
    let raf
    let last = performance.now()

    const tick = (now) => {
      const dt = (now - last) / 1000
      last = now

      setRpm((prev) => {
        const speed = dirRef.current > 0 ? 2600 : 3400
        let next = prev + dirRef.current * speed * dt
        if (next >= REV_RPM) {
          next = REV_RPM
          dirRef.current = -1
        } else if (next <= IDLE_RPM) {
          next = IDLE_RPM
          dirRef.current = 1
        }
        return next
      })

      raf = requestAnimationFrame(tick)
    }

    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [])

  return rpm
}

/**
 * Κλίση 3D της κάρτας ανάλογα με τη θέση του δείκτη. Γράφει κατευθείαν CSS
 * μεταβλητές στο στοιχείο, ώστε να μη γίνεται re-render σε κάθε κίνηση.
 */
function useTilt() {
  const ref = useRef(null)

  useEffect(() => {
    const node = ref.current
    if (!node) return undefined

    // Χωρίς κλίση σε οθόνες αφής ή όταν ο χρήστης ζητά λιγότερη κίνηση.
    const fine = window.matchMedia('(hover: hover) and (pointer: fine)')
    const calm = window.matchMedia('(prefers-reduced-motion: reduce)')
    if (!fine.matches || calm.matches) return undefined

    const onMove = (e) => {
      const rect = node.getBoundingClientRect()
      const px = (e.clientX - rect.left) / rect.width
      const py = (e.clientY - rect.top) / rect.height

      node.style.setProperty('--ry', `${(px - 0.5) * 2 * MAX_TILT}`)
      node.style.setProperty('--rx', `${(0.5 - py) * 2 * MAX_TILT}`)
      node.style.setProperty('--mx', `${px * 100}%`)
      node.style.setProperty('--my', `${py * 100}%`)
      node.classList.add('hero-card--tilting')
    }

    const onLeave = () => {
      node.classList.remove('hero-card--tilting')
      node.style.setProperty('--rx', '0')
      node.style.setProperty('--ry', '0')
    }

    node.addEventListener('pointermove', onMove)
    node.addEventListener('pointerleave', onLeave)
    return () => {
      node.removeEventListener('pointermove', onMove)
      node.removeEventListener('pointerleave', onLeave)
    }
  }, [])

  return ref
}

const chips = ['60 FPS φυσική', 'SVG όργανα', 'Πληκτρολόγιο & αφή']

export default function HeroCard() {
  const rpm = useIdleRev()
  const cardRef = useTilt()

  return (
    <div className="hero-card-scene">
      <div className="hero-card" ref={cardRef}>
        <div className="hero-card__backdrop" aria-hidden="true">
          <div className="hero-card__glow" />
          <div className="hero-card__glare" />
        </div>

        <div className="hero-card__copy">
          <span className="hero-card__eyebrow">Civic EK &middot; ψηφιακό καντράν</span>
          <h1>Το ταμπλό του Civic, ζωντανό στην οθόνη σου</h1>
          <p>
            Στροφόμετρο, ταχύμετρο και όλα τα warning lights αντιδρούν σε
            πραγματικό χρόνο σε μια προσομοίωση φυσικής που τρέχει τοπικά στον
            browser σου — καμία εγκατάσταση.
          </p>

          <div className="hero-card__chips">
            {chips.map((c) => (
              <span key={c} className="hero-card__chip">
                {c}
              </span>
            ))}
          </div>
        </div>

        <div className="hero-card__preview">
          <Gauge
            value={rpm}
            max={8000}
            majorStep={1000}
            redlineFrom={6000}
            label="RPM"
            unit="x1000"
            digits={0}
            size={220}
            accent="#ff3b30"
          />
        </div>
      </div>
    </div>
  )
}
