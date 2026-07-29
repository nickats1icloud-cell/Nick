/**
 * Ένα και μοναδικό Supabase client instance για όλο το site.
 *
 * Το `js/vendor/supabase.umd.js` φορτώνεται από κάθε σελίδα με ένα κλασικό
 * <script> (πριν από τα modules) και εκθέτει το global `supabase`. Έτσι δεν
 * χρειάζεται bundler ούτε npm.
 */

import { SUPABASE_URL, SUPABASE_ANON_KEY } from "./config.js";

if (!window.supabase || typeof window.supabase.createClient !== "function") {
  throw new Error(
    "Λείπει το vendor bundle. Πρόσθεσε <script src=\"js/vendor/supabase.umd.js\"></script> πριν τα modules.",
  );
}

export const db = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    storage: window.localStorage,
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});

/**
 * Βοηθός για ερωτήματα που δεν πρέπει να ρίξουν τη σελίδα: επιστρέφει
 * `fallback` και γράφει το σφάλμα στην κονσόλα.
 *
 * Προσοχή: όταν ένα RLS policy απορρίπτει γραμμές, το Supabase ΔΕΝ γυρίζει
 * σφάλμα — γυρίζει άδειο array. Άδειο αποτέλεσμα ≠ κενός πίνακας.
 */
export async function safe(promise, fallback = null) {
  try {
    const { data, error } = await promise;
    if (error) {
      console.warn("[supabase]", error.message);
      return fallback;
    }
    return data ?? fallback;
  } catch (err) {
    console.warn("[supabase]", err);
    return fallback;
  }
}

/** Πλήθος γραμμών χωρίς να κατεβούν οι ίδιες οι γραμμές. */
export async function countRows(table, apply) {
  let q = db.from(table).select("*", { count: "exact", head: true });
  if (apply) q = apply(q);
  const { count, error } = await q;
  if (error) {
    console.warn("[supabase:count]", error.message);
    return 0;
  }
  return count || 0;
}
