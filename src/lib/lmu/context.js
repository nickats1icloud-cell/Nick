import { createContext } from 'react'

/**
 * Το context του πρωταθλήματος ζει σε δικό του αρχείο ώστε ο provider
 * (component) και τα hooks να μένουν χωριστά — έτσι δουλεύει σωστά το
 * fast refresh του Vite.
 */
export const ChampionshipContext = createContext(null)
