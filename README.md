# Beldi Collective · website

Static storefront (Oasis design) for GitHub Pages, ready to connect to Printful.

```
index.html          Home: hero, early access + countdown, categories, products, build the look, story
shop.html           All products, category filter, search, sort  (shop.html?c=tops)
product.html        Product page: colour, size, quantity, size guide  (product.html?p=oasis-crewneck)
js/config.js        ← YOUR SETTINGS: drop date, free-shipping threshold, discounts, look, endpoints
js/store.js         Cart (saved in the browser), cart drawer, waitlist forms
data/products.json  The products the site shows (demo now, Printful after syncing)
data/overrides.json Extra info Printful doesn't store: description, category, tag, colour hex
scripts/sync-printful.mjs   Pulls your Printful products into data/products.json
.github/workflows/sync-printful.yml   Runs that sync on GitHub, daily or with one click
worker/             Optional checkout server (Stripe + Printful orders) for when you start selling
```

## 1. Put it online (GitHub Pages)

1. Create a repository on GitHub, for example `beldi-collective`, and upload all these files (keep the folders).
2. **Settings → Pages → Build and deployment**: Source *Deploy from a branch*, branch `main`, folder `/ (root)`.
3. After a minute the site is at `https://YOURNAME.github.io/beldi-collective/`.

To preview on your computer: `python3 -m http.server` in this folder, then open http://localhost:8000.
(Opening `index.html` by double-clicking won't load the products; browsers block that.)

## 2. Connect Printful (products)

Your Printful token is secret, so it never goes in the website. GitHub keeps it and uses it to refresh `data/products.json`.

1. Printful: create a **Manual order / API** store and add your products there (designs, mockups, retail prices).
2. Go to **developers.printful.com → Your tokens → Create token**. Give it read access to sync products (`sync_products/read`), and add order access (`orders`) later for checkout. Copy the token.
3. GitHub repo → **Settings → Secrets and variables → Actions → New repository secret**:
   - `PRINTFUL_TOKEN` = the token
   - `PRINTFUL_STORE_ID` = only if you made an *account-level* token (store ID is in the Printful dashboard URL)
4. **Actions tab → Sync Printful products → Run workflow.** It replaces the demo products with yours and runs again every night.
5. Optional: fill `data/overrides.json` with descriptions, categories (`tops`, `bottoms`, `accessories`), tags (`New`, `Limited`) and slugs. Key = Printful product ID or the exact product name. Then update `look` in `js/config.js` with the slugs of your outfit pieces.

You can also run it on your computer (Node 18+):
```
PRINTFUL_TOKEN=your_token node scripts/sync-printful.mjs
```

Prices, sizes, colours and mockup images all come from Printful. Each size/colour is a Printful **sync variant**; its ID is stored in the cart, so orders can go straight to Printful.

## 3. Turn on real checkout (later)

Until `apiBase` is set in `js/config.js`, the cart works but checkout shows a "demo store" message. To sell for real:

1. Stripe account → enable **Bancontact**, cards, Apple Pay (Settings → Payment methods).
2. Deploy the worker (free Cloudflare account):
   ```
   cd worker
   npx wrangler login
   npx wrangler secret put PRINTFUL_TOKEN
   npx wrangler secret put STRIPE_SECRET_KEY
   npx wrangler deploy
   ```
   Set `ALLOWED_ORIGIN` in `worker/wrangler.toml` to your GitHub Pages URL first.
3. Stripe → Developers → Webhooks → add `https://beldi-api.YOURNAME.workers.dev/stripe-webhook` for the event `checkout.session.completed`. Then `npx wrangler secret put STRIPE_WEBHOOK_SECRET` with the signing secret.
4. Put the worker URL in `js/config.js` → `apiBase`.

Flow: cart → worker checks prices with Printful → Stripe Checkout → payment → webhook → order created in Printful.
Orders arrive in Printful as **drafts** (you confirm them by hand) until you set `PRINTFUL_AUTO_CONFIRM = "true"`.
Test with Stripe's test keys first.

Not built yet: the "complete look" bundle discount at checkout (the home page shows it; add a Stripe coupon in the worker), and Printful shipping rates (Stripe uses a flat or free rate you set up there).

## 4. Waitlist

`waitlistEndpoint` in `js/config.js` is empty, so sign-ups are not saved yet. Paste an endpoint that accepts `POST {email}`: a Formspree form, Brevo or Mailchimp (through a small proxy), or a route on your worker.

## Things to replace

- `assets/products/*.svg` are placeholder drawings; Printful mockups replace them after syncing.
- Campaign and outfit photos: see the comment in `index.html` (`<img class="cover" …>` inside the arch).
- The story text, size-guide numbers, contact email and social links.
- The drop date, shipping threshold, returns period and discounts in `js/config.js`.
