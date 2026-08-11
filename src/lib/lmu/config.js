// Ρύθμιση backend.
//
// Το κλειδί «anon» / «publishable» είναι σχεδιασμένο να είναι δημόσιο: την
// πρόσβαση την κρίνει το Row Level Security της βάσης, όχι το κλειδί. Οπότε
// μπαίνει άφοβα εδώ ή σε .env — ίδιο μοτίβο με το greek-simracers/js/config.js.
//
// ΠΟΤΕ μη βάλεις εδώ το service_role key: αυτό παρακάμπτει το RLS.
//
// Δύο τρόποι ρύθμισης:
//   1. Αρχείο `.env.local` στη ρίζα (δεν ανεβαίνει στο git):
//        VITE_SUPABASE_URL=https://xxxx.supabase.co
//        VITE_SUPABASE_ANON_KEY=eyJ...
//   2. Συμπλήρωσε τα σταθερά παρακάτω (θα μπουν στο git — εντάξει για anon key).
//
// Χωρίς ρύθμιση, η εφαρμογή τρέχει σε **τοπική λειτουργία** (localStorage), όπως
// πριν — δεν χαλάει τίποτα.

const FALLBACK_URL = ''
const FALLBACK_ANON_KEY = ''

export const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || FALLBACK_URL
export const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || FALLBACK_ANON_KEY

/**
 * Προαιρετικό: κλείδωσε την εφαρμογή σε ένα συγκεκριμένο πρωτάθλημα. Αν μείνει
 * κενό, φορτώνεται αυτόματα το πρωτάθλημα στο οποίο συμμετέχει ο χρήστης (ή το
 * πιο πρόσφατο δημόσιο, για επισκέπτες).
 */
export const CHAMPIONSHIP_ID = import.meta.env.VITE_LMU_CHAMPIONSHIP_ID || ''

/** Τρέχουμε με πραγματικό backend ή τοπικά στον browser; */
export function isBackendConfigured() {
  return Boolean(SUPABASE_URL && SUPABASE_ANON_KEY)
}

export const BACKEND_MODE = isBackendConfigured() ? 'remote' : 'local'
