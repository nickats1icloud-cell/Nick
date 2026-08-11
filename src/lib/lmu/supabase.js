// Ο Supabase client, φορτωμένος με dynamic import: όταν δεν υπάρχει backend
// ρυθμισμένο, το bundle του supabase-js δεν κατεβαίνει καθόλου.

import { SUPABASE_ANON_KEY, SUPABASE_URL, isBackendConfigured } from './config.js'

let clientPromise = null

/** @returns Promise<SupabaseClient|null> */
export function getClient() {
  if (!isBackendConfigured()) return Promise.resolve(null)
  if (!clientPromise) {
    clientPromise = import('@supabase/supabase-js').then(({ createClient }) =>
      createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: true,
          storageKey: 'nick.lmu.auth',
        },
      }),
    )
  }
  return clientPromise
}

/** Πετάει σφάλμα με ελληνικό μήνυμα αντί για το τεχνικό του Postgres. */
export function assertOk(error, context = 'Η ενέργεια απέτυχε') {
  if (!error) return
  const message = String(error.message || '')
  // Τα μηνύματα των triggers μας είναι ήδη στα ελληνικά — δείξ' τα ως έχουν.
  if (/[Α-Ωα-ω]/.test(message)) throw new Error(message)
  if (error.code === '42501' || /row-level security/i.test(message)) {
    throw new Error(`${context}: δεν έχεις δικαίωμα γι' αυτό (το έκρινε η βάση).`)
  }
  if (error.code === '23505') {
    throw new Error(`${context}: υπάρχει ήδη εγγραφή με αυτά τα στοιχεία.`)
  }
  if (error.code === '23503') {
    throw new Error(`${context}: λείπει κάτι που συνδέεται με αυτή την εγγραφή.`)
  }
  throw new Error(`${context}: ${message}`)
}
