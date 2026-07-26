// Singleton auth module — ES modules are cached per URL, so every page that
// imports this shares the same state. Stands in for a React context/provider
// without needing a framework.
import { supabase } from "./supabase-client.js";
import { toast } from "./toast.js";

const LAST_SEEN_INTERVAL_MS = 2 * 60 * 1000;

let currentUser = null;
let currentSession = null;
let isApproved = false;
let heartbeat = null;
const listeners = new Set();

function notify() {
  const snapshot = { user: currentUser, session: currentSession, isApproved };
  listeners.forEach((fn) => fn(snapshot));
}

async function checkApproval(userId) {
  const { data } = await supabase.from("profiles").select("is_approved").eq("user_id", userId).single();

  if (!data?.is_approved) {
    toast.error("Ο λογαριασμός σου δεν έχει εγκριθεί ακόμα από τους διαχειριστές.");
    await supabase.auth.signOut();
    isApproved = false;
    notify();
    return;
  }
  isApproved = true;
  notify();
}

async function updateLastSeen(userId) {
  await supabase.from("profiles").update({ last_seen: new Date().toISOString() }).eq("user_id", userId);
}

function startHeartbeat(userId) {
  clearInterval(heartbeat);
  heartbeat = setInterval(() => updateLastSeen(userId), LAST_SEEN_INTERVAL_MS);
}

let initialized = false;

/** Call once per page (partials.js does this automatically). */
export async function initAuth() {
  if (initialized) return;
  initialized = true;

  supabase.auth.onAuthStateChange((_event, session) => {
    currentSession = session;
    currentUser = session?.user ?? null;

    if (currentUser) {
      void checkApproval(currentUser.id);
      void updateLastSeen(currentUser.id);
      startHeartbeat(currentUser.id);
    } else {
      isApproved = false;
      clearInterval(heartbeat);
      notify();
    }
  });

  const {
    data: { session },
  } = await supabase.auth.getSession();
  currentSession = session;
  currentUser = session?.user ?? null;
  if (currentUser) {
    await checkApproval(currentUser.id);
    startHeartbeat(currentUser.id);
  }
  notify();
}

/** Subscribe to auth state; returns an unsubscribe function. Fires immediately with the current state. */
export function onAuthChange(fn) {
  listeners.add(fn);
  fn({ user: currentUser, session: currentSession, isApproved });
  return () => listeners.delete(fn);
}

export function getUser() {
  return currentUser;
}

export function getIsApproved() {
  return isApproved;
}

export async function signOut() {
  await supabase.auth.signOut();
}
