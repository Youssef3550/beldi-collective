/* Home page: featured products, drop countdown, build the look. */
(function () {
  'use strict';
  var B = window.Beldi, CFG = B.CFG;

  /* Countdown */
  function tick() {
    var el = document.getElementById('countdown'); if (!el) return;
    var diff = new Date(CFG.dropDate).getTime() - Date.now();
    if (isNaN(diff)) return;
    if (diff <= 0) {
      el.innerHTML = '<p class="form-done">Collection 01 is live. <a href="shop.html">Shop now →</a></p>';
      return true;
    }
    var s = Math.floor(diff / 1000);
    var parts = { d: Math.floor(s / 86400), h: Math.floor(s % 86400 / 3600), m: Math.floor(s % 3600 / 60), s: s % 60 };
    Object.keys(parts).forEach(function (k) { var n = el.querySelector('[data-cd="' + k + '"]'); if (n) n.textContent = String(parts[k]).padStart(2, '0'); });
  }

  /* Build the look */
  function initLook(products) {
    var list = document.getElementById('look-list'); if (!list) return;
    var picks = (CFG.look || []).map(function (slug) { return products.find(function (p) { return p.slug === slug; }); }).filter(Boolean);
    if (!picks.length) { document.getElementById('look').hidden = true; return; }
    var state = picks.map(function (p) {
      var color = B.colorsOf(p)[0].name, sizes = B.sizesOf(p, color);
      return { p: p, on: true, color: color, size: B.defaultSize(sizes), sizes: sizes };
    });
    var added = false;

    list.innerHTML = state.map(function (s, i) {
      var v = B.findVariant(s.p, s.color, s.size);
      return '<label class="look-item"><input type="checkbox" checked data-i="' + i + '"><img src="' + B.esc(v.image) + '" alt="">' +
        '<span class="meta"><strong>' + B.esc(s.p.name) + '</strong><span>' + B.esc(s.color) + ' · ' + B.money(parseFloat(v.price)) + '</span></span>' +
        (s.sizes.length > 1 ? '<select aria-label="Size for ' + B.esc(s.p.name) + '" data-size-i="' + i + '">' + s.sizes.map(function (z) { return '<option' + (z === s.size ? ' selected' : '') + '>' + B.esc(z) + '</option>'; }).join('') + '</select>' : '<span class="small-muted">One size</span>') +
        '</label>';
    }).join('');

    var btn = document.getElementById('look-add');
    function update() {
      var chosen = state.filter(function (s) { return s.on; });
      var sum = chosen.reduce(function (n, s) { return n + parseFloat(B.findVariant(s.p, s.color, s.size).price); }, 0);
      var full = chosen.length === state.length;
      var pct = CFG.lookBundleDiscount || 0;
      var price = full ? sum * (1 - pct / 100) : sum;
      document.getElementById('look-summary').textContent = full ? 'Complete look · ' + pct + '% off' : chosen.length + ' of ' + state.length + ' pieces selected';
      var was = document.getElementById('look-was'); was.hidden = !(full && pct); was.textContent = B.money(sum);
      document.getElementById('look-price').textContent = B.money(price);
      btn.disabled = !chosen.length;
      btn.classList.toggle('done', added);
      btn.textContent = added ? 'Added to bag ✓' : (!chosen.length ? 'Select at least one piece' : full ? 'Add the complete look' : 'Add ' + chosen.length + ' piece' + (chosen.length > 1 ? 's' : '') + ' to bag');
    }
    list.addEventListener('change', function (e) {
      if (e.target.dataset.i != null) state[+e.target.dataset.i].on = e.target.checked;
      if (e.target.dataset.sizeI != null) state[+e.target.dataset.sizeI].size = e.target.value;
      added = false; update();
    });
    btn.addEventListener('click', function () {
      var chosen = state.filter(function (s) { return s.on; });
      chosen.forEach(function (s) { B.addToCart(s.p, B.findVariant(s.p, s.color, s.size), 1, { silent: true }); });
      // The bundle discount is applied at checkout (see worker/README). The cart shows regular prices.
      added = true; update(); B.toast(chosen.length + ' pieces added to your bag'); B.openCart();
    });
    update();
  }

  var userScrolled = false;
  ['wheel', 'touchmove', 'keydown'].forEach(function (ev) { window.addEventListener(ev, function () { userScrolled = true; }, { once: true, passive: true }); });
  function jumpToHash() {
    if (userScrolled || !location.hash) return;
    var el = document.getElementById(location.hash.slice(1));
    if (el) el.scrollIntoView({ behavior: 'instant', block: 'start' });
  }

  /* Coming from another page (index.html#look / #story): products, fonts and images load after the
     browser's first jump and push the section down. Keep the section in place while the page
     settles (max 4 s), unless the visitor starts scrolling themselves. */
  if (location.hash && document.getElementById(location.hash.slice(1))) {
    var root = document.documentElement;
    root.style.scrollBehavior = 'auto';
    var settle = function () { jumpToHash(); };
    var ro = 'ResizeObserver' in window ? new ResizeObserver(settle) : null;
    if (ro) ro.observe(document.body);
    window.addEventListener('load', settle);
    if (document.fonts && document.fonts.addEventListener) document.fonts.addEventListener('loadingdone', settle);
    setTimeout(function () { if (ro) ro.disconnect(); root.style.scrollBehavior = ''; }, 4000);
  }

  document.addEventListener('DOMContentLoaded', function () {
    if (!tick()) { var t = setInterval(function () { if (tick()) clearInterval(t); }, 1000); }
    B.loadProducts().then(function (products) {
      var grid = document.getElementById('featured');
      grid.innerHTML = '';
      products.slice(0, 4).forEach(function (p) { grid.appendChild(B.productCard(p)); });
      initLook(products);
      jumpToHash();
    }).catch(function (err) {
      document.getElementById('featured').innerHTML = '<p class="body">Products could not be loaded. If you opened this file directly, run it through a local server (see README).</p>';
      console.error(err);
    });
  });
})();
