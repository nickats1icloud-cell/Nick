// Shared Supabase client for all pages. Loaded after the supabase-js CDN
// script, before any page-specific script (podcasts.js, championships.js...).
// The anon key below is safe to expose client-side by design; access to
// each table is restricted by the Row Level Security policies in Supabase.
const SUPABASE_URL = "https://dwkdquzqmcxtqnmefizk.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImR3a2RxdXpxbWN4dHFubWVmaXprIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODUwMTQzODIsImV4cCI6MjEwMDU5MDM4Mn0.kUe12Cwk2iLMlSij_Uasd8w6_0Z11UPQUN5pihHrqIk";

const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
