/*
 * Beldi Collective: pre-launch gate.
 * While LOCKED is true, visitors only see a "coming soon" page with the countdown and the waitlist.
 * Enter the password once on a device and that browser sees the full site from then on.
 * Visit any page with ?lock to lock your own browser again.
 *
 * To open the site for everyone at launch: set LOCKED to false (and remove the robots noindex tags).
 * To change the password: HASH = sha256('beldi:' + newPassword), e.g. in a browser console:
 *   crypto.subtle.digest('SHA-256', new TextEncoder().encode('beldi:NEWPASSWORD'))
 *     .then(b => console.log([...new Uint8Array(b)].map(x => x.toString(16).padStart(2, '0')).join('')))
 *
 * Note: this is a curtain, not a vault. GitHub Pages is static, so the files are still public
 * for anyone who knows the exact URLs. Good enough to keep the shop out of sight before launch.
 */
(function () {
  var LOCKED = true;
  var HASH = 'a25b76e3110d3eedd43cc94e264cc2a90abda133ab48ac99d2792e00c49bfd3c';
  var KEY = 'beldi_access';

  try { if (/[?&]lock\b/.test(location.search)) localStorage.removeItem(KEY); } catch (e) { /* ignore */ }
  var ok = false;
  try { ok = localStorage.getItem(KEY) === HASH; } catch (e) { /* ignore */ }
  if (!LOCKED || ok) return;

  var root = document.documentElement;
  root.classList.add('gate-locked');
  var st = document.createElement('style');
  st.textContent =
    'html.gate-locked body > *:not(#gate){display:none !important}' +
    '#gate{min-height:100vh;display:flex;flex-direction:column;background:var(--plaster,#efe7da)}' +
    '#gate .gate-main{flex:1;display:flex;align-items:center;justify-content:center;padding:56px 20px}' +
    '#gate .gate-inner{width:100%;max-width:560px;display:flex;flex-direction:column;align-items:center;text-align:center;gap:24px}' +
    '#gate .gate-logo{width:132px;height:auto}' +
    '#gate .countdown{justify-content:center}' +
    '#gate .early-card{width:100%;text-align:left}' +
    '#gate .gate-foot{display:flex;justify-content:space-between;gap:16px;flex-wrap:wrap;padding:20px clamp(20px,4vw,48px);font-size:12px;color:var(--muted,#7a6f64);border-top:1px solid var(--line,#ddd)}' +
    '#gate .gate-foot button{background:none;border:0;padding:0;font:inherit;color:inherit;text-decoration:underline;text-underline-offset:3px;cursor:pointer}' +
    '#gate .gate-pass{display:flex;gap:8px;width:100%;max-width:360px}' +
    '#gate .gate-pass .input{flex:1}' +
    '#gate .gate-err{color:#a0392b;font-size:13px;margin:0}' +
    '@media (max-width:480px){#gate .countdown{flex-wrap:nowrap;width:100%;gap:8px}#gate .countdown div{flex:1 1 0;min-width:0;padding:12px 4px}#gate .countdown strong{font-size:28px}#gate .countdown span{letter-spacing:.08em;font-size:10px}}';
  document.head.appendChild(st);

  function sha256(text) {
    return crypto.subtle.digest('SHA-256', new TextEncoder().encode(text)).then(function (b) {
      return Array.prototype.map.call(new Uint8Array(b), function (x) { return ('0' + x.toString(16)).slice(-2); }).join('');
    });
  }

  document.addEventListener('DOMContentLoaded', function () {
    var g = document.createElement('div');
    g.id = 'gate';
    g.innerHTML =
      '<main class="gate-main"><div class="gate-inner">' +
        '<img class="gate-logo" src="assets/logo.png" alt="Beldi Collective">' +
        '<p class="eyebrow" style="margin:0">Coming soon</p>' +
        '<h1 class="h2" style="margin:0">Collection 01 drops <em data-cfg="dropDateText"></em>.</h1>' +
        '<p class="body" style="margin:0">Everyday streetwear rooted in heritage. Join the waitlist and shop 24 hours before everyone else, while every size is still there.</p>' +
        '<div class="countdown" role="timer" aria-label="Time until the drop">' +
          '<div><strong data-g="d">--</strong><span>Days</span></div><div><strong data-g="h">--</strong><span>Hours</span></div>' +
          '<div><strong data-g="m">--</strong><span>Minutes</span></div><div><strong data-g="s">--</strong><span>Seconds</span></div>' +
        '</div>' +
        '<div class="early-card">' +
          '<form class="stack-form" data-waitlist="gate" novalidate>' +
            '<label class="field-label" for="gate-email">Email address</label>' +
            '<input class="input" id="gate-email" type="email" autocomplete="email" placeholder="you@example.com" required>' +
            '<button class="btn" type="submit">Join the waitlist</button>' +
          '</form>' +
          '<p class="small-muted" style="margin:0"><span data-cfg="firstOrderDiscount"></span>% off your first order for the list. No spam, unsubscribe any time.</p>' +
        '</div>' +
        '<form class="gate-pass" id="gate-pass" hidden>' +
          '<label class="sr-only" for="gate-pw">Password</label>' +
          '<input class="input" id="gate-pw" type="password" autocomplete="current-password" placeholder="Password">' +
          '<button class="btn" type="submit">Enter</button>' +
        '</form>' +
        '<p class="gate-err" id="gate-err" role="alert" hidden>Wrong password.</p>' +
      '</div></main>' +
      '<footer class="gate-foot"><span>© ' + new Date().getFullYear() + ' Beldi Collective</span><button type="button" id="gate-open">Have a password?</button></footer>';
    document.body.insertBefore(g, document.body.firstChild);

    var pass = g.querySelector('#gate-pass'), err = g.querySelector('#gate-err');
    g.querySelector('#gate-open').addEventListener('click', function () {
      pass.hidden = false; g.querySelector('#gate-pw').focus();
    });
    pass.addEventListener('submit', function (e) {
      e.preventDefault();
      sha256('beldi:' + g.querySelector('#gate-pw').value).then(function (h) {
        if (h === HASH) {
          try { localStorage.setItem(KEY, h); } catch (x) { /* ignore */ }
          root.classList.remove('gate-locked'); g.remove();
          window.scrollTo(0, 0);
          if (location.hash) location.reload();
        } else { err.hidden = false; }
      });
    });

    // Countdown
    var cfg = window.BELDI_CONFIG || {}, end = new Date(cfg.dropDate || 0).getTime();
    function pad(n) { return (n < 10 ? '0' : '') + n; }
    function tick() {
      var t = Math.max(0, end - Date.now()), s = Math.floor(t / 1000);
      var v = { d: Math.floor(s / 86400), h: Math.floor(s % 86400 / 3600), m: Math.floor(s % 3600 / 60), s: s % 60 };
      Object.keys(v).forEach(function (k) { var el = g.querySelector('[data-g="' + k + '"]'); if (el) el.textContent = k === 'd' ? v[k] : pad(v[k]); });
    }
    if (end) { tick(); setInterval(tick, 1000); }
  });
})();
