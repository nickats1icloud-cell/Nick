// Ο client δημιουργείται από το vendored bundle (js/vendor/supabase.umd.js,
// φορτώνεται με <script defer> στο <head> κάθε σελίδας και ορίζει το
// window.supabase). Καμία εξάρτηση από CDN — το site είναι πλήρως αυτόνομο.
import { SUPABASE_URL, SUPABASE_ANON_KEY } from "./config.js";

export const isConfigured = Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);

if (!isConfigured) {
  console.warn(
    "Supabase δεν έχει ρυθμιστεί ακόμα: συμπλήρωσε το SUPABASE_URL / SUPABASE_ANON_KEY στο js/config.js",
  );
}

// Με κενό config το createClient() πετάει exception και θα έριχνε όλο το
// module graph (μαζί και το navbar/footer κάθε σελίδας). Χρησιμοποιούμε
// placeholder τιμές ώστε ο client να δημιουργείται πάντα — τα queries απλώς
// αποτυγχάνουν ήσυχα και κάθε σελίδα δείχνει το graceful fallback της.
export const supabase = window.supabase.createClient(
  isConfigured ? SUPABASE_URL : "https://placeholder.supabase.co",
  isConfigured ? SUPABASE_ANON_KEY : "placeholder-anon-key",
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
    },
  },
);
