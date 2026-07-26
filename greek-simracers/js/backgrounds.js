// Lightweight canvas particle background, configurable enough to cover the
// few background variants the site needs (reactive home/intro background,
// ambient auth-panel background) without duplicating near-identical canvas
// code per page.
export function mountParticles(canvas, options = {}) {
  const { count = 60, color = "214 89% 60%", reactive = true, speed = 0.3 } = options;
  const ctx = canvas.getContext("2d");
  let width, height;
  let mouse = { x: -9999, y: -9999 };
  let particles = [];
  let raf;

  function resize() {
    width = canvas.width = canvas.offsetWidth * devicePixelRatio;
    height = canvas.height = canvas.offsetHeight * devicePixelRatio;
  }

  function init() {
    particles = Array.from({ length: count }, () => ({
      x: Math.random() * width,
      y: Math.random() * height,
      vx: (Math.random() - 0.5) * speed,
      vy: (Math.random() - 0.5) * speed,
      r: Math.random() * 1.5 + 0.5,
    }));
  }

  function step() {
    ctx.clearRect(0, 0, width, height);
    for (const p of particles) {
      if (reactive) {
        const dx = p.x - mouse.x;
        const dy = p.y - mouse.y;
        const dist = Math.hypot(dx, dy);
        if (dist < 120) {
          p.x += (dx / dist) * 1.2;
          p.y += (dy / dist) * 1.2;
        }
      }
      p.x += p.vx;
      p.y += p.vy;
      if (p.x < 0 || p.x > width) p.vx *= -1;
      if (p.y < 0 || p.y > height) p.vy *= -1;

      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r * devicePixelRatio, 0, Math.PI * 2);
      ctx.fillStyle = `hsl(${color} / 0.6)`;
      ctx.fill();
    }

    // constellation lines between nearby particles
    for (let i = 0; i < particles.length; i++) {
      for (let j = i + 1; j < particles.length; j++) {
        const dx = particles[i].x - particles[j].x;
        const dy = particles[i].y - particles[j].y;
        const dist = Math.hypot(dx, dy);
        if (dist < 100 * devicePixelRatio) {
          ctx.beginPath();
          ctx.moveTo(particles[i].x, particles[i].y);
          ctx.lineTo(particles[j].x, particles[j].y);
          ctx.strokeStyle = `hsl(${color} / ${0.15 * (1 - dist / (100 * devicePixelRatio))})`;
          ctx.stroke();
        }
      }
    }

    raf = requestAnimationFrame(step);
  }

  resize();
  init();
  step();

  const onResize = () => {
    resize();
    init();
  };
  const onMouseMove = (e) => {
    const rect = canvas.getBoundingClientRect();
    mouse = { x: (e.clientX - rect.left) * devicePixelRatio, y: (e.clientY - rect.top) * devicePixelRatio };
  };

  window.addEventListener("resize", onResize);
  if (reactive) canvas.addEventListener("mousemove", onMouseMove);

  return () => {
    cancelAnimationFrame(raf);
    window.removeEventListener("resize", onResize);
    canvas.removeEventListener("mousemove", onMouseMove);
  };
}
