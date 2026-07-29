/**
 * markdown.js — μικρός, ασφαλής markdown renderer.
 *
 * Το αρχικό project χρησιμοποιούσε το @uiw/react-md-editor (npm). Εδώ δεν
 * υπάρχει build step, οπότε υλοποιούμε το υποσύνολο που πραγματικά γράφουν οι
 * χρήστες: επικεφαλίδες, bold/italic, code, λίστες, quotes, links, εικόνες,
 * YouTube embeds, οριζόντιες γραμμές.
 *
 * ΑΣΦΑΛΕΙΑ: το κείμενο κάνει escape ΠΡΩΤΑ, και μόνο μετά μπαίνουν tags. Έτσι
 * τυχόν HTML μέσα στο markdown δεν εκτελείται ποτέ.
 */

import { esc, safeUrl } from "./ui.js";

const YT = /(?:youtube\.com\/(?:watch\?v=|embed\/)|youtu\.be\/)([A-Za-z0-9_-]{11})/;

function inline(text) {
  let out = text;

  // Εικόνες πριν από links (ίδια σύνταξη με ένα `!` μπροστά).
  out = out.replace(/!\[([^\]]*)\]\(([^)\s]+)\)/g, (_m, alt, url) => {
    const href = safeUrl(url);
    return href ? `<img src="${href}" alt="${alt}" loading="lazy" />` : alt;
  });

  out = out.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (_m, label, url) => {
    const href = safeUrl(url);
    if (!href) return label;
    const external = /^https?:/i.test(url);
    return `<a href="${href}"${external ? ' target="_blank" rel="noopener noreferrer"' : ""}>${label}</a>`;
  });

  out = out.replace(/`([^`]+)`/g, "<code>$1</code>");
  out = out.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  out = out.replace(/(^|\W)\*([^*\n]+)\*/g, "$1<em>$2</em>");
  out = out.replace(/~~([^~]+)~~/g, "<del>$1</del>");

  // Γυμνά URLs (μόνο εκτός ήδη φτιαγμένων tags).
  out = out.replace(/(^|\s)(https?:\/\/[^\s<]+)/g, (match, space, url) => {
    if (match.includes('href=')) return match;
    return `${space}<a href="${safeUrl(url)}" target="_blank" rel="noopener noreferrer">${url}</a>`;
  });

  return out;
}

/** Επιστρέφει HTML string. Το αποτέλεσμα είναι ασφαλές για innerHTML. */
export function renderMarkdown(source) {
  if (!source) return "";

  const lines = esc(source).replace(/\r\n/g, "\n").split("\n");
  const out = [];
  let listType = null;
  let inCode = false;
  let codeBuffer = [];

  const closeList = () => {
    if (listType) {
      out.push(`</${listType}>`);
      listType = null;
    }
  };

  for (const raw of lines) {
    const line = raw;

    // Code fences
    if (/^\s*```/.test(line)) {
      if (inCode) {
        out.push(`<pre><code>${codeBuffer.join("\n")}</code></pre>`);
        codeBuffer = [];
        inCode = false;
      } else {
        closeList();
        inCode = true;
      }
      continue;
    }
    if (inCode) {
      codeBuffer.push(line);
      continue;
    }

    if (!line.trim()) {
      closeList();
      continue;
    }

    // YouTube σε δική του γραμμή → responsive embed
    const yt = line.trim().match(YT);
    if (yt && /^https?:\/\/\S+$/.test(line.trim())) {
      closeList();
      out.push(
        `<div class="hub-embed"><iframe src="https://www.youtube.com/embed/${yt[1]}" title="YouTube" allowfullscreen loading="lazy"></iframe></div>`,
      );
      continue;
    }

    const heading = line.match(/^(#{1,6})\s+(.*)$/);
    if (heading) {
      closeList();
      const level = Math.min(heading[1].length + 1, 6); // h1 του κειμένου → h2 της σελίδας
      out.push(`<h${level}>${inline(heading[2])}</h${level}>`);
      continue;
    }

    if (/^\s*(---|\*\*\*|___)\s*$/.test(line)) {
      closeList();
      out.push("<hr />");
      continue;
    }

    const quote = line.match(/^&gt;\s?(.*)$/);
    if (quote) {
      closeList();
      out.push(`<blockquote>${inline(quote[1])}</blockquote>`);
      continue;
    }

    const bullet = line.match(/^\s*[-*+]\s+(.*)$/);
    if (bullet) {
      if (listType !== "ul") {
        closeList();
        out.push("<ul>");
        listType = "ul";
      }
      out.push(`<li>${inline(bullet[1])}</li>`);
      continue;
    }

    const numbered = line.match(/^\s*\d+\.\s+(.*)$/);
    if (numbered) {
      if (listType !== "ol") {
        closeList();
        out.push("<ol>");
        listType = "ol";
      }
      out.push(`<li>${inline(numbered[1])}</li>`);
      continue;
    }

    closeList();
    out.push(`<p>${inline(line)}</p>`);
  }

  if (inCode) out.push(`<pre><code>${codeBuffer.join("\n")}</code></pre>`);
  closeList();

  return out.join("\n");
}

/** Καθαρό κείμενο για περιλήψεις/preview καρτών. */
export function stripMarkdown(source, limit = 160) {
  const text = String(source || "")
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/!\[[^\]]*\]\([^)]*\)/g, " ")
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/[#>*_`~-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return text.length > limit ? `${text.slice(0, limit)}…` : text;
}

/**
 * Συνδέει μια απλή μπάρα εργαλείων markdown με ένα <textarea>.
 * Χρησιμοποιείται σε άρθρα, forum posts και admin.
 */
export function attachEditor(container) {
  const area = container.querySelector(".hub-editor__area");
  const preview = container.querySelector(".hub-editor__preview");
  if (!area) return;

  const wrap = (before, after = before, placeholder = "κείμενο") => {
    const { selectionStart: start, selectionEnd: end, value } = area;
    const selected = value.slice(start, end) || placeholder;
    area.value = `${value.slice(0, start)}${before}${selected}${after}${value.slice(end)}`;
    area.focus();
    area.selectionStart = start + before.length;
    area.selectionEnd = start + before.length + selected.length;
    area.dispatchEvent(new Event("input", { bubbles: true }));
  };

  container.querySelectorAll("[data-md]").forEach((button) => {
    button.addEventListener("click", (ev) => {
      ev.preventDefault();
      const action = button.dataset.md;
      if (action === "bold") wrap("**", "**", "έντονα");
      else if (action === "italic") wrap("*", "*", "πλάγια");
      else if (action === "code") wrap("`", "`", "code");
      else if (action === "link") wrap("[", "](https://)", "τίτλος");
      else if (action === "img") wrap("![", "](https://)", "alt");
      else if (action === "h") wrap("## ", "", "Επικεφαλίδα");
      else if (action === "ul") wrap("- ", "", "στοιχείο");
      else if (action === "quote") wrap("> ", "", "παράθεση");
      else if (action === "preview") {
        preview.hidden = !preview.hidden;
        button.classList.toggle("is-active", !preview.hidden);
      }
    });
  });

  if (preview) {
    area.addEventListener("input", () => {
      if (!preview.hidden) preview.innerHTML = renderMarkdown(area.value);
    });
  }
}

/** Το HTML της μπάρας — για να μη γράφεται σε κάθε σελίδα. */
export function editorHtml({ name = "content", value = "", placeholder = "Γράψε…", rows = 8 } = {}) {
  const tools = [
    ["h", "H2"],
    ["bold", "B"],
    ["italic", "I"],
    ["code", "</>"],
    ["link", "🔗"],
    ["img", "🖼"],
    ["ul", "• —"],
    ["quote", "❝"],
    ["preview", "👁"],
  ];
  return `<div class="hub-editor">
    <div class="hub-editor__bar">
      ${tools.map(([action, label]) => `<button type="button" class="hub-editor__tool" data-md="${action}" title="${action}">${label}</button>`).join("")}
    </div>
    <textarea class="hub-editor__area" name="${esc(name)}" rows="${rows}" placeholder="${esc(placeholder)}">${esc(value)}</textarea>
    <div class="hub-editor__preview hub-prose" hidden></div>
  </div>`;
}
