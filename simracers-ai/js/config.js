/*
 * Δημόσιες ρυθμίσεις — δεν υπάρχει τίποτα μυστικό εδώ.
 *
 * Το anon key του Supabase είναι σχεδιασμένο να είναι ορατό στον browser
 * (η πρόσβαση ελέγχεται από Row Level Security, όχι από το κλειδί). Το
 * κλειδί του Claude ΔΕΝ βρίσκεται πουθενά στο front-end — ζει μόνο ως
 * secret στο Edge Function.
 *
 * Συμπλήρωσε τα δύο πεδία μετά το `supabase functions deploy ask`:
 * Supabase Dashboard → Project Settings → API.
 */

export const SUPABASE_URL = "";
export const SUPABASE_ANON_KEY = "";

/** Το endpoint του Edge Function που μιλάει στον Claude. */
export const ASK_ENDPOINT = `${SUPABASE_URL}/functions/v1/ask`;

/** Πόσα μηνύματα κρατάμε στη συζήτηση πριν αρχίσουμε να κόβουμε τα παλιά. */
export const MAX_HISTORY = 20;
