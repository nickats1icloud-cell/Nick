import { useCallback, useEffect, useReducer, useRef, useState } from 'react'
import { KEY_CURRENT, loadCurrent, storeCurrent } from '../lib/simlab/storage.js'

/** Πόσα βήματα πίσω κρατάει το ιστορικό. */
const HISTORY_LIMIT = 60
/**
 * Αλλαγές που απέχουν λιγότερο από τόσο συγχωνεύονται σε ένα βήμα ιστορικού —
 * αλλιώς ένα σύρσιμο κάρτας θα γέμιζε το ιστορικό με εκατοντάδες θέσεις.
 */
const COALESCE_MS = 400

/**
 * Η τρέχουσα κατασκευή, μοιρασμένη ανάμεσα στις καρτέλες, με αναίρεση.
 *
 * Κρατά την κατάσταση, τη γράφει στο localStorage και ακούει το ίδιο κλειδί
 * ώστε η αυτόνομη σελίδα καλωδίωσης και το εργαστήριο να βλέπουν τα ίδια
 * πράγματα ζωντανά. Η εγγραφή παραλείπεται όταν το περιεχόμενο δεν άλλαξε,
 * αλλιώς οι δύο καρτέλες θα έστελναν συνέχεια η μία στην άλλη το ίδιο state.
 *
 * Το ιστορικό ζει σε refs (δεν προκαλεί render) και τα Ctrl/⌘+Z και
 * Ctrl+Shift+Z / Ctrl+Y δουλεύουν σε όποια σελίδα χρησιμοποιεί το hook.
 *
 * @param {() => object} makeInitial  τι φορτώνεται όταν δεν υπάρχει αποθηκευμένη
 * @returns {[object, Function, {undo, redo, canUndo, canRedo}]}
 */
export default function useBuildStore(makeInitial) {
  const [build, setBuildState] = useState(() => loadCurrent() || makeInitial())
  const lastJson = useRef('')
  const past = useRef([])
  const future = useRef([])
  const lastPushAt = useRef(0)
  const [, bump] = useReducer((n) => n + 1, 0)

  /* Πάντα το τρέχον build, για να διαβάζεται ΕΚΤΟΣ updater — οι μεταλλάξεις
     του ιστορικού δεν επιτρέπεται να ζουν μέσα σε updater: το StrictMode
     καλεί τους updaters δύο φορές και το δεύτερο pop θα έβρισκε άδειο stack. */
  const buildRef = useRef(build)
  buildRef.current = build

  useEffect(() => {
    const json = JSON.stringify(build)
    if (json === lastJson.current) return
    lastJson.current = json
    storeCurrent(build)
  }, [build])

  const update = useCallback((updater) => {
    setBuildState((prev) => {
      const next = typeof updater === 'function' ? updater(prev) : updater
      if (next === prev) return prev
      const prevJson = JSON.stringify(prev)
      if (JSON.stringify(next) !== prevJson) {
        const now = Date.now()
        const top = past.current[past.current.length - 1]
        if (top !== prevJson && (now - lastPushAt.current > COALESCE_MS || past.current.length === 0)) {
          past.current.push(prevJson)
          if (past.current.length > HISTORY_LIMIT) past.current.shift()
          lastPushAt.current = now
        }
        future.current = []
      }
      return next
    })
    bump()
  }, [])

  const undo = useCallback(() => {
    const prevJson = past.current.pop()
    if (!prevJson) return
    future.current.push(JSON.stringify(buildRef.current))
    lastPushAt.current = 0
    setBuildState(JSON.parse(prevJson))
    bump()
  }, [])

  const redo = useCallback(() => {
    const nextJson = future.current.pop()
    if (!nextJson) return
    past.current.push(JSON.stringify(buildRef.current))
    lastPushAt.current = 0
    setBuildState(JSON.parse(nextJson))
    bump()
  }, [])

  /* Συγχρονισμός από την άλλη καρτέλα — μπαίνει κι αυτός στο ιστορικό. */
  useEffect(() => {
    const onStorage = (e) => {
      if (e.key !== KEY_CURRENT || !e.newValue) return
      if (e.newValue === lastJson.current) return
      try {
        const next = JSON.parse(e.newValue)
        lastJson.current = e.newValue
        past.current.push(JSON.stringify(buildRef.current))
        if (past.current.length > HISTORY_LIMIT) past.current.shift()
        future.current = []
        setBuildState(next)
        bump()
      } catch {
        /* Χαλασμένο περιεχόμενο από άλλη καρτέλα — το αγνοούμε. */
      }
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [])

  /* Ctrl/⌘+Z αναίρεση, Ctrl+Shift+Z ή Ctrl+Y επανάληψη — όχι μέσα σε πεδία. */
  useEffect(() => {
    const onKey = (e) => {
      if (!e.ctrlKey && !e.metaKey) return
      const tag = document.activeElement?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return
      const k = e.key.toLowerCase()
      if (k === 'z' && !e.shiftKey) {
        e.preventDefault()
        undo()
      } else if (k === 'y' || (k === 'z' && e.shiftKey)) {
        e.preventDefault()
        redo()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [undo, redo])

  return [
    build,
    update,
    { undo, redo, canUndo: past.current.length > 0, canRedo: future.current.length > 0 },
  ]
}
