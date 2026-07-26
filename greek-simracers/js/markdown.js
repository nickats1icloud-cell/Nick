/*
 * Μικρός, ασφαλής markdown renderer για περιεχόμενο χρηστών (άρθρα, forum).
 * ΣΗΜΑΝΤΙΚΟ: πρώτα γίνεται escape ΟΛΗ η HTML και μετά εφαρμόζονται οι
 * μετατροπές markdown, ώστε να μην περνά ποτέ raw HTML από χρήστες (XSS).
 *
 * Υποστηρίζει: # ## ### επικεφαλίδες, **bold**, *italic*, `inline code`,
 * ``` code blocks, - λίστες, > παραθέσεις, [κείμενο](url) links και
 * ![alt](url) εικόνες (μόνο http/https), κενή γραμμή = νέα παράγραφος.
 */

/** Escape όλων των ειδικών χαρακτήρων HTML — χρήσιμο και από άλλες σελίδες. */
export function escapeHtml(text) {
  return String(text ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

/* Δεκτά μόνο απόλυτα http/https URLs σε links και εικόνες. */
function safeUrl(url) {
  return /^https?:\/\/\S+$/i.test(url) ? url : null;
}

/* Inline μετατροπές — δουλεύουν πάνω σε ήδη escaped κείμενο. */
function renderInline(text) {
  return text
    .replace(/`([^`]+)`/g, "<code>$1</code>")
    .replace(/!\[([^\]]*)\]\(([^()\s]+)\)/g, (_m, alt, url) =>
      safeUrl(url) ? `<img src="${url}" alt="${alt}" loading="lazy" />` : alt,
    )
    .replace(/\[([^\]]+)\]\(([^()\s]+)\)/g, (_m, label, url) =>
      safeUrl(url) ? `<a href="${url}" target="_blank" rel="noopener">${label}</a>` : label,
    )
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/\*([^*]+)\*/g, "<em>$1</em>");
}

/** Μετατρέπει markdown κείμενο σε ασφαλές HTML string. */
export function renderMarkdown(text) {
  const lines = escapeHtml(text).split(/\r?\n/);
  const out = [];
  let paragraph = []; // γραμμές της τρέχουσας παραγράφου
  let list = null; // στοιχεία ανοιχτής λίστας <ul>
  let code = null; // γραμμές ανοιχτού ``` block

  const flushParagraph = () => {
    if (paragraph.length) {
      out.push(`<p>${renderInline(paragraph.join("<br />"))}</p>`);
      paragraph = [];
    }
  };
  const flushList = () => {
    if (list) {
      out.push(`<ul>${list.map((item) => `<li>${renderInline(item)}</li>`).join("")}</ul>`);
      list = null;
    }
  };

  for (const line of lines) {
    // Μέσα σε ``` block οι γραμμές μπαίνουν αυτούσιες (είναι ήδη escaped).
    if (code !== null) {
      if (line.trim().startsWith("```")) {
        out.push(`<pre><code>${code.join("\n")}</code></pre>`);
        code = null;
      } else {
        code.push(line);
      }
      continue;
    }
    if (line.trim().startsWith("```")) {
      flushParagraph();
      flushList();
      code = [];
      continue;
    }

    const heading = line.match(/^(#{1,3})\s+(.*)$/);
    if (heading) {
      flushParagraph();
      flushList();
      const level = heading[1].length;
      out.push(`<h${level}>${renderInline(heading[2])}</h${level}>`);
      continue;
    }

    const listItem = line.match(/^-\s+(.*)$/);
    if (listItem) {
      flushParagraph();
      (list ??= []).push(listItem[1]);
      continue;
    }
    flushList();

    // Το ">" έχει ήδη γίνει "&gt;" από το escape.
    const quote = line.match(/^&gt;\s?(.*)$/);
    if (quote) {
      flushParagraph();
      out.push(`<blockquote><p>${renderInline(quote[1])}</p></blockquote>`);
      continue;
    }

    if (!line.trim()) {
      flushParagraph();
    } else {
      paragraph.push(line);
    }
  }

  if (code !== null) out.push(`<pre><code>${code.join("\n")}</code></pre>`); // μη κλεισμένο block
  flushParagraph();
  flushList();
  return out.join("\n");
}
