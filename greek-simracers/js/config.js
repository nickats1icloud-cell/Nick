// Public, non-secret config. The Supabase "anon" key is designed to be
// exposed client-side (Row Level Security enforces access, not this key),
// so it's safe to commit here — same pattern the original project used.
// Fill these in after the Supabase project is created (see supabase/README.md).
export const SUPABASE_URL = "";
export const SUPABASE_ANON_KEY = "";

export const SOCIAL_LINKS = {
  discord: "#",
  youtube: "#",
  facebook: "#",
};
