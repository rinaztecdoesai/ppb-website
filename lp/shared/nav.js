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
    function closeSub() {   // collapse any open Services drill-down panel
      nav.querySelectorAll(".nav-sub-wrap.open").forEach(function (w) {
        w.classList.remove("open");
        var b = w.querySelector(".nav-sub-btn");
        if (b) b.setAttribute("aria-expanded", "false");
      });
    }
    function setMenu(open) {
      nav.classList.toggle("open", open);
      var t = nav.querySelector(".nav-toggle");
      if (t) {
        t.setAttribute("aria-expanded", open ? "true" : "false");
        t.setAttribute("aria-label", open ? "Close menu" : "Open menu");
      }
      if (!open) closeSub();   // always reopen on the main list, never mid-drill
      document.body.classList.toggle("nav-open", open);   // lock scroll while open
    }
    var toggle = nav.querySelector(".nav-toggle");
    if (toggle) {
      toggle.addEventListener("click", function () { setMenu(!nav.classList.contains("open")); });
    }
    nav.querySelectorAll(".nav-menu a").forEach(function (a) {
      a.addEventListener("click", function () {
        var href = a.getAttribute("href") || "";
        var base = href.split("#")[0];
        // Real internal page navigation (different page, same tab, not a modal)
        // → KEEP the overlay up + show a loader so the old page never flashes
        //   underneath while the next one loads. Everything else (same-page
        //   anchor, tel:/wa.me, modal, current page) just closes the menu.
        var internalNav = !a.hasAttribute("data-open-modal") && a.target !== "_blank"
                          && href.charAt(0) === "/" && base !== "" && base !== location.pathname;
        if (internalNav) {
          nav.classList.add("nav-loading");
          setTimeout(function () { nav.classList.remove("nav-loading"); }, 8000);  // safety if nav is cancelled
        } else {
          setMenu(false);
        }
      });
    });
    // Services dropdown: tap to expand inside the full-screen overlay.
    // Gate on the overlay being open (only true on mobile) rather than a
    // media query — desktop opens the panel on CSS hover instead.
    nav.querySelectorAll(".nav-sub-btn").forEach(function (btn) {
      btn.addEventListener("click", function (e) {
        if (nav.classList.contains("open")) {
          e.preventDefault();
          var wrap = btn.closest(".nav-sub-wrap");
          var open = wrap.classList.toggle("open");
          btn.setAttribute("aria-expanded", open ? "true" : "false");
        }
      });
    });
    // Inject a "Back" control into each Services drill-down panel (mobile only)
    nav.querySelectorAll(".nav-sub").forEach(function (sub) {
      if (sub.querySelector(".nav-sub-back")) return;
      var li = document.createElement("li");
      li.className = "nav-sub-back-li";
      li.innerHTML = '<button type="button" class="nav-sub-back" aria-label="Back to menu">' +
        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M15 18l-6-6 6-6"/></svg>Back</button>';
      sub.insertBefore(li, sub.firstChild);
      li.firstChild.addEventListener("click", function (e) { e.preventDefault(); e.stopPropagation(); closeSub(); });
    });
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && nav.classList.contains("open")) setMenu(false);
    });

    /* ---- thin sticky bar: inject once, then slide in on scroll ---- */
    if (!document.getElementById("stickyNav")) {
      var P = location.pathname;
      var cur = function (h) { return P.indexOf(h) === 0 ? ' aria-current="page"' : ""; };
      var home = (P === "/") ? ' aria-current="page"' : "";
      var SN =
        '<div class="sticky-nav" id="stickyNav" aria-hidden="true"><div class="sticky-inner">' +
          '<a class="sn-logo" href="/" aria-label="Prime Property Buyers — home">' +
            '<img src="/lp/shared/assets/logo.png?v=2" alt="Prime Property Buyers" width="128" height="41"></a>' +
          '<ul class="sn-menu">' +
            '<li><a href="/"' + home + ">Home</a></li>" +
            '<li class="nav-sub-wrap"><button type="button" class="nav-sub-btn" aria-expanded="false" aria-haspopup="true">Services <svg class="nav-caret" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9l6 6 6-6"/></svg></button>' +
              '<ul class="nav-sub">' +
                '<li><a href="/sell-your-house-fast/"><svg class="nav-sub-ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M13 2 3 14h9l-1 8 10-12h-9l1-8z"/></svg>Sell house fast</a></li>' +
                '<li><a href="/selling-inherited-property/"><svg class="nav-sub-ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><path d="M9 22V12h6v10"/></svg>Inherited property</a></li>' +
                '<li><a href="/stop-repossession/"><svg class="nav-sub-ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0Z"/><path d="M12 9v4m0 4h.01"/></svg>Stop repossession</a></li>' +
                '<li><a href="/selling-house-after-divorce/"><svg class="nav-sub-ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/></svg>Divorce or separation</a></li>' +
                '<li><a href="/selling-house-due-illness/"><svg class="nav-sub-ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>Ill health or care</a></li>' +
                '<li><a href="/selling-house-pay-debt/"><svg class="nav-sub-ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12V7H5a2 2 0 0 1 0-4h14v4"/><path d="M3 5v14a2 2 0 0 0 2 2h16v-5"/><path d="M18 12a2 2 0 0 0 0 4h4v-4z"/></svg>Financial difficulty</a></li>' +
                '<li><a href="/sell-former-buy-to-let/"><svg class="nav-sub-ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4"/></svg>Former buy-to-let</a></li>' +
              "</ul></li>" +
            '<li><a href="/important-advice/"' + cur("/important-advice/") + ">Important Advice</a></li>" +
            '<li><a href="/why-us/"' + cur("/why-us/") + ">Why Us</a></li>" +
            '<li><a href="/faqs/"' + cur("/faqs/") + ">FAQs</a></li>" +
            '<li><a href="/contact/"' + cur("/contact/") + ">Contact</a></li>" +
          "</ul>" +
          '<a class="sn-cta" href="/" data-open-modal="leadModal">Get my cash offer</a>' +
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
