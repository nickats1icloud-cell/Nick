/** Ορισμός νέου κωδικού μετά από το email επαναφοράς. */

import { mountShell } from "../shell.js";
import { db } from "../supabase-client.js";
import { $, toastOk, toastError, toast } from "../ui.js";

await mountShell("");

$("#reset-form").addEventListener("submit", async (ev) => {
  ev.preventDefault();
  const data = new FormData(ev.target);
  const password = String(data.get("password") || "");
  const confirm = String(data.get("confirm") || "");

  if (password.length < 6) {
    toast("Πολύ μικρός κωδικός", { body: "Χρειάζονται τουλάχιστον 6 χαρακτήρες.", tone: "bad" });
    return;
  }
  if (password !== confirm) {
    toast("Οι κωδικοί δεν ταιριάζουν", { tone: "bad" });
    return;
  }

  const button = ev.target.querySelector('[type="submit"]');
  button.disabled = true;

  const { error } = await db.auth.updateUser({ password });
  button.disabled = false;

  if (error) {
    toastError(error);
    return;
  }

  toastOk("Ο κωδικός άλλαξε", "Μπορείς να συνδεθείς με τον νέο σου κωδικό.");
  setTimeout(() => (location.href = "home.html"), 1200);
});
