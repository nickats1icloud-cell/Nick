/**
 * Support tickets με realtime μηνύματα.
 *
 * Οι admins βλέπουν όλα τα tickets (το επιτρέπει το RLS), τα μέλη μόνο τα δικά
 * τους. Τα νέα μηνύματα φτάνουν μέσω Supabase realtime channel.
 */

import { mountShell } from "../shell.js";
import { session, requireUser } from "../auth.js";
import { db, safe } from "../supabase-client.js";
import {
  $, esc, render, avatar, nameOf, fmtDateTime, timeAgo, empty, byUserId, uniq,
  openModal, toastOk, toastError,
} from "../ui.js";

await mountShell("");
const user = await requireUser();

const STATUS = {
  open: { label: "Ανοιχτό", badge: "hub-badge--ok" },
  pending: { label: "Σε αναμονή", badge: "hub-badge--warn" },
  closed: { label: "Κλειστό", badge: "" },
};

const PRIORITY = { low: "Χαμηλή", normal: "Κανονική", high: "Υψηλή", urgent: "Επείγον" };

let tickets = [];
let current = null;
let profiles = new Map();
let channel = null;

if (user) {
  await loadTickets();
}

async function loadTickets() {
  render("#sup-list", '<div class="hub-loading"><div class="hub-spinner"></div></div>');

  tickets = (await safe(db.from("support_tickets").select("*").order("updated_at", { ascending: false }), [])) || [];

  if (!tickets.length) {
    render("#sup-list", empty("Δεν έχεις tickets.", "🎫"));
    render("#sup-thread", empty("Άνοιξε ένα ticket για να ξεκινήσεις.", "💬"));
    return;
  }

  render(
    "#sup-list",
    tickets
      .map((ticket) => {
        const status = STATUS[ticket.status] || STATUS.open;
        return `<button class="chat__ticket ${current?.id === ticket.id ? "is-active" : ""}" type="button" data-ticket="${esc(ticket.id)}">
          <div class="u-between" style="gap:8px">
            <span class="u-small u-truncate">${esc(ticket.subject)}</span>
            <span class="hub-badge ${status.badge}">${esc(status.label)}</span>
          </div>
          <p class="u-tiny u-faint" style="margin-top:4px">${esc(PRIORITY[ticket.priority] || ticket.priority)} · ${timeAgo(ticket.updated_at)} πριν</p>
        </button>`;
      })
      .join(""),
  );

  if (!current) openTicket(tickets[0].id);
}

$("#sup-list").addEventListener("click", (ev) => {
  const button = ev.target.closest("[data-ticket]");
  if (button) openTicket(button.dataset.ticket);
});

/* -------------------------------------------------------------- thread ---- */

async function openTicket(ticketId) {
  current = tickets.find((row) => row.id === ticketId) || null;
  if (!current) return;

  document.querySelectorAll("[data-ticket]").forEach((node) =>
    node.classList.toggle("is-active", node.dataset.ticket === ticketId),
  );

  render("#sup-thread", '<div class="hub-loading"><div class="hub-spinner"></div></div>');
  await renderThread();

  // Realtime: νέα μηνύματα στο ίδιο ticket.
  if (channel) db.removeChannel(channel);
  channel = db
    .channel(`support-${ticketId}`)
    .on(
      "postgres_changes",
      { event: "INSERT", schema: "public", table: "support_messages", filter: `ticket_id=eq.${ticketId}` },
      renderThread,
    )
    .subscribe();
}

async function renderThread() {
  const messages =
    (await safe(db.from("support_messages").select("*").eq("ticket_id", current.id).order("created_at"), [])) || [];

  const senders =
    (await safe(db.from("profiles").select("user_id, display_name, username, avatar_url").in("user_id", uniq(messages.map((m) => m.sender_id))), [])) || [];
  profiles = byUserId(senders);

  const status = STATUS[current.status] || STATUS.open;

  render(
    "#sup-thread",
    `<div class="chat__thread">
      <div class="u-between" style="padding:14px;border-bottom:1px solid hsl(var(--line-soft))">
        <div style="min-width:0">
          <h2 style="font-size:1rem" class="u-truncate">${esc(current.subject)}</h2>
          <p class="u-tiny u-faint">Άνοιξε ${fmtDateTime(current.created_at)}</p>
        </div>
        <span class="hub-badge ${status.badge}">${esc(status.label)}</span>
      </div>

      <div class="chat__stream" id="sup-stream">
        ${
          messages.length
            ? messages
                .map((message) => {
                  const mine = message.sender_id === user.id;
                  const sender = profiles.get(message.sender_id);
                  return `<div class="chat__msg ${mine ? "chat__msg--mine" : ""} ${message.is_admin ? "chat__msg--staff" : ""}">
                    ${mine ? "" : `<p class="u-tiny u-faint u-row" style="gap:6px;margin-bottom:4px">${avatar(sender, "xs")}${esc(nameOf(sender))}${message.is_admin ? ' <span class="hub-badge hub-badge--ice">Staff</span>' : ""}</p>`}
                    <span style="white-space:pre-wrap">${esc(message.content)}</span>
                    <time>${fmtDateTime(message.created_at)}</time>
                  </div>`;
                })
                .join("")
            : '<p class="u-small u-faint u-center" style="margin:auto">Κανένα μήνυμα ακόμα.</p>'
        }
      </div>

      ${
        current.status === "closed"
          ? '<p class="u-small u-faint u-center" style="padding:14px">🔒 Το ticket είναι κλειστό.</p>'
          : `<form class="chat__compose" id="sup-form">
               <input class="hub-input" name="content" placeholder="Γράψε μήνυμα…" autocomplete="off" />
               <button class="hub-btn hub-btn--primary" type="submit">Αποστολή</button>
             </form>`
      }
    </div>`,
  );

  const stream = $("#sup-stream");
  if (stream) stream.scrollTop = stream.scrollHeight;

  $("#sup-form")?.addEventListener("submit", async (ev) => {
    ev.preventDefault();
    const input = ev.target.elements.content;
    const content = input.value.trim();
    if (!content) return;
    input.value = "";

    const { error } = await db.from("support_messages").insert({
      ticket_id: current.id,
      sender_id: user.id,
      content,
      is_admin: Boolean(session.isAdmin),
    });
    if (error) return toastError(error);

    await safe(db.from("support_tickets").update({ updated_at: new Date().toISOString() }).eq("id", current.id));
    renderThread();
  });
}

/* ---------------------------------------------------------- νέο ticket ---- */

$("#sup-new").addEventListener("click", () => {
  const { root, close } = openModal({
    title: "Νέο ticket",
    body: `<label class="hub-field"><span>Θέμα *</span><input class="hub-input" name="subject" maxlength="160" /></label>
      <label class="hub-field"><span>Προτεραιότητα</span>
        <select class="hub-select" name="priority">
          ${Object.entries(PRIORITY).map(([value, label]) => `<option value="${value}" ${value === "normal" ? "selected" : ""}>${esc(label)}</option>`).join("")}
        </select>
      </label>
      <label class="hub-field"><span>Μήνυμα *</span><textarea class="hub-textarea" name="message" rows="5"></textarea></label>`,
    footer: `<button class="hub-btn hub-btn--ghost" type="button" data-close>Άκυρο</button>
             <button class="hub-btn hub-btn--primary" type="button" data-save>Άνοιγμα ticket</button>`,
  });

  root.querySelector("[data-save]").addEventListener("click", async (ev) => {
    const value = (name) => root.querySelector(`[name="${name}"]`).value.trim();
    if (!value("subject") || !value("message")) return toastError(null, "Συμπλήρωσε θέμα και μήνυμα.");

    ev.target.disabled = true;
    const { data: ticket, error } = await db
      .from("support_tickets")
      .insert({ user_id: user.id, subject: value("subject"), priority: value("priority") })
      .select()
      .single();

    if (error) {
      ev.target.disabled = false;
      return toastError(error);
    }

    await safe(
      db.from("support_messages").insert({
        ticket_id: ticket.id,
        sender_id: user.id,
        content: value("message"),
        is_admin: false,
      }),
    );

    toastOk("Το ticket δημιουργήθηκε");
    close();
    current = null;
    await loadTickets();
    openTicket(ticket.id);
  });
});

window.addEventListener("pagehide", () => {
  if (channel) db.removeChannel(channel);
});
