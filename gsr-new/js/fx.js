/**
 * fx.js — καμβάδες φόντου.
 *
 * Αντικαθιστά τα React components `ReactiveBackground`, `Particles`,
 * `RacingBackground` και τον καμβά του intro με δύο απλές συναρτήσεις που
 * δουλεύουν σε οποιοδήποτε <canvas>. Και οι δύο σέβονται το
 * `prefers-reduced-motion` και σταματούν όταν η καρτέλα δεν είναι ορατή.
 */

const reduced = () => window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

/** Διαβάζει ένα CSS custom property ως συμπαγές hsl() string. */
function tone(name, alpha = 1) {
  const raw = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return `hsl(${raw} / ${alpha})`;
}

function setup(canvas) {
  const ctx = canvas.getContext("2d");
  const dpr = Math.min(window.devicePixelRatio || 1, 2);

  const resize = () => {
    const rect = canvas.getBoundingClientRect();
    const width = rect.width || window.innerWidth;
    const height = rect.height || window.innerHeight;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    return { width, height };
  };

  let size = resize();
  window.addEventListener("resize", () => {
    size = resize();
  });

  return { ctx, get size() { return size; }, resize: () => (size = resize()) };
}

function loop(draw) {
  let id = 0;
  let running = true;

  const tick = () => {
    if (running) draw();
    id = requestAnimationFrame(tick);
  };
  tick();

  const onVisibility = () => {
    running = !document.hidden;
  };
  document.addEventListener("visibilitychange", onVisibility);

  return () => {
    cancelAnimationFrame(id);
    document.removeEventListener("visibilitychange", onVisibility);
  };
}

/* --------------------------------------------------------------------------
   Σωματίδια που αντιδρούν στο ποντίκι (home, auth)
   -------------------------------------------------------------------------- */

export function particleField(canvas, { count = 46, link = 130, drift = 0.22 } = {}) {
  if (!canvas) return () => {};
  const { ctx } = setup(canvas);
  const dots = [];
  const pointer = { x: -9999, y: -9999 };

  const seed = () => {
    dots.length = 0;
    const total = window.innerWidth < 700 ? Math.round(count * 0.55) : count;
    for (let i = 0; i < total; i += 1) {
      dots.push({
        x: Math.random() * canvas.clientWidth,
        y: Math.random() * canvas.clientHeight,
        vx: (Math.random() - 0.5) * drift,
        vy: (Math.random() - 0.5) * drift,
        r: 0.8 + Math.random() * 1.6,
      });
    }
  };
  seed();
  window.addEventListener("resize", seed);

  window.addEventListener(
    "pointermove",
    (ev) => {
      const rect = canvas.getBoundingClientRect();
      pointer.x = ev.clientX - rect.left;
      pointer.y = ev.clientY - rect.top;
    },
    { passive: true },
  );
  window.addEventListener("pointerleave", () => {
    pointer.x = -9999;
    pointer.y = -9999;
  });

  if (reduced()) {
    // Στατική εκδοχή: μόνο οι κουκκίδες, χωρίς κίνηση.
    ctx.clearRect(0, 0, canvas.clientWidth, canvas.clientHeight);
    dots.forEach((dot) => {
      ctx.beginPath();
      ctx.arc(dot.x, dot.y, dot.r, 0, Math.PI * 2);
      ctx.fillStyle = tone("--brand", 0.35);
      ctx.fill();
    });
    return () => {};
  }

  return loop(() => {
    const { width, height } = { width: canvas.clientWidth, height: canvas.clientHeight };
    ctx.clearRect(0, 0, width, height);

    dots.forEach((dot) => {
      dot.x += dot.vx;
      dot.y += dot.vy;
      if (dot.x < 0 || dot.x > width) dot.vx *= -1;
      if (dot.y < 0 || dot.y > height) dot.vy *= -1;

      // Ήπια απώθηση από τον κέρσορα
      const dx = dot.x - pointer.x;
      const dy = dot.y - pointer.y;
      const dist = Math.hypot(dx, dy);
      if (dist < 110 && dist > 0.1) {
        dot.x += (dx / dist) * 0.7;
        dot.y += (dy / dist) * 0.7;
      }

      ctx.beginPath();
      ctx.arc(dot.x, dot.y, dot.r, 0, Math.PI * 2);
      ctx.fillStyle = tone("--brand", 0.45);
      ctx.fill();
    });

    // Γραμμές σύνδεσης
    for (let i = 0; i < dots.length; i += 1) {
      for (let j = i + 1; j < dots.length; j += 1) {
        const dx = dots[i].x - dots[j].x;
        const dy = dots[i].y - dots[j].y;
        const dist = Math.hypot(dx, dy);
        if (dist > link) continue;
        ctx.beginPath();
        ctx.moveTo(dots[i].x, dots[i].y);
        ctx.lineTo(dots[j].x, dots[j].y);
        ctx.strokeStyle = tone("--accent", 0.1 * (1 - dist / link));
        ctx.lineWidth = 1;
        ctx.stroke();
      }
    }
  });
}

/* --------------------------------------------------------------------------
   Intro: κάθετες neon μπάρες + οριζόντιες γραμμές ταχύτητας
   -------------------------------------------------------------------------- */

export function speedBars(canvas, { bars = 14, streaks = 20 } = {}) {
  if (!canvas) return () => {};
  const { ctx } = setup(canvas);

  const width = () => canvas.clientWidth;
  const height = () => canvas.clientHeight;

  const columns = [];
  const lines = [];

  const seed = () => {
    columns.length = 0;
    for (let i = 0; i < bars; i += 1) {
      columns.push({
        x: (width() / (bars + 1)) * (i + 1) + (Math.random() - 0.5) * 36,
        h: 0,
        max: 80 + Math.random() * 300,
        speed: 2 + Math.random() * 3,
        alpha: 0.45 + Math.random() * 0.5,
        w: 1.5 + Math.random() * 2,
        phase: Math.random() * Math.PI * 2,
      });
    }
    lines.length = 0;
    for (let i = 0; i < streaks; i += 1) {
      lines.push({
        x: Math.random() * width(),
        y: Math.random() * height(),
        len: 60 + Math.random() * 150,
        speed: 4 + Math.random() * 7,
        alpha: 0.05 + Math.random() * 0.13,
      });
    }
  };
  seed();
  window.addEventListener("resize", seed);

  if (reduced()) return () => {};

  let t = 0;
  return loop(() => {
    const w = width();
    const h = height();
    t += 0.02;
    ctx.clearRect(0, 0, w, h);

    // Λάμψη βάθους
    const glow = ctx.createRadialGradient(w * 0.5, h * 0.88, 0, w * 0.5, h * 0.88, w * 0.72);
    glow.addColorStop(0, tone("--brand", 0.16));
    glow.addColorStop(0.55, tone("--brand-deep", 0.06));
    glow.addColorStop(1, "transparent");
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, w, h);

    // Οριζόντιες γραμμές ταχύτητας
    lines.forEach((line) => {
      const grad = ctx.createLinearGradient(line.x, line.y, line.x - line.len, line.y);
      grad.addColorStop(0, tone("--brand-glow", line.alpha));
      grad.addColorStop(1, "transparent");
      ctx.beginPath();
      ctx.moveTo(line.x, line.y);
      ctx.lineTo(line.x - line.len, line.y);
      ctx.strokeStyle = grad;
      ctx.lineWidth = 1;
      ctx.stroke();
      line.x += line.speed;
      if (line.x - line.len > w) line.x = -line.len;
    });

    // Κάθετες μπάρες που «φουσκώνουν»
    columns.forEach((bar) => {
      if (bar.h < bar.max) bar.h = Math.min(bar.h + bar.speed, bar.max);
      const pulse = Math.sin(t * 1.8 + bar.phase) * 0.15 + 0.85;
      const top = h - bar.h * pulse;

      ctx.shadowColor = tone("--brand", 1);
      ctx.shadowBlur = 16;

      const grad = ctx.createLinearGradient(bar.x, top, bar.x, h);
      grad.addColorStop(0, tone("--brand-glow", 0));
      grad.addColorStop(0.25, tone("--brand-glow", bar.alpha * 0.6));
      grad.addColorStop(0.85, tone("--brand", bar.alpha));
      grad.addColorStop(1, tone("--accent", bar.alpha));

      ctx.beginPath();
      ctx.moveTo(bar.x, h);
      ctx.lineTo(bar.x, top);
      ctx.strokeStyle = grad;
      ctx.lineWidth = bar.w;
      ctx.stroke();

      ctx.beginPath();
      ctx.arc(bar.x, top, bar.w * 1.5, 0, Math.PI * 2);
      ctx.fillStyle = tone("--brand-glow", bar.alpha * pulse);
      ctx.fill();
      ctx.shadowBlur = 0;
    });

    // Πλέγμα κουκκίδων
    const gap = 56;
    for (let x = gap; x < w; x += gap) {
      for (let y = gap; y < h; y += gap) {
        const pulse = Math.sin(t + x * 0.01 + y * 0.01) * 0.03 + 0.04;
        ctx.beginPath();
        ctx.arc(x, y, 1, 0, Math.PI * 2);
        ctx.fillStyle = tone("--accent", pulse);
        ctx.fill();
      }
    }
  });
}

/** Εφέ γραφομηχανής — το intro το χρησιμοποιεί δύο φορές. */
export function typewriter(node, text, { speed = 55, delay = 0, caret = true } = {}) {
  return new Promise((resolve) => {
    if (!node) return resolve();
    if (reduced()) {
      node.textContent = text;
      return resolve();
    }
    let i = 0;
    setTimeout(() => {
      const id = setInterval(() => {
        i += 1;
        node.innerHTML = `${text.slice(0, i)}${caret && i < text.length ? '<span class="intro__caret">|</span>' : ""}`;
        if (i >= text.length) {
          clearInterval(id);
          resolve();
        }
      }, speed);
    }, delay);
  });
}
