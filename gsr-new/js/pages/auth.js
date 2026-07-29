/**
 * Σύνδεση / Εγγραφή (2 βήματα) / Ξέχασα τον κωδικό.
 *
 * Η εγγραφή αντιγράφει τη ροή του αρχικού project:
 *  1. στοιχεία λογαριασμού → 2. αγωνιστικό προφίλ
 *  · μετά το signUp ενημερώνεται το `profiles` με τα extra πεδία
 *  · καλείται το edge function `notify-admin-signup`
 *  · γίνεται αμέσως signOut — ο λογαριασμός περιμένει έγκριση admin
 */

import { mountShell } from "../shell.js";
import { db, safe, countRows } from "../supabase-client.js";
import { authReady, settings } from "../auth.js";
import { particleField } from "../fx.js";
import { $, esc, param, toast, toastOk, toastError } from "../ui.js";
import { SIM_OPTIONS, SETUP_OPTIONS } from "../config.js";

await mountShell("", { footer: false });
particleField($("#auth-canvas"), { count: 30, link: 110 });
particleField($("#auth-art-canvas"), { count: 34 });

const next = param("next") || "home.html";

// Ήδη συνδεδεμένος → φύγε από το auth.
authReady().then((state) => {
  if (state.user) location.replace(next);
});

countRows("forum_threads").then((count) => {
  const node = $("#auth-threads");
  if (node) node.textContent = String(count || 0);
});

/* ----------------------------------------------------------- κατάσταση ---- */

const state = {
  mode: "login", // "login" | "signup" | "forgot"
  step: 1,
  sim: "",
  setup: "",
};

const form = $("#auth-form");
const titleNode = $("#auth-title");
const leadNode = $("#auth-lead");
const stepsNode = $("#auth-steps");
const switchNode = $("#auth-switch");

const field = (label, name, type, placeholder, extra = "") =>
  `<label class="hub-field"><span>${esc(label)}</span>
     <span class="auth__input-wrap" style="display:block">
       <input class="hub-input" type="${type}" name="${name}" placeholder="${esc(placeholder)}" ${extra} />
     </span>
   </label>`;

const passwordField = (label, placeholder, name = "password") =>
  `<label class="hub-field"><span>${esc(label)}</span>
     <span class="auth__input-wrap" style="display:block">
       <input class="hub-input" type="password" name="${name}" placeholder="${esc(placeholder)}" required autocomplete="current-password" />
       <button type="button" class="auth__pw-toggle" data-pw aria-label="Εμφάνιση κωδικού">👁</button>
     </span>
   </label>`;

function draw() {
  const registrationOff = settings.registration_enabled === "false";

  if (state.mode === "forgot") {
    titleNode.textContent = "Επαναφορά";
    leadNode.textContent = "Συμπλήρωσε το email σου για επαναφορά κωδικού";
    stepsNode.hidden = true;
    form.innerHTML = `${field("Email", "email", "email", "Το email σου", 'required autocomplete="email"')}
      <button class="hub-btn hub-btn--primary hub-btn--block" type="submit">Αποστολή link</button>`;
    switchNode.innerHTML = '<button type="button" class="hub-btn hub-btn--ghost hub-btn--sm" data-go="login">Πίσω στη σύνδεση</button>';
    return;
  }

  if (state.mode === "login") {
    titleNode.textContent = "Σύνδεση";
    leadNode.textContent = "Καλώς ήρθες πίσω στην πίστα";
    stepsNode.hidden = true;
    form.innerHTML = `${field("Email", "email", "email", "Το email σου", 'required autocomplete="email"')}
      ${passwordField("Κωδικός", "Ο κωδικός σου")}
      <p style="text-align:right"><button type="button" class="u-small" style="background:none;border:0;color:hsl(var(--brand));cursor:pointer" data-go="forgot">Ξέχασες τον κωδικό;</button></p>
      <button class="hub-btn hub-btn--primary hub-btn--block" type="submit">Σύνδεση</button>`;
    switchNode.innerHTML = registrationOff
      ? '<span class="u-faint">Οι εγγραφές είναι προσωρινά κλειστές.</span>'
      : 'Δεν έχεις λογαριασμό; <button type="button" style="background:none;border:0;color:hsl(var(--brand));cursor:pointer;font-weight:500" data-go="signup">Εγγραφή</button>';
    return;
  }

  // --- Εγγραφή ---
  stepsNode.hidden = false;
  stepsNode.innerHTML = `<i class="${state.step >= 1 ? "on" : ""}"></i><i class="${state.step >= 2 ? "on" : ""}"></i>`;
  titleNode.textContent = state.step === 1 ? "Εγγραφή" : "Ο οδηγός σου";
  leadNode.textContent =
    state.step === 1 ? "Γίνε μέλος της κοινότητας" : "Πες μας λίγα για τον αγωνιστικό σου εαυτό 🏎️";

  if (state.step === 1) {
    form.innerHTML = `${field("Ονοματεπώνυμο", "displayName", "text", "Το όνομά σου", 'required autocomplete="name"')}
      ${field("Email", "email", "email", "Το email σου", 'required autocomplete="email"')}
      ${passwordField("Κωδικός", "Τουλάχιστον 6 χαρακτήρες")}
      <button class="hub-btn hub-btn--primary hub-btn--block" type="button" data-step2>Συνέχεια →</button>`;
  } else {
    form.innerHTML = `
      <div class="hub-field">
        <span class="hub-label">🎮 Αγαπημένο sim</span>
        <div class="hub-chips" data-sims>
          ${SIM_OPTIONS.map((sim) => `<button type="button" class="hub-chip ${state.sim === sim ? "is-active" : ""}" data-sim="${esc(sim)}">${esc(sim)}</button>`).join("")}
        </div>
      </div>
      <div class="hub-field">
        <span class="hub-label">🖥 Τύπος setup</span>
        <div class="auth__setup-grid" data-setups>
          ${SETUP_OPTIONS.map(
            (opt) => `<button type="button" class="auth__setup ${state.setup === opt.value ? "is-active" : ""}" data-setup="${opt.value}">
              <span>${opt.icon}</span><span>${esc(opt.label)}</span></button>`,
          ).join("")}
        </div>
      </div>
      ${field("📍 Αγαπημένη πίστα", "favoriteTrack", "text", "π.χ. Spa-Francorchamps, Monza…")}
      <div class="u-row">
        <button class="hub-btn hub-btn--ghost" type="button" data-step1 style="flex:1">← Πίσω</button>
        <button class="hub-btn hub-btn--primary" type="submit" style="flex:1">Εγγραφή 🏁</button>
      </div>`;
  }

  switchNode.innerHTML =
    'Έχεις ήδη λογαριασμό; <button type="button" style="background:none;border:0;color:hsl(var(--brand));cursor:pointer;font-weight:500" data-go="login">Σύνδεση</button>';
}

/* ------------------------------------------------------------ ενέργειες ---- */

// Κρατάμε τις τιμές του βήματος 1 όσο ο χρήστης πάει μπρος-πίσω.
const draft = { displayName: "", email: "", password: "", favoriteTrack: "" };

function captureDraft() {
  const data = new FormData(form);
  for (const key of Object.keys(draft)) {
    const value = data.get(key);
    if (value !== null) draft[key] = String(value);
  }
}

function restoreDraft() {
  for (const [key, value] of Object.entries(draft)) {
    const input = form.querySelector(`[name="${key}"]`);
    if (input && value) input.value = value;
  }
}

document.addEventListener("click", (ev) => {
  const go = ev.target.closest("[data-go]");
  if (go) {
    state.mode = go.dataset.go;
    state.step = 1;
    draw();
    restoreDraft();
    return;
  }

  const pw = ev.target.closest("[data-pw]");
  if (pw) {
    const input = pw.previousElementSibling;
    input.type = input.type === "password" ? "text" : "password";
    pw.textContent = input.type === "password" ? "👁" : "🙈";
    return;
  }

  const step2 = ev.target.closest("[data-step2]");
  if (step2) {
    captureDraft();
    if (!draft.displayName.trim() || !draft.email.trim() || draft.password.length < 6) {
      toast("Συμπλήρωσε τα στοιχεία", { body: "Ο κωδικός χρειάζεται τουλάχιστον 6 χαρακτήρες.", tone: "bad" });
      return;
    }
    state.step = 2;
    draw();
    restoreDraft();
    return;
  }

  const step1 = ev.target.closest("[data-step1]");
  if (step1) {
    captureDraft();
    state.step = 1;
    draw();
    restoreDraft();
    return;
  }

  const sim = ev.target.closest("[data-sim]");
  if (sim) {
    state.sim = state.sim === sim.dataset.sim ? "" : sim.dataset.sim;
    form.querySelectorAll("[data-sim]").forEach((node) => node.classList.toggle("is-active", node.dataset.sim === state.sim));
    return;
  }

  const setup = ev.target.closest("[data-setup]");
  if (setup) {
    state.setup = state.setup === setup.dataset.setup ? "" : setup.dataset.setup;
    form.querySelectorAll("[data-setup]").forEach((node) => node.classList.toggle("is-active", node.dataset.setup === state.setup));
  }
});

form.addEventListener("submit", async (ev) => {
  ev.preventDefault();
  captureDraft();
  const submit = form.querySelector('[type="submit"]');
  const original = submit.textContent;
  submit.disabled = true;
  submit.textContent = "Περίμενε…";

  try {
    if (state.mode === "forgot") {
      const { error } = await db.auth.resetPasswordForEmail(draft.email, {
        redirectTo: `${location.origin}${location.pathname.replace(/[^/]*$/, "")}reset-password.html`,
      });
      if (error) throw error;
      toastOk("Έλεγξε το email σου", "Σου στείλαμε link για επαναφορά κωδικού.");
      state.mode = "login";
      draw();
      restoreDraft();
      return;
    }

    if (state.mode === "login") {
      const { error } = await db.auth.signInWithPassword({ email: draft.email, password: draft.password });
      if (error) throw error;
      // Ο έλεγχος έγκρισης γίνεται στο auth.js· αν περάσει, πάμε παρακάτω.
      const state2 = await authReady();
      if (state2.user) location.href = next;
      return;
    }

    // --- Εγγραφή ---
    const { data, error } = await db.auth.signUp({
      email: draft.email,
      password: draft.password,
      options: { data: { full_name: draft.displayName } },
    });
    if (error) throw error;

    if (data.user) {
      await safe(
        db
          .from("profiles")
          .update({
            display_name: draft.displayName || null,
            favorite_sim: state.sim || null,
            setup_type: state.setup || null,
            favorite_track: draft.favoriteTrack || null,
          })
          .eq("user_id", data.user.id),
      );
    }

    // Ειδοποίηση admin (Discord webhook μέσω edge function). Δεν είναι κρίσιμη.
    try {
      await db.functions.invoke("notify-admin-signup", {
        body: { email: draft.email, display_name: draft.displayName },
      });
    } catch (err) {
      console.warn("notify-admin-signup", err);
    }

    // Ο λογαριασμός χρειάζεται έγκριση — αποσύνδεση αμέσως.
    await db.auth.signOut();
    toastOk("Εγγραφή επιτυχής! 🏁", "Ο λογαριασμός σου αναμένει έγκριση από τους διαχειριστές.");
    Object.keys(draft).forEach((key) => (draft[key] = ""));
    state.mode = "login";
    state.step = 1;
    state.sim = "";
    state.setup = "";
    draw();
  } catch (err) {
    toastError(err);
  } finally {
    submit.disabled = false;
    submit.textContent = original;
  }
});

draw();
