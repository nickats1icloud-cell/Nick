import { useCallback, useEffect, useRef, useState } from 'react'
import { KEY_CURRENT, loadCurrent, storeCurrent } from '../lib/simlab/storage.js'

/**
 * Η τρέχουσα κατασκευή, μοιρασμένη ανάμεσα στις καρτέλες.
 *
 * Κρατά την κατάσταση, τη γράφει στο localStorage και ακούει το ίδιο κλειδί
 * ώστε η αυτόνομη σελίδα καλωδίωσης και το εργαστήριο να βλέπουν τα ίδια
 * πράγματα ζωντανά. Η εγγραφή παραλείπεται όταν το περιεχόμενο δεν άλλαξε,
 * αλλιώς οι δύο καρτέλες θα έστελναν συνέχεια η μία στην άλλη το ίδιο state.
 *
 * @param {() => object} makeInitial  τι φορτώνεται όταν δεν υπάρχει αποθηκευμένη
 */
export default function useBuildStore(makeInitial) {
  const [build, setBuild] = useState(() => loadCurrent() || makeInitial())
  const lastJson = useRef('')

  useEffect(() => {
    const json = JSON.stringify(build)
    if (json === lastJson.current) return
    lastJson.current = json
    storeCurrent(build)
  }, [build])

  useEffect(() => {
    const onStorage = (e) => {
      if (e.key !== KEY_CURRENT || !e.newValue) return
      if (e.newValue === lastJson.current) return
      try {
        const next = JSON.parse(e.newValue)
        lastJson.current = e.newValue
        setBuild(next)
      } catch {
        /* Χαλασμένο περιεχόμενο από άλλη καρτέλα — το αγνοούμε. */
      }
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [])

  /** Σαν setBuild, αλλά σημειώνει ότι η αλλαγή προήλθε από εδώ. */
  const update = useCallback((updater) => {
    setBuild((prev) => (typeof updater === 'function' ? updater(prev) : updater))
  }, [])

  return [build, update]
}
