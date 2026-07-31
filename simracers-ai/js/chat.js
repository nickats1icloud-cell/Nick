/*
 * Η λογική της συζήτησης.
 *
 * Στέλνει το ιστορικό στο Edge Function και διαβάζει την απάντηση με
 * streaming (Server-Sent Events), ώστε τα λόγια να εμφανίζονται όπως
 * γράφονται αντί να περιμένει ο χρήστης 10 δευτερόλεπτα σε λευκή οθόνη.
 */

import { ASK_ENDPOINT, SUPABASE_ANON_KEY, SUPABASE_URL, MAX_HISTORY } from "./config.js";
import { renderMarkdown } from "./markdown.js";

const chatEl = document.getElementById("chat");
const welcomeEl = document.getElementById("welcome");
const messagesEl = document.getElementById("messages");
const formEl = document.getElementById("composer");
const inputEl = document.getElementById("input");
const sendBtn = document.getElementById("send-btn");
const resetBtn = document.getElementById("reset-btn");

/* Το ιστορικό που στέλνουμε στον βοηθό. Ζει μόνο στη μνήμη της σελίδας. */
let history = [];
let busy = false;

/* ---------- Βοηθητικά UI ---------- */

function scrollToBottom() {
  chatEl.scrollTop = chatEl.scrollHeight;
}

/** Φτιάχνει ένα μήνυμα στην οθόνη και επιστρέφει το στοιχείο του σώματος. */
function addMessage(who, { error = false } = {}) {
  const wrap = document.createElement("article");
  wrap.className = `msg msg--${who === "user" ? "user" : "bot"}${error ? " msg--error" : ""}`;

  const label = document.createElement("span");
  label.className = "msg__who";
  label.textContent = who === "user" ? "Εσύ" : "Βοηθός";

  const body = document.createElement("div");
  body.className = "msg__body";

  wrap.append(label, body);
  messagesEl.append(wrap);
  scrollToBottom();
  return { wrap, body };
}

function showTyping(body) {
  body.innerHTML =
    '<span class="typing"><span></span><span></span><span></span></span>';
}

/** Δείχνει από πού αντλήθηκε η απάντηση — διαφάνεια, όχι διακόσμηση. */
function renderSources(wrap, sources) {
  if (!sources?.length) return;

  /* Ένα chip ανά πηγή, χωρίς διπλότυπα από πολλαπλά chunks του ίδιου αρχείου. */
  const seen = new Map();
  for (const s of sources) {
    if (!seen.has(s.title)) seen.set(s.title, s);
  }

  const box = document.createElement("div");
  box.className = "sources";

  const label = document.createElement("span");
  label.className = "sources__label";
  label.textContent = "Πηγές";
  box.append(label);

  for (const s of seen.values()) {
    const isLink = typeof s.url === "string" && /^https?:\/\//i.test(s.url);
    const chip = document.createElement(isLink ? "a" : "span");
    chip.className = "source";
    chip.textContent = s.title;
    if (isLink) {
      chip.href = s.url;
      chip.target = "_blank";
      chip.rel = "noopener";
    }
    box.append(chip);
  }

  wrap.append(box);
  scrollToBottom();
}

function setBusy(state) {
  busy = state;
  sendBtn.disabled = state;
  inputEl.disabled = state;
  if (!state) inputEl.focus();
}

/* Το textarea μεγαλώνει όσο γράφεις, μέχρι το max-height του CSS. */
function autoResize() {
  inputEl.style.height = "auto";
  inputEl.style.height = `${inputEl.scrollHeight}px`;
}

/* ---------- Επικοινωνία με το Edge Function ---------- */

/**
 * Διαβάζει SSE από το fetch response και καλεί το `onEvent` για κάθε
 * γεγονός. Δεν χρησιμοποιούμε EventSource γιατί εκείνο κάνει μόνο GET —
 * εμείς χρειαζόμαστε POST για να στείλουμε το ιστορικό.
 */
async function readEventStream(response, onEvent) {
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });

    /* Τα γεγονότα χωρίζονται με κενή γραμμή. Το τελευταίο κομμάτι μπορεί
       να είναι μισό — μένει στο buffer για τον επόμενο γύρο. */
    const blocks = buffer.split("\n\n");
    buffer = blocks.pop() ?? "";

    for (const block of blocks) {
      let event = "message";
      const dataLines = [];

      for (const line of block.split("\n")) {
        if (line.startsWith("event:")) event = line.slice(6).trim();
        else if (line.startsWith("data:")) dataLines.push(line.slice(5).trim());
      }
      if (!dataLines.length) continue;

      try {
        onEvent(event, JSON.parse(dataLines.join("\n")));
      } catch {
        /* Χαλασμένο πακέτο — το προσπερνάμε αντί να σπάσει η συζήτηση. */
      }
    }
  }
}

async function ask(question) {
  history.push({ role: "user", content: question });
  addMessage("user").body.textContent = question;

  const { wrap, body } = addMessage("bot");
  showTyping(body);
  setBusy(true);

  let answer = "";
  let sources = [];

  const fail = (message) => {
    body.textContent = message;
    wrap.classList.add("msg--error");
    /* Η αποτυχημένη ερώτηση φεύγει από το ιστορικό, ώστε μια νέα
       προσπάθεια να μην ξαναστείλει σπασμένη σειρά μηνυμάτων. */
    history.pop();
  };

  try {
    const response = await fetch(ASK_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
      },
      body: JSON.stringify({ messages: history.slice(-MAX_HISTORY) }),
    });

    if (!response.ok) {
      const payload = await response.json().catch(() => ({}));
      fail(payload.error ?? `Ο βοηθός απάντησε με σφάλμα (${response.status}).`);
      return;
    }

    await readEventStream(response, (event, data) => {
      switch (event) {
        case "sources":
          sources = data.sources ?? [];
          break;

        case "delta":
          answer += data.text;
          body.innerHTML = renderMarkdown(answer);
          scrollToBottom();
          break;

        case "notice":
          answer += `\n\n*${data.message}*`;
          body.innerHTML = renderMarkdown(answer);
          break;

        case "error":
          if (!answer) {
            fail(data.message);
          } else {
            answer += `\n\n*${data.message}*`;
            body.innerHTML = renderMarkdown(answer);
          }
          break;

        case "done":
          if (answer) {
            history.push({ role: "assistant", content: answer });
            renderSources(wrap, sources);
          }
          break;
      }
    });

    if (!answer) {
      fail("Ο βοηθός δεν επέστρεψε απάντηση. Δοκίμασε ξανά.");
    }
  } catch (err) {
    console.error(err);
    fail("Δεν μπόρεσα να συνδεθώ. Έλεγξε τη σύνδεσή σου και δοκίμασε ξανά.");
  } finally {
    setBusy(false);
  }
}

/* ---------- Συμβάντα ---------- */

function submitQuestion(text) {
  const question = text.trim();
  if (!question || busy) return;

  welcomeEl.hidden = true;
  inputEl.value = "";
  autoResize();
  ask(question);
}

formEl.addEventListener("submit", (event) => {
  event.preventDefault();
  submitQuestion(inputEl.value);
});

/* Enter στέλνει, Shift+Enter αλλάζει γραμμή — όπως σε κάθε chat. */
inputEl.addEventListener("keydown", (event) => {
  if (event.key === "Enter" && !event.shiftKey) {
    event.preventDefault();
    submitQuestion(inputEl.value);
  }
});

inputEl.addEventListener("input", autoResize);

document.getElementById("suggestions").addEventListener("click", (event) => {
  const chip = event.target.closest(".chip");
  if (chip) submitQuestion(chip.dataset.prompt);
});

resetBtn.addEventListener("click", () => {
  if (busy) return;
  history = [];
  messagesEl.replaceChildren();
  welcomeEl.hidden = false;
  inputEl.value = "";
  autoResize();
  inputEl.focus();
});

/* ---------- Εκκίνηση ---------- */

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  welcomeEl.hidden = true;
  const { wrap, body } = addMessage("bot", { error: true });
  body.innerHTML = renderMarkdown(
    "**Το site δεν έχει ρυθμιστεί ακόμα.**\n\n" +
      "Συμπλήρωσε τα `SUPABASE_URL` και `SUPABASE_ANON_KEY` στο `js/config.js`. " +
      "Τα βρίσκεις στο Supabase Dashboard → Project Settings → API.",
  );
  wrap.querySelector(".msg__who").textContent = "Ρύθμιση";
  setBusy(true);
} else {
  inputEl.focus();
}
