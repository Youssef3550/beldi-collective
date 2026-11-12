/* Beldi Collective: shared store logic (products, cart, drawer, forms). */
(function () {
  'use strict';
  var CFG = window.BELDI_CONFIG || {};
  var CART_KEY = 'beldi_cart_v1';
  var productsPromise = null;

  /* ---------- helpers ---------- */
  function $(sel, root) { return (root || document).querySelector(sel); }
  function $all(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function money(n) {
    try { return new Intl.NumberFormat(CFG.locale || 'nl-BE', { style: 'currency', currency: CFG.currency || 'EUR' }).format(n); }
    catch (e) { return '€' + Number(n).toFixed(2); }
  }

  /* ---------- products ---------- */
  function loadProducts() {
    if (!productsPromise) {
      productsPromise = fetch('data/products.json', { cache: 'no-cache' })
        .then(function (r) { if (!r.ok) throw new Error('products.json ' + r.status); return r.json(); })
        .then(function (data) { return (data.products || []).filter(function (p) { return p.variants && p.variants.length; }); });
    }
    return productsPromise;
  }
  function priceFrom(p) { return Math.min.apply(null, p.variants.map(function (v) { return parseFloat(v.price) || 0; })); }
  function colorsOf(p) {
    var seen = {}, out = [];
    p.variants.forEach(function (v) { var k = v.color || 'Default'; if (!seen[k]) { seen[k] = 1; out.push({ name: k, hex: v.colorHex || '#ccc', image: v.image }); } });
    return out;
  }
  var SIZE_ORDER = ['XXS', 'XS', 'S', 'M', 'L', 'XL', '2XL', 'XXL', '3XL', '4XL', '5XL'];
  function sizesOf(p, color) {
    var seen = {}, out = [];
    p.variants.forEach(function (v) { if (color && v.color !== color) return; var k = v.size || 'One size'; if (!seen[k]) { seen[k] = 1; out.push(k); } });
    return out.sort(function (a, b) { var ia = SIZE_ORDER.indexOf(a), ib = SIZE_ORDER.indexOf(b); return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib); });
  }
  function findVariant(p, color, size) {
    return p.variants.find(function (v) { return (!color || v.color === color) && (!size || (v.size || 'One size') === size); });
  }
  function defaultSize(sizes) { return sizes.indexOf('M') >= 0 ? 'M' : sizes[0]; }

  /* ---------- cart ---------- */
  function readCart() { try { return JSON.parse(localStorage.getItem(CART_KEY)) || []; } catch (e) { return memCart; } }
  var memCart = [];
  function writeCart(c) { memCart = c; try { localStorage.setItem(CART_KEY, JSON.stringify(c)); } catch (e) { /* private mode: keep in memory */ } renderCart(); }
  function cartCount() { return readCart().reduce(function (n, l) { return n + l.qty; }, 0); }
  function cartTotal() { return readCart().reduce(function (n, l) { return n + l.qty * parseFloat(l.price); }, 0); }

  function addToCart(product, variant, qty, opts) {
    qty = qty || 1;
    var cart = readCart();
    var line = cart.find(function (l) { return l.variantId === variant.id; });
    if (line) line.qty += qty;
    else cart.push({ variantId: variant.id, productId: product.id, slug: product.slug, name: product.name, color: variant.color || '', size: variant.size || '', price: variant.price, image: variant.image || product.images[0], qty: qty });
    writeCart(cart);
    if (!(opts && opts.silent)) toast(product.name + ' added to your bag');
  }
  function setQty(variantId, qty) {
    var cart = readCart().map(function (l) { if (l.variantId === variantId) l.qty = qty; return l; }).filter(function (l) { return l.qty > 0; });
    writeCart(cart);
  }

  /* ---------- drawer ---------- */
  function buildDrawer() {
    if ($('#cart-drawer')) return;
    var wrap = document.createElement('div');
    wrap.innerHTML =
      '<div class="drawer-backdrop" data-close-cart></div>' +
      '<aside class="drawer" id="cart-drawer" role="dialog" aria-modal="true" aria-labelledby="cart-title" aria-hidden="true">' +
      '  <div class="drawer-head"><h2 id="cart-title">Your bag</h2><button class="icon-btn" data-close-cart aria-label="Close bag">' +
      '    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg></button></div>' +
      '  <div class="ship-progress" id="ship-progress"></div>' +
      '  <div class="drawer-items" id="cart-items"></div>' +
      '  <div class="drawer-foot" id="cart-foot"></div>' +
      '</aside><div class="toast" id="toast" role="status" aria-live="polite"></div>';
    while (wrap.firstChild) document.body.appendChild(wrap.firstChild);
    document.addEventListener('click', function (e) {
      if (e.target.closest('[data-open-cart]')) { e.preventDefault(); openCart(); }
      if (e.target.closest('[data-close-cart]')) closeCart();
    });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && document.body.classList.contains('cart-open')) closeCart(); });
  }
  var lastFocus = null;
  function openCart() { lastFocus = document.activeElement; document.body.classList.add('cart-open'); $('#cart-drawer').setAttribute('aria-hidden', 'false'); var b = $('#cart-drawer [data-close-cart]'); if (b) b.focus(); }
  function closeCart() { document.body.classList.remove('cart-open'); $('#cart-drawer').setAttribute('aria-hidden', 'true'); if (lastFocus) lastFocus.focus(); }

  function renderCart() {
    $all('[data-cart-count]').forEach(function (el) { el.textContent = cartCount(); });
    var items = $('#cart-items'); if (!items) return;
    var cart = readCart(), total = cartTotal();
    var th = CFG.freeShippingThreshold || 0;
    var prog = $('#ship-progress');
    if (th) {
      var left = Math.max(0, th - total), pct = Math.min(100, total / th * 100);
      prog.innerHTML = '<span>' + (left > 0 ? 'You\'re <strong>' + money(left) + '</strong> away from free shipping' : 'You\'ve unlocked <strong>free shipping</strong> in Belgium') + '</span><div class="bar" aria-hidden="true"><span style="width:' + pct + '%"></span></div>';
      prog.style.display = cart.length ? '' : 'none';
    } else prog.style.display = 'none';

    if (!cart.length) {
      items.innerHTML = '<div class="drawer-empty"><img src="assets/palm.png" alt="" width="40"><p class="body">Your bag is empty.</p><a class="btn" href="shop.html">Shop the collection</a></div>';
      $('#cart-foot').innerHTML = '';
      return;
    }
    items.innerHTML = cart.map(function (l) {
      var opts = [l.color, l.size].filter(Boolean).join(' · ');
      return '<div class="line"><a href="product.html?p=' + encodeURIComponent(l.slug) + '"><img src="' + esc(l.image) + '" alt=""></a>' +
        '<div><h3>' + esc(l.name) + '</h3><div class="opts">' + esc(opts) + '</div>' +
        '<div class="qty" style="margin-top:10px"><button aria-label="Decrease quantity of ' + esc(l.name) + '" data-qty="' + esc(l.variantId) + '" data-d="-1">−</button><output>' + l.qty + '</output><button aria-label="Increase quantity of ' + esc(l.name) + '" data-qty="' + esc(l.variantId) + '" data-d="1">+</button></div></div>' +
        '<div class="line-right"><span>' + money(l.qty * parseFloat(l.price)) + '</span><button class="remove" data-remove="' + esc(l.variantId) + '">Remove</button></div></div>';
    }).join('');
    var demo = !CFG.apiBase;
    $('#cart-foot').innerHTML =
      '<div class="row"><span>Subtotal</span><strong>' + money(total) + '</strong></div>' +
      '<p class="small-muted">Shipping and taxes calculated at checkout.</p>' +
      '<button class="btn block" id="checkout-btn">Checkout</button>' +
      '<p class="small-muted" style="text-align:center">Bancontact · Visa · Mastercard · Apple Pay · PayPal</p>' +
      '<p class="demo-note" id="demo-note" hidden>This is a demo store: checkout opens when the shop launches. Join the waitlist to hear first.</p>';
    $all('[data-qty]', items).forEach(function (b) { b.addEventListener('click', function () { var l = readCart().find(function (x) { return x.variantId === b.dataset.qty; }); if (l) setQty(l.variantId, l.qty + parseInt(b.dataset.d, 10)); }); });
    $all('[data-remove]', items).forEach(function (b) { b.addEventListener('click', function () { setQty(b.dataset.remove, 0); }); });
    $('#checkout-btn').addEventListener('click', function () { checkout(demo); });
  }

  function checkout(demo) {
    if (demo) { $('#demo-note').hidden = false; return; }
    var btn = $('#checkout-btn'); btn.disabled = true; btn.textContent = 'Opening secure checkout…';
    fetch(CFG.apiBase.replace(/\/$/, '') + '/checkout', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ items: readCart().map(function (l) { return { variantId: l.variantId, qty: l.qty }; }), returnUrl: location.origin + location.pathname.replace(/[^/]*$/, '') })
    }).then(function (r) { return r.json(); }).then(function (d) {
      if (d && d.url) location.href = d.url; else throw new Error(d && d.error || 'No checkout URL');
    }).catch(function (err) {
      btn.disabled = false; btn.textContent = 'Checkout';
      toast('Checkout is unavailable right now. Please try again.');
      console.error(err);
    });
  }

  var toastTimer;
  function toast(msg) { var t = $('#toast'); if (!t) return; t.textContent = msg; t.classList.add('show'); clearTimeout(toastTimer); toastTimer = setTimeout(function () { t.classList.remove('show'); }, 2600); }

  /* ---------- product card (home + shop) ---------- */
  function productCard(p) {
    var colors = colorsOf(p), sizes = sizesOf(p, colors[0].name), size = defaultSize(sizes);
    var el = document.createElement('article');
    el.className = 'card';
    el.innerHTML =
      '<a class="card-media" href="product.html?p=' + encodeURIComponent(p.slug) + '"><img src="' + esc(p.images[0]) + '" alt="' + esc(p.name) + '" loading="lazy">' + (p.tag ? '<span class="tag">' + esc(p.tag) + '</span>' : '') + '</a>' +
      '<div class="card-row"><h3 class="card-title"><a href="product.html?p=' + encodeURIComponent(p.slug) + '">' + esc(p.name) + '</a></h3><span class="price">' + (p.variants.some(function (v) { return v.price !== p.variants[0].price; }) ? 'From ' : '') + money(priceFrom(p)) + '</span></div>' +
      '<div class="card-sub dots-row" style="display:flex;justify-content:space-between;align-items:center"><span>' + esc(colors.map(function (c) { return c.name; }).join(' · ')) + '</span><span class="dots" aria-hidden="true">' + colors.map(function (c) { return '<span style="background:' + esc(c.hex) + '"></span>'; }).join('') + '</span></div>' +
      (sizes.length > 1 ? '<div class="pills" role="group" aria-label="Size for ' + esc(p.name) + '">' + sizes.map(function (s) { return '<button class="pill" type="button" aria-pressed="' + (s === size) + '" data-size="' + esc(s) + '">' + esc(s) + '</button>'; }).join('') + '</div>' : '') +
      '<button class="btn" type="button" data-add>Add to bag</button>';
    $all('[data-size]', el).forEach(function (b) {
      b.addEventListener('click', function () { size = b.dataset.size; $all('[data-size]', el).forEach(function (x) { x.setAttribute('aria-pressed', String(x === b)); }); });
    });
    $('[data-add]', el).addEventListener('click', function () {
      var v = findVariant(p, colors[0].name, size); if (!v) return;
      addToCart(p, v, 1);
      var btn = this; btn.textContent = 'Added · ' + (v.size || 'one size'); btn.classList.add('done');
      setTimeout(function () { btn.textContent = 'Add to bag'; btn.classList.remove('done'); }, 1800);
    });
    return el;
  }

  /* ---------- forms + config text ---------- */
  function initWaitlist() {
    $all('form[data-waitlist]').forEach(function (form) {
      form.addEventListener('submit', function (e) {
        e.preventDefault();
        var email = (form.querySelector('input[type=email]') || {}).value || '';
        if (!/^\S+@\S+\.\S+$/.test(email)) { toast('Please enter a valid email address'); return; }
        var done = function () {
          $all('form[data-waitlist]').forEach(function (f) {
            var msg = document.createElement('p'); msg.className = 'form-done'; msg.setAttribute('role', 'status');
            msg.textContent = 'Shukran. You\'re on the list. We\'ll email you before the doors open.';
            f.replaceWith(msg);
          });
          try { localStorage.setItem('beldi_waitlist', '1'); } catch (err) { /* ignore */ }
        };
        if (!CFG.waitlistEndpoint) { done(); return; }
        fetch(CFG.waitlistEndpoint, { method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json' }, body: JSON.stringify({ email: email, source: form.dataset.waitlist }) })
          .then(function (r) { if (!r.ok) throw new Error(r.status); done(); })
          .catch(function () { toast('Something went wrong. Please try again.'); });
      });
    });
  }
  function fillConfig() {
    $all('[data-cfg]').forEach(function (el) {
      var k = el.dataset.cfg, v = CFG[k];
      if (k === 'freeShippingThreshold') v = money(v).replace(/[.,]00(?=\D*$)/, '');
      if (k === 'dropDateText') v = dropDateText();
      if (v != null) el.textContent = v;
    });
  }
  function dropDateText() {
    try { return new Date(CFG.dropDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'long' }); } catch (e) { return ''; }
  }
  function initNav() {
    var btn = $('[data-menu]'), nav = $('#main-nav');
    if (!btn || !nav) return;
    function setOpen(o) { nav.classList.toggle('open', o); btn.setAttribute('aria-expanded', String(o)); }
    btn.addEventListener('click', function () { setOpen(!nav.classList.contains('open')); });
    // Close the menu after picking a link (same-page links like #look don't reload the page)
    $all('a', nav).forEach(function (a) { a.addEventListener('click', function () { setOpen(false); }); });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape') setOpen(false); });
    window.addEventListener('resize', function () { if (window.innerWidth > 860) setOpen(false); });
  }

  window.Beldi = {
    CFG: CFG, $: $, $all: $all, esc: esc, money: money,
    loadProducts: loadProducts, colorsOf: colorsOf, sizesOf: sizesOf, findVariant: findVariant, defaultSize: defaultSize, priceFrom: priceFrom,
    addToCart: addToCart, openCart: openCart, productCard: productCard, toast: toast
  };

  document.addEventListener('DOMContentLoaded', function () {
    buildDrawer();
    // Back from Stripe Checkout
    var order = new URLSearchParams(location.search).get('order');
    if (order === 'success') { writeCart([]); setTimeout(function () { toast('Shukran! Your order is confirmed. Check your email.'); }, 300); }
    if (order === 'cancelled') setTimeout(function () { toast('Checkout cancelled. Your bag is still here.'); }, 300);
    renderCart(); initWaitlist(); fillConfig(); initNav();
    var y = $('[data-year]'); if (y) y.textContent = new Date().getFullYear();
  });
})();
