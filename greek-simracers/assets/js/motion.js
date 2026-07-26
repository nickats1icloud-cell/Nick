// Συμπεριφορές κίνησης για όλες τις σελίδες. Καθαρά διακοσμητικά:
// τίποτα εδώ δεν είναι απαραίτητο για να λειτουργήσει η σελίδα, και όλα
// σέβονται το prefers-reduced-motion.
(function () {
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  document.addEventListener("DOMContentLoaded", () => {
    initStagger();
    initTextReveal();
    initReveal();
    initScrollProgress();
    if (reduceMotion) return;
    initSpotlightCards();
    initTilt();
    initMagnetic();
    initCountUp();
    initHeroParallax();
    initScrollParallax();
    initRipples();
  });

  /* ============ Αποκαλύψεις ============ */

  // Δίνει αύξοντα δείκτη στα παιδιά κάθε [data-stagger] ώστε το CSS να
  // κλιμακώνει τις καθυστερήσεις.
  function initStagger() {
    document.querySelectorAll("[data-stagger]").forEach((group) => {
      Array.from(group.children).forEach((child, i) => {
        child.style.setProperty("--stagger-i", String(i));
      });
    });
  }

  // Σπάει τους τίτλους σε λέξεις για αποκάλυψη μία-μία.
  function initTextReveal() {
    document.querySelectorAll("[data-text-reveal]").forEach((el) => {
      if (el.dataset.textRevealDone) return;
      const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
      const nodes = [];
      while (walker.nextNode()) nodes.push(walker.currentNode);

      let index = 0;
      nodes.forEach((node) => {
        const parts = node.textContent.split(/(\s+)/);
        if (!parts.length) return;
        const frag = document.createDocumentFragment();
        parts.forEach((part) => {
          if (!part) return;
          if (/^\s+$/.test(part)) {
            frag.appendChild(document.createTextNode(part));
            return;
          }
          const span = document.createElement("span");
          span.className = "word";
          span.style.setProperty("--word-i", String(index++));
          span.textContent = part;
          frag.appendChild(span);
        });
        node.parentNode.replaceChild(frag, node);
      });
      el.dataset.textRevealDone = "1";
    });
  }

  function initReveal() {
    const targets = document.querySelectorAll(".reveal, [data-reveal], [data-text-reveal]");
    if (!targets.length) return;

    if (!("IntersectionObserver" in window)) {
      targets.forEach((el) => el.classList.add("is-visible"));
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-visible");
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.12, rootMargin: "0px 0px -40px 0px" }
    );
    targets.forEach((el) => observer.observe(el));
  }

  /* ============ Scroll ============ */

  function initScrollProgress() {
    const bar = document.createElement("div");
    bar.className = "scroll-progress";
    bar.setAttribute("aria-hidden", "true");
    document.body.appendChild(bar);

    let ticking = false;
    const update = () => {
      const doc = document.documentElement;
      const max = doc.scrollHeight - doc.clientHeight;
      doc.style.setProperty("--scroll-progress", max > 0 ? (doc.scrollTop / max).toFixed(4) : 0);
      ticking = false;
    };
    window.addEventListener("scroll", () => {
      if (!ticking) {
        ticking = true;
        requestAnimationFrame(update);
      }
    }, { passive: true });
    update();
  }

  // [data-parallax="0.25"] → μετακινείται κατά 25% της απόστασης scroll.
  function initScrollParallax() {
    const layers = [...document.querySelectorAll("[data-parallax]")];
    if (!layers.length) return;

    const MAX_SHIFT = 48; // κρατάει τη μετατόπιση διακριτική, ώστε το
                          // στοιχείο να μη φεύγει ποτέ από τη θέση του
    let ticking = false;
    const update = () => {
      const viewportCenter = window.innerHeight / 2;
      layers.forEach((layer) => {
        const speed = parseFloat(layer.dataset.parallax) || 0.2;
        const rect = layer.getBoundingClientRect();
        const raw = (rect.top + rect.height / 2 - viewportCenter) * speed;
        const offset = Math.max(-MAX_SHIFT, Math.min(MAX_SHIFT, raw));
        layer.style.setProperty("--scroll-shift", offset.toFixed(1) + "px");
      });
      ticking = false;
    };
    window.addEventListener("scroll", () => {
      if (!ticking) {
        ticking = true;
        requestAnimationFrame(update);
      }
    }, { passive: true });
    update();
  }

  /* ============ Δείκτης ποντικιού ============ */

  function initSpotlightCards() {
    document.addEventListener("pointermove", (e) => {
      const card = e.target.closest(".card, .feature-card");
      if (!card) return;
      const rect = card.getBoundingClientRect();
      card.style.setProperty("--spot-x", (((e.clientX - rect.left) / rect.width) * 100).toFixed(2) + "%");
      card.style.setProperty("--spot-y", (((e.clientY - rect.top) / rect.height) * 100).toFixed(2) + "%");
    }, { passive: true });
  }

  function initTilt() {
    const MAX_DEG = 6;
    document.querySelectorAll("[data-tilt]").forEach((el) => {
      el.addEventListener("pointermove", (e) => {
        const rect = el.getBoundingClientRect();
        const px = (e.clientX - rect.left) / rect.width - 0.5;
        const py = (e.clientY - rect.top) / rect.height - 0.5;
        el.style.setProperty("--tilt-x", (-py * MAX_DEG).toFixed(2) + "deg");
        el.style.setProperty("--tilt-y", (px * MAX_DEG).toFixed(2) + "deg");
      }, { passive: true });
      el.addEventListener("pointerleave", () => {
        el.style.setProperty("--tilt-x", "0deg");
        el.style.setProperty("--tilt-y", "0deg");
      });
    });
  }

  // Το στοιχείο «τραβιέται» ελαφρά προς τον δείκτη.
  function initMagnetic() {
    const STRENGTH = 0.28;
    document.querySelectorAll(".fx-magnetic").forEach((el) => {
      el.addEventListener("pointermove", (e) => {
        const rect = el.getBoundingClientRect();
        el.style.setProperty("--mag-x", ((e.clientX - rect.left - rect.width / 2) * STRENGTH).toFixed(1) + "px");
        el.style.setProperty("--mag-y", ((e.clientY - rect.top - rect.height / 2) * STRENGTH).toFixed(1) + "px");
      }, { passive: true });
      el.addEventListener("pointerleave", () => {
        el.style.setProperty("--mag-x", "0px");
        el.style.setProperty("--mag-y", "0px");
      });
    });
  }

  function initHeroParallax() {
    const hero = document.querySelector(".hero");
    if (!hero) return;
    hero.addEventListener("pointermove", (e) => {
      const rect = hero.getBoundingClientRect();
      hero.style.setProperty("--parallax-x", ((e.clientX - rect.left) / rect.width - 0.5).toFixed(3));
      hero.style.setProperty("--parallax-y", ((e.clientY - rect.top) / rect.height - 0.5).toFixed(3));
    }, { passive: true });
  }

  function initRipples() {
    document.addEventListener("pointerdown", (e) => {
      const btn = e.target.closest(".btn");
      if (!btn) return;
      const rect = btn.getBoundingClientRect();
      const dot = document.createElement("span");
      dot.className = "fx-ripple-dot";
      const size = Math.max(rect.width, rect.height) * 2;
      dot.style.width = dot.style.height = size + "px";
      dot.style.left = e.clientX - rect.left + "px";
      dot.style.top = e.clientY - rect.top + "px";
      btn.appendChild(dot);
      setTimeout(() => dot.remove(), 650);
    }, { passive: true });
  }

  /* ============ Μετρητές ============ */

  // [data-countup] σε στοιχείο με αριθμό — μετράει από το 0 μόλις φανεί.
  function initCountUp() {
    const els = document.querySelectorAll("[data-countup]");
    if (!els.length || !("IntersectionObserver" in window)) return;

    const animate = (el) => {
      const text = el.textContent.trim();
      const match = text.match(/^([0-9.,]+)(.*)$/);
      if (!match) return;
      const target = parseFloat(match[1].replace(/[.,]/g, ""));
      const suffix = match[2] || "";
      if (!isFinite(target) || target <= 0) return;

      const duration = 1400;
      const start = performance.now();
      const step = (now) => {
        const t = Math.min((now - start) / duration, 1);
        const eased = 1 - Math.pow(1 - t, 3);
        el.textContent = Math.round(target * eased).toLocaleString("el-GR") + suffix;
        if (t < 1) requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
    };

    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          animate(entry.target);
          observer.unobserve(entry.target);
        }
      });
    }, { threshold: 0.6 });

    els.forEach((el) => observer.observe(el));
  }

  // Οι δυναμικά φορτωμένες σελίδες (forum, shop…) μπορούν να ξανακαλέσουν
  // τα reveals για ό,τι πρόσθεσαν στο DOM.
  window.gsrMotion = { refresh: () => { initStagger(); initReveal(); } };
})();
