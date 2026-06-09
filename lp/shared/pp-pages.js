/* Prime Property Buyers — content-pages shared behaviour.
   Lightweight, no dependencies. Linked root-relative as /lp/shared/pp-pages.js. */
(function () {
  // ---- Reveal-on-scroll ----
  var els = document.querySelectorAll('[data-reveal]');
  if (!('IntersectionObserver' in window) || window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    els.forEach(function (el) { el.classList.add('is-visible'); });
  } else {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (e.isIntersecting) { e.target.classList.add('is-visible'); io.unobserve(e.target); }
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -8% 0px' });
    els.forEach(function (el) { io.observe(el); });
  }

  // ---- Mobile nav toggle ----
  var nav = document.querySelector('.site-nav');
  var toggle = nav && nav.querySelector('.nav-toggle');
  if (nav && toggle) {
    toggle.addEventListener('click', function () {
      var open = nav.classList.toggle('open');
      toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
    });
    // close the menu when a link is tapped
    nav.querySelectorAll('.nav-menu a').forEach(function (a) {
      a.addEventListener('click', function () {
        nav.classList.remove('open');
        toggle.setAttribute('aria-expanded', 'false');
      });
    });
  }

  // ---- Analytics events (pushed to GTM dataLayer; GTM fires the tags) ----
  // Phone-call clicks, WhatsApp clicks and "Get my offer" CTA clicks become
  // clean dataLayer events you can wire to Google Ads conversions in GTM.
  window.dataLayer = window.dataLayer || [];
  function track(name, extra) {
    var payload = { event: name };
    if (extra) { for (var k in extra) { payload[k] = extra[k]; } }
    window.dataLayer.push(payload);
  }
  document.addEventListener('click', function (e) {
    var a = e.target.closest && e.target.closest('a');
    if (!a) return;
    var href = a.getAttribute('href') || '';
    if (href.indexOf('tel:') === 0) {
      track('phone_click', { link_url: href });
    } else if (href.indexOf('wa.me') > -1 || href.indexOf('api.whatsapp.com') > -1) {
      track('whatsapp_click', { link_url: href });
    } else if (href.indexOf('/lp/pp-cash-offer') > -1) {
      track('get_offer_click', { link_url: href, link_text: (a.textContent || '').trim().slice(0, 60) });
    }
  });
})();
