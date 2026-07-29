/**
 * Φόρμα επικοινωνίας.
 *
 * Στο αρχικό project η υποβολή ήταν προσομοίωση (δεν υπάρχει πίνακας
 * μηνυμάτων επικοινωνίας στο schema). Εδώ κάνουμε το χρήσιμο: αν ο χρήστης
 * είναι συνδεδεμένος, το μήνυμα γίνεται πραγματικό support ticket· αλλιώς
 * ανοίγει mailto προς το `contact_email` με προ-συμπληρωμένο κείμενο.
 */

import { mountShell } from "../shell.js";
import { session, settings, authReady, loadSettings } from "../auth.js";
import { db, safe } from "../supabase-client.js";
import { $, esc, safeUrl, render, toastOk, toastError } from "../ui.js";

await mountShell("contact");
// Οι κάρτες επικοινωνίας διαβάζουν τα site_settings — τα περιμένουμε ρητά.
await Promise.all([authReady(), loadSettings()]);

/* --------------------------------------------------------- κάρτες info ---- */

const cards = [
  { icon: "✉️", title: "Email", desc: "Στείλε μας email για οποιοδήποτε θέμα", value: settings.contact_email, href: `mailto:${settings.contact_email}` },
  {
    icon: "💬",
    title: "Discord",
    desc: "Γίνε μέλος της κοινότητάς μας",
    value: String(settings.discord_invite || "").replace(/^https?:\/\//, ""),
    href: settings.discord_invite,
    external: true,
  },
  { icon: "🎧", title: "Support", desc: "Άνοιξε ticket για άμεση βοήθεια", value: "Σύστημα Tickets", href: "support.html" },
  { icon: "🕒", title: "Ώρες υποστήριξης", desc: "Διαθέσιμοι για βοήθεια", value: settings.support_hours },
];

render(
  "#contact-info",
  cards
    .map(
      (card) => `<div class="hub-card" style="display:flex;gap:14px;align-items:flex-start">
        <span style="font-size:1.3rem">${card.icon}</span>
        <div style="min-width:0">
          <p style="font-family:var(--font-display);font-weight:600;font-size:0.9rem">${esc(card.title)}</p>
          <p class="u-tiny u-faint">${esc(card.desc)}</p>
          ${
            card.href
              ? `<a class="u-small" href="${safeUrl(card.href)}" ${card.external ? 'target="_blank" rel="noopener noreferrer"' : ""}>${esc(card.value)}</a>`
              : `<p class="u-small" style="color:hsl(var(--ember))">${esc(card.value)}</p>`
          }
        </div>
      </div>`,
    )
    .join(""),
);

/* ---------------------------------------------------------------- φόρμα ---- */

const form = $("#contact-form");
const counter = $("#contact-count");
const message = form.elements.message;

message.addEventListener("input", () => (counter.textContent = String(message.value.length)));

$("#contact-faq").addEventListener("click", (ev) => {
  const chip = ev.target.closest(".hub-chip");
  if (chip) form.elements.subject.value = chip.textContent.trim();
});

// Προσυμπλήρωση για συνδεδεμένους.
if (session.user) {
  form.elements.name.value = session.profile?.display_name || "";
  form.elements.email.value = session.user.email || "";
}

form.addEventListener("submit", async (ev) => {
  ev.preventDefault();
  const data = new FormData(form);
  const name = String(data.get("name") || "").trim();
  const email = String(data.get("email") || "").trim();
  const subject = String(data.get("subject") || "").trim() || "Μήνυμα από τη φόρμα επικοινωνίας";
  const body = String(data.get("message") || "").trim();

  if (!name || !email || !body) {
    toastError(null, "Συμπλήρωσε όλα τα απαραίτητα πεδία.");
    return;
  }

  const button = form.querySelector('[type="submit"]');
  button.disabled = true;

  try {
    if (session.user) {
      // Συνδεδεμένος → γίνεται πραγματικό ticket, ώστε να απαντηθεί μέσα στο site.
      const { data: ticket, error } = await db
        .from("support_tickets")
        .insert({ user_id: session.user.id, subject, priority: "normal" })
        .select()
        .single();
      if (error) throw error;

      await safe(
        db.from("support_messages").insert({
          ticket_id: ticket.id,
          sender_id: session.user.id,
          content: body,
          is_admin: false,
        }),
      );

      toastOk("Το μήνυμά σου εστάλη!", "Δημιουργήσαμε ticket — δες το στη σελίδα Support.");
      form.reset();
      counter.textContent = "0";
    } else {
      const href = `mailto:${settings.contact_email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(`${body}\n\n— ${name} <${email}>`)}`;
      location.href = href;
      toastOk("Άνοιξε το email σου", "Συμπληρώσαμε το μήνυμα· πάτα αποστολή από τον client σου.");
    }
  } catch (err) {
    toastError(err);
  } finally {
    button.disabled = false;
  }
});
