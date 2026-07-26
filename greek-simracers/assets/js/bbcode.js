// Κοινό BBCode: απόδοση για εμφάνιση, μετατροπή προς/από τον editor.
// Το χρησιμοποιούν το forum, τα προσωπικά μηνύματα και ο editor, ώστε
// να υπάρχει ΕΝΑ σημείο αλήθειας για το τι επιτρέπεται.
//
// Χρυσός κανόνας: ΠΡΩΤΑ escapeHtml, ΜΕΤΑ οι μετατροπές. Έτσι ό,τι HTML
// έγραψε ο χρήστης μένει αδρανές κείμενο και μόνο τα δικά μας tags
// παράγουν πραγματικά στοιχεία.
(function () {
  function escapeHtml(value) {
    const div = document.createElement("div");
    div.textContent = value ?? "";
    return div.innerHTML;
  }

  // Το escapeHtml (textContent → innerHTML) ΔΕΝ κωδικοποιεί εισαγωγικά.
  // Ό,τι μπαίνει μέσα σε attribute χρειάζεται επιπλέον πέρασμα, αλλιώς ένα
  // " στο κείμενο «σπάει» το attribute και μπορεί να περάσει event handler.
  function escapeAttr(value) {
    return escapeHtml(value).replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  }

  // Μόνο http(s). Οτιδήποτε άλλο (javascript:, data:, file:) απορρίπτεται.
  function isSafeHref(href) {
    return /^https?:\/\/[^\s"'<>]+$/i.test(String(href || "").trim());
  }

  // Δεχόμαστε μόνο hex χρώματα ή μια μικρή λίστα ονομάτων, ώστε να μη
  // μπορεί να περάσει αυθαίρετο CSS μέσα σε style attribute.
  const NAMED_COLORS = ["red", "orange", "yellow", "green", "blue", "purple", "pink", "white", "gray"];

  function safeColor(value) {
    const c = String(value || "").trim().toLowerCase();
    if (/^#[0-9a-f]{3}$/.test(c) || /^#[0-9a-f]{6}$/.test(c)) return c;
    if (NAMED_COLORS.includes(c)) return c;
    return null;
  }

  // Δέχεται είτε σκέτο id είτε οποιαδήποτε μορφή συνδέσμου YouTube.
  function youtubeId(value) {
    const s = String(value || "").trim();
    const patterns = [
      /(?:youtube\.com\/watch\?(?:.*&)?v=)([A-Za-z0-9_-]{11})/,
      /(?:youtu\.be\/)([A-Za-z0-9_-]{11})/,
      /(?:youtube\.com\/embed\/)([A-Za-z0-9_-]{11})/,
      /(?:youtube\.com\/shorts\/)([A-Za-z0-9_-]{11})/,
      /^([A-Za-z0-9_-]{11})$/,
    ];
    for (const re of patterns) {
      const m = s.match(re);
      if (m) return m[1];
    }
    return null;
  }

  /* ============ Κοινά βήματα μετατροπής ============ */

  // Βγάζει τα [code] μπλοκ από τη ροή ώστε να μην τα πειράξουν οι
  // υπόλοιπες αντικαταστάσεις (ούτε η μετατροπή αλλαγών γραμμής).
  // Δείκτης μοναδικός ανά κλήση: αποκλείεται να τον γράψει χρήστης κατά τύχη.
  function newCodeStore() {
    return { token: "gsrcode" + Math.random().toString(36).slice(2, 10), items: [] };
  }

  function extractCode(text, store) {
    return text.replace(/\[code\]([\s\S]*?)\[\/code\]/gi, function (m, inner) {
      store.items.push(inner.replace(/^\n+|\n+$/g, ""));
      return "\u2063" + store.token + (store.items.length - 1) + "\u2063";
    });
  }

  function restoreCode(text, store, wrap) {
    const re = new RegExp("\u2063" + store.token + "(\\d+)\u2063", "g");
    return text.replace(re, function (m, i) { return wrap(store.items[Number(i)] || ""); });
  }

  function convertQuotes(text, buildQuote) {
    const quoteRe = /\[quote(?:=([^\]\n]{1,80}))?\]((?:(?!\[quote)[\s\S])*?)\[\/quote\]/gi;
    for (let i = 0; i < 5; i++) {
      const next = text.replace(quoteRe, (m, name, inner) => buildQuote(name ? name.trim() : "", inner.trim()));
      if (next === text) break;
      text = next;
    }
    return text;
  }

  function convertLists(text) {
    const listRe = /\[list(=1)?\]([\s\S]*?)\[\/list\]/gi;
    for (let i = 0; i < 4; i++) {
      const next = text.replace(listRe, (m, ordered, body) => {
        const items = body
          .split(/\[\*\]/)
          .map((s) => s.trim())
          .filter(Boolean)
          .map((s) => "<li>" + s.replace(/\n+$/g, "") + "</li>")
          .join("");
        const tag = ordered ? "ol" : "ul";
        return `<${tag} class="bb-list">${items}</${tag}>`;
      });
      if (next === text) break;
      text = next;
    }
    return text;
  }

  function convertInline(text, opts) {
    const o = opts || {};

    text = text.replace(/\[url=([^\]\s]+)\]([\s\S]*?)\[\/url\]/gi, (m, href, label) =>
      isSafeHref(href) ? `<a href="${href}"${o.linkAttrs || ""}>${label}</a>` : m);
    text = text.replace(/\[url\]([^\]\s]+)\[\/url\]/gi, (m, href) =>
      isSafeHref(href) ? `<a href="${href}"${o.linkAttrs || ""}>${href}</a>` : m);

    text = text.replace(/\[img\]([^\]\s]+)\[\/img\]/gi, (m, src) =>
      isSafeHref(src) ? `<img class="bb-img" src="${src}" alt="" loading="lazy">` : m);

    text = text.replace(/\[youtube\]([^\]\s]+)\[\/youtube\]/gi, (m, raw) => {
      const id = youtubeId(raw);
      return id ? o.youtube(id) : m;
    });

    text = text.replace(/\[color=([^\]\s]+)\]([\s\S]*?)\[\/color\]/gi, (m, color, inner) => {
      const safe = safeColor(color);
      return safe ? `<span style="color:${safe}">${inner}</span>` : inner;
    });

    text = text.replace(/\[h\]([\s\S]*?)\[\/h\]/gi, `<${o.headingTag} class="bb-heading">$1</${o.headingTag}>`);
    text = text.replace(/\[b\]([\s\S]*?)\[\/b\]/gi, `<${o.boldTag}>$1</${o.boldTag}>`);
    text = text.replace(/\[i\]([\s\S]*?)\[\/i\]/gi, `<${o.italicTag}>$1</${o.italicTag}>`);
    text = text.replace(/\[u\]([\s\S]*?)\[\/u\]/gi, "<u>$1</u>");
    text = text.replace(/\[s\]([\s\S]*?)\[\/s\]/gi, "<s>$1</s>");

    return text;
  }

  // Τα block στοιχεία κρατούν μόνα τους γραμμή· απορροφάμε την αλλαγή
  // γραμμής γύρω τους ώστε να μη διπλασιάζονται τα κενά σε κάθε κύκλο.
  function trimAroundBlocks(text) {
    return text
      .replace(/\n?(<(?:blockquote|ul|ol|pre|h[1-6])\b)/g, "$1")
      .replace(/(<\/(?:blockquote|ul|ol|pre|h[1-6])>)\n?/g, "$1");
  }

  /* ============ Απόδοση για εμφάνιση ============ */

  function toHtml(raw) {
    const code = newCodeStore();
    let text = extractCode(escapeHtml(raw), code);

    text = convertQuotes(text, (name, inner) => {
      const attr = name ? `<span class="bbcode-quote__attr">${name} έγραψε:</span>` : "";
      return `<blockquote class="bbcode-quote">${attr}${inner}</blockquote>`;
    });
    text = convertLists(text);
    text = convertInline(text, {
      linkAttrs: ' target="_blank" rel="noopener noreferrer nofollow"',
      boldTag: "strong",
      italicTag: "em",
      headingTag: "h4",
      youtube: (id) =>
        `<span class="bb-video"><iframe src="https://www.youtube-nocookie.com/embed/${id}" title="YouTube" loading="lazy" allowfullscreen referrerpolicy="strict-origin-when-cross-origin"></iframe></span>`,
    });
    text = trimAroundBlocks(text);
    text = text.replace(/\r\n|\r|\n/g, "<br>");

    return restoreCode(text, code, (c) => `<pre class="bb-code"><code>${c}</code></pre>`);
  }

  /* ============ Μετατροπή για τον editor ============ */

  function toEditorHtml(raw) {
    const code = newCodeStore();
    let text = extractCode(escapeHtml(raw), code);

    text = convertQuotes(text, (name, inner) => {
      const attr = name ? ` data-quote-author="${escapeAttr(name)}"` : "";
      return `<blockquote${attr}>${inner}</blockquote>`;
    });
    text = convertLists(text);
    text = convertInline(text, {
      linkAttrs: "",
      boldTag: "b",
      italicTag: "i",
      headingTag: "h4",
      // Μέσα στον editor δείχνουμε placeholder αντί για iframe: το iframe
      // δεν επεξεργάζεται και «κλέβει» τον δρομέα.
      youtube: (id) => `<span class="bb-yt-chip" data-yt="${id}" contenteditable="false">▶ YouTube: ${id}</span>`,
    });
    text = trimAroundBlocks(text);
    text = text.replace(/\r\n|\r|\n/g, "<br>");

    return restoreCode(text, code, (c) => `<pre class="bb-code"><code>${c}</code></pre>`);
  }

  /* ============ Editor DOM → BBCode ============ */

  function childrenToBB(node) {
    let out = "";
    node.childNodes.forEach((child) => {
      out += nodeToBB(child);
    });
    return out;
  }

  function nodeToBB(node) {
    if (node.nodeType === Node.TEXT_NODE) {
      return String(node.nodeValue || "").replace(/ /g, " ");
    }
    if (node.nodeType !== Node.ELEMENT_NODE) return "";

    const el = node;
    const tag = el.tagName.toLowerCase();

    if (tag === "br") return "\n";
    if (tag === "img") {
      const src = el.getAttribute("src") || "";
      return isSafeHref(src) ? "[img]" + src + "[/img]" : "";
    }
    if (el.dataset && el.dataset.yt) return "[youtube]" + el.dataset.yt + "[/youtube]";
    if (tag === "pre") {
      return "\n[code]" + el.textContent.replace(/^\n+|\n+$/g, "") + "[/code]\n";
    }

    const inner = childrenToBB(el);
    const wrap = (open, close) => (inner.trim() ? open + inner + close : inner);

    switch (tag) {
      case "b":
      case "strong":
        return wrap("[b]", "[/b]");
      case "i":
      case "em":
        return wrap("[i]", "[/i]");
      case "u":
        return wrap("[u]", "[/u]");
      case "s":
      case "strike":
      case "del":
        return wrap("[s]", "[/s]");
      case "h1":
      case "h2":
      case "h3":
      case "h4":
      case "h5":
      case "h6":
        return inner.trim() ? "\n[h]" + inner.trim() + "[/h]\n" : inner;
      case "a": {
        const href = el.getAttribute("href") || "";
        return isSafeHref(href) ? "[url=" + href.trim() + "]" + inner + "[/url]" : inner;
      }
      case "font": {
        const color = safeColor(el.getAttribute("color"));
        return color ? wrap("[color=" + color + "]", "[/color]") : inner;
      }
      case "span": {
        const color = safeColor(el.style && el.style.color ? rgbToHex(el.style.color) : "");
        return color ? wrap("[color=" + color + "]", "[/color]") : inner;
      }
      case "ul":
      case "ol": {
        const items = [];
        el.querySelectorAll(":scope > li").forEach((li) => {
          const t = childrenToBB(li).replace(/\n+/g, " ").trim();
          if (t) items.push("[*]" + t);
        });
        if (!items.length) return "";
        return "\n[list" + (tag === "ol" ? "=1" : "") + "]\n" + items.join("\n") + "\n[/list]\n";
      }
      case "li":
        return inner;
      case "blockquote": {
        const who = (el.getAttribute("data-quote-author") || "").replace(/[[\]]/g, "").trim();
        const body = inner.replace(/^\n+|\n+$/g, "");
        return "\n[quote" + (who ? "=" + who : "") + "]" + body + "[/quote]\n";
      }
      case "div":
      case "p":
        return inner === "\n" ? "\n" : inner + "\n";
      default:
        return inner;
    }
  }

  // Ο browser επιστρέφει χρώματα ως rgb(...); τα φέρνουμε σε hex για έλεγχο.
  function rgbToHex(value) {
    const m = String(value).match(/^rgba?\((\d+),\s*(\d+),\s*(\d+)/i);
    if (!m) return value;
    const hex = (n) => Number(n).toString(16).padStart(2, "0");
    return "#" + hex(m[1]) + hex(m[2]) + hex(m[3]);
  }

  function fromEditor(root) {
    return childrenToBB(root)
      .replace(/\n{3,}/g, "\n\n")
      .replace(/[ \t]+\n/g, "\n")
      .trim();
  }

  window.GSRBBCode = {
    escapeAttr,
    toHtml,
    toEditorHtml,
    fromEditor,
    escapeHtml,
    isSafeHref,
    safeColor,
    youtubeId,
  };
})();
