/* =====================================================================
   Prime Property Buyers — SHARED SITE HEADER behaviour (every page).
   1) Full-screen mobile menu toggle (body-scroll-lock, Esc, close-on-tap)
   2) Injects the thin sticky bar + slides it in on scroll.
   Load this BEFORE script.js so the injected sticky CTA gets wired by
   script.js's setupModal() (which queries [data-open-modal] at call time).
   ===================================================================== */
(function () {
  function initNav() {
    var nav = document.querySelector(".site-nav");
    if (!nav) return;

    /* ---- full-screen mobile menu ---- */
    var toggle = nav.querySelector(".nav-toggle");
    if (toggle) {
      var setMenu = function (open) {
        nav.classList.toggle("open", open);
        toggle.setAttribute("aria-expanded", open ? "true" : "false");
        toggle.setAttribute("aria-label", open ? "Close menu" : "Open menu");
        document.body.classList.toggle("nav-open", open);   // lock scroll while open
      };
      toggle.addEventListener("click", function () {
        setMenu(!nav.classList.contains("open"));
      });
      nav.querySelectorAll(".nav-menu a").forEach(function (a) {
        a.addEventListener("click", function () { setMenu(false); });
      });
      document.addEventListener("keydown", function (e) {
        if (e.key === "Escape" && nav.classList.contains("open")) setMenu(false);
      });
    }

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
        "</div></div>";
      document.body.insertAdjacentHTML("beforeend", SN);
    }

    var sticky = document.getElementById("stickyNav");
    if (sticky) {
      var hero = document.querySelector(".hero");   // landing pages: trigger past the hero
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
