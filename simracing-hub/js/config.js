/**
 * Δημόσιες ρυθμίσεις. Το `anon` key του Supabase είναι σχεδιασμένο να
 * εκτίθεται στον browser — η ασφάλεια επιβάλλεται από τα RLS policies της
 * βάσης, όχι από το κλειδί. Το ίδιο έκανε και το αρχικό React project
 * (`src/integrations/supabase/client.ts`).
 *
 * Άλλαξε τα δύο πρώτα αν δείξεις το site σε άλλο Supabase project.
 */

export const SUPABASE_URL = "https://mnfixmdhpkapdmehfmys.supabase.co";
export const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1uZml4bWRocGthcGRtZWhmbXlzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE0NDU5OTMsImV4cCI6MjA4NzAyMTk5M30.uOr-tMhlslTJqtAYiQPClyXW_p0K1KrUo3Cz6UwXbJk";

/** Προεπιλογές — τις υπερισχύουν οι τιμές του πίνακα `site_settings`. */
export const DEFAULT_SETTINGS = {
  site_name: "Greek SimRacers",
  site_tagline: "Η #1 Ελληνική πλατφόρμα SimRacing",
  footer_text: "Made with ❤️ in Greece",
  contact_email: "info@greeksimracers.gr",
  support_hours: "Δευτ–Παρ: 10:00–22:00",
  discord_server_id: "459797812251590677",
  discord_invite: "https://discord.gg/v5RsBTnPpY",
  youtube_url: "https://www.youtube.com/@GreekSimracers",
  facebook_url: "https://www.facebook.com/groups/greeksimracers",
  spotify_url: "https://open.spotify.com/show/62c9vN8ZOT4unAzzJmtOXD",
  maintenance_mode: "false",
  registration_enabled: "true",
};

/** Επιλογές που εμφανίζονται σε φόρμες (εγγραφή, προφίλ, lap times). */
export const SIM_OPTIONS = [
  "Assetto Corsa",
  "Assetto Corsa Competizione",
  "iRacing",
  "rFactor 2",
  "Gran Turismo",
  "Forza Motorsport",
  "F1 Series",
  "Automobilista 2",
  "Le Mans Ultimate",
  "Άλλο",
];

export const SETUP_OPTIONS = [
  { value: "wheel", label: "Τιμόνι", icon: "🛞" },
  { value: "controller", label: "Controller", icon: "🎮" },
  { value: "keyboard", label: "Πληκτρολόγιο", icon: "⌨️" },
];
