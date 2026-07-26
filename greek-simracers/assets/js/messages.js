// Προσωπικά μηνύματα: λίστα συζητήσεων + συνομιλία, με realtime παράδοση.
//   #/               → λίστα συζητήσεων
//   #/chat/<userId>  → συνομιλία με συγκεκριμένο μέλος
(function () {
  const app = document.getElementById("messages-app");
  if (!app) return;

  let session = null;
  let myId = null;
  let messages = [];     // όλα τα μηνύματα που με αφορούν
  let names = new Map(); // user_id → display_name
  let channel = null;
  let renderToken = 0;

  /* ============ Βοηθητικά ============ */

  function escapeHtml(value) {
    const div = document.createElement("div");
    div.textContent = value ?? "";
    return div.innerHTML;
  }

  function hasClient() {
    return typeof window.supabaseClient !== "undefined";
  }

  function avatarHue(userId) {
    const s = String(userId || "");
    let h = 0;
    for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
    return h % 360;
  }

  function avatarHtml(userId, name, size) {
    const initial = (String(name || "Μ").trim().charAt(0) || "Μ").toUpperCase();
    return `<span class="msg-avatar msg-avatar--${size}" style="background:hsl(${avatarHue(userId)} 60% 45%)" aria-hidden="true">${escapeHtml(initial)}</span>`;
  }

  function timeAgo(iso) {
    const then = new Date(iso).getTime();
    if (Number.isNaN(then)) return "";
    const minutes = Math.floor(Math.max(0, Date.now() - then) / 60000);
    if (minutes < 1) return "μόλις τώρα";
    if (minutes < 60) return "πριν " + minutes + "λ";
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return "πριν " + hours + "ω";
    const days = Math.floor(hours / 24);
    if (days < 7) return "πριν " + days + "μ";
    return new Date(iso).toLocaleDateString("el-GR", { day: "numeric", month: "short" });
  }

  function clockTime(iso) {
    const d = new Date(iso);
    return Number.isNaN(d.getTime()) ? "" : d.toLocaleTimeString("el-GR", { hour: "2-digit", minute: "2-digit" });
  }

  function dayLabel(iso) {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return "";
    const today = new Date();
    const yesterday = new Date();
    yesterday.setDate(today.getDate() - 1);
    const sameDay = (a, b) => a.toDateString() === b.toDateString();
    if (sameDay(d, today)) return "Σήμερα";
    if (sameDay(d, yesterday)) return "Χθες";
    return d.toLocaleDateString("el-GR", { day: "numeric", month: "long", year: "numeric" });
  }

  // Για την προεπισκόπηση στη λίστα θέλουμε σκέτο κείμενο, χωρίς tags.
  function stripBBCode(text) {
    return String(text || "")
      .replace(/\[quote[^\]]*\][\s\S]*?\[\/quote\]/gi, "")
      .replace(/\[code\]([\s\S]*?)\[\/code\]/gi, "$1")
      .replace(/\[img\][^\]]*\[\/img\]/gi, "🖼️ εικόνα")
      .replace(/\[youtube\][^\]]*\[\/youtube\]/gi, "▶ βίντεο")
      .replace(/\[url=([^\]]*)\]([\s\S]*?)\[\/url\]/gi, "$2")
      .replace(/\[\*\]/g, " • ")
      .replace(/\[\/?[a-z]+(?:=[^\]]*)?\]/gi, "")
      .replace(/\s+/g, " ")
      .trim();
  }

  function otherIdOf(message) {
    return message.sender_id === myId ? message.recipient_id : message.sender_id;
  }

  function nameOf(userId) {
    return names.get(userId) || "Μέλος";
  }

  function renderState(html) {
    app.innerHTML = `<div class="state-message">${html}</div>`;
  }

  function renderLoading(message) {
    renderState(`<div class="spinner"></div><p>${escapeHtml(message)}</p>`);
  }

  function renderError(message) {
    renderState(`<p>${escapeHtml(message)}</p>`);
  }

  /* ============ Δεδομένα ============ */

  async function loadNames(ids) {
    const missing = ids.filter((id) => id && !names.has(id));
    if (!missing.length) return;
    const { data } = await window.supabaseClient
      .from("profiles")
      .select("user_id, display_name")
      .in("user_id", missing);
    (data || []).forEach((row) => names.set(row.user_id, row.display_name || "Μέλος"));
  }

  async function loadMessages() {
    const { data, error } = await window.supabaseClient
      .from("private_messages")
      .select("id, sender_id, recipient_id, content, read_at, created_at")
      .or(`sender_id.eq.${myId},recipient_id.eq.${myId}`)
      .order("created_at", { ascending: false })
      .limit(500);
    if (error) throw error;
    messages = data || [];
    await loadNames([...new Set(messages.map(otherIdOf))]);
  }

  // Ομαδοποιεί τα μηνύματα ανά συνομιλητή, νεότερη συζήτηση πρώτη.
  function conversations() {
    const map = new Map();
    // Τα messages είναι ήδη ταξινομημένα φθίνουσα, οπότε το πρώτο που
    // συναντάμε ανά συνομιλητή είναι και το τελευταίο μήνυμα.
    messages.forEach((message) => {
      const other = otherIdOf(message);
      if (!map.has(other)) {
        map.set(other, { otherId: other, last: message, unread: 0 });
      }
      if (message.recipient_id === myId && !message.read_at) {
        map.get(other).unread += 1;
      }
    });
    return [...map.values()].sort(
      (a, b) => new Date(b.last.created_at) - new Date(a.last.created_at)
    );
  }

  function totalUnread() {
    return messages.filter((m) => m.recipient_id === myId && !m.read_at).length;
  }

  /* ============ Λίστα συζητήσεων ============ */

  function conversationListHtml(activeId) {
    const list = conversations();
    if (!list.length) {
      return `<p class="msg-empty">Δεν έχεις συζητήσεις ακόμα — στείλε το πρώτο σου μήνυμα!</p>`;
    }
    return list
      .map((conv) => {
        const isMine = conv.last.sender_id === myId;
        const snippet = (isMine ? "Εσύ: " : "") + (stripBBCode(conv.last.content) || "(χωρίς κείμενο)");
        return `
          <a class="msg-conv${conv.otherId === activeId ? " is-active" : ""}" href="#/chat/${encodeURIComponent(conv.otherId)}">
            ${avatarHtml(conv.otherId, nameOf(conv.otherId), "sm")}
            <span class="msg-conv__body">
              <span class="msg-conv__top">
                <span class="msg-conv__name">${escapeHtml(nameOf(conv.otherId))}</span>
                <span class="msg-conv__time">${escapeHtml(timeAgo(conv.last.created_at))}</span>
              </span>
              <span class="msg-conv__snippet">${escapeHtml(snippet)}</span>
            </span>
            ${conv.unread ? `<span class="msg-conv__unread">${conv.unread}</span>` : ""}
          </a>`;
      })
      .join("");
  }

  function shellHtml(activeId, rightPane) {
    return `
      <div class="msg-app${activeId ? " is-chat" : ""}">
        <aside class="msg-sidebar">
          <div class="msg-sidebar__head">
            <h2 class="msg-sidebar__title">Συζητήσεις</h2>
            <button type="button" class="btn btn-outline btn-sm" id="msg-new">✚ Νέο</button>
          </div>
          <div class="msg-search" id="msg-search" hidden>
            <label class="visually-hidden" for="msg-search-input">Αναζήτηση μέλους</label>
            <input id="msg-search-input" type="search" placeholder="Αναζήτηση μέλους…" autocomplete="off">
            <div class="msg-search__results" id="msg-search-results"></div>
          </div>
          <div class="msg-conv-list" id="msg-conv-list">${conversationListHtml(activeId)}</div>
        </aside>
        <section class="msg-main" id="msg-main">${rightPane}</section>
      </div>`;
  }

  function wireSidebar() {
    const toggle = app.querySelector("#msg-new");
    const search = app.querySelector("#msg-search");
    const input = app.querySelector("#msg-search-input");
    const results = app.querySelector("#msg-search-results");
    if (!toggle) return;

    toggle.addEventListener("click", () => {
      search.hidden = !search.hidden;
      if (!search.hidden) input.focus();
      else results.innerHTML = "";
    });

    let timer = null;
    input.addEventListener("input", () => {
      clearTimeout(timer);
      const term = input.value.trim();
      if (term.length < 2) {
        results.innerHTML = "";
        return;
      }
      timer = setTimeout(async () => {
        try {
          const { data } = await window.supabaseClient
            .from("profiles")
            .select("user_id, display_name")
            .ilike("display_name", `%${term}%`)
            .neq("user_id", myId)
            .limit(8);
          const rows = data || [];
          if (!rows.length) {
            results.innerHTML = `<p class="msg-search__empty">Κανένα μέλος δεν βρέθηκε.</p>`;
            return;
          }
          rows.forEach((row) => names.set(row.user_id, row.display_name || "Μέλος"));
          results.innerHTML = rows
            .map(
              (row) => `
                <a class="msg-search__item" href="#/chat/${encodeURIComponent(row.user_id)}">
                  ${avatarHtml(row.user_id, row.display_name, "sm")}
                  <span>${escapeHtml(row.display_name || "Μέλος")}</span>
                </a>`
            )
            .join("");
        } catch (err) {
          results.innerHTML = `<p class="msg-search__empty">Η αναζήτηση απέτυχε.</p>`;
        }
      }, 300);
    });
  }

  /* ============ Συνομιλία ============ */

  function chatMessagesHtml(otherId) {
    const thread = messages
      .filter((m) => otherIdOf(m) === otherId)
      .slice()
      .sort((a, b) => new Date(a.created_at) - new Date(b.created_at));

    if (!thread.length) {
      return `<p class="msg-empty">Κανένα μήνυμα ακόμα. Γράψε το πρώτο!</p>`;
    }

    let lastDay = "";
    return thread
      .map((message) => {
        const label = dayLabel(message.created_at);
        const separator = label !== lastDay ? `<div class="msg-day">${escapeHtml(label)}</div>` : "";
        lastDay = label;
        const mine = message.sender_id === myId;
        return (
          separator +
          `<div class="msg-bubble${mine ? " msg-bubble--mine" : ""}${message.pending ? " is-pending" : ""}" data-message-id="${escapeHtml(message.id)}">
            <div class="msg-bubble__text">${window.GSRBBCode.toHtml(message.content)}</div>
            <span class="msg-bubble__time">${escapeHtml(clockTime(message.created_at))}</span>
          </div>`
        );
      })
      .join("");
  }

  function chatPaneHtml(otherId) {
    return `
      <div class="msg-chat">
        <header class="msg-chat__head">
          <a class="msg-chat__back" href="#/" aria-label="Πίσω στις συζητήσεις">←</a>
          ${avatarHtml(otherId, nameOf(otherId), "sm")}
          <a class="msg-chat__name" href="profile.html#/user/${encodeURIComponent(otherId)}">${escapeHtml(nameOf(otherId))}</a>
        </header>
        <div class="msg-chat__body" id="msg-chat-body">${chatMessagesHtml(otherId)}</div>
        <form class="msg-composer" id="msg-composer">
          <div id="msg-editor"></div>
          <button type="submit" class="btn btn-primary btn-sm">Αποστολή</button>
          <p class="form-status" id="msg-status" role="status"></p>
        </form>
      </div>`;
  }

  function scrollChatToBottom() {
    const body = app.querySelector("#msg-chat-body");
    if (body) body.scrollTop = body.scrollHeight;
  }

  async function markRead(otherId) {
    const unread = messages.filter(
      (m) => m.sender_id === otherId && m.recipient_id === myId && !m.read_at
    );
    if (!unread.length) return;
    const now = new Date().toISOString();
    unread.forEach((m) => {
      m.read_at = now;
    });
    try {
      await window.supabaseClient
        .from("private_messages")
        .update({ read_at: now })
        .eq("sender_id", otherId)
        .eq("recipient_id", myId)
        .is("read_at", null);
    } catch (err) {
      // Αν αποτύχει, το ξαναπροσπαθούμε στο επόμενο άνοιγμα.
    }
  }

  function wireComposer(otherId) {
    const form = app.querySelector("#msg-composer");
    const status = app.querySelector("#msg-status");
    if (!form) return;

    // Πλήρης editor και εδώ· Ctrl+Enter στέλνει, Enter αλλάζει γραμμή.
    const editor = window.GSREditor.create(form.querySelector("#msg-editor"), {
      label: "Μήνυμα",
      placeholder: "Γράψε ένα μήνυμα…",
      compact: true,
      hint: "Ctrl+Enter αποστολή",
      onSubmit: () => form.requestSubmit(),
    });

    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      const content = editor.getValue();
      if (!content) return;
      if (editor.isOverLimit()) {
        status.textContent = "Το μήνυμα είναι πολύ μεγάλο.";
        status.setAttribute("data-state", "error");
        return;
      }

      const tempId = "pending-" + Date.now();
      const optimistic = {
        id: tempId,
        sender_id: myId,
        recipient_id: otherId,
        content,
        read_at: null,
        created_at: new Date().toISOString(),
        pending: true,
      };
      messages.unshift(optimistic);
      editor.clear();
      status.textContent = "";
      status.removeAttribute("data-state");
      refreshChat(otherId);

      try {
        const { data, error } = await window.supabaseClient
          .from("private_messages")
          .insert({ sender_id: myId, recipient_id: otherId, content })
          .select()
          .single();
        if (error) throw error;
        const index = messages.findIndex((m) => m.id === tempId);
        if (index !== -1) messages[index] = data;
        refreshChat(otherId);
      } catch (err) {
        messages = messages.filter((m) => m.id !== tempId);
        editor.setValue(content);
        refreshChat(otherId);
        const liveStatus = app.querySelector("#msg-status");
        if (liveStatus) {
          liveStatus.textContent = "Το μήνυμα δεν στάλθηκε. Δοκίμασε ξανά.";
          liveStatus.setAttribute("data-state", "error");
        }
      }
    });
  }

  // Ξαναζωγραφίζει μόνο τα δυναμικά κομμάτια, κρατώντας το focus στο input.
  function refreshChat(otherId) {
    const body = app.querySelector("#msg-chat-body");
    const list = app.querySelector("#msg-conv-list");
    if (body) body.innerHTML = chatMessagesHtml(otherId);
    if (list) list.innerHTML = conversationListHtml(otherId);
    scrollChatToBottom();
  }

  /* ============ Realtime ============ */

  function subscribeRealtime() {
    if (channel || !window.supabaseClient.channel) return;
    try {
      channel = window.supabaseClient
        .channel("pm-" + myId)
        .on(
          "postgres_changes",
          {
            event: "INSERT",
            schema: "public",
            table: "private_messages",
            filter: "recipient_id=eq." + myId,
          },
          async (payload) => {
            const message = payload.new;
            if (!message || messages.some((m) => m.id === message.id)) return;
            messages.unshift(message);
            await loadNames([message.sender_id]);

            const activeId = currentChatId();
            if (activeId && otherIdOf(message) === activeId) {
              markRead(activeId);
              refreshChat(activeId);
            } else {
              const list = app.querySelector("#msg-conv-list");
              if (list) list.innerHTML = conversationListHtml(activeId);
            }
            updateNavBadge();
          }
        )
        .subscribe();
    } catch (err) {
      // Χωρίς realtime η σελίδα δουλεύει κανονικά με refresh.
      channel = null;
    }
  }

  // Ενημερώνει το ✉️ badge στο header (το στήνει το auth.js).
  function updateNavBadge() {
    const badge = document.querySelector("[data-messages-badge]");
    if (!badge) return;
    const count = totalUnread();
    badge.textContent = count > 99 ? "99+" : String(count);
    badge.hidden = count === 0;
  }

  function currentChatId() {
    const match = (window.location.hash || "").match(/^#\/chat\/([^/?]+)/);
    return match ? decodeURIComponent(match[1]) : null;
  }

  /* ============ Routing ============ */

  async function route() {
    const token = ++renderToken;

    if (!hasClient()) {
      renderError("Η σύνδεση με τον διακομιστή δεν είναι διαθέσιμη αυτή τη στιγμή. Δοκίμασε να ανανεώσεις τη σελίδα.");
      return;
    }

    if (!session) {
      renderLoading("Φόρτωση μηνυμάτων…");
      try {
        const { data } = await window.supabaseClient.auth.getSession();
        session = data && data.session ? data.session : null;
      } catch (err) {
        session = null;
      }
      if (token !== renderToken) return;
      if (!session) {
        renderState(
          `<p>Πρέπει να συνδεθείς για να δεις τα μηνύματά σου.</p>` +
            `<p style="margin-top:1rem;"><a class="btn btn-primary" href="auth.html">Σύνδεση / Εγγραφή</a></p>`
        );
        return;
      }
      myId = session.user.id;
    }

    if (!messages.length) {
      try {
        await loadMessages();
        if (token !== renderToken) return;
      } catch (err) {
        if (token !== renderToken) return;
        renderError("Δεν καταφέραμε να φορτώσουμε τα μηνύματα. Δοκίμασε ξανά σε λίγο.");
        return;
      }
    }

    const chatId = currentChatId();
    if (chatId) {
      await loadNames([chatId]);
      if (token !== renderToken) return;
      app.innerHTML = shellHtml(chatId, chatPaneHtml(chatId));
      wireSidebar();
      wireComposer(chatId);
      scrollChatToBottom();
      await markRead(chatId);
      refreshChat(chatId);
    } else {
      app.innerHTML = shellHtml(
        null,
        `<div class="msg-placeholder"><p>Διάλεξε μια συζήτηση από τα αριστερά ή ξεκίνα καινούργια.</p></div>`
      );
      wireSidebar();
    }

    updateNavBadge();
    subscribeRealtime();
  }

  window.addEventListener("hashchange", route);
  route();
})();
