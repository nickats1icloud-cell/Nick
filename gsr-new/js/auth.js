/**
 * auth.js — κατάσταση σύνδεσης για όλο το site.
 *
 * Αναπαράγει το `AuthContext` του React project:
 *  · κρατάει session/user
 *  · «πύλη έγκρισης»: αν το profile δεν είναι `is_approved`, ο χρήστης
 *    αποσυνδέεται αμέσως με μήνυμα
 *  · ενημερώνει το `last_seen` στη σύνδεση και κάθε 2 λεπτά
 *  · φορτώνει ρόλο admin/moderator και τα `site_settings`
 *
 * Χρήση:
 *   import { session, onAuth, requireUser } from "./auth.js";
 */

import { db, safe } from "./supabase-client.js";
import { DEFAULT_SETTINGS } from "./config.js";
import { toast } from "./ui.js";

/** Κοινή, ζωντανή κατάσταση. Μη την αντικαθιστάς — μόνο διάβασέ την. */
export const session = {
  ready: false,
  user: null,
  profile: null,
  role: null, // "admin" | "moderator" | null
  isAdmin: false,
  isModerator: false,
};

export const settings = { ...DEFAULT_SETTINGS };

const listeners = new Set();
let settingsLoaded = null;

function emit() {
  listeners.forEach((fn) => {
    try {
      fn(session);
    } catch (err) {
      console.warn("[auth listener]", err);
    }
  });
}

/**
 * Καλείται αμέσως με την τρέχουσα κατάσταση (ακόμη κι αν δεν έχει «γίνει
 * ready») και ξανά σε κάθε αλλαγή. Επιστρέφει συνάρτηση αποσύνδεσης.
 */
export function onAuth(fn) {
  listeners.add(fn);
  fn(session);
  return () => listeners.delete(fn);
}

/** Περιμένει μέχρι να είναι γνωστή η κατάσταση σύνδεσης. */
export function authReady() {
  if (session.ready) return Promise.resolve(session);
  return new Promise((resolve) => {
    const off = onAuth((state) => {
      if (state.ready) {
        off();
        resolve(state);
      }
    });
  });
}

/* --------------------------------------------------------------------------
   Φόρτωση προφίλ / ρόλου
   -------------------------------------------------------------------------- */

async function loadProfile(userId) {
  return safe(db.from("profiles").select("*").eq("user_id", userId).maybeSingle());
}

async function loadRole(userId) {
  const rows = await safe(db.from("user_roles").select("role").eq("user_id", userId), []);
  const roles = (rows || []).map((row) => row.role);
  if (roles.includes("admin")) return "admin";
  if (roles.includes("moderator")) return "moderator";
  return null;
}

async function touchLastSeen(userId) {
  await safe(db.from("profiles").update({ last_seen: new Date().toISOString() }).eq("user_id", userId));
}

async function hydrate(user) {
  session.user = user || null;

  if (!user) {
    session.profile = null;
    session.role = null;
    session.isAdmin = false;
    session.isModerator = false;
    return;
  }

  const profile = await loadProfile(user.id);

  // Πύλη έγκρισης — ίδια συμπεριφορά με το React AuthContext.
  if (profile && profile.is_approved === false) {
    toast("Λογαριασμός σε αναμονή", {
      body: "Ο λογαριασμός σου δεν έχει εγκριθεί ακόμα από τους διαχειριστές.",
      tone: "bad",
      ms: 7000,
    });
    await db.auth.signOut();
    session.user = null;
    session.profile = null;
    session.role = null;
    session.isAdmin = false;
    session.isModerator = false;
    return;
  }

  session.profile = profile;
  session.role = await loadRole(user.id);
  session.isAdmin = session.role === "admin";
  session.isModerator = session.role === "admin" || session.role === "moderator";
  touchLastSeen(user.id);
}

/* --------------------------------------------------------------------------
   Site settings
   -------------------------------------------------------------------------- */

export function loadSettings() {
  if (settingsLoaded) return settingsLoaded;
  settingsLoaded = (async () => {
    const rows = await safe(db.from("site_settings").select("key, value"), []);
    (rows || []).forEach((row) => {
      if (row.value) settings[row.key] = row.value;
    });
    return settings;
  })();
  return settingsLoaded;
}

/** Καθαρίζει την cache ώστε το admin panel να δει τις αλλαγές του. */
export function invalidateSettings() {
  settingsLoaded = null;
  return loadSettings();
}

/* --------------------------------------------------------------------------
   Εκκίνηση
   -------------------------------------------------------------------------- */

let started = false;
let heartbeat = null;

export function initAuth() {
  if (started) return authReady();
  started = true;

  db.auth.onAuthStateChange(async (_event, next) => {
    await hydrate(next?.user ?? null);
    session.ready = true;
    emit();
  });

  db.auth.getSession().then(async ({ data }) => {
    await hydrate(data?.session?.user ?? null);
    session.ready = true;
    emit();
  });

  // Heartbeat «τελευταία σύνδεση» κάθε 2 λεπτά.
  heartbeat = setInterval(() => {
    if (session.user) touchLastSeen(session.user.id);
  }, 120000);
  window.addEventListener("pagehide", () => clearInterval(heartbeat));

  return authReady();
}

export async function signOut() {
  await db.auth.signOut();
  location.href = "home.html";
}

/**
 * Για σελίδες μόνο για μέλη. Αν δεν υπάρχει χρήστης, στέλνει στο auth.html
 * κρατώντας το σημείο επιστροφής. Επιστρέφει το user ή null.
 */
export async function requireUser({ redirect = true } = {}) {
  const state = await authReady();
  if (state.user) return state.user;
  if (redirect) {
    const back = encodeURIComponent(location.pathname.split("/").pop() + location.search);
    location.replace(`auth.html?next=${back}`);
  }
  return null;
}

/** Για το admin panel. */
export async function requireAdmin() {
  const state = await authReady();
  if (!state.user) {
    location.replace("auth.html?next=admin.html");
    return null;
  }
  if (!state.isAdmin) {
    location.replace("home.html");
    return null;
  }
  return state.user;
}
