// Premium page logic: render products from products.json and open lightweight checkout panel
(async function(){
  const $ = (sel, ctx=document) => ctx.querySelector(sel);
  const $$ = (sel, ctx=document) => Array.from(ctx.querySelectorAll(sel));

  const productsEl = $('#products');
  const checkout = $('#checkout');
  const sumName = $('#sumName');
  const sumPrice = $('#sumPrice');
  const sumTax = $('#sumTax');
  const sumTotal = $('#sumTotal');
  const cancelBtn = $('#cancelCheckout');
  const payButtonsEl = $('#payButtons');

  function getInlineProducts(){
    try {
      const node = $('#products-data');
      if (!node) return null;
      return JSON.parse(node.textContent.trim());
    } catch { return null; }
  }

  let products = [];
  // Try to fetch external JSON (works on http server). If it fails (file://), fallback to inline JSON.
  try {
    const res = await fetch('./products.json', { cache: 'no-store' });
    if (res.ok) {
      products = await res.json();
    }
  } catch {}
  if (!products || products.length === 0) {
    const fallback = getInlineProducts();
    if (fallback && fallback.length) {
      products = fallback;
    } else {
      productsEl.innerHTML = '<p style="text-align:center;color:#c7b7a3">No products available.</p>';
      return;
    }
  }

  function euro(n){ return new Intl.NumberFormat(undefined,{style:'currency',currency:'EUR'}).format(n); }

  function render(){
    productsEl.innerHTML = products.map(p => `
      <article class="card" data-id="${p.id}">
        <img src="${p.image}" alt="${p.name}">
        <div class="body">
          <h3 class="title">${p.name}</h3>
          <p class="price">${euro(p.price_eur)}</p>
          <p class="desc" style="color:#c7b7a3">${p.description ?? ''}</p>
          <div class="actions">
            <button class="btn btn-primary" data-buy="${p.id}">Buy</button>
            <a class="btn btn-ghost" href="https://hackmanhub.pages.dev/premium" target="_blank" rel="noopener">Details</a>
          </div>
        </div>
      </article>
    `).join('');

    // attach buy handlers
    $$('[data-buy]').forEach(btn => btn.addEventListener('click', () => openCheckout(btn.getAttribute('data-buy'))));
  }

  function withQuery(url, params){
    const u = new URL(url, window.location.origin);
    Object.entries(params).forEach(([k,v]) => u.searchParams.set(k, String(v)));
    return u.toString();
  }

  function renderPayButtons(product){
    const cfg = window.HMH_PAY_CONFIG || { buttons: [] };
    payButtonsEl.innerHTML = cfg.buttons.map(b => {
      const cls = b.style === 'accent' ? 'btn btn-accent' : b.style === 'ghost' ? 'btn btn-ghost' : 'btn btn-primary';
      const href = b.href ? withQuery(b.href, { pid: product.id, name: product.name, amount: product.price_eur }) : '#';
      return `<a class="${cls}" href="${href}" target="_blank" rel="noopener" data-pay-id="${b.id}">${b.label}</a>`;
    }).join('');
  }

  function openCheckout(id){
    const p = products.find(x => x.id === id);
    if(!p) return;
    const tax = (p.tax_rate ?? 0) * p.price_eur;
    const total = p.price_eur + tax;
    sumName.textContent = p.name;
    sumPrice.textContent = euro(p.price_eur);
    sumTax.textContent = euro(tax);
    sumTotal.textContent = euro(total);
    renderPayButtons(p);
    checkout.hidden = false;
    checkout.scrollIntoView({behavior:'smooth'});
  }

  cancelBtn?.addEventListener('click', () => { checkout.hidden = true; });

  render();
})();

