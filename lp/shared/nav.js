/* =====================================================================
   Prime Property Buyers — SHARED SITE HEADER behaviour (every page).
   1) Full-screen mobile menu (opened from the main header hamburger OR the
      sticky bar's hamburger; closed via the X, Esc, or tapping an item).
   2) Injects the thin sticky bar + slides it in on scroll. On mobile the
      sticky bar shows logo + phone (circle) + hamburger.
   Load this BEFORE script.js so the injected sticky CTA gets wired by
   script.js's setupModal() (which queries [data-open-modal] at call time).
   ===================================================================== */
(function () {
  var PHONE_SVG = '<svg viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></svg>';
  var MENU_SVG  = '<svg viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M3 12h18M3 6h18M3 18h18"/></svg>';

  function initNav() {
    var nav = document.querySelector(".site-nav");
    if (!nav) return;

    /* ---- full-screen mobile menu (shared open/close) ---- */
    function setMenu(open) {
      nav.classList.toggle("open", open);
      var t = nav.querySelector(".nav-toggle");
      if (t) {
        t.setAttribute("aria-expanded", open ? "true" : "false");
        t.setAttribute("aria-label", open ? "Close menu" : "Open menu");
      }
      document.body.classList.toggle("nav-open", open);   // lock scroll while open
    }
    var toggle = nav.querySelector(".nav-toggle");
    if (toggle) {
      toggle.addEventListener("click", function () { setMenu(!nav.classList.contains("open")); });
    }
    nav.querySelectorAll(".nav-menu a").forEach(function (a) {
      a.addEventListener("click", function () { setMenu(false); });
    });
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && nav.classList.contains("open")) setMenu(false);
    });

    /* ---- thin sticky bar: inject once, then slide in on scroll ---- */
    if (!document.getElementById("stickyNav")) {
      var P = location.pathname;
      var cur = function (h) { return P.indexOf(h) === 0 ? ' aria-current="page"' : ""; };
      var home = (P === "/" || P.indexOf("/lp/pp-cash-offer/") === 0) ? ' aria-current="page"' : "";
      var SN =
        '<div class="sticky-nav" id="stickyNav" aria-hidden="true"><div class="sticky-inner">' +
          '<a class="sn-logo" href="/lp/pp-cash-offer/" aria-label="Prime Property Buyers — home">' +
            '<img src="/lp/shared/assets/logo.png?v=2" alt="Prime Property Buyers" width="128" height="41"></a>' +
          '<ul class="sn-menu">' +
            '<li><a href="/lp/pp-cash-offer/"' + home + ">Home</a></li>" +
            '<li><a href="/important-advice/"' + cur("/important-advice/") + ">Important Advice</a></li>" +
            '<li><a href="/why-us/"' + cur("/why-us/") + ">Why Us</a></li>" +
            '<li><a href="/faqs/"' + cur("/faqs/") + ">FAQs</a></li>" +
            '<li><a href="/contact/"' + cur("/contact/") + ">Contact</a></li>" +
          "</ul>" +
          '<a class="sn-cta" href="/lp/pp-cash-offer/" data-open-modal="leadModal">Get my cash offer</a>' +
          '<a class="sn-phone" href="tel:08000122239" aria-label="Call 0800 0122 239">' + PHONE_SVG + "</a>" +
          '<button class="sn-toggle" type="button" aria-label="Open menu">' + MENU_SVG + "</button>" +
        "</div></div>";
      document.body.insertAdjacentHTML("beforeend", SN);
    }

    var sticky = document.getElementById("stickyNav");
    if (sticky) {
      var snToggle = sticky.querySelector(".sn-toggle");   // sticky-bar hamburger opens the full menu
      if (snToggle) snToggle.addEventListener("click", function () { setMenu(true); });

      var hero = document.querySelector(".hero");          // landing pages: trigger past the hero
      var update = function () {
        var trigger = hero ? (hero.offsetTop + hero.offsetHeight - 90) : ((nav.offsetHeight || 80) + 10);
        var show = window.pageYOffset > trigger;
        sticky.classList.toggle("show", show);
        sticky.setAttribute("aria-hidden", show ? "false" : "true");
      };
      window.addEventListener("scroll", update, { passive: true });
      window.addEventListener("resize", update, { passive: true });
      update();
    }
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", initNav);
  else initNav();
})();
