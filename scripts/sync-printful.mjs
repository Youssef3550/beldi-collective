#!/usr/bin/env node
/**
 * Pull your Printful store products into data/products.json.
 *
 *   PRINTFUL_TOKEN=xxxx node scripts/sync-printful.mjs
 *   PRINTFUL_TOKEN=xxxx PRINTFUL_STORE_ID=1234567 node scripts/sync-printful.mjs   (account-level token)
 *   ... --dry   prints the result instead of writing the file
 *
 * Needs Node 18+ (built-in fetch). No npm packages.
 * The token is only used here (on your computer or in GitHub Actions), never in the website.
 *
 * Extra shop data Printful doesn't store (description, category, tag, colour hex, slug) goes in
 * data/overrides.json, keyed by the Printful sync product ID or exact product name.
 */
import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const API = 'https://api.printful.com';

const COLOR_HEX = {
  black: '#111111', white: '#FFFFFF', espresso: '#2C221E', 'dark chocolate': '#3B2A23', brown: '#5A3E2B',
  sand: '#C9B391', 'sand dune': '#C9B391', khaki: '#B9A27C', natural: '#E9E0CC', cream: '#F4EFE6', bone: '#E8E1D3',
  olive: '#5B5A3E', 'military green': '#5B5A3E', 'forest green': '#2E4A33', navy: '#1F2A44', 'heather grey': '#B8B6B2',
  'sport grey': '#A7A7A7', 'dark heather': '#4A4A4A', maroon: '#5C1F24', red: '#A32A2A'
};

export function slugify(s) {
  return String(s).normalize('NFKD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

export function guessCategory(name) {
  const n = name.toLowerCase();
  if (/(jogger|pant|trouser|short|sweatpant|legging)/.test(n)) return 'bottoms';
  if (/(cap|hat|beanie|tote|bag|sock|mug|poster|case|bucket)/.test(n)) return 'accessories';
  return 'tops';
}

/** Turn one Printful GET /store/products/{id} result into the site's product shape. */
export function normalizeProduct(result, overrides = {}, colorCodes = {}) {
  const sp = result.sync_product;
  const ov = overrides[String(sp.id)] || overrides[sp.name] || {};
  const colorMap = { ...COLOR_HEX, ...Object.fromEntries(Object.entries(overrides._colors || {}).map(([k, v]) => [k.toLowerCase(), v])) };

  const variants = (result.sync_variants || [])
    .filter((v) => !v.is_ignored)
    .map((v) => {
      const previews = (v.files || []).filter((f) => f.type === 'preview' && f.preview_url).map((f) => f.preview_url);
      const image = previews[0] || v.product?.image || sp.thumbnail_url;
      const color = v.color || '';
      return {
        id: String(v.id), // Printful sync variant ID: this is what goes into orders
        externalId: v.external_id || null,
        size: v.size || 'One size',
        color,
        colorHex: colorMap[color.toLowerCase()] || colorCodes[v.variant_id] || '#CCCCCC',
        price: Number(v.retail_price || 0).toFixed(2),
        currency: v.currency || 'EUR',
        image,
        images: previews.length ? previews : [image],
        available: !/out_of_stock|discontinued|inactive/.test(v.availability_status || '')
      };
    });

  const images = [];
  variants.forEach((v) => { if (v.image && !images.includes(v.image)) images.push(v.image); });
  if (!images.length && sp.thumbnail_url) images.push(sp.thumbnail_url);

  return {
    id: String(sp.id),
    slug: ov.slug || slugify(sp.name),
    name: ov.name || sp.name,
    category: ov.category || guessCategory(sp.name),
    tag: ov.tag ?? '',
    description: ov.description || '',
    details: ov.details || '',
    images: ov.images || images,
    variants,
    source: 'printful'
  };
}

async function pf(pathname, token, storeId) {
  const headers = { Authorization: `Bearer ${token}` };
  if (storeId) headers['X-PF-Store-Id'] = storeId;
  for (let attempt = 0; attempt < 4; attempt++) {
    const res = await fetch(API + pathname, { headers });
    if (res.status === 429) { await new Promise((r) => setTimeout(r, 15000)); continue; }
    const body = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(`Printful ${pathname} → ${res.status}: ${body?.error?.message || body?.result || res.statusText}`);
    return body;
  }
  throw new Error(`Printful ${pathname}: rate limited`);
}

async function main() {
  const token = process.env.PRINTFUL_TOKEN;
  const storeId = process.env.PRINTFUL_STORE_ID || '';
  const dry = process.argv.includes('--dry');
  if (!token) { console.error('Missing PRINTFUL_TOKEN. Create a private token at developers.printful.com → Your tokens.'); process.exit(1); }

  let overrides = {};
  try { overrides = JSON.parse(await readFile(path.join(ROOT, 'data/overrides.json'), 'utf8')); } catch { /* optional */ }

  // 1. List sync products (paged, 100 per page)
  const list = [];
  for (let offset = 0; ; offset += 100) {
    const page = await pf(`/store/products?limit=100&offset=${offset}`, token, storeId);
    list.push(...page.result);
    if (!page.paging || offset + 100 >= page.paging.total) break;
  }
  console.log(`Found ${list.length} Printful products`);

  // 2. Details per product (variants, prices, mockups)
  const products = [];
  const colorCodes = {};
  for (const item of list) {
    const { result } = await pf(`/store/products/${item.id}`, token, storeId);
    // Look up the hex colour of catalog variants we don't know yet (cached per catalog variant).
    for (const v of result.sync_variants || []) {
      const known = COLOR_HEX[(v.color || '').toLowerCase()] || (overrides._colors || {})[v.color];
      if (!known && v.variant_id && !colorCodes[v.variant_id]) {
        try { const cv = await pf(`/products/variant/${v.variant_id}`, token, storeId); colorCodes[v.variant_id] = cv.result?.variant?.color_code || ''; }
        catch { colorCodes[v.variant_id] = ''; }
      }
    }
    const p = normalizeProduct(result, overrides, colorCodes);
    if (p.variants.length) products.push(p);
    console.log(`  ✓ ${p.name} (${p.variants.length} variants)`);
  }

  const out = { source: 'printful', currency: products[0]?.variants[0]?.currency || 'EUR', updatedAt: new Date().toISOString(), products };
  if (dry) { console.log(JSON.stringify(out, null, 2)); return; }
  await writeFile(path.join(ROOT, 'data/products.json'), JSON.stringify(out, null, 2) + '\n');
  console.log(`Wrote data/products.json with ${products.length} products`);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  main().catch((e) => { console.error(e.message); process.exit(1); });
}
