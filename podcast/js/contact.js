/*
 * Φόρμα επικοινωνίας: επιλογή θέματος, inline validation (μετά το πρώτο
 * blur, όχι σε κάθε πλήκτρο), μετρητής χαρακτήρων.
 *
 * ΔΕΝ υπάρχει backend: τα μηνύματα δεν στέλνονται πουθενά. Αντί να δείξουμε
 * ψεύτικο "στάλθηκε", ανοίγουμε τον mail client με προσυμπληρωμένο κείμενο.
 * Για κανονική αποθήκευση, δες το README (Supabase, όπως στο κύριο site).
 */

import { initPage } from "./ui.js";
import { SITE } from "./data/site.js";
import { toast } from "./toast.js";

initPage();

const form = document.querySelector("[data-contact]");
if (form) {
  const hints = {
    idea: "Π.χ. «Επεισόδιο για setups σε rally»",
    guest: "Πες μας ποιος είσαι και τι θα ήθελες να συζητήσουμε",
    partner: "Ποια είναι η εταιρεία/διοργάνωση και τι έχεις στο μυαλό σου",
  };
  let topic = "idea";

  /* Επιλογή θέματος */
  form.querySelectorAll("[data-topic]").forEach((button) => {
    button.addEventListener("click", () => {
      topic = button.dataset.topic;
      form
        .querySelectorAll("[data-topic]")
        .forEach((other) => other.setAttribute("aria-pressed", String(other === button)));
      form.querySelector("[data-subject-hint]").textContent = hints[topic];
    });
  });

  /* Μετρητής χαρακτήρων */
  const message = form.querySelector("#message");
  const chars = form.querySelector("[data-chars]");
  message.addEventListener("input", () => {
    chars.textContent = message.value.length;
  });

  /* Validation */
  const rules = {
    name: (value) => (value.trim().length >= 2 ? "" : "Γράψε το όνομά σου."),
    email: (value) =>
      /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value.trim()) ? "" : "Χρειαζόμαστε ένα σωστό email.",
    subject: (value) => (value.trim().length >= 4 ? "" : "Δώσε έναν σύντομο τίτλο."),
    message: (value) =>
      value.trim().length >= 20 ? "" : "Πες μας λίγα παραπάνω (τουλάχιστον 20 χαρακτήρες).",
  };

  const validateField = (field) => {
    const rule = rules[field.name];
    if (!rule) return true;
    const error = rule(field.value);
    field.setAttribute("aria-invalid", String(Boolean(error)));
    const slot = form.querySelector(`[data-error-for="${field.name}"]`);
    if (slot) slot.textContent = error;
    return !error;
  };

  // Επικύρωση στο blur — δεν "τσιρίζουμε" όσο πληκτρολογεί ο χρήστης.
  form.querySelectorAll("input, textarea").forEach((field) => {
    field.addEventListener("blur", () => validateField(field));
    field.addEventListener("input", () => {
      if (field.getAttribute("aria-invalid") === "true") validateField(field);
    });
  });

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    const fields = [...form.querySelectorAll("input[name], textarea[name]")];
    const invalid = fields.filter((field) => !validateField(field));

    if (invalid.length) {
      invalid[0].focus();
      toast("Λείπουν κάποια στοιχεία.", "err");
      return;
    }

    const data = Object.fromEntries(new FormData(form).entries());
    const labels = { idea: "Ιδέα", guest: "Καλεσμένος", partner: "Συνεργασία" };
    const body = [
      `Θέμα: ${labels[topic]}`,
      `Όνομα: ${data.name}`,
      `Email: ${data.email}`,
      "",
      data.message,
    ].join("\n");

    const href =
      `mailto:${SITE.email}?subject=${encodeURIComponent(`[${labels[topic]}] ${data.subject}`)}` +
      `&body=${encodeURIComponent(body)}`;
    window.location.href = href;

    form.querySelector("[data-form-note]").textContent =
      "Άνοιξε το email σου με το μήνυμα έτοιμο — πάτα αποστολή εκεί.";
    toast("Δεν υπάρχει server: ανοίγουμε το email σου.", "info");
  });
}
