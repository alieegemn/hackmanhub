// HackManHub access page rendering for key-system
(function(){
  const $ = (sel, ctx=document) => ctx.querySelector(sel);

  // Resolve relative asset paths for pages inside /key-system
  function withBase(p){
    if (!p) return p;
    const absolute = /^(?:[a-z]+:)?\/\//i.test(p) || p.startsWith('/') || p.startsWith('data:');
    if (absolute) return p;
    if (p.startsWith('../')) return p;
    return '../' + p; // make root-relative assets work from key-system
  }

  const cfg = (function(){
    const d = {
      brandName: 'HackManHub',
      logoSquare: 'assets/hlogo.jpg',
      logoLarge: 'assets/premium-key.jpg',
      plan: { title: '1 Day Key', subtitle: '(3 Min To Complete)', durationMinutes: 1440, continueHref: '../premium.html' },
      checkpoints: [ {name:'Captcha Check', emoji:'🛡️'}, {name:'Email Verify', emoji:'✉️'}, {name:'Device Bind', emoji:'🔗'} ]
    };
    try { return Object.assign({}, d, window.HMH_ACCESS_CONFIG || {}); } catch { return d; }
  })();

  // Brand
  ['brandName','brandNameFoot'].forEach(id => { const el = $('#'+id); if (el) el.textContent = cfg.brandName; });
  const brandLogo = $('#brandLogo'); if (brandLogo) brandLogo.src = withBase(cfg.logoSquare);
  const favicon = document.querySelector('link[rel="icon"]'); if (favicon) favicon.href = withBase(cfg.logoSquare);

  // Plan (do NOT override user-provided text if already present)
  (function(){
    const t = $('#planTitle');
    if (t && !t.textContent.trim()) t.textContent = cfg.plan?.title || '';
    const s = $('#planSubtitle');
    if (s && !s.textContent.trim()) s.textContent = cfg.plan?.subtitle || '';
    const d = $('#durationText');
    const dur = cfg.plan?.durationMinutes ?? 1440;
    if (d && !d.textContent.trim()) d.textContent = `${dur} minutes`;
    const continueBtn = $('#continueBtn');
    if (continueBtn && (!continueBtn.getAttribute('href') || continueBtn.getAttribute('href') === '#') && cfg.plan?.continueHref) {
      continueBtn.href = cfg.plan.continueHref;
    }
  })();

  // Big illustration (respect existing src; only fill if missing)
  (function(){
    const bigLogo = $('#bigLogo');
    if (bigLogo) {
      const currentSrc = bigLogo.getAttribute('src');
      if (!currentSrc || currentSrc.trim() === '') {
        bigLogo.src = withBase(cfg.logoLarge || cfg.logoSquare);
      }
    }
  })();

  // Checkpoints
  const cps = Array.isArray(cfg.checkpoints) ? cfg.checkpoints : [];
  const cpList = $('#checkpointItems');
  if (cpList) {
    cpList.innerHTML = cps.map(cp => {
      const icon = cp.img
        ? `<img class="cp-icon" src="${withBase(cp.img)}" alt="" />`
        : `<span class="cp-icon">${cp.emoji || '•'}</span>`;
      const name = cp.name || 'Checkpoint';
      return `<li class="cp-item">${icon}<span class="cp-name">${name}</span></li>`;
    }).join('');
  }

  // Count row
  const cpCountEl = $('#checkpointCount');
  if (cpCountEl) cpCountEl.textContent = `${cps.length} Checkpoints`;

  // Merge provider cards across multiple .cards sections so new providers
  // always appear next to the previous ones (no HTML edits required).
  (function(){
    const sections = Array.from(document.querySelectorAll('section.cards'));
    if (sections.length <= 1) return;
    const target = sections[0];
    for (let i = 1; i < sections.length; i++) {
      const sec = sections[i];
      const cards = Array.from(sec.querySelectorAll('.card'));
      cards.forEach(card => target.appendChild(card));
      // remove empty section to avoid extra gaps
      if (!sec.querySelector('.card')) sec.remove();
    }
  })();
})();
