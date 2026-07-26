// Championship Hub — γραφήματα σε καθαρό SVG.
//
// Το spec ζητούσε Recharts, που θέλει React και build step. Το site είναι
// στατικό HTML, οπότε τα γραφήματα γράφονται απευθείας σε SVG: μηδέν
// εξαρτήσεις, μηδέν kilobytes από CDN, και κληρονομούν αυτόματα τα χρώματα
// του θέματος μέσω currentColor και των CSS μεταβλητών.
//
// Όλα τα γραφήματα είναι responsive (viewBox + width:100%) και έχουν
// εναλλακτική περιγραφή για τους αναγνώστες οθόνης.
(function () {
  const NS = "http://www.w3.org/2000/svg";

  function esc(value) {
    return String(value == null ? "" : value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  // Παλέτα: μπλε της μάρκας + ουδέτερα motorsport χρώματα. Χωρίς RGB.
  const SERIES_COLORS = [
    "hsl(214 89% 52%)",
    "hsl(210 12% 72%)",
    "hsl(45 93% 55%)",
    "hsl(142 60% 45%)",
    "hsl(28 70% 55%)",
  ];

  const AXIS = "hsl(210 25% 24%)";
  const LABEL = "hsl(210 15% 60%)";

  function svgEl(width, height, title) {
    const svg = document.createElementNS(NS, "svg");
    svg.setAttribute("viewBox", `0 0 ${width} ${height}`);
    svg.setAttribute("class", "chart");
    svg.setAttribute("role", "img");
    svg.setAttribute("preserveAspectRatio", "xMidYMid meet");
    if (title) {
      const t = document.createElementNS(NS, "title");
      t.textContent = title;
      svg.appendChild(t);
    }
    return svg;
  }

  function reducedMotion() {
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  }

  function niceMax(value) {
    if (value <= 0) return 1;
    const pow = Math.pow(10, Math.floor(Math.log10(value)));
    return Math.ceil(value / pow) * pow;
  }

  // ---------- Γράφημα γραμμής (π.χ. εξέλιξη χρόνων γύρου) ----------
  // series: [{ name, values: [number] }], labels: [string]
  function lineChart(host, config) {
    const W = 640;
    const H = 260;
    const pad = { top: 16, right: 16, bottom: 30, left: 44 };
    const series = config.series || [];
    const labels = config.labels || [];
    const invert = config.invert === true; // χρόνοι γύρου: μικρότερο = καλύτερο

    const all = series.flatMap((s) => s.values.filter((v) => Number.isFinite(v)));
    if (!all.length) {
      host.innerHTML = "";
      return;
    }
    const min = Math.min(...all);
    const max = Math.max(...all);
    const span = max - min || 1;
    const lo = min - span * 0.1;
    const hi = max + span * 0.1;

    const innerW = W - pad.left - pad.right;
    const innerH = H - pad.top - pad.bottom;
    const x = (i, n) => pad.left + (n <= 1 ? innerW / 2 : (i / (n - 1)) * innerW);
    const y = (v) => pad.top + innerH - ((v - lo) / (hi - lo)) * innerH;

    const svg = svgEl(W, H, config.title || "Γράφημα γραμμής");
    let html = "";

    // Οριζόντιοι οδηγοί + ετικέτες άξονα.
    for (let i = 0; i <= 4; i += 1) {
      const gy = pad.top + (i / 4) * innerH;
      const value = hi - (i / 4) * (hi - lo);
      html +=
        `<line x1="${pad.left}" y1="${gy}" x2="${W - pad.right}" y2="${gy}" stroke="${AXIS}" stroke-width="1"/>` +
        `<text x="${pad.left - 8}" y="${gy + 4}" fill="${LABEL}" font-size="10" text-anchor="end">` +
        esc(config.formatY ? config.formatY(value) : Math.round(value)) +
        "</text>";
    }

    // Ετικέτες οριζόντιου άξονα (αραιωμένες ώστε να μη στριμώχνονται).
    const step = Math.max(1, Math.ceil(labels.length / 8));
    labels.forEach((label, i) => {
      if (i % step) return;
      html +=
        `<text x="${x(i, labels.length)}" y="${H - 10}" fill="${LABEL}" font-size="10" text-anchor="middle">` +
        esc(label) +
        "</text>";
    });

    series.forEach((s, si) => {
      const color = SERIES_COLORS[si % SERIES_COLORS.length];
      const points = s.values
        .map((v, i) => (Number.isFinite(v) ? `${x(i, s.values.length)},${y(v)}` : null))
        .filter(Boolean);
      if (!points.length) return;

      html +=
        `<polyline fill="none" stroke="${color}" stroke-width="2.5" stroke-linejoin="round" ` +
        `stroke-linecap="round" points="${points.join(" ")}" class="chart__line"/>`;

      s.values.forEach((v, i) => {
        if (!Number.isFinite(v)) return;
        html += `<circle cx="${x(i, s.values.length)}" cy="${y(v)}" r="3" fill="${color}"><title>${esc(labels[i] || i + 1)}: ${esc(v)}</title></circle>`;
      });
    });

    svg.innerHTML = html;
    if (invert) svg.setAttribute("data-invert", "true");
    host.innerHTML = "";
    host.appendChild(svg);
    host.appendChild(legend(series));
    if (!reducedMotion()) animateLines(svg);
  }

  function animateLines(svg) {
    svg.querySelectorAll(".chart__line").forEach((line) => {
      const len = line.getTotalLength ? line.getTotalLength() : 0;
      if (!len) return;
      line.style.strokeDasharray = String(len);
      line.style.strokeDashoffset = String(len);
      line.style.transition = "stroke-dashoffset 0.9s ease-out";
      requestAnimationFrame(() => {
        line.style.strokeDashoffset = "0";
      });
    });
  }

  // ---------- Γράφημα ράβδων (π.χ. πόντοι πρωταθλήματος) ----------
  function barChart(host, config) {
    const items = config.items || [];
    const W = 640;
    const rowH = 26;
    const H = Math.max(80, items.length * rowH + 20);
    const labelW = 128;
    const max = niceMax(Math.max(...items.map((i) => Number(i.value) || 0), 1));

    const svg = svgEl(W, H, config.title || "Γράφημα ράβδων");
    let html = "";

    items.forEach((item, i) => {
      const y = 10 + i * rowH;
      const value = Number(item.value) || 0;
      const w = ((W - labelW - 60) * value) / max;
      const color = item.color || SERIES_COLORS[0];
      html +=
        `<text x="0" y="${y + 14}" fill="${LABEL}" font-size="11">${esc(item.label)}</text>` +
        `<rect x="${labelW}" y="${y + 4}" width="${W - labelW - 60}" height="14" rx="7" fill="${AXIS}" opacity="0.5"/>` +
        `<rect class="chart__bar" x="${labelW}" y="${y + 4}" width="${w}" height="14" rx="7" fill="${color}">` +
        `<title>${esc(item.label)}: ${esc(value)}</title></rect>` +
        `<text x="${W - 4}" y="${y + 15}" fill="hsl(210 20% 92%)" font-size="11" text-anchor="end">${esc(value)}</text>`;
    });

    svg.innerHTML = html;
    host.innerHTML = "";
    host.appendChild(svg);

    if (!reducedMotion()) {
      svg.querySelectorAll(".chart__bar").forEach((bar, i) => {
        const target = bar.getAttribute("width");
        bar.setAttribute("width", "0");
        bar.style.transition = `width 0.6s cubic-bezier(0.22,1,0.36,1) ${i * 45}ms`;
        requestAnimationFrame(() => bar.setAttribute("width", target));
      });
    }
  }

  // ---------- Ραντάρ (σύγκριση οδηγών) ----------
  // axes: [string], series: [{ name, values: [0..100] }]
  function radarChart(host, config) {
    const size = 300;
    const cx = size / 2;
    const cy = size / 2;
    const r = size / 2 - 40;
    const axes = config.axes || [];
    const series = config.series || [];
    const n = axes.length;
    if (!n) return;

    const point = (i, value) => {
      const angle = (Math.PI * 2 * i) / n - Math.PI / 2;
      const dist = (Math.max(0, Math.min(100, value)) / 100) * r;
      return [cx + Math.cos(angle) * dist, cy + Math.sin(angle) * dist];
    };

    const svg = svgEl(size, size, config.title || "Γράφημα ραντάρ");
    let html = "";

    // Δαχτυλίδια και ακτίνες.
    for (let ring = 1; ring <= 4; ring += 1) {
      const pts = axes
        .map((_, i) => point(i, (ring / 4) * 100).join(","))
        .join(" ");
      html += `<polygon points="${pts}" fill="none" stroke="${AXIS}" stroke-width="1"/>`;
    }
    axes.forEach((axis, i) => {
      const [px, py] = point(i, 100);
      const [lx, ly] = point(i, 122);
      html +=
        `<line x1="${cx}" y1="${cy}" x2="${px}" y2="${py}" stroke="${AXIS}" stroke-width="1"/>` +
        `<text x="${lx}" y="${ly}" fill="${LABEL}" font-size="10" text-anchor="middle" dominant-baseline="middle">${esc(axis)}</text>`;
    });

    series.forEach((s, si) => {
      const color = SERIES_COLORS[si % SERIES_COLORS.length];
      const pts = s.values.map((v, i) => point(i, v).join(",")).join(" ");
      html +=
        `<polygon points="${pts}" fill="${color}" fill-opacity="0.18" stroke="${color}" stroke-width="2"/>`;
    });

    svg.innerHTML = html;
    host.innerHTML = "";
    host.appendChild(svg);
    host.appendChild(legend(series));
  }

  // ---------- Δακτύλιος (π.χ. χρήση αυτοκινήτων) ----------
  function donutChart(host, config) {
    const items = (config.items || []).filter((i) => Number(i.value) > 0);
    const size = 240;
    const cx = size / 2;
    const cy = size / 2;
    const r = 88;
    const thickness = 26;
    const total = items.reduce((sum, i) => sum + Number(i.value), 0);
    if (!total) {
      host.innerHTML = "";
      return;
    }

    const svg = svgEl(size, size, config.title || "Γράφημα δακτυλίου");
    let html = "";
    let angle = -Math.PI / 2;

    items.forEach((item, i) => {
      const slice = (Number(item.value) / total) * Math.PI * 2;
      const end = angle + slice;
      const large = slice > Math.PI ? 1 : 0;
      const x1 = cx + Math.cos(angle) * r;
      const y1 = cy + Math.sin(angle) * r;
      const x2 = cx + Math.cos(end) * r;
      const y2 = cy + Math.sin(end) * r;
      const color = item.color || SERIES_COLORS[i % SERIES_COLORS.length];
      const pct = Math.round((Number(item.value) / total) * 100);

      html +=
        `<path d="M ${x1} ${y1} A ${r} ${r} 0 ${large} 1 ${x2} ${y2}" fill="none" stroke="${color}" ` +
        `stroke-width="${thickness}" stroke-linecap="butt">` +
        `<title>${esc(item.label)}: ${pct}%</title></path>`;
      angle = end;
    });

    html +=
      `<text x="${cx}" y="${cy - 2}" fill="hsl(210 20% 92%)" font-size="26" font-weight="700" text-anchor="middle">${total}</text>` +
      `<text x="${cx}" y="${cy + 18}" fill="${LABEL}" font-size="11" text-anchor="middle">${esc(config.centerLabel || "σύνολο")}</text>`;

    svg.innerHTML = html;
    host.innerHTML = "";
    host.appendChild(svg);
    host.appendChild(legend(items.map((i, idx) => ({ name: i.label, color: i.color || SERIES_COLORS[idx % SERIES_COLORS.length] }))));
  }

  // ---------- Υπόμνημα ----------
  function legend(series) {
    const el = document.createElement("div");
    el.className = "chart-legend";
    el.innerHTML = series
      .map((s, i) => {
        const color = s.color || SERIES_COLORS[i % SERIES_COLORS.length];
        return (
          '<span class="chart-legend__item">' +
          `<span class="chart-legend__swatch" style="background:${color}"></span>` +
          esc(s.name) +
          "</span>"
        );
      })
      .join("");
    return el;
  }

  window.GSRCharts = { lineChart, barChart, radarChart, donutChart, SERIES_COLORS };
})();
