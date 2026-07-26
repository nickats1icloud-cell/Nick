// Motion & FX behaviours shared by every page. Pure enhancement:
// nothing here is load-bearing, and everything checks for
// prefers-reduced-motion before animating.
(function () {
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  document.addEventListener('DOMContentLoaded', () => {
    initScrollProgress();
    initStagger();
    if (reduceMotion) return;
    initSpotlightCards();
    initTilt();
    initCountUp();
    initHeroParallax();
  });

  function initScrollProgress() {
    const bar = document.createElement('div');
    bar.className = 'scroll-progress';
    bar.setAttribute('aria-hidden', 'true');
    document.body.appendChild(bar);

    let ticking = false;
    const update = () => {
      const doc = document.documentElement;
      const max = doc.scrollHeight - doc.clientHeight;
      doc.style.setProperty('--scroll-progress', max > 0 ? (doc.scrollTop / max).toFixed(4) : 0);
      ticking = false;
    };
    window.addEventListener('scroll', () => {
      if (!ticking) {
        ticking = true;
        requestAnimationFrame(update);
      }
    }, { passive: true });
    update();
  }

  // Give each child of a [data-stagger] group an incrementing index so
  // motion.css can cascade the reveal transition delays.
  function initStagger() {
    document.querySelectorAll('[data-stagger]').forEach((group) => {
      Array.from(group.children).forEach((child, i) => {
        child.style.setProperty('--stagger-i', String(i));
      });
    });
  }

  // Pointer-tracking highlight inside .card / .feature-card.
  function initSpotlightCards() {
    document.addEventListener('pointermove', (e) => {
      const card = e.target.closest('.card, .feature-card');
      if (!card) return;
      const rect = card.getBoundingClientRect();
      card.style.setProperty('--spot-x', ((e.clientX - rect.left) / rect.width * 100).toFixed(2) + '%');
      card.style.setProperty('--spot-y', ((e.clientY - rect.top) / rect.height * 100).toFixed(2) + '%');
    }, { passive: true });
  }

  // Subtle 3D tilt for elements opting in with data-tilt.
  function initTilt() {
    const MAX_DEG = 6;
    document.querySelectorAll('[data-tilt]').forEach((el) => {
      el.addEventListener('pointermove', (e) => {
        const rect = el.getBoundingClientRect();
        const px = (e.clientX - rect.left) / rect.width - 0.5;
        const py = (e.clientY - rect.top) / rect.height - 0.5;
        el.style.setProperty('--tilt-x', (-py * MAX_DEG).toFixed(2) + 'deg');
        el.style.setProperty('--tilt-y', (px * MAX_DEG).toFixed(2) + 'deg');
      }, { passive: true });
      el.addEventListener('pointerleave', () => {
        el.style.setProperty('--tilt-x', '0deg');
        el.style.setProperty('--tilt-y', '0deg');
      });
    });
  }

  // Count numeric stats up from 0 when they scroll into view.
  // Opt-in via data-countup on the element holding the number text.
  function initCountUp() {
    const els = document.querySelectorAll('[data-countup]');
    if (!els.length || !('IntersectionObserver' in window)) return;

    const animate = (el) => {
      const text = el.textContent.trim();
      const match = text.match(/^([0-9.,]+)(.*)$/);
      if (!match) return;
      const target = parseFloat(match[1].replace(/[.,]/g, ''));
      const suffix = match[2] || '';
      if (!isFinite(target) || target <= 0) return;

      const duration = 1200;
      const start = performance.now();
      const format = (n) => n.toLocaleString('el-GR');

      const step = (now) => {
        const t = Math.min((now - start) / duration, 1);
        const eased = 1 - Math.pow(1 - t, 3);
        el.textContent = format(Math.round(target * eased)) + suffix;
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

  // Hero glows drift slightly toward the pointer.
  function initHeroParallax() {
    const hero = document.querySelector('.hero');
    if (!hero) return;
    hero.addEventListener('pointermove', (e) => {
      const rect = hero.getBoundingClientRect();
      hero.style.setProperty('--parallax-x', ((e.clientX - rect.left) / rect.width - 0.5).toFixed(3));
      hero.style.setProperty('--parallax-y', ((e.clientY - rect.top) / rect.height - 0.5).toFixed(3));
    }, { passive: true });
  }
})();
