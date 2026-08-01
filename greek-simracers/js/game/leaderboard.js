/**
 * Πίνακας χρόνων.
 *
 * Τοπικά (localStorage) κρατιούνται πάντα οι καλύτεροι χρόνοι ανά πίστα, ώστε
 * το παιχνίδι να δουλεύει και χωρίς λογαριασμό ή χωρίς ρυθμισμένο Supabase.
 * Αν υπάρχει Supabase και συνδεδεμένος χρήστης, ο χρόνος ανεβαίνει και στον
 * κοινό πίνακα (`game_lap_times`, βλ. supabase/migrations/002_game.sql).
 */

import { supabase, isConfigured } from "../supabase-client.js";
import { getUser } from "../auth.js";

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
  if (!isConfigured) return { available: false, rows: [] };
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
  if (!isConfigured) return { ok: false, reason: "not-configured" };
  const user = getUser();
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
