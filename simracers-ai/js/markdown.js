/*
 * Μικρός, ασφαλής markdown renderer για τις απαντήσεις του βοηθού.
 * ΣΗΜΑΝΤΙΚΟ: πρώτα γίνεται escape ΟΛΗ η HTML και μετά εφαρμόζονται οι
 * μετατροπές markdown. Έτσι, ακόμα κι αν το μοντέλο (ή κάποιο απόσπασμα από
 * τη βάση γνώσης) βγάλει HTML ή <script>, δεν εκτελείται ποτέ στη σελίδα.
 *
 * Ίδια λογική με το markdown.js του greeksimracers.gr, με προσθήκη
 * αριθμημένων λιστών — ο βοηθός δίνει συχνά οδηγίες με βήματα.
 *
 * Υποστηρίζει: # ## ### επικεφαλίδες, **bold**, *italic*, `inline code`,
 * ``` code blocks, - λίστες, 1. αριθμημένες λίστες, > παραθέσεις,
 * [κείμενο](url) links, κενή γραμμή = νέα παράγραφος.
 */

export function escapeHtml(text) {
  return String(text ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

/* Δεκτά μόνο απόλυτα http/https URLs — μπλοκάρει javascript: και data: links. */
function safeUrl(url) {
  return /^https?:\/\/\S+$/i.test(url) ? url : null;
}

/* Inline μετατροπές — δουλεύουν πάνω σε ήδη escaped κείμενο. */
function renderInline(text) {
  return text
    .replace(/`([^`]+)`/g, "<code>$1</code>")
    .replace(/\[([^\]]+)\]\(([^()\s]+)\)/g, (_m, label, url) =>
      safeUrl(url) ? `<a href="${url}" target="_blank" rel="noopener">${label}</a>` : label,
    )
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/\*([^*]+)\*/g, "<em>$1</em>");
}

export function renderMarkdown(text) {
  const lines = escapeHtml(text).split(/\r?\n/);
  const out = [];
  let paragraph = []; // γραμμές της τρέχουσας παραγράφου
  let list = null; // { tag: "ul" | "ol", items: [] }
  let code = null; // γραμμές ανοιχτού ``` block

  const flushParagraph = () => {
    if (paragraph.length) {
      out.push(`<p>${renderInline(paragraph.join("<br />"))}</p>`);
      paragraph = [];
    }
  };
  const flushList = () => {
    if (list) {
      const items = list.items.map((item) => `<li>${renderInline(item)}</li>`).join("");
      out.push(`<${list.tag}>${items}</${list.tag}>`);
      list = null;
    }
  };
  /* Ανοίγει νέα λίστα αν αλλάξει το είδος (π.χ. από - σε 1.). */
  const pushItem = (tag, item) => {
    flushParagraph();
    if (list && list.tag !== tag) flushList();
    (list ??= { tag, items: [] }).items.push(item);
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
      // h1 του markdown γίνεται h2 — ο h1 της σελίδας είναι ο τίτλος.
      const level = Math.min(heading[1].length + 1, 4);
      out.push(`<h${level}>${renderInline(heading[2])}</h${level}>`);
      continue;
    }

    const bullet = line.match(/^[-*]\s+(.*)$/);
    if (bullet) {
      pushItem("ul", bullet[1]);
      continue;
    }

    const numbered = line.match(/^\d+[.)]\s+(.*)$/);
    if (numbered) {
      pushItem("ol", numbered[1]);
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
