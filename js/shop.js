/* Shop page: category filter, search, sort. State lives in the URL (?c=tops&q=hoodie). */
(function () {
  'use strict';
  var B = window.Beldi;
  var TITLES = { all: 'Shop all', tops: 'Tees & sweats', bottoms: 'Bottoms', accessories: 'Accessories' };

  document.addEventListener('DOMContentLoaded', function () {
    var params = new URLSearchParams(location.search);
    var state = { cat: params.get('c') || 'all', q: params.get('q') || '', sort: params.get('sort') || 'featured' };
    var grid = document.getElementById('grid'), search = document.getElementById('search'), sort = document.getElementById('sort');
    search.value = state.q; sort.value = state.sort;

    B.loadProducts().then(function (all) {
      function render() {
        var q = state.q.trim().toLowerCase();
        var list = all.filter(function (p) {
          return (state.cat === 'all' || p.category === state.cat) &&
            (!q || (p.name + ' ' + (p.description || '') + ' ' + B.colorsOf(p).map(function (c) { return c.name; }).join(' ')).toLowerCase().indexOf(q) >= 0);
        });
        if (state.sort === 'low') list.sort(function (a, b) { return B.priceFrom(a) - B.priceFrom(b); });
        if (state.sort === 'high') list.sort(function (a, b) { return B.priceFrom(b) - B.priceFrom(a); });
        if (state.sort === 'az') list.sort(function (a, b) { return a.name.localeCompare(b.name); });

        document.getElementById('shop-title').textContent = TITLES[state.cat] || 'Shop all';
        document.title = (TITLES[state.cat] || 'Shop all') + ' · Beldi Collective';
        B.$all('#chips [data-cat]').forEach(function (c) { c.setAttribute('aria-pressed', String(c.dataset.cat === state.cat)); });
        document.getElementById('result-count').textContent = list.length + (list.length === 1 ? ' product' : ' products');
        grid.innerHTML = '';
        if (!list.length) grid.innerHTML = '<p class="body">Nothing found. <a href="shop.html">See all products</a></p>';
        list.forEach(function (p) { grid.appendChild(B.productCard(p)); });

        var u = new URLSearchParams();
        if (state.cat !== 'all') u.set('c', state.cat);
        if (state.q) u.set('q', state.q);
        if (state.sort !== 'featured') u.set('sort', state.sort);
        history.replaceState(null, '', location.pathname + (u.toString() ? '?' + u : ''));
      }
      B.$all('#chips [data-cat]').forEach(function (c) { c.addEventListener('click', function () { state.cat = c.dataset.cat; render(); }); });
      var t; search.addEventListener('input', function () { clearTimeout(t); t = setTimeout(function () { state.q = search.value; render(); }, 150); });
      sort.addEventListener('change', function () { state.sort = sort.value; render(); });
      render();
    }).catch(function (err) {
      grid.innerHTML = '<p class="body">Products could not be loaded.</p>';
      console.error(err);
    });
  });
})();
