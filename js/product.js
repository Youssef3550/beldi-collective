/* Product page: product.html?p=<slug>. Colour + size pick the Printful sync variant. */
(function () {
  'use strict';
  var B = window.Beldi, CFG = B.CFG;

  function setJsonLd(p, colors) {
    var data = {
      '@context': 'https://schema.org', '@type': 'Product', name: p.name, description: p.description || '',
      image: p.images.map(function (src) { return new URL(src, location.href).href; }),
      brand: { '@type': 'Brand', name: 'Beldi Collective' },
      color: colors.map(function (c) { return c.name; }).join(', '),
      offers: { '@type': 'AggregateOffer', priceCurrency: CFG.currency || 'EUR', lowPrice: B.priceFrom(p).toFixed(2), offerCount: p.variants.length, availability: 'https://schema.org/PreOrder' }
    };
    var s = document.createElement('script'); s.type = 'application/ld+json'; s.textContent = JSON.stringify(data);
    document.head.appendChild(s);
  }

  document.addEventListener('DOMContentLoaded', function () {
    var slug = new URLSearchParams(location.search).get('p');
    B.loadProducts().then(function (products) {
      var p = products.find(function (x) { return x.slug === slug || String(x.id) === slug; }) || products[0];
      if (!p) return;
      var colors = B.colorsOf(p);
      var state = { color: colors[0].name, size: null, qty: 1 };
      state.size = B.defaultSize(B.sizesOf(p, state.color));

      document.title = p.name + ' · Beldi Collective';
      var meta = document.querySelector('meta[name=description]'); if (meta) meta.content = p.description || p.name;
      document.getElementById('crumb-name').textContent = p.name;
      document.getElementById('p-name').textContent = p.name;
      document.getElementById('p-tag').textContent = p.tag || 'Collection 01';
      document.getElementById('p-desc').textContent = p.description || '';
      document.getElementById('p-details').textContent = p.details || p.description || '';
      setJsonLd(p, colors);

      var mainImg = document.getElementById('main-img');
      function images() {
        var v = p.variants.filter(function (x) { return x.color === state.color; });
        var list = [];
        v.forEach(function (x) { (x.images || [x.image]).forEach(function (src) { if (src && list.indexOf(src) < 0) list.push(src); }); });
        return list.length ? list : p.images;
      }
      function renderGallery() {
        var imgs = images();
        mainImg.src = imgs[0]; mainImg.alt = p.name + ' in ' + state.color;
        var th = document.getElementById('thumbs');
        th.innerHTML = imgs.length > 1 ? imgs.map(function (src, i) { return '<button type="button" aria-pressed="' + (i === 0) + '" aria-label="Image ' + (i + 1) + '"><img src="' + B.esc(src) + '" alt=""></button>'; }).join('') : '';
        B.$all('button', th).forEach(function (b, i) { b.addEventListener('click', function () { mainImg.src = imgs[i]; B.$all('button', th).forEach(function (x) { x.setAttribute('aria-pressed', String(x === b)); }); }); });
      }
      function renderOptions() {
        var sw = document.getElementById('swatches');
        document.getElementById('color-block').hidden = colors.length < 2 && colors[0].name === 'Default';
        document.getElementById('color-name').textContent = state.color;
        sw.innerHTML = colors.map(function (c) { return '<button class="swatch" type="button" aria-label="' + B.esc(c.name) + '" aria-pressed="' + (c.name === state.color) + '" data-color="' + B.esc(c.name) + '"><span style="background:' + B.esc(c.hex) + '"></span></button>'; }).join('');
        B.$all('[data-color]', sw).forEach(function (b) { b.addEventListener('click', function () {
          state.color = b.dataset.color;
          var sizes = B.sizesOf(p, state.color); if (sizes.indexOf(state.size) < 0) state.size = B.defaultSize(sizes);
          renderOptions(); renderGallery();
        }); });

        var sizes = B.sizesOf(p, state.color), box = document.getElementById('sizes');
        document.getElementById('size-block').hidden = sizes.length < 2;
        box.innerHTML = sizes.map(function (s) {
          var v = B.findVariant(p, state.color, s);
          return '<button class="pill" type="button" data-s="' + B.esc(s) + '" aria-pressed="' + (s === state.size) + '"' + (v && v.available === false ? ' disabled' : '') + '>' + B.esc(s) + '</button>';
        }).join('');
        B.$all('[data-s]', box).forEach(function (b) { b.addEventListener('click', function () { state.size = b.dataset.s; renderOptions(); }); });

        var v = B.findVariant(p, state.color, state.size);
        document.getElementById('p-price').textContent = v ? B.money(parseFloat(v.price)) : '';
        var add = document.getElementById('add-btn');
        add.disabled = !v || v.available === false;
        add.textContent = !v || v.available === false ? 'Sold out' : 'Add to bag · ' + B.money(parseFloat(v.price) * state.qty);
      }
      function setQty(n) { state.qty = Math.max(1, Math.min(10, n)); document.getElementById('q-val').textContent = state.qty; renderOptions(); }
      document.getElementById('q-minus').addEventListener('click', function () { setQty(state.qty - 1); });
      document.getElementById('q-plus').addEventListener('click', function () { setQty(state.qty + 1); });
      document.getElementById('add-btn').addEventListener('click', function () {
        var v = B.findVariant(p, state.color, state.size); if (!v) return;
        B.addToCart(p, v, state.qty, { silent: true }); B.openCart();
      });
      document.getElementById('open-size-guide').addEventListener('click', function () { document.getElementById('size-guide').open = true; });

      renderGallery(); renderOptions();

      var rel = document.getElementById('related');
      var lookSlugs = CFG.look || [];
      var others = products.filter(function (x) { return x.slug !== p.slug; });
      others.sort(function (a, b) { return (lookSlugs.indexOf(b.slug) >= 0) - (lookSlugs.indexOf(a.slug) >= 0); });
      others.slice(0, 4).forEach(function (x) { rel.appendChild(B.productCard(x)); });

      if (location.hash === '#size-guide') document.getElementById('size-guide').open = true;
    }).catch(function (err) {
      document.getElementById('p-name').textContent = 'Product not found';
      console.error(err);
    });
  });
})();
