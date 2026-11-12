/**
 * Beldi Collective API: Cloudflare Worker (optional, for when real orders start).
 *
 *   POST /checkout        → checks prices with Printful, opens a Stripe Checkout (Bancontact, cards, Apple Pay…)
 *   POST /stripe-webhook  → when Stripe confirms payment, creates the order in Printful
 *   GET  /health          → "ok"
 *
 * Secrets (set with `npx wrangler secret put NAME`):
 *   PRINTFUL_TOKEN, STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET, PRINTFUL_STORE_ID (optional)
 * Vars (wrangler.toml): ALLOWED_ORIGIN, SHIP_COUNTRIES, PRINTFUL_AUTO_CONFIRM
 */
const PF = 'https://api.printful.com';

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const cors = corsHeaders(request, env);
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
    try {
      if (url.pathname === '/health') return json({ ok: true }, 200, cors);
      if (url.pathname === '/checkout' && request.method === 'POST') return json(await checkout(request, env), 200, cors);
      if (url.pathname === '/stripe-webhook' && request.method === 'POST') return await stripeWebhook(request, env);
      return json({ error: 'Not found' }, 404, cors);
    } catch (err) {
      console.error(err);
      return json({ error: err.message || 'Server error' }, 500, cors);
    }
  }
};

/* ---------- checkout ---------- */
async function checkout(request, env) {
  const body = await request.json();
  const items = (body.items || []).filter((i) => i && i.variantId && i.qty > 0).slice(0, 30);
  if (!items.length) throw new Error('Cart is empty');

  // Never trust prices from the browser: read every variant from Printful.
  const lines = [];
  for (const item of items) {
    const { result } = await printful(env, `/store/variants/${encodeURIComponent(item.variantId)}`);
    lines.push({ id: String(result.id), name: result.name, price: Number(result.retail_price), currency: (result.currency || 'EUR').toLowerCase(), qty: Math.min(10, Math.floor(item.qty)), image: (result.files || []).find((f) => f.type === 'preview')?.preview_url || result.product?.image });
  }

  const returnUrl = safeReturnUrl(body.returnUrl, env);
  const form = new URLSearchParams();
  form.set('mode', 'payment');
  form.set('success_url', `${returnUrl}?order=success`);
  form.set('cancel_url', `${returnUrl}?order=cancelled`);
  form.set('locale', 'auto');
  form.set('phone_number_collection[enabled]', 'true');
  (env.SHIP_COUNTRIES || 'BE,NL,LU,FR,DE').split(',').forEach((c, i) => form.set(`shipping_address_collection[allowed_countries][${i}]`, c.trim()));
  lines.forEach((l, i) => {
    form.set(`line_items[${i}][quantity]`, String(l.qty));
    form.set(`line_items[${i}][price_data][currency]`, l.currency);
    form.set(`line_items[${i}][price_data][unit_amount]`, String(Math.round(l.price * 100)));
    form.set(`line_items[${i}][price_data][product_data][name]`, l.name);
    if (l.image) form.set(`line_items[${i}][price_data][product_data][images][0]`, l.image);
  });
  // Printful needs the sync variant IDs later: keep them on the session (compact: "id:qty,id:qty").
  form.set('metadata[pf_items]', lines.map((l) => `${l.id}:${l.qty}`).join(','));

  const res = await fetch('https://api.stripe.com/v1/checkout/sessions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${env.STRIPE_SECRET_KEY}`, 'Content-Type': 'application/x-www-form-urlencoded' },
    body: form
  });
  const session = await res.json();
  if (!res.ok) throw new Error(session.error?.message || 'Stripe error');
  return { url: session.url };
}

/* ---------- webhook: paid → Printful order ---------- */
async function stripeWebhook(request, env) {
  const raw = await request.text();
  const ok = await verifyStripe(raw, request.headers.get('stripe-signature') || '', env.STRIPE_WEBHOOK_SECRET);
  if (!ok) return new Response('Bad signature', { status: 400 });

  const event = JSON.parse(raw);
  if (event.type !== 'checkout.session.completed' || event.data.object.payment_status !== 'paid') return new Response('ignored');

  const s = event.data.object;
  const ship = s.collected_information?.shipping_details || s.shipping_details || {};
  const addr = ship.address || s.customer_details?.address || {};
  const items = String(s.metadata?.pf_items || '').split(',').filter(Boolean).map((pair) => {
    const [id, qty] = pair.split(':');
    return { sync_variant_id: Number(id), quantity: Number(qty) };
  });

  const order = {
    recipient: {
      name: ship.name || s.customer_details?.name,
      address1: addr.line1, address2: addr.line2 || '', city: addr.city, state_code: addr.state || '',
      country_code: addr.country, zip: addr.postal_code,
      email: s.customer_details?.email, phone: s.customer_details?.phone || ''
    },
    items,
    retail_costs: { currency: (s.currency || 'eur').toUpperCase(), subtotal: (s.amount_subtotal / 100).toFixed(2), total: (s.amount_total / 100).toFixed(2) }
  };
  // Draft by default, so you can check orders in the Printful dashboard first.
  const confirm = env.PRINTFUL_AUTO_CONFIRM === 'true' ? '?confirm=true' : '';
  await printful(env, `/orders${confirm}`, { method: 'POST', body: JSON.stringify(order) });
  return new Response('ok');
}

/* ---------- helpers ---------- */
async function printful(env, path, init = {}) {
  const headers = { Authorization: `Bearer ${env.PRINTFUL_TOKEN}`, 'Content-Type': 'application/json' };
  if (env.PRINTFUL_STORE_ID) headers['X-PF-Store-Id'] = env.PRINTFUL_STORE_ID;
  const res = await fetch(PF + path, { ...init, headers });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`Printful ${res.status}: ${data.error?.message || data.result || 'error'}`);
  return data;
}

async function verifyStripe(payload, header, secret) {
  if (!secret) return false;
  const parts = Object.fromEntries(header.split(',').map((kv) => kv.split('=')));
  const t = parts.t, sig = parts.v1;
  if (!t || !sig || Math.abs(Date.now() / 1000 - Number(t)) > 300) return false;
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const mac = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(`${t}.${payload}`));
  const hex = [...new Uint8Array(mac)].map((b) => b.toString(16).padStart(2, '0')).join('');
  if (hex.length !== sig.length) return false;
  let diff = 0; for (let i = 0; i < hex.length; i++) diff |= hex.charCodeAt(i) ^ sig.charCodeAt(i);
  return diff === 0;
}

function allowedOrigin(env) {
  try { return new URL(env.ALLOWED_ORIGIN).origin; } catch { return ''; }
}

// Only send shoppers back to your own site after payment.
function safeReturnUrl(u, env) {
  try { const parsed = new URL(u); if (parsed.origin === allowedOrigin(env)) return parsed.href; } catch { /* fall through */ }
  return env.ALLOWED_ORIGIN || 'https://example.com/';
}

function corsHeaders(request, env) {
  const origin = request.headers.get('Origin') || '';
  const ok = origin && origin === allowedOrigin(env);
  return { 'Access-Control-Allow-Origin': ok ? origin : 'null', 'Access-Control-Allow-Methods': 'POST, GET, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type', Vary: 'Origin' };
}

function json(data, status, headers) {
  return new Response(JSON.stringify(data), { status, headers: { ...headers, 'Content-Type': 'application/json' } });
}
