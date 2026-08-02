/**
 * Πίνακας χρόνων.
 *
 * Τοπικά (localStorage) κρατιούνται πάντα οι καλύτεροι χρόνοι ανά πίστα, ώστε
 * το παιχνίδι να δουλεύει και χωρίς λογαριασμό ή χωρίς Supabase.
 * Αν υπάρχει συνδεδεμένος χρήστης, ο χρόνος ανεβαίνει και στον κοινό πίνακα
 * `game_lap_times` (SQL στο τέλος αυτού του αρχείου).
 */

// Το site φορτώνει το Supabase από CDN μέσα από κλασικά <script> (δες
// assets/js/supabase-client.js), οπότε εδώ το διαβάζουμε από το window αντί
// για import — και δουλεύουμε κανονικά αν λείπει ή αν απέτυχε το CDN.
function client() {
  return typeof window.supabaseClient !== "undefined" ? window.supabaseClient : null;
}

async function currentUser() {
  const supabase = client();
  if (!supabase) return null;
  try {
    const { data } = await supabase.auth.getUser();
    return data?.user ?? null;
  } catch {
    return null;
  }
}

const STORAGE_KEY = "gsr-game-times-v1";
const MAX_LOCAL_PER_TRACK = 20;

/** Χρόνος σε μορφή Μ:ΔΔ.χχχ — όπως τον δείχνουν τα sims. */
export function formatTime(ms) {
  if (ms == null || !Number.isFinite(ms)) return "--:--.---";
  const total = Math.max(0, Math.round(ms));
  const m = Math.floor(total / 60000);
  const s = Math.floor((total % 60000) / 1000);
  const msPart = total % 1000;
  return `${m}:${String(s).padStart(2, "0")}.${String(msPart).padStart(3, "0")}`;
}

/** Διαφορά από τον καλύτερο, με πρόσημο (π.χ. -0.284). */
export function formatDelta(ms) {
  if (ms == null || !Number.isFinite(ms)) return "—";
  const sign = ms >= 0 ? "+" : "-";
  return `${sign}${(Math.abs(ms) / 1000).toFixed(3)}`;
}

function readAll() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : {};
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function writeAll(data) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch {
    // Π.χ. private mode χωρίς quota — το παιχνίδι συνεχίζει κανονικά.
  }
}

/** Οι τοπικοί χρόνοι μιας πίστας, ταξινομημένοι. */
export function localTimes(trackId) {
  const all = readAll();
  return (all[trackId] || []).slice().sort((a, b) => a.lapMs - b.lapMs);
}

/** Ο καλύτερος τοπικός χρόνος μιας πίστας (ή null). */
export function localBest(trackId) {
  return localTimes(trackId)[0] || null;
}

export function saveLocal(entry) {
  const all = readAll();
  const list = all[entry.trackId] || [];
  list.push({
    driverName: entry.driverName,
    carId: entry.carId,
    lapMs: Math.round(entry.lapMs),
    at: Date.now(),
  });
  list.sort((a, b) => a.lapMs - b.lapMs);
  all[entry.trackId] = list.slice(0, MAX_LOCAL_PER_TRACK);
  writeAll(all);
  return all[entry.trackId];
}

export function savedDriverName() {
  try {
    return localStorage.getItem("gsr-game-driver") || "";
  } catch {
    return "";
  }
}

export function rememberDriverName(name) {
  try {
    localStorage.setItem("gsr-game-driver", name);
  } catch {
    // αγνοείται
  }
}

/** Οι καλύτεροι χρόνοι της κοινότητας — ένας ανά οδηγό. */
export async function fetchRemote(trackId, limit = 10) {
  const supabase = client();
  if (!supabase) return { available: false, rows: [] };
  try {
    const { data, error } = await supabase
      .from("game_lap_times")
      .select("driver_name,car_id,lap_ms,created_at")
      .eq("track_id", trackId)
      .order("lap_ms", { ascending: true })
      .limit(60);
    if (error) throw error;

    const seen = new Set();
    const rows = [];
    for (const row of data || []) {
      const key = (row.driver_name || "").toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      rows.push(row);
      if (rows.length >= limit) break;
    }
    return { available: true, rows };
  } catch {
    return { available: false, rows: [] };
  }
}

/**
 * Ανεβάζει χρόνο στον κοινό πίνακα. Απαιτεί σύνδεση — τα RLS policies δέχονται
 * insert μόνο με `user_id = auth.uid()`.
 * @returns {Promise<{ok:boolean, reason?:string}>}
 */
export async function submitRemote(entry) {
  const supabase = client();
  if (!supabase) return { ok: false, reason: "not-configured" };
  const user = await currentUser();
  if (!user) return { ok: false, reason: "not-signed-in" };
  try {
    const { error } = await supabase.from("game_lap_times").insert({
      user_id: user.id,
      driver_name: entry.driverName,
      track_id: entry.trackId,
      car_id: entry.carId,
      lap_ms: Math.round(entry.lapMs),
    });
    if (error) throw error;
    return { ok: true };
  } catch {
    return { ok: false, reason: "error" };
  }
}

/*
 * SQL για τον κοινό πίνακα (τρέξε το μία φορά στο SQL Editor του Supabase):
 *
 *   create table public.game_lap_times (
 *     id uuid primary key default gen_random_uuid(),
 *     user_id uuid not null references auth.users(id) on delete cascade,
 *     driver_name text not null check (char_length(driver_name) between 1 and 24),
 *     track_id text not null,
 *     car_id text not null,
 *     lap_ms integer not null check (lap_ms between 10000 and 1800000),
 *     created_at timestamptz not null default now()
 *   );
 *   alter table public.game_lap_times enable row level security;
 *   create policy "Lap times are publicly readable"
 *     on public.game_lap_times for select using (true);
 *   create policy "Users can submit own lap times"
 *     on public.game_lap_times for insert with check (auth.uid() = user_id);
 *   create policy "Users can delete own lap times"
 *     on public.game_lap_times for delete using (auth.uid() = user_id);
 *   create index game_lap_times_track_lap_idx
 *     on public.game_lap_times (track_id, lap_ms);
 *
 * Μέχρι να δημιουργηθεί ο πίνακας, το παιχνίδι δείχνει μόνο τους τοπικούς
 * χρόνους και ο κοινός πίνακας εμφανίζεται ως μη διαθέσιμος.
 */
