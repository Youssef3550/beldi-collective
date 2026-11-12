/*
 * Beldi Collective: site settings.
 * Change these values; every page reads them. No secrets go in this file:
 * it is public on GitHub Pages.
 */
window.BELDI_CONFIG = {
  // Collection 01 drop moment (ISO date with timezone). The countdown and the early-access banner use it.
  dropDate: '2026-12-12T18:00:00+01:00',

  // Shop rules shown across the site (EUR).
  freeShippingThreshold: 75,
  returnsDays: 30,
  firstOrderDiscount: 10,  // % off the first order for waitlist sign-ups
  lookBundleDiscount: 10,  // % off when the complete look is bought

  // Product slugs that make up "Build the look" on the home page.
  look: ['oasis-crewneck', 'fes-joggers', 'palm-dad-cap'],

  // Waitlist / newsletter. Leave empty for demo mode (sign-ups are not stored).
  // Paste a form endpoint that accepts JSON POST {email} (Formspree, Brevo, Mailchimp via a proxy, your worker...).
  waitlistEndpoint: '',

  // Checkout API: the URL of the deployed worker in /worker (e.g. https://beldi-api.yourname.workers.dev).
  // Empty = demo mode: the cart works, checkout shows a "coming soon" message.
  apiBase: '',

  currency: 'EUR',
  locale: 'nl-BE'
};
