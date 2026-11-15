/*
 * Beldi Collective: garment measurements per category, in cm.
 * Source: Printful's size guides for the blank used in each category (product measurements,
 * garment laid flat). Width = across the chest, armpit to armpit. Values rounded to 0.5 cm.
 * If you switch blanks in Printful, update the numbers here.
 */
window.BELDI_SIZECHARTS = {
  tees: {
    blank: 'Stanley/Stella Blaster 2.0 (SATU020)',
    fabric: '100% organic cotton, 200 g/m²',
    fit: 'Oversized fit with a high neck. Take your usual size for the boxy look, or size down for a closer fit.',
    sizes: ['S', 'M', 'L', 'XL', '2XL'],
    rows: [
      ['Length', [73, 75, 77, 80, 82.5]],
      ['Width', [63, 67, 71, 76, 81]],
      ['Sleeve length', [24, 24.5, 25, 25.5, 26]]
    ]
  },
  longsleeves: {
    blank: 'AS Colour Heavy Long Sleeve (5081)',
    fabric: '100% cotton, 278 g/m²',
    fit: 'Relaxed, structured fit. Take your usual size.',
    sizes: ['S', 'M', 'L', 'XL', '2XL'],
    rows: [
      ['Length', [70.5, 73.5, 76, 79.5, 82.5]],
      ['Width', [52, 56, 59.5, 63.5, 68]]
    ]
  },
  hoodies: {
    blank: 'Stanley/Stella Cruiser 2.0 (STSU177)',
    fabric: '85% organic cotton, 15% recycled polyester, 350 g/m² brushed fleece',
    fit: 'Classic unisex fit. Take your usual size, or size up for a looser feel.',
    sizes: ['S', 'M', 'L', 'XL', '2XL'],
    rows: [
      ['Length', [71, 74, 76, 78, 80]],
      ['Width', [55, 59, 62, 65, 69]],
      ['Sleeve length', [64.5, 66.5, 68.5, 69.5, 69.5]]
    ]
  },
  caps: {
    blank: 'Yupoong Classic Dad Hat (6245CM)',
    fabric: '100% cotton twill, embroidered',
    fit: 'One size. Unstructured, low-profile crown with an adjustable buckle strap at the back.',
    sizes: [],
    rows: []
  }
};

window.BELDI_SIZE_TABLE = function (cat) {
  var c = (window.BELDI_SIZECHARTS || {})[cat];
  if (!c) return '';
  var h = '<p style="margin-top:0">' + c.fit + '</p>';
  if (c.sizes.length) {
    h += '<div style="overflow-x:auto"><table class="size-table"><thead><tr><th scope="col">cm</th>' +
      c.sizes.map(function (s) { return '<th scope="col">' + s + '</th>'; }).join('') + '</tr></thead><tbody>' +
      c.rows.map(function (r) {
        return '<tr><th scope="row">' + r[0] + '</th>' + r[1].map(function (v) { return '<td>' + String(v).replace('.', ',') + '</td>'; }).join('') + '</tr>';
      }).join('') + '</tbody></table></div>';
    h += '<p style="margin-bottom:0;font-size:12px">Garment measured flat. Width is across the chest, armpit to armpit. Tolerance ±2 cm. Tip: lay a top you love flat and compare.</p>';
  }
  h += '<p style="margin-bottom:0;font-size:12px">Blank: ' + c.blank + ' · ' + c.fabric + '.</p>';
  return h;
};
