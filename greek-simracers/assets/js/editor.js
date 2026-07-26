// Απλός WYSIWYG editor για το forum.
//
// ΣΗΜΑΝΤΙΚΟ: ό,τι γράφει ο χρήστης αποθηκεύεται ΩΣ BBCODE, ποτέ ως HTML.
// Το contenteditable είναι μόνο η επιφάνεια σύνταξης· στην αποθήκευση
// μετατρέπουμε το DOM σε BBCode κρατώντας μόνο όσα tags αναγνωρίζουμε.
// Έτσι τα παλιά μηνύματα παραμένουν συμβατά και η απόδοση συνεχίζει να
// περνά από το ίδιο ασφαλές μονοπάτι (escape → BBCode → HTML).
(function () {
  const MAX_LENGTH = 5000;

  function escapeHtml(value) {
    const div = document.createElement("div");
    div.textContent = value ?? "";
    return div.innerHTML;
  }

  function isSafeHref(href) {
    return /^https?:\/\/[^\s]+$/i.test(String(href || "").trim());
  }

  /* ============ BBCode → HTML (για φόρτωση στον editor) ============ */

  function bbcodeToEditorHtml(raw) {
    let text = escapeHtml(raw);

    const quoteRe = /\[quote(?:=([^\]\n]{1,80}))?\]((?:(?!\[quote)[\s\S])*?)\[\/quote\]/gi;
    for (let i = 0; i < 5; i++) {
      const next = text.replace(quoteRe, (m, name, inner) => {
        const attr = name ? ` data-quote-author="${name.trim()}"` : "";
        return `<blockquote${attr}>${inner.trim()}</blockquote>`;
      });
      if (next === text) break;
      text = next;
    }

    // Το <blockquote> είναι block: κρατάει μόνο του τη δική του γραμμή.
    // Χωρίς αυτό, η αλλαγή γραμμής γύρω του θα γινόταν επιπλέον <br> και
    // κάθε κύκλος επεξεργασίας θα πρόσθετε μια κενή γραμμή.
    text = text.replace(/\n?(<blockquote)/g, "$1").replace(/(<\/blockquote>)\n?/g, "$1");

    text = text.replace(/\[url=([^\]\s]+)\]([\s\S]*?)\[\/url\]/gi, (m, href, label) =>
      isSafeHref(href) ? `<a href="${href}">${label}</a>` : m);
    text = text.replace(/\[url\]([^\]\s]+)\[\/url\]/gi, (m, href) =>
      isSafeHref(href) ? `<a href="${href}">${href}</a>` : m);

    text = text.replace(/\[b\]([\s\S]*?)\[\/b\]/gi, "<b>$1</b>");
    text = text.replace(/\[i\]([\s\S]*?)\[\/i\]/gi, "<i>$1</i>");
    text = text.replace(/\[u\]([\s\S]*?)\[\/u\]/gi, "<u>$1</u>");

    return text.replace(/\r\n|\r|\n/g, "<br>");
  }

  /* ============ HTML → BBCode (για αποθήκευση) ============ */

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

    const tag = node.tagName.toLowerCase();

    if (tag === "br") return "\n";

    const inner = childrenToBB(node);

    switch (tag) {
      case "b":
      case "strong":
        return inner.trim() ? "[b]" + inner + "[/b]" : inner;
      case "i":
      case "em":
        return inner.trim() ? "[i]" + inner + "[/i]" : inner;
      case "u":
        return inner.trim() ? "[u]" + inner + "[/u]" : inner;
      case "a": {
        const href = node.getAttribute("href") || "";
        return isSafeHref(href) ? "[url=" + href.trim() + "]" + inner + "[/url]" : inner;
      }
      case "blockquote": {
        const who = (node.getAttribute("data-quote-author") || "").replace(/[[\]]/g, "").trim();
        const body = inner.replace(/^\n+|\n+$/g, "");
        return "\n[quote" + (who ? "=" + who : "") + "]" + body + "[/quote]\n";
      }
      case "div":
      case "p": {
        // Το contenteditable τυλίγει κάθε νέα γραμμή σε <div>. Ένα άδειο
        // div περιέχει μόνο <br>, οπότε δεν προσθέτουμε δεύτερη αλλαγή.
        return inner === "\n" ? "\n" : inner + "\n";
      }
      default:
        return inner;
    }
  }

  function editorHtmlToBBCode(root) {
    return childrenToBB(root)
      .replace(/\n{3,}/g, "\n\n")
      .replace(/[ \t]+\n/g, "\n")
      .trim();
  }

  /* ============ Toolbar ============ */

  const BUTTONS = [
    { cmd: "bold", label: "<strong>B</strong>", title: "Έντονα (Ctrl+B)" },
    { cmd: "italic", label: "<em>I</em>", title: "Πλάγια (Ctrl+I)" },
    { cmd: "underline", label: "<u>U</u>", title: "Υπογράμμιση (Ctrl+U)" },
    { cmd: "createLink", label: "🔗", title: "Σύνδεσμος" },
    { cmd: "formatBlock", label: "❝", title: "Παράθεση" },
    { cmd: "removeFormat", label: "⌫", title: "Καθαρισμός μορφοποίησης" },
  ];

  function toolbarHtml() {
    return (
      '<div class="wysiwyg__toolbar" role="toolbar" aria-label="Μορφοποίηση κειμένου">' +
      BUTTONS.map(
        (b) =>
          `<button type="button" class="wysiwyg__btn" data-cmd="${b.cmd}" title="${b.title}" aria-label="${b.title}" aria-pressed="false">${b.label}</button>`
      ).join("") +
      "</div>"
    );
  }

  /* ============ Δημιουργία editor ============ */

  function create(host, options) {
    const opts = options || {};
    const labelId = "wysiwyg-label-" + Math.random().toString(36).slice(2, 8);

    host.innerHTML =
      (opts.label ? `<span class="wysiwyg__label" id="${labelId}">${escapeHtml(opts.label)}</span>` : "") +
      '<div class="wysiwyg">' +
      toolbarHtml() +
      `<div class="wysiwyg__area" contenteditable="true" role="textbox" aria-multiline="true"` +
      (opts.label ? ` aria-labelledby="${labelId}"` : "") +
      ` data-placeholder="${escapeHtml(opts.placeholder || "Γράψε το μήνυμά σου…")}"></div>` +
      '<div class="wysiwyg__foot"><span class="wysiwyg__hint">Ctrl+B έντονα · Ctrl+I πλάγια</span>' +
      '<span class="wysiwyg__count"></span></div>' +
      "</div>";

    const area = host.querySelector(".wysiwyg__area");
    const toolbar = host.querySelector(".wysiwyg__toolbar");
    const counter = host.querySelector(".wysiwyg__count");

    if (opts.value) area.innerHTML = bbcodeToEditorHtml(opts.value);

    function getValue() {
      return editorHtmlToBBCode(area);
    }

    function updateCounter() {
      const len = getValue().length;
      counter.textContent = len + "/" + MAX_LENGTH;
      counter.classList.toggle("is-over", len > MAX_LENGTH);
      area.classList.toggle("is-empty", area.textContent.trim() === "" && !area.querySelector("img"));
    }

    // Οι εντολές του execCommand είναι deprecated αλλά παραμένουν ο μόνος
    // τρόπος που δουλεύει παντού για contenteditable χωρίς βιβλιοθήκη.
    function exec(cmd) {
      area.focus();
      if (cmd === "createLink") {
        const url = window.prompt("Διεύθυνση συνδέσμου (http:// ή https://):", "https://");
        if (!url) return;
        if (!isSafeHref(url)) {
          window.alert("Επιτρέπονται μόνο σύνδεσμοι που ξεκινούν με http:// ή https://");
          return;
        }
        document.execCommand("createLink", false, url.trim());
      } else if (cmd === "formatBlock") {
        const inQuote = !!getSelectionAncestor("blockquote");
        document.execCommand("formatBlock", false, inQuote ? "div" : "blockquote");
      } else {
        document.execCommand(cmd, false, null);
      }
      syncToolbar();
      updateCounter();
    }

    function getSelectionAncestor(tagName) {
      const sel = window.getSelection();
      if (!sel || !sel.rangeCount) return null;
      let node = sel.getRangeAt(0).commonAncestorContainer;
      if (node.nodeType === Node.TEXT_NODE) node = node.parentNode;
      while (node && node !== area) {
        if (node.tagName && node.tagName.toLowerCase() === tagName) return node;
        node = node.parentNode;
      }
      return null;
    }

    function syncToolbar() {
      toolbar.querySelectorAll("[data-cmd]").forEach((btn) => {
        const cmd = btn.dataset.cmd;
        let active = false;
        if (cmd === "formatBlock") {
          active = !!getSelectionAncestor("blockquote");
        } else if (cmd === "bold" || cmd === "italic" || cmd === "underline") {
          try {
            active = document.queryCommandState(cmd);
          } catch (err) {
            active = false;
          }
        }
        btn.setAttribute("aria-pressed", String(active));
        btn.classList.toggle("is-active", active);
      });
    }

    toolbar.querySelectorAll("[data-cmd]").forEach((btn) => {
      // mousedown + preventDefault ώστε να μη χαθεί η επιλογή κειμένου.
      btn.addEventListener("mousedown", (e) => e.preventDefault());
      btn.addEventListener("click", () => exec(btn.dataset.cmd));
    });

    // Η επικόλληση μπαίνει πάντα ως απλό κείμενο: δεν θέλουμε ξένο HTML
    // (με στυλ, scripts ή εικόνες) μέσα στον editor.
    area.addEventListener("paste", (e) => {
      e.preventDefault();
      const text = (e.clipboardData || window.clipboardData).getData("text/plain");
      document.execCommand("insertText", false, text);
      updateCounter();
    });

    area.addEventListener("drop", (e) => e.preventDefault());
    area.addEventListener("input", updateCounter);
    area.addEventListener("keyup", syncToolbar);
    area.addEventListener("mouseup", syncToolbar);
    area.addEventListener("focus", () => {
      try {
        document.execCommand("styleWithCSS", false, false);
      } catch (err) {
        /* μη υποστηριζόμενο — τα semantic tags παράγονται ούτως ή άλλως */
      }
      syncToolbar();
    });

    updateCounter();

    return {
      element: area,
      getValue,
      setValue(bb) {
        area.innerHTML = bbcodeToEditorHtml(bb || "");
        updateCounter();
      },
      clear() {
        area.innerHTML = "";
        updateCounter();
      },
      focus() {
        area.focus();
      },
      // Προσθέτει παράθεση στο τέλος και αφήνει τον δρομέα από κάτω.
      appendQuote(author, content) {
        const who = String(author || "").replace(/[[\]]/g, "").trim();
        const quote = document.createElement("blockquote");
        if (who) quote.setAttribute("data-quote-author", who);
        quote.innerHTML = bbcodeToEditorHtml(content || "");
        area.appendChild(quote);
        const after = document.createElement("div");
        after.innerHTML = "<br>";
        area.appendChild(after);
        updateCounter();

        area.focus();
        const range = document.createRange();
        range.selectNodeContents(after);
        range.collapse(true);
        const sel = window.getSelection();
        sel.removeAllRanges();
        sel.addRange(range);
        area.scrollIntoView({ behavior: "smooth", block: "center" });
      },
    };
  }

  window.GSREditor = { create, bbcodeToEditorHtml, editorHtmlToBBCode, MAX_LENGTH };
})();
