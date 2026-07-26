// WYSIWYG editor για forum και προσωπικά μηνύματα.
//
// ΣΗΜΑΝΤΙΚΟ: ό,τι γράφει ο χρήστης αποθηκεύεται ΩΣ BBCODE, ποτέ ως HTML.
// Το contenteditable είναι μόνο η επιφάνεια σύνταξης· η μετατροπή προς
// και από BBCode γίνεται αποκλειστικά μέσα από το κοινό assets/js/bbcode.js,
// που κρατάει ένα whitelist από tags και ελέγχει συνδέσμους και χρώματα.
(function () {
  const MAX_LENGTH = 5000;
  const BB = window.GSRBBCode;

  function escapeAttr(value) {
    return BB.escapeHtml(value);
  }

  const GROUPS = [
    [
      { cmd: "bold", label: "<strong>B</strong>", title: "Έντονα (Ctrl+B)" },
      { cmd: "italic", label: "<em>I</em>", title: "Πλάγια (Ctrl+I)" },
      { cmd: "underline", label: "<u>U</u>", title: "Υπογράμμιση (Ctrl+U)" },
      { cmd: "strikeThrough", label: "<s>S</s>", title: "Διαγραφή" },
    ],
    [
      { cmd: "heading", label: "H", title: "Επικεφαλίδα" },
      { cmd: "color", label: "🎨", title: "Χρώμα κειμένου" },
    ],
    [
      { cmd: "insertUnorderedList", label: "•", title: "Λίστα με κουκκίδες" },
      { cmd: "insertOrderedList", label: "1.", title: "Αριθμημένη λίστα" },
    ],
    [
      { cmd: "createLink", label: "🔗", title: "Σύνδεσμος" },
      { cmd: "image", label: "🖼️", title: "Εικόνα από σύνδεσμο" },
      { cmd: "youtube", label: "▶", title: "Βίντεο YouTube" },
    ],
    [
      { cmd: "quote", label: "❝", title: "Παράθεση" },
      { cmd: "code", label: "&lt;/&gt;", title: "Κώδικας" },
    ],
    [{ cmd: "removeFormat", label: "⌫", title: "Καθαρισμός μορφοποίησης" }],
  ];

  const COLORS = ["#3b82f6", "#22c55e", "#ef4444", "#f59e0b", "#a855f7", "#ffffff"];

  function toolbarHtml() {
    return (
      '<div class="wysiwyg__toolbar" role="toolbar" aria-label="Μορφοποίηση κειμένου">' +
      GROUPS.map(
        (group) =>
          '<span class="wysiwyg__group">' +
          group
            .map(
              (b) =>
                `<button type="button" class="wysiwyg__btn" data-cmd="${b.cmd}" title="${b.title}" aria-label="${b.title}" aria-pressed="false">${b.label}</button>`
            )
            .join("") +
          "</span>"
      ).join("") +
      '<span class="wysiwyg__palette" hidden>' +
      COLORS.map(
        (c) =>
          `<button type="button" class="wysiwyg__swatch" data-color="${c}" style="background:${c}" title="Χρώμα ${c}" aria-label="Χρώμα ${c}"></button>`
      ).join("") +
      "</span>" +
      "</div>"
    );
  }

  function create(host, options) {
    const opts = options || {};
    const labelId = "wysiwyg-label-" + Math.random().toString(36).slice(2, 8);

    host.innerHTML =
      (opts.label ? `<span class="wysiwyg__label" id="${labelId}">${escapeAttr(opts.label)}</span>` : "") +
      `<div class="wysiwyg${opts.compact ? " wysiwyg--compact" : ""}">` +
      toolbarHtml() +
      `<div class="wysiwyg__area" contenteditable="true" role="textbox" aria-multiline="true"` +
      (opts.label ? ` aria-labelledby="${labelId}"` : "") +
      ` data-placeholder="${escapeAttr(opts.placeholder || "Γράψε το μήνυμά σου…")}"></div>` +
      `<div class="wysiwyg__foot"><span class="wysiwyg__hint">${escapeAttr(opts.hint || "Ctrl+B έντονα · Ctrl+I πλάγια")}</span>` +
      '<span class="wysiwyg__count"></span></div>' +
      "</div>";

    const area = host.querySelector(".wysiwyg__area");
    const toolbar = host.querySelector(".wysiwyg__toolbar");
    const palette = host.querySelector(".wysiwyg__palette");
    const counter = host.querySelector(".wysiwyg__count");

    if (opts.value) area.innerHTML = BB.toEditorHtml(opts.value);

    function getValue() {
      return BB.fromEditor(area);
    }

    function updateCounter() {
      const len = getValue().length;
      counter.textContent = len + "/" + MAX_LENGTH;
      counter.classList.toggle("is-over", len > MAX_LENGTH);
      area.classList.toggle("is-empty", area.textContent.trim() === "" && !area.querySelector("img, .bb-yt-chip"));
    }

    function ancestor(tagName) {
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

    function insertNodeAtCaret(node) {
      area.focus();
      const sel = window.getSelection();
      if (sel && sel.rangeCount && area.contains(sel.anchorNode)) {
        const range = sel.getRangeAt(0);
        range.deleteContents();
        range.insertNode(node);
        range.setStartAfter(node);
        range.collapse(true);
        sel.removeAllRanges();
        sel.addRange(range);
      } else {
        area.appendChild(node);
      }
    }

    // Το execCommand είναι deprecated αλλά παραμένει ο μόνος τρόπος που
    // δουλεύει παντού για contenteditable χωρίς εξωτερική βιβλιοθήκη.
    function exec(cmd) {
      area.focus();

      if (cmd === "createLink") {
        const url = window.prompt("Διεύθυνση συνδέσμου (http:// ή https://):", "https://");
        if (!url) return;
        if (!BB.isSafeHref(url)) {
          window.alert("Επιτρέπονται μόνο σύνδεσμοι που ξεκινούν με http:// ή https://");
          return;
        }
        document.execCommand("createLink", false, url.trim());
      } else if (cmd === "image") {
        const url = window.prompt("Διεύθυνση εικόνας (http:// ή https://):", "https://");
        if (!url) return;
        if (!BB.isSafeHref(url)) {
          window.alert("Επιτρέπονται μόνο εικόνες από http:// ή https://");
          return;
        }
        const img = document.createElement("img");
        img.className = "bb-img";
        img.src = url.trim();
        img.alt = "";
        insertNodeAtCaret(img);
      } else if (cmd === "youtube") {
        const url = window.prompt("Σύνδεσμος YouTube:", "https://www.youtube.com/watch?v=");
        if (!url) return;
        const id = BB.youtubeId(url);
        if (!id) {
          window.alert("Δεν αναγνωρίστηκε βίντεο YouTube σε αυτόν τον σύνδεσμο.");
          return;
        }
        const chip = document.createElement("span");
        chip.className = "bb-yt-chip";
        chip.dataset.yt = id;
        chip.contentEditable = "false";
        chip.textContent = "▶ YouTube: " + id;
        insertNodeAtCaret(chip);
      } else if (cmd === "quote") {
        document.execCommand("formatBlock", false, ancestor("blockquote") ? "div" : "blockquote");
      } else if (cmd === "heading") {
        const inHeading = ancestor("h4");
        document.execCommand("formatBlock", false, inHeading ? "div" : "h4");
      } else if (cmd === "code") {
        const pre = ancestor("pre");
        if (pre) {
          document.execCommand("formatBlock", false, "div");
        } else {
          document.execCommand("formatBlock", false, "pre");
        }
      } else if (cmd === "color") {
        palette.hidden = !palette.hidden;
        return;
      } else {
        document.execCommand(cmd, false, null);
      }

      syncToolbar();
      updateCounter();
    }

    function syncToolbar() {
      toolbar.querySelectorAll("[data-cmd]").forEach((btn) => {
        const cmd = btn.dataset.cmd;
        let active = false;
        if (cmd === "quote") active = !!ancestor("blockquote");
        else if (cmd === "heading") active = !!ancestor("h4");
        else if (cmd === "code") active = !!ancestor("pre");
        else if (["bold", "italic", "underline", "strikeThrough", "insertUnorderedList", "insertOrderedList"].includes(cmd)) {
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

    palette.querySelectorAll("[data-color]").forEach((swatch) => {
      swatch.addEventListener("mousedown", (e) => e.preventDefault());
      swatch.addEventListener("click", () => {
        area.focus();
        document.execCommand("foreColor", false, swatch.dataset.color);
        palette.hidden = true;
        updateCounter();
      });
    });

    // Η επικόλληση μπαίνει πάντα ως απλό κείμενο: δεν θέλουμε ξένο HTML
    // (με στυλ, scripts ή iframes) μέσα στον editor.
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

    if (typeof opts.onSubmit === "function") {
      area.addEventListener("keydown", (e) => {
        if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
          e.preventDefault();
          opts.onSubmit();
        }
      });
    }

    updateCounter();

    return {
      element: area,
      getValue,
      setValue(bb) {
        area.innerHTML = BB.toEditorHtml(bb || "");
        updateCounter();
      },
      clear() {
        area.innerHTML = "";
        updateCounter();
      },
      focus() {
        area.focus();
      },
      isOverLimit() {
        return getValue().length > MAX_LENGTH;
      },
      // Προσθέτει παράθεση στο τέλος και αφήνει τον δρομέα από κάτω.
      appendQuote(author, content) {
        const who = String(author || "").replace(/[[\]]/g, "").trim();
        const quote = document.createElement("blockquote");
        if (who) quote.setAttribute("data-quote-author", who);
        quote.innerHTML = BB.toEditorHtml(content || "");
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

  window.GSREditor = { create, MAX_LENGTH };
})();
