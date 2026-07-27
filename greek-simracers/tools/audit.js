// Έλεγχος των σελίδων με βάση τους κανόνες προτεραιότητας 1-10 του ui-ux-pro-max.
const { chromium } = require('playwright');
const fs = require('fs');

const PAGES = [
  { file: 'index.html', name: 'Αρχική' },
  { file: 'championship.html?id=ch1', name: 'Championship Hub' },
];

function audit() {
  function parseRGB(s) {
    const m = s.match(/rgba?\(([^)]+)\)/);
    if (!m) return null;
    const p = m[1].split(',').map((x) => parseFloat(x));
    return { r: p[0], g: p[1], b: p[2], a: p.length > 3 ? p[3] : 1 };
  }
  function lum(c) {
    const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
    return 0.2126 * f(c.r) + 0.7152 * f(c.g) + 0.0722 * f(c.b);
  }
  function ratio(fg, bg) {
    const a = lum(fg) + 0.05;
    const b = lum(bg) + 0.05;
    return a > b ? a / b : b / a;
  }
  function effectiveBg(el) {
    let node = el;
    while (node && node !== document.documentElement) {
      const bg = parseRGB(getComputedStyle(node).backgroundColor);
      if (bg && bg.a > 0.85) return bg;
      node = node.parentElement;
    }
    return { r: 9, g: 13, b: 21, a: 1 };
  }

  const out = { contrast: [], touch: [], noAlt: [], noLabel: [], emoji: [], smallText: [] };
  const seen = new Set();

  document.querySelectorAll('body *').forEach((el) => {
    const cs = getComputedStyle(el);
    if (cs.visibility === 'hidden' || cs.display === 'none') return;
    const text = [...el.childNodes].filter((n) => n.nodeType === 3).map((n) => n.textContent.trim()).join('');
    if (!text) return;
    const fg = parseRGB(cs.color);
    if (!fg || fg.a === 0) return;
    const bg = effectiveBg(el);
    const size = parseFloat(cs.fontSize);
    const weight = parseInt(cs.fontWeight, 10) || 400;
    const large = size >= 24 || (size >= 18.66 && weight >= 700);
    const need = large ? 3 : 4.5;
    const r = ratio(fg, bg);
    const sig = el.className + '|' + Math.round(r * 10);
    if (r < need && !seen.has(sig)) {
      seen.add(sig);
      out.contrast.push({
        sel: el.tagName.toLowerCase() + '.' + String(el.className).slice(0, 40),
        text: text.slice(0, 30), ratio: Math.round(r * 100) / 100, need, size,
      });
    }
    if (size < 12 && text.length > 3) {
      out.smallText.push({ sel: String(el.className).slice(0, 40), size, text: text.slice(0, 25) });
    }
  });

  function visuallyClipped(el) {
    let node = el;
    while (node && node !== document.body) {
      const cs = getComputedStyle(node);
      if (cs.clipPath && cs.clipPath !== 'none' && cs.clipPath.includes('inset(50%')) return true;
      node = node.parentElement;
    }
    return false;
  }

  document.querySelectorAll('a, button, input[type=checkbox], [role=tab], select').forEach((el) => {
    const r = el.getBoundingClientRect();
    if (r.width === 0 || r.height === 0) return;
    if (visuallyClipped(el)) return;
    if (r.width < 44 || r.height < 44) {
      out.touch.push({
        sel: el.tagName.toLowerCase() + '.' + String(el.className).slice(0, 35),
        label: (el.getAttribute('aria-label') || el.textContent || '').trim().slice(0, 22),
        w: Math.round(r.width), h: Math.round(r.height),
      });
    }
  });

  document.querySelectorAll('img').forEach((img) => {
    if (!img.hasAttribute('alt')) out.noAlt.push(img.getAttribute('src') || '');
  });

  document.querySelectorAll('a, button').forEach((el) => {
    const txt = el.textContent.replace(/\s/g, '');
    if (el.querySelector('svg, img') && txt.length === 0 &&
        !el.getAttribute('aria-label') && !el.getAttribute('title')) {
      out.noLabel.push(el.tagName.toLowerCase() + '.' + String(el.className).slice(0, 35));
    }
  });

  const EMOJI = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u;
  document.querySelectorAll('.hub-card__meta span, .hub-card__foot span, .hub-state__icon, .share-btn, .stat-card__label').forEach((el) => {
    const t = el.textContent || '';
    if (EMOJI.test(t)) out.emoji.push({ sel: String(el.className).slice(0, 40), text: t.trim().slice(0, 24) });
  });

  return out;
}

(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const stub = fs.readFileSync('/tmp/t/hubstub.js', 'utf8');
  const report = {};

  for (const width of [1440, 390]) {
    const ctx = await b.newContext({ viewport: { width, height: 900 }, hasTouch: width < 700, isMobile: width < 700 });
    await ctx.route('**/*', (r) => r.request().url().startsWith('http://localhost') ? r.continue() : r.abort());
    await ctx.addInitScript({ content: stub });
    const p = await ctx.newPage();
    for (const page of PAGES) {
      await p.goto('http://localhost:8870/' + page.file, { waitUntil: 'load' });
      await p.waitForTimeout(1400);
      report[`${page.name} @${width}`] = await p.evaluate(audit);
    }
    await ctx.close();
  }

  const ctxRm = await b.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce' });
  await ctxRm.route('**/*', (r) => r.request().url().startsWith('http://localhost') ? r.continue() : r.abort());
  await ctxRm.addInitScript({ content: stub });
  const pr = await ctxRm.newPage();
  await pr.goto('http://localhost:8870/championship.html?id=ch1', { waitUntil: 'load' });
  await pr.waitForTimeout(1300);
  report['reduced-motion'] = await pr.evaluate(() => {
    const anim = [];
    document.querySelectorAll('*').forEach((el) => {
      const cs = getComputedStyle(el);
      const dur = parseFloat(cs.animationDuration) || 0;
      const tdur = parseFloat(cs.transitionDuration) || 0;
      if (dur > 0.05 || tdur > 0.35) {
        anim.push({ sel: el.tagName.toLowerCase() + '.' + String(el.className).slice(0, 35), anim: cs.animationName, dur, tdur });
      }
    });
    return anim.slice(0, 12);
  });

  const p2 = await ctxRm.newPage();
  await p2.goto('http://localhost:8870/index.html', { waitUntil: 'load' });
  await p2.waitForTimeout(700);
  report['δομή'] = await p2.evaluate(() => ({
    skipLink: !!document.querySelector('.skip-link, a[href="#main"]'),
    main: document.querySelectorAll('main').length,
    h1: document.querySelectorAll('h1').length,
    lang: document.documentElement.lang,
    navLandmark: document.querySelectorAll('nav[aria-label]').length,
    viewport: (document.querySelector('meta[name=viewport]') || {}).content,
  }));

  fs.writeFileSync('/tmp/t/audit.json', JSON.stringify(report, null, 1));
  await b.close();
})();
