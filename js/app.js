// Starfield + small interactions
(function() {
  const canvas = document.getElementById('starfield');
  const ctx = canvas.getContext('2d');
  let width, height, stars;

  function resize() {
    width = canvas.width = window.innerWidth;
    height = canvas.height = window.innerHeight;
    // build stars proportional to area
    const count = Math.min(800, Math.floor((width * height) / 3000));
    stars = new Array(count).fill(0).map(() => ({
      x: Math.random() * width,
      y: Math.random() * height,
      z: Math.random() * 0.8 + 0.2, // depth 0.2-1.0
      vx: (Math.random() - 0.5) * 0.15,
      vy: (Math.random() - 0.5) * 0.15
    }));
  }

  function tick() {
    ctx.clearRect(0, 0, width, height);
    for (const s of stars) {
      s.x += s.vx * s.z; s.y += s.vy * s.z;
      if (s.x < -2) s.x = width + 2; if (s.x > width + 2) s.x = -2;
      if (s.y < -2) s.y = height + 2; if (s.y > height + 2) s.y = -2;
      const size = s.z * 1.8;
      const alpha = 0.5 + s.z * 0.5;
      ctx.fillStyle = `rgba(255,255,255,${alpha})`;
      ctx.beginPath(); ctx.arc(s.x, s.y, size, 0, Math.PI * 2); ctx.fill();
    }
    requestAnimationFrame(tick);
  }

  window.addEventListener('resize', resize);
  resize();
  tick();

  // current year
  const y = document.getElementById('year');
  if (y) y.textContent = new Date().getFullYear();

  // Discord button placeholder
  const discordBtn = document.getElementById('discordBtn');
  if (discordBtn) {
    discordBtn.addEventListener('click', (e) => {
      e.preventDefault();
      const url = 'https://hackmanhub.pages.dev/discord';
      window.open(url, '_blank', 'noopener');
    });
  }
})();

