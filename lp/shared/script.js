/* =====================================================================
   Prime Property Buyers — Landing Page interactions
   - Scroll-reveal animations (Intersection Observer)
   - Animated counters (trust-strip numbers tick up when visible)
   - Multi-step lead form (postcode → details → contact → success)
   - UK postcode validation
   - Smooth scroll to form on CTA click
   - Form submit handler (configurable endpoint)
   - Ad-click tracking (gclid / kws / dyn_keyword → cookies → Zoho)
   ===================================================================== */


/* ═══════════════════════════════════════════════════════════════════
   AD-CLICK TRACKING — capture URL params on first hit, persist for
   the whole session so they ride along on the final lead POST.

   Why this exists: Google Ads ad URLs land on these landing pages with
   ?gclid=XXX&kws=YYY&dyn_keyword=ZZZ. If the user pokes around the page,
   clicks anchor links, opens the modal, etc., the URL might lose those
   params (depending on hash navigation, smooth-scroll, history.pushState).
   The WP site solves this with PHP $_REQUEST + hidden form fields on
   every step; landing pages are static HTML so we mirror it in JS via
   first-party cookies + sessionStorage. On sendLead() we read URL → cookie
   → sessionStorage in priority order and inject the three values into
   the JSON body. The WP REST endpoint (functions-chatbot-zoho-rest.php)
   then writes them to Zoho's Gclid1 / Custom_KWS / Search_Query fields,
   matching what form1-fields-step4.php already does for the WP form.

   Runs as an IIFE BEFORE DOMContentLoaded so capture happens the instant
   the script parses — even if Cookiebot or any other widget blocks
   later code, the cookies are already written.
   ═══════════════════════════════════════════════════════════════════ */
(function captureAdTrackingOnLoad() {
  try {
    var search = window.location.search;
    if (!search) return;
    var params = new URLSearchParams(search);
    var keys = ["gclid", "gbraid", "wbraid", "kws", "dyn_keyword",
                "utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content"];
    var ninetyDays = 90 * 24 * 60 * 60 * 1000;
    var expires = new Date(Date.now() + ninetyDays).toUTCString();
    keys.forEach(function (k) {
      var v = params.get(k);
      if (!v) return;
      // First-party cookie (90 days) on the current host + path=/
      document.cookie = "ppb_" + k + "=" + encodeURIComponent(v) +
                        "; expires=" + expires + "; path=/; SameSite=Lax";
      // sessionStorage as a belt-and-braces fallback for the current tab
      try { sessionStorage.setItem("ppb_" + k, v); } catch (e) {}
    });
  } catch (e) {
    // Tracking capture must never break the page. Silently swallow.
    if (window.console && console.warn) console.warn("[tracking] capture failed:", e);
  }
})();


/* Read a tracked value with URL → cookie → sessionStorage priority. */
function readTracking(key) {
  try {
    // 1. URL — freshest, wins if present
    var fromUrl = new URLSearchParams(window.location.search).get(key);
    if (fromUrl) return fromUrl;
    // 2. Cookie — survives across page loads + days
    var cookieMatch = document.cookie.match(new RegExp("(?:^|; )ppb_" + key + "=([^;]*)"));
    if (cookieMatch) return decodeURIComponent(cookieMatch[1]);
    // 3. sessionStorage — same-tab fallback if cookies are blocked
    var fromSession = sessionStorage.getItem("ppb_" + key);
    if (fromSession) return fromSession;
  } catch (e) {}
  return "";
}


/* Pull all tracked values into the shape expected by the WP REST endpoint.
   Field names (gclid, kws, search_query) match form1-fields-step4.php's
   $_REQUEST lookup so the same PHP-side handling can be reused. */
function getTrackingPayload() {
  return {
    gclid:        readTracking("gclid"),
    kws:          readTracking("kws"),
    // WP form maps URL param `dyn_keyword` → Zoho field `Search_Query`,
    // so we use the same key on the JSON body for consistency.
    search_query: readTracking("dyn_keyword"),
    // Bonus UTMs (not yet written to Zoho but the endpoint can pick them
    // up later without another JS deploy).
    utm_source:   readTracking("utm_source"),
    utm_medium:   readTracking("utm_medium"),
    utm_campaign: readTracking("utm_campaign"),
    utm_term:     readTracking("utm_term"),
    utm_content:  readTracking("utm_content"),
    // Newer iOS app conversion IDs — kept so Google Ads still attributes
    // when gclid is missing on iOS in-app browsers.
    gbraid:       readTracking("gbraid"),
    wbraid:       readTracking("wbraid"),
  };
}


document.addEventListener("DOMContentLoaded", () => {
  setupScrollReveal();
  setupCounters();
  setupLeadForm();
  setupSmoothScroll();
  setupCtaBar();
  setupModal();
});


/* ─── Scroll-reveal: elements with [data-reveal] fade-in when in view ─── */
function setupScrollReveal() {
  const els = document.querySelectorAll("[data-reveal]");
  if (!els.length || !("IntersectionObserver" in window)) {
    // Fallback: just show everything
    els.forEach(el => el.classList.add("is-visible"));
    return;
  }
  const io = new IntersectionObserver((entries) => {
    entries.forEach((entry, idx) => {
      if (entry.isIntersecting) {
        // Tiny stagger so siblings cascade in
        const delay = (idx % 3) * 80;
        entry.target.style.setProperty("--reveal-delay", `${delay}ms`);
        entry.target.classList.add("is-visible");
        io.unobserve(entry.target);
      }
    });
  }, { threshold: 0.12, rootMargin: "0px 0px -40px 0px" });
  els.forEach(el => io.observe(el));
}


/* ─── Animated counters: 0 → target when scrolled into view ─── */
function setupCounters() {
  const counters = document.querySelectorAll("[data-counter]");
  if (!counters.length || !("IntersectionObserver" in window)) {
    counters.forEach(el => {
      const target = parseInt(el.dataset.counter, 10);
      const suffix = el.dataset.suffix || "";
      el.textContent = target.toLocaleString() + suffix;
    });
    return;
  }
  const io = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      const el = entry.target;
      const target = parseInt(el.dataset.counter, 10);
      const suffix = el.dataset.suffix || "";
      const duration = 1600;
      const start = performance.now();
      const startVal = 0;
      function tick(now) {
        const t = Math.min(1, (now - start) / duration);
        // Ease-out cubic
        const eased = 1 - Math.pow(1 - t, 3);
        const val = Math.round(startVal + (target - startVal) * eased);
        el.textContent = val.toLocaleString() + suffix;
        if (t < 1) requestAnimationFrame(tick);
      }
      requestAnimationFrame(tick);
      io.unobserve(el);
    });
  }, { threshold: 0.5 });
  counters.forEach(el => io.observe(el));
}


/* ═══════════════════════════════════════════════════════════════════
   ANALYTICS HELPERS — same patterns as the live WordPress site.
   - toE164UK: normalises any UK phone number to +44XXXXXXXXXX
   - fireLead: sends Enhanced Conversions + dataLayer push + Lead event
   - trackEvent: simple wrapper around gtag('event', …) for funnel events
   Tags only fire if gtag is loaded AND user has consented (Consent Mode
   handles the gate automatically; denied = no-op).
   ═══════════════════════════════════════════════════════════════ */
function toE164UK(raw) {
  if (!raw) return "";
  var d = String(raw).replace(/\D/g, "");
  if (d.charAt(0) === "0") d = "44" + d.substring(1);
  else if (d.substring(0, 2) !== "44") d = "44" + d;
  return "+" + d;
}

// Render the mortgage_remaining state value for display in the summary.
// "0" means the user said "None (owned outright)" — show a clear English
// phrase rather than the bare number. Anything else shows verbatim (the
// user already typed it as e.g. "£120,000" or "180k").
function formatMortgageDisplay(val) {
  var s = (val == null ? "" : String(val)).trim();
  if (!s) return "Not provided";
  if (s === "0" || /^£?\s*0(\.0+)?$/.test(s)) return "Owned outright";
  return s;
}

// Strip a UK postcode (and trailing commas/whitespace) from the END of an
// address string. The PHP REST endpoint splits the composed address on
// commas and treats the LAST chunk as City — so if the postcode leaks
// into the address (via Fetchify's `summaryline`, the chatbot free-text
// fallback where the user types "8 The Courtyard, Witham, CM8 2FW", or
// any path that includes the postcode in the address), it ends up
// populated as City and the real town gets shoved into Street. The
// postcode is always sent separately as `postcode` in the JSON body, so
// scrubbing it out of `address` is purely additive — no data lost.
//
// UK postcode pattern (case-insensitive, optional space): GIR 0AA / W1A 1AA
// / SW1A 2AA / B33 8TH / etc. Anchored to end so we only strip a trailing
// postcode, not one weirdly mid-string.
function stripPostcodeSuffix(addr) {
  if (!addr) return "";
  var POSTCODE_RE = /,?\s*[A-Z]{1,2}[0-9][A-Z0-9]?\s*[0-9][A-Z]{2}\s*,?\s*$/i;
  return String(addr).replace(POSTCODE_RE, "").replace(/[,\s]+$/, "").trim();
}

// Human-friendly UK phone formatter for display: '+44 7712 345 678'.
// Same normalisation as toE164UK but with spacing. Stable to call on
// already-formatted values (idempotent).
function prettifyUKPhone(raw) {
  if (!raw) return "";
  var d = String(raw).replace(/\D/g, "");
  if (!d) return "";
  if (d.charAt(0) === "0") d = "44" + d.substring(1);
  else if (d.substring(0, 2) !== "44") d = "44" + d;
  var cc   = d.substring(0, 2);                 // 44
  var rest = d.substring(2);                    // up to 10 digits
  var out  = "+" + cc;
  if (rest.length > 0) out += " " + rest.substring(0, 4);
  if (rest.length > 4) out += " " + rest.substring(4, 7);
  if (rest.length > 7) out += " " + rest.substring(7);
  return out;
}

function fireLead(name, phone, email, source) {
  if (typeof gtag !== "function") return;
  var phoneE164  = toE164UK(phone);
  var emailClean = (email || "").trim().toLowerCase();

  // 1. Enhanced Conversions — Google reads these exact keys
  gtag("set", "user_data", {
    email: emailClean,
    phone_number: phoneE164
  });

  // 2. dataLayer push for any GTM-side tags
  window.dataLayer = window.dataLayer || [];
  window.dataLayer.push({
    event: "lead_submission",
    enhanced_conversion_data: { email: emailClean, phone_number: phoneE164 }
  });

  // 3. Existing Lead event (keeps current Ads/GA reports working)
  gtag("event", "Lead", {
    lead_name:      name || "",
    lead_phone:     phoneE164,
    lead_email:     emailClean,
    event_label:    "Form Submission",
    event_category: "Lead"
  });

  console.log("[Lead fired from " + source + "]", { name: name, phone: phoneE164, email: emailClean });
}

function trackEvent(eventName, params) {
  if (typeof gtag === "function") gtag("event", eventName, params || {});
  window.dataLayer = window.dataLayer || [];
  window.dataLayer.push(Object.assign({ event: eventName }, params || {}));
}


/* ─── Button loading state helper ────────────────────────────────
   Swaps a submit button into a "loading" state with a CSS spinner +
   rotating reassurance text. Used during the Zoho push (1-3s) so the
   user knows something is happening and doesn't double-click.

   Usage:
     const release = setButtonLoading(submitBtn, ["Sending…", "Almost done…"]);
     try { await sendLead(data); release.done("Sent ✓"); }
     catch (e) { release.error("Try again"); }
*/
function setButtonLoading(btn, phrases) {
  if (!btn) return { done: () => {}, error: () => {} };
  const originalHTML = btn.innerHTML;
  const originalDisabled = btn.disabled;
  btn.classList.add("is-loading");
  btn.disabled = true;

  // Build the loading content
  const loadingPhrases = phrases && phrases.length ? phrases : ["Sending…"];
  btn.innerHTML = `<span class="btn-spinner" aria-hidden="true"></span> <span class="btn-loading-text">${loadingPhrases[0]}</span>`;
  const textEl = btn.querySelector(".btn-loading-text");

  // Rotate phrases every 1.1s with a soft fade for less jank. Faster
  // than typical to ensure users see at least 2-3 phrases even on a
  // sub-2-second backend roundtrip.
  let i = 0;
  const rotateTimer = setInterval(() => {
    if (!textEl) return;
    i = (i + 1) % loadingPhrases.length;
    textEl.classList.add("is-swapping");
    setTimeout(() => {
      textEl.textContent = loadingPhrases[i];
      textEl.classList.remove("is-swapping");
    }, 180);
  }, 1100);

  function restore(text) {
    clearInterval(rotateTimer);
    btn.classList.remove("is-loading");
    btn.disabled = originalDisabled;
    if (text) {
      btn.textContent = text;
    } else {
      btn.innerHTML = originalHTML;
    }
  }

  return {
    done: (successText) => restore(successText),
    error: (errorText) => restore(errorText || "Try again"),
  };
}


/* ─── Postcode address lookup (Fetchify / CraftyClicks API) ───
   Same access token + endpoints as the live WordPress site. CORS-enabled
   so works directly from the browser. As the user types a valid UK
   postcode the .postcode-results dropdown populates; clicking a result
   fills the hidden address_line_1 / address_line_2 / locality fields
   and shows a green confirmation pill.
   Falls back gracefully: if the API is unavailable, the user can still
   submit with just the postcode. */
const FETCHIFY_KEY = "2bedc-a271a-32e8c-00ed4";
const FETCHIFY_FIND_URL = "https://api.craftyclicks.co.uk/address/1.1/find";
const FETCHIFY_RETRIEVE_URL = "https://api.craftyclicks.co.uk/address/1.1/retrieve";
const UK_POSTCODE = /^[A-Z]{1,2}\d[A-Z\d]?\s*\d[A-Z]{2}$/i;

async function fetchifyFind(query) {
  // max_results: 100 — Fetchify's default is small (typically 7 in
  // "predictive" mode); without this we were truncating big postcodes
  // (blocks of flats, busy terraces) to a handful of results so the
  // user couldn't find their house. 100 is the API's hard cap.
  const res = await fetch(FETCHIFY_FIND_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ key: FETCHIFY_KEY, query, country: "gbr", max_results: 100 }),
  });
  if (!res.ok) throw new Error(`Fetchify find failed (${res.status})`);
  return res.json();
}

async function fetchifyRetrieve(id) {
  const res = await fetch(FETCHIFY_RETRIEVE_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ key: FETCHIFY_KEY, id, country: "gbr" }),
  });
  if (!res.ok) throw new Error(`Fetchify retrieve failed (${res.status})`);
  return res.json();
}

function setupPostcodeLookup(form) {
  const input    = form.querySelector('[name="postcode"]');
  const wrapper  = form.querySelector(".field-with-lookup");
  if (!input || !wrapper) return;   // form without the lookup markup

  // Make sure the single module-level outside-click listener is attached
  bindOutsideClickOnce();

  const results  = wrapper.querySelector("[data-postcode-results]");
  const spinner  = wrapper.querySelector("[data-postcode-spinner]");
  const line1    = wrapper.querySelector("[data-address-line1]");
  const line2    = wrapper.querySelector("[data-address-line2]");
  const locality = wrapper.querySelector("[data-address-locality]");
  const confirmed     = wrapper.querySelector("[data-address-confirmed]");
  const confirmedText = wrapper.querySelector("[data-address-confirmed-text]");
  const manualPanel   = wrapper.querySelector("[data-address-manual]");
  const manualLine1   = wrapper.querySelector("[data-manual-line1]");
  const manualTown    = wrapper.querySelector("[data-manual-town]");
  const manualApplyBtn= wrapper.querySelector("[data-use-manual]");
  const stage1Btn     = form.querySelector('[data-next="1"]');
  const submitHint    = form.querySelector('[data-submit-hint]');
  const submitTo      = form.dataset.submitTo;   // hand-off URL (optional)

  function showManualFallback(reason) {
    if (!manualPanel) return;
    manualPanel.hidden = false;
    // Track that we had to fall back (signal for the team — Fetchify may
    // be missing coverage for this postcode)
    trackEvent("address_manual_fallback_shown", {
      postcode: input.value || "",
      reason: reason || "unknown",
      form_id: form.id || ""
    });
  }
  function hideManualFallback() {
    if (manualPanel) manualPanel.hidden = true;
  }

  // CREDIT-SAFE PATTERN — debounced auto-search on input, with a dedupe
  // cache so re-typing the same postcode doesn't re-hit the API. Same
  // approach the live WordPress site uses after the credit-burn fix.
  let lastSearched = "";
  let busy = false;
  let debounceTimer = null;

  // Session-scoped state cache — restores postcode + address selection if
  // the user navigates to /middle-form/ and hits back. sessionStorage (not
  // localStorage) so the data clears when the tab closes — privacy-safer.
  const STATE_KEY = "ppb_landing_form_state_" + (form.id || "form");

  function saveFormState() {
    if (!(line1 && line1.value)) return;  // only save once an address is picked
    try {
      sessionStorage.setItem(STATE_KEY, JSON.stringify({
        postcode: input.value || "",
        line1:    line1.value || "",
        line2:    (line2 && line2.value) || "",
        locality: (locality && locality.value) || "",
        label:    (confirmedText && confirmedText.textContent) || ""
      }));
    } catch (e) {}
  }

  function clearFormState() {
    try { sessionStorage.removeItem(STATE_KEY); } catch (e) {}
  }

  function restoreFormState() {
    try {
      const raw = sessionStorage.getItem(STATE_KEY);
      if (!raw) return;
      const state = JSON.parse(raw);
      if (!state.postcode || !state.line1) return;
      input.value = state.postcode;
      if (line1)    line1.value    = state.line1;
      if (line2)    line2.value    = state.line2;
      if (locality) locality.value = state.locality;
      if (confirmedText) confirmedText.textContent = state.label || state.line1;
      if (confirmed) confirmed.hidden = false;
      lastSearched = state.postcode.toUpperCase();  // dedupe future searches
    } catch (e) {}
  }

  function clearAddress() {
    if (line1)    line1.value = "";
    if (line2)    line2.value = "";
    if (locality) locality.value = "";
    if (confirmed) confirmed.hidden = true;
    hideManualFallback();
    if (manualLine1) manualLine1.value = "";
    if (manualTown)  manualTown.value  = "";
    clearFormState();   // wipe the session cache too
  }

  // "Use this address" button on the manual fallback panel — populates
  // the same hidden fields a Fetchify pick would have set, shows the
  // green confirmation pill, then auto-redirects just like a normal pick.
  if (manualApplyBtn) {
    manualApplyBtn.addEventListener("click", function () {
      const ml1 = (manualLine1 && manualLine1.value || "").trim();
      const mtown = (manualTown && manualTown.value || "").trim();
      if (!ml1) {
        if (manualLine1) manualLine1.focus();
        return;
      }
      const v = input.value.trim();
      // Build the same formatted string the API would return
      const formatted = [ml1, mtown, v].filter(Boolean).join(", ");
      if (line1)    line1.value    = ml1;
      if (line2)    line2.value    = "";
      if (locality) locality.value = mtown;
      if (confirmedText) confirmedText.textContent = formatted;
      if (confirmed) confirmed.hidden = false;
      hideManualFallback();
      results.hidden = true;
      const errEl = form.querySelector('[data-error-for="postcode"]');
      if (errEl) errEl.textContent = "";
      saveFormState();
      trackEvent("address_selected", {
        postcode: v,
        form_id:  form.id || "",
        method:   "manual_entry"
      });

      // Auto-redirect just like a normal pick (only for hand-off forms)
      if (submitTo) {
        setTimeout(function () {
          if (!(line1 && line1.value)) return;   // bail if user cleared in the meantime
          const params = new URLSearchParams();
          params.set("postcode", v);
          params.set("line1", ml1);
          params.set("line2", "");
          params.set("locality", mtown);
          params.set("source", "landing-page");
          // Carry ad-click tracking through the redirect to /middle-form/ so
          // the WP form picks up gclid/kws/dyn_keyword in $_REQUEST.
          var _gclid = readTracking("gclid");
          var _kws   = readTracking("kws");
          var _dynkw = readTracking("dyn_keyword");
          if (_gclid) params.set("gclid", _gclid);
          if (_kws)   params.set("kws",   _kws);
          if (_dynkw) params.set("dyn_keyword", _dynkw);
          trackEvent("lead_handoff_to_middleform", {
            postcode: v, destination: submitTo, form_id: form.id || "",
            trigger: "manual-entry"
          });
          window.location.href = submitTo + (submitTo.includes("?") ? "&" : "?") + params.toString();
        }, 450);
      }
    });
  }

  // Flash the results dropdown to draw the user's eye when they click the
  // button before picking an address. Removed after the animation runs.
  function flashResults() {
    if (!results || results.hidden) return;
    results.classList.remove("is-flash");
    void results.offsetWidth;  // restart the CSS animation
    results.classList.add("is-flash");
  }

  function setBusy(state) {
    busy = state;
    if (spinner) spinner.classList.toggle("is-visible", state);
  }

  function renderResults(items) {
    results.innerHTML = "";
    if (!items || !items.length) {
      results.hidden = true;
      return;
    }
    // No artificial cap — show every result Fetchify returned (server
    // is now capped at max_results: 100). Removed the old slice(0, 15)
    // because users were missing their address on big postcodes (flats,
    // busy terraces). UL has overflow-y so a long list still scrolls.
    items.forEach((item) => {
      const li = document.createElement("li");
      li.className = "pc-result";
      li.setAttribute("role", "option");
      li.tabIndex = 0;
      li.dataset.id = item.id;
      li.textContent = Array.isArray(item.labels) ? item.labels.join(", ") : (item.text || "");
      results.appendChild(li);
    });
    // Persistent "Can't find your address? Enter manually" footer link
    // appended to every result list. Lets the user fall back to manual
    // entry even when Fetchify DID return results (just not theirs) —
    // previously the manual panel only opened on 0 results / API error.
    // Different className so the existing .pc-result click handler
    // (which calls runRetrieve) ignores it.
    if (manualPanel) {
      const fb = document.createElement("li");
      fb.className = "pc-result-fallback";
      fb.setAttribute("role", "option");
      fb.tabIndex = 0;
      fb.textContent = "Can't find your address? Enter it manually →";
      fb.style.cssText = "padding:10px 12px;color:#0a64f1;font-weight:600;cursor:pointer;border-top:1px solid #e5e7eb;background:#f8fafc";
      const openManual = function () {
        results.hidden = true;
        showManualFallback("user_clicked");
        if (manualLine1) {
          // tiny delay so the panel is unhidden before focus call
          setTimeout(function () { manualLine1.focus(); }, 0);
        }
      };
      fb.addEventListener("click", openManual);
      fb.addEventListener("keydown", function (e) {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          openManual();
        }
      });
      results.appendChild(fb);
    }
    results.hidden = false;
  }

  async function runFind(query) {
    if (busy) return;
    setBusy(true);
    console.log("[postcode-lookup] firing find for:", query);
    try {
      const data = await fetchifyFind(query);
      console.log("[postcode-lookup] got response:", data);
      const items = data.results || [];
      renderResults(items);
      const errEl = form.querySelector('[data-error-for="postcode"]');
      if (items.length) {
        // Got results — clear any prior error + hide the manual fallback
        if (errEl) errEl.textContent = "";
        hideManualFallback();
      } else {
        // No matches at all → show the manual entry fallback
        if (errEl) errEl.textContent = "We couldn't find addresses for that postcode. Enter your address manually below.";
        showManualFallback("no_results");
      }
    } catch (err) {
      console.error("[postcode-lookup] find threw:", err);
      results.hidden = true;
      // Network / API failure → also surface the manual fallback so the
      // user isn't blocked by anything outside their control.
      const errEl = form.querySelector('[data-error-for="postcode"]');
      if (errEl) errEl.textContent = "Address lookup unavailable. Enter your address manually below.";
      showManualFallback("api_error");
    } finally {
      setBusy(false);
    }
  }

  async function runRetrieve(id, displayText) {
    setBusy(true);
    try {
      const data = await fetchifyRetrieve(id);
      const r = data.result || {};
      if (line1)    line1.value    = r.line_1 || "";
      if (line2)    line2.value    = r.line_2 || "";
      // Prefer Fetchify's `town_or_city` (the actual town name like "Witham")
      // over `locality` (the sub-locality / district — often empty) or
      // `province_name` (the county like "Essex", not what Zoho wants in City).
      // The chatbot path uses the same `town_or_city` field; this keeps the
      // two paths consistent so City always lands the town name.
      if (locality) locality.value = r.town_or_city || r.locality || r.province_name || "";
      if (r.postal_code) input.value = r.postal_code;  // canonicalise format
      if (confirmedText) confirmedText.textContent = displayText;
      if (confirmed) confirmed.hidden = false;
      results.hidden = true;
      // Clear any previous postcode error
      const errEl = form.querySelector('[data-error-for="postcode"]');
      if (errEl) errEl.textContent = "";
      // Persist so back-button from /middle-form/ keeps the selection
      saveFormState();
      // Funnel event: user got far enough to confirm an address (high intent)
      trackEvent("address_selected", {
        postcode: input.value || "",
        form_id:  form.id || ""
      });

      // AUTO-ADVANCE — if the form has a hand-off URL (hero form on
      // landing page), redirect to /middle-form/ a beat after the user
      // picks an address. 450ms gives the green pill time to flash so
      // the user sees their selection registered. The button stays
      // visible during the delay as a manual fallback / for keyboard
      // users who'd rather click it themselves.
      if (submitTo) {
        setTimeout(function () {
          // Bail if the user has already cleared the address in those 450ms
          if (!line1.value) return;
          const params = new URLSearchParams();
          params.set("postcode", input.value.trim());
          params.set("line1", line1.value || "");
          params.set("line2", (line2 && line2.value) || "");
          params.set("locality", (locality && locality.value) || "");
          params.set("source", "landing-page");
          // Carry ad-click tracking through the redirect so the WP form's
          // $_REQUEST['gclid'] / 'kws' / 'dyn_keyword' picks them up and
          // writes to Zoho's Gclid1 / Custom_KWS / Search_Query fields.
          // Without this hop the landing page's cookie-captured gclid never
          // reaches the WP form path. Only set when populated so we don't
          // pollute clean URLs with empty params.
          var _gclid = readTracking("gclid");
          var _kws   = readTracking("kws");
          var _dynkw = readTracking("dyn_keyword");
          if (_gclid) params.set("gclid", _gclid);
          if (_kws)   params.set("kws",   _kws);
          if (_dynkw) params.set("dyn_keyword", _dynkw);
          trackEvent("lead_handoff_to_middleform", {
            postcode: input.value.trim(),
            destination: submitTo,
            form_id: form.id || "",
            trigger: "auto-after-pick"
          });
          window.location.href = submitTo + (submitTo.includes("?") ? "&" : "?") + params.toString();
        }, 450);
      }
    } catch (err) {
      console.error("[postcode-lookup] retrieve failed:", err);
    } finally {
      setBusy(false);
    }
  }

  // Typing the postcode → debounced auto-search. Any change after an
  // address was selected wipes the selection (re-locks the button).
  input.addEventListener("input", () => {
    if (line1 && line1.value) clearAddress();
    clearTimeout(debounceTimer);
    const value = input.value.trim();
    if (!UK_POSTCODE.test(value)) {
      results.hidden = true;
      return;
    }
    if (value.toUpperCase() === lastSearched) return;  // dedupe
    lastSearched = value.toUpperCase();
    // 320ms gives the user time to finish typing → 1 API call per postcode
    debounceTimer = setTimeout(() => runFind(value), 320);
  });

  // Enter inside postcode field → fire the search immediately (no wait)
  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      clearTimeout(debounceTimer);
      const v = input.value.trim();
      if (UK_POSTCODE.test(v) && v.toUpperCase() !== lastSearched) {
        lastSearched = v.toUpperCase();
        runFind(v);
      }
    }
  });

  // Stage-1 button click → smart prompts based on what's missing.
  // Button is ALWAYS clickable; this handler steers the user instead
  // of greying out (which feels broken to people who don't notice why).
  if (stage1Btn) {
    stage1Btn.addEventListener("click", async (e) => {
      const v = input.value.trim();
      const errEl = form.querySelector('[data-error-for="postcode"]');
      const hasAddress = line1 && line1.value;

      // 1. No postcode at all
      if (!v) {
        e.stopImmediatePropagation();
        e.preventDefault();
        if (errEl) errEl.textContent = "Please enter your postcode to continue.";
        input.focus();
        return;
      }

      // 2. Postcode entered but format is wrong
      if (!UK_POSTCODE.test(v)) {
        e.stopImmediatePropagation();
        e.preventDefault();
        if (errEl) errEl.textContent = "Please enter a valid UK postcode (e.g. SW1A 1AA).";
        input.focus();
        return;
      }

      // 3. Valid postcode, address already picked → proceed
      if (hasAddress) {
        if (submitTo) {
          // Hand-off form (hero): redirect to /middle-form/ with captured data
          e.stopImmediatePropagation();
          e.preventDefault();
          if (errEl) errEl.textContent = "";
          const params = new URLSearchParams();
          params.set("postcode", v);
          params.set("line1", line1.value || "");
          params.set("line2", (line2 && line2.value) || "");
          params.set("locality", (locality && locality.value) || "");
          params.set("source", "landing-page");
          // Carry ad-click tracking through the redirect so the WP form's
          // $_REQUEST['gclid'] / 'kws' / 'dyn_keyword' picks them up.
          var _gclid = readTracking("gclid");
          var _kws   = readTracking("kws");
          var _dynkw = readTracking("dyn_keyword");
          if (_gclid) params.set("gclid", _gclid);
          if (_kws)   params.set("kws",   _kws);
          if (_dynkw) params.set("dyn_keyword", _dynkw);
          // Fire handoff event BEFORE navigating (use sendBeacon-safe pattern)
          trackEvent("lead_handoff_to_middleform", {
            postcode: v,
            destination: submitTo,
            form_id: form.id || ""
          });
          window.location.href = submitTo + (submitTo.includes("?") ? "&" : "?") + params.toString();
          return;
        }
        // In-page form (modal): let the generic data-next handler advance
        return;
      }

      // 4. Valid postcode, no address picked yet
      e.stopImmediatePropagation();
      e.preventDefault();

      // 4a. Results already showing → ask them to pick one
      if (!results.hidden && results.children.length) {
        if (errEl) errEl.textContent = "Please choose your address from the list above.";
        flashResults();
        return;
      }

      // 4b. Manual fallback already showing → nudge them to fill it
      if (manualPanel && !manualPanel.hidden) {
        if (errEl) errEl.textContent = "Enter your address manually below to continue.";
        if (manualLine1) manualLine1.focus();
        return;
      }

      // 4c. Dropdown isn't visible — RETRY the search even if same query.
      // This is the "give me my dropdown back" path: user clicked away,
      // closed it accidentally, or it never appeared. Force a re-fire by
      // resetting the dedupe cache.
      lastSearched = "";
      await runFind(v);

      // Tell them what to do next once the dropdown is open (or the
      // manual fallback appeared after a no-results response)
      if (!results.hidden && results.children.length) {
        if (errEl) errEl.textContent = "Now choose your address from the list above.";
        flashResults();
      }
    }, true);
  }

  // Click a result → retrieve full address (unlocks the button)
  results.addEventListener("click", (e) => {
    const li = e.target.closest(".pc-result");
    if (!li) return;
    runRetrieve(li.dataset.id, li.textContent);
  });

  // Keyboard support: Enter selects highlighted result
  results.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && e.target.matches(".pc-result")) {
      e.preventDefault();
      runRetrieve(e.target.dataset.id, e.target.textContent);
    }
  });

  // "Change" button on the confirmation pill → wipe selection, refocus input
  wrapper.addEventListener("click", (e) => {
    if (e.target.matches("[data-clear-address]")) {
      clearAddress();
      input.focus();
      input.select();
    }
  });

  // Restore previous selection if the user is returning via back button
  restoreFormState();
}

// Single document-level listener — hides ANY visible postcode-results
// dropdown when the user clicks outside its wrapper. Registered ONCE
// at module level so we don't leak a listener per form instance.
let __ppbOutsideClickBound = false;
function bindOutsideClickOnce() {
  if (__ppbOutsideClickBound) return;
  __ppbOutsideClickBound = true;
  document.addEventListener("click", function (e) {
    document.querySelectorAll(".field-with-lookup").forEach(function (wrap) {
      if (wrap.contains(e.target)) return;
      const r = wrap.querySelector("[data-postcode-results]");
      if (r) r.hidden = true;
    });
  }, { passive: true });
}


/* ─── Multi-step lead form ─── */
function setupLeadForm() {
  // Wire up every .lead-form on the page (hero form + modal form).
  document.querySelectorAll(".lead-form").forEach(setupLeadFormInstance);
}

function setupLeadFormInstance(form) {
  if (!form) return;

  // Postcode address lookup (Fetchify / CraftyClicks API)
  setupPostcodeLookup(form);

  // Stage navigation (Continue / Back buttons)
  form.querySelectorAll("[data-next]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const currentStage = parseInt(btn.dataset.next, 10);
      if (validateStage(form, currentStage)) {
        goToStage(form, currentStage + 1);
      }
    });
  });
  form.querySelectorAll("[data-prev]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const currentStage = parseInt(btn.dataset.prev, 10);
      goToStage(form, currentStage - 1);
    });
  });

  // Final submit
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (!validateStage(form, 3)) return;
    const submitBtn = form.querySelector('button[type="submit"]');

    // Rotating reassurance phrases — load-bearing UX: keeps the user
    // engaged during the 1-3s Zoho push, reinforces value props, and
    // signals progress rather than just "waiting".
    const loader = setButtonLoading(submitBtn, [
      "Generating your free cash offer…",
      "Looking up your property…",
      "Checking the local market…",
      "Finding the best price for you…",
      "Free, no obligation. Almost ready…",
      "We'll be in touch within 24 hours…",
    ]);

    const raw = Object.fromEntries(new FormData(form));

    // ─── Transform raw FormData → shape the PHP REST endpoint expects ─────
    // The endpoint (functions-chatbot-zoho-rest.php) expects first_name +
    // last_name (Zoho REQUIRES last_name), and a single composed `address`
    // string. Until this transform was added, every modal submit hit a 400
    // "last_name required" and silently failed for the user.
    const rawName = (raw.name || raw.fullname || "").trim().replace(/\s+/g, " ");
    const nameParts = rawName ? rawName.split(" ") : [];
    const first_name = nameParts[0] || "";
    const last_name  = nameParts.length >= 2 ? nameParts.slice(1).join(" ") : "";

    // Compose `address` from the Fetchify hidden fields. Same convention
    // as the chatbot: "<line1>, <line2>, <town>" with the postcode held
    // separately in `postcode` so PHP / Zoho can split into Street + City.
    // Defensive: strip any trailing postcode in case Fetchify's locality
    // field (or a manual-entry typo) leaks the postcode into the address.
    const addressParts = [raw.address_line_1, raw.address_line_2, raw.locality]
      .map((s) => (s || "").trim())
      .filter(Boolean);
    const address = stripPostcodeSuffix(addressParts.join(", "));

    const data = {
      ...raw,
      // Replace `name` (which PHP ignores) with the split fields it needs.
      first_name,
      last_name,
      name: rawName,                  // kept for analytics / GTM tag
      address,                        // composed full string for PHP
      // Pass condition through so the PHP endpoint can mention it in the
      // Description text. (No matching Zoho field today, but it surfaces
      // in the lead's notes blob so the sales team sees it.)
      condition: raw.condition || "",
    };

    // Tag the source so the WP endpoint maps to Lead_Source = "PPB LP"
    if (!data.source) data.source = "landing-popup";

    // Fire Enhanced Conversions + Lead event BEFORE the async submit so
    // the tag fires even if the network call is slow.
    fireLead(rawName, data.phone || "", data.email || "", "modal-submit");

    // Stash for any thank-you page that might re-fire the tag
    try {
      sessionStorage.setItem("lead_name",  rawName);
      sessionStorage.setItem("lead_phone", data.phone || "");
      sessionStorage.setItem("lead_email", data.email || "");
    } catch (err) {}

    try {
      await sendLead(data);
      loader.done();   // restore button (we're about to swap to success stage)
      goToStage(form, "success");
    } catch (err) {
      loader.error("Try again");
      console.error("Lead submission failed:", err);
      alert("Sorry, something went wrong. Please call us on 0800 0122 239.");
    }
  });
}

function goToStage(form, stage) {
  form.querySelectorAll(".stage").forEach((s) => s.classList.remove("stage-active"));
  const target = form.querySelector(`[data-stage="${stage}"]`);
  if (target) target.classList.add("stage-active");

  // Mirror current stage onto the form element so CSS can react
  // (e.g. hide form-progress on stage 1 — the postcode-only entry view).
  form.dataset.stage = String(stage);

  // Update progress dots
  const steps = form.querySelectorAll(".form-progress .step");
  const lines = form.querySelectorAll(".form-progress .step-line");
  steps.forEach((s) => s.classList.remove("active", "done"));
  lines.forEach((l) => l.classList.remove("done"));
  if (typeof stage === "number") {
    steps.forEach((s, idx) => {
      const stepNum = idx + 1;
      if (stepNum < stage) s.classList.add("done");
      else if (stepNum === stage) s.classList.add("active");
    });
    lines.forEach((l, idx) => {
      if (idx + 1 < stage) l.classList.add("done");
    });
  } else if (stage === "success") {
    // All steps done
    steps.forEach((s) => s.classList.add("done"));
    lines.forEach((l) => l.classList.add("done"));
  }
}

function validateStage(form, stage) {
  // Clear any previous errors
  form.querySelectorAll(".field-error").forEach((e) => (e.textContent = ""));
  let valid = true;

  if (stage === 1) {
    const pc = form.querySelector('[name="postcode"]');
    const v = (pc.value || "").trim().toUpperCase();
    // Loose UK postcode regex — accepts most variants with/without space
    const ok = /^[A-Z]{1,2}\d[A-Z\d]?\s*\d[A-Z]{2}$/.test(v);
    if (!ok) {
      setError(form, "postcode", "Please enter a valid UK postcode (e.g. SW1A 1AA)");
      pc.focus();
      valid = false;
    } else {
      // Normalise spacing
      pc.value = v.replace(/\s+/g, " ").replace(/^(.*)(\d[A-Z]{2})$/, "$1 $2").replace(/\s+/g, " ").trim();
    }
  } else if (stage === 2) {
    ["property_type", "bedrooms", "condition"].forEach((name) => {
      const el = form.querySelector(`[name="${name}"]`);
      if (!el.value) {
        el.style.borderColor = "#c0392b";
        valid = false;
      } else {
        el.style.borderColor = "";
      }
    });
  } else if (stage === 3) {
    ["name", "phone"].forEach((name) => {
      const el = form.querySelector(`[name="${name}"]`);
      if (!el.value.trim()) {
        el.style.borderColor = "#c0392b";
        valid = false;
      } else {
        el.style.borderColor = "";
      }
    });
    const phone = (form.querySelector('[name="phone"]').value || "").replace(/\s+/g, "");
    if (phone && !/^(\+?44|0)\d{9,11}$/.test(phone)) {
      const el = form.querySelector('[name="phone"]');
      el.style.borderColor = "#c0392b";
      valid = false;
    }
  }
  return valid;
}

function setError(form, fieldName, msg) {
  const errEl = form.querySelector(`[data-error-for="${fieldName}"]`);
  if (errEl) errEl.textContent = msg;
}

/* ─── Lead submission ───────────────────────────────────────────────
   Replace this with your real lead endpoint. Examples:
   - WordPress: fetch('/wp-admin/admin-ajax.php', { method:'POST', body: ... })
   - Zoho webhook: fetch('https://flow.zoho.com/.../webhook/...', ...)
   - Your FastAPI: fetch('https://your-app.sevalla.app/api/lead', ...)
   For now, this is a stub that simulates a 1.2s network call.
   ─────────────────────────────────────────────────────────────────── */
async function sendLead(data) {
  // POST to the Sevalla PHP lead backend, reached via the SAME-ORIGIN path
  // /api/lead (a _redirects proxy forwards /api/* to the backend). Token
  // refresh + OAuth all happen server-side. The frontend just hands over
  // JSON and gets back {ok: true, id: "..."} or {ok: false, error: "..."}.
  //
  // The backend dispatches on the JSON "action" field. Both the chatbot
  // (source:"chatbot") and the landing-popup form (source:"landing-popup")
  // use the "chatbot" action — Lead::chatbot() maps the Lead_Source label
  // from `source` (PPB CB / PPB CB Abandoned / PPB LP).
  const ENDPOINT = "/api/lead";

  // Stitch in ad-tracking values captured on page load (URL → cookie →
  // sessionStorage). These get written to Zoho's $gclid / Custom_KWS /
  // Search_Query fields by the backend. Caller-supplied values still win
  // in case they want to override (e.g. testing).
  const tracking = getTrackingPayload();
  const enrichedData = Object.assign({ action: "chatbot" }, tracking, data);
  if (!enrichedData.action) enrichedData.action = "chatbot";

  console.log("Lead submitting:", {
    source: enrichedData.source,
    name:   enrichedData.name,
    gclid:  enrichedData.gclid || "(none)",
    kws:    enrichedData.kws   || "(none)",
  });

  let res;
  try {
    res = await fetch(ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(enrichedData),
    });
  } catch (e) {
    // Network failure — surface to the caller so it can show the user a
    // friendly fallback ("call us on 0800...")
    throw new Error("Network error: " + e.message);
  }

  let payload = null;
  try { payload = await res.json(); } catch (e) { /* might not be JSON */ }

  if (!res.ok || !payload || payload.ok === false) {
    const reason = (payload && payload.error) || `HTTP ${res.status}`;
    console.warn("Lead submit failed:", reason);
    throw new Error(reason);
  }

  console.log("Lead created in Zoho:", payload.id || payload.zoho_id);
  return payload;
}


/* ─── Smooth scroll to lead form when CTA clicked ─── */
function setupSmoothScroll() {
  document.querySelectorAll("[data-scroll-to]").forEach((el) => {
    el.addEventListener("click", (e) => {
      e.preventDefault();
      const target = document.getElementById(el.dataset.scrollTo);
      if (target) {
        target.scrollIntoView({ behavior: "smooth", block: "center" });
        // Pulse the form to draw the eye
        target.style.transition = "transform .4s cubic-bezier(.18,.89,.32,1.28), box-shadow .4s";
        target.style.transform = "scale(1.02)";
        setTimeout(() => { target.style.transform = ""; }, 400);
        // Focus the first input
        setTimeout(() => {
          const firstInput = target.querySelector(".stage-active input, .stage-active select");
          if (firstInput) firstInput.focus();
        }, 600);
      }
    });
  });
}


/* ─── Slide-up CTA bar ──────────────────────────────────────────────────────
   When the hero lead form scrolls out of view, the bottom CTA bar slides up
   from the viewport floor so users always have a visible call-to-action.
   When the form scrolls back into view (or the success state is visible),
   the bar slides back down. Uses Intersection Observer for performance.
   ─────────────────────────────────────────────────────────────────────────── */
function setupCtaBar() {
  const bar = document.getElementById("ctaBar");
  const form = document.getElementById("leadForm");
  if (!bar || !form || !("IntersectionObserver" in window)) return;

  const io = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        // Hide bar when form is at least partly visible; show when form is gone
        if (entry.isIntersecting) {
          bar.classList.remove("is-visible");
          bar.setAttribute("aria-hidden", "true");
        } else {
          bar.classList.add("is-visible");
          bar.setAttribute("aria-hidden", "false");
        }
      });
    },
    {
      // Form needs at least 25% visible to count as "in view" — gives us a
      // small dead-zone so the bar doesn't flicker right at the edge.
      threshold: 0.25,
      rootMargin: "0px 0px -60px 0px",
    }
  );
  io.observe(form);
}


/* ─── Modal (popup form) ────────────────────────────────────────────────────
   Opens when any element with [data-open-modal="leadModal"] is clicked.
   Closes via X button, ESC key, or backdrop click. Locks page scroll while
   open, restores focus to the trigger when closed.
   ─────────────────────────────────────────────────────────────────────────── */
function setupModal() {
  const modal = document.getElementById("leadModal");
  if (!modal) return;

  let lastTrigger = null;

  function openModal(trigger) {
    lastTrigger = trigger || null;
    modal.classList.add("is-open");
    modal.setAttribute("aria-hidden", "false");
    document.body.classList.add("modal-open");
    // Focus the first input after the open animation
    setTimeout(() => {
      const first = modal.querySelector(".stage-active input, .stage-active select");
      if (first) first.focus();
    }, 220);
  }

  function closeModal() {
    modal.classList.remove("is-open");
    modal.setAttribute("aria-hidden", "true");
    document.body.classList.remove("modal-open");
    // Reset modal form to stage 1 so next open is clean
    const modalForm = modal.querySelector(".lead-form");
    if (modalForm) {
      // Reset visually only — values stay so user can recover if they
      // closed by accident. To clear values too, uncomment the reset:
      // modalForm.reset();
      const stages = modalForm.querySelectorAll(".stage");
      stages.forEach((s) => s.classList.remove("stage-active"));
      const stage1 = modalForm.querySelector('[data-stage="1"]');
      if (stage1) stage1.classList.add("stage-active");
      modalForm.dataset.stage = "1";
    }
    // Restore focus to whatever opened the modal
    if (lastTrigger && typeof lastTrigger.focus === "function") {
      lastTrigger.focus();
    }
  }

  // Open from any [data-open-modal="leadModal"] trigger
  document.querySelectorAll('[data-open-modal="leadModal"]').forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.preventDefault();
      openModal(btn);
    });
  });

  // Close from X, backdrop, or any [data-close-modal] inside modal
  modal.querySelectorAll("[data-close-modal]").forEach((el) => {
    el.addEventListener("click", (e) => {
      e.preventDefault();
      closeModal();
    });
  });

  // ESC key closes modal
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && modal.classList.contains("is-open")) {
      closeModal();
    }
  });
}


/* ─── Video facade: click thumbnail → swap in autoplay iframe ───────────
   Avoids loading the YouTube iframe on initial page load (fast first paint),
   AND keeps playback inline instead of opening YouTube externally.
   The anchor's href stays as a fallback if the iframe is blocked.
   ─────────────────────────────────────────────────────────────────────── */
function setupVideoFacades() {
  document.querySelectorAll("[data-yt-id]").forEach((card) => {
    card.addEventListener("click", (e) => {
      e.preventDefault();
      const id = card.dataset.ytId;
      const thumb = card.querySelector(".video-thumb");
      if (!id || !thumb) return;
      // Replace the thumbnail with an autoplaying iframe in the same box
      thumb.innerHTML = `
        <iframe
          src="https://www.youtube.com/embed/${id}?autoplay=1&rel=0&modestbranding=1"
          title="Video player"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
          allowfullscreen
          referrerpolicy="strict-origin-when-cross-origin"
          style="position:absolute;inset:0;width:100%;height:100%;border:0;">
        </iframe>
      `;
      thumb.style.position = "relative";
    });
  });
}


/* ─── Modal trigger headline override ───────────────────────────────────────
   When an element with [data-modal-title] opens the lead modal, swap the
   modal's headline to that custom title so the form feels personalised
   ("Selling an inherited property?" instead of "Get your cash offer").
   This hooks into setupModal's open trigger via a small listener that runs
   BEFORE the open is fired (capture-phase listener).
   ─────────────────────────────────────────────────────────────────────────── */
function setupModalTitleOverride() {
  const modal = document.getElementById("leadModal");
  if (!modal) return;
  const headline = modal.querySelector(".form-headline");
  const defaultTitle = headline ? headline.textContent : "Get your cash offer";

  document.addEventListener("click", (e) => {
    const trigger = e.target.closest('[data-open-modal="leadModal"]');
    if (!trigger) return;
    const customTitle = trigger.dataset.modalTitle;
    if (headline) {
      headline.textContent = customTitle || defaultTitle;
    }
  }, true);  // capture phase: runs before setupModal's bubble-phase open
}

document.addEventListener("DOMContentLoaded", () => {
  setupVideoFacades();
  setupModalTitleOverride();
  setupChatbot();
});


/* ============================================================================
   CHATBOT — "Sarah" virtual assistant
   ----------------------------------------------------------------------------
   A scripted-conversational widget that:
     1. Captures lead info: situation, postcode, name, phone, address (+ email)
     2. Drip-feeds the 5 Important Advice points naturally as it goes:
          #1 Verify they are a real cash buyer (we use our own funds)
          #2 No tie-in agreements (walk away any time)
          #3 No last-minute price drops (offer agreed = offer paid)
          #4 We cover all legal fees (no surprises at completion)
          #5 We can complete fast (5–14 days if needed)
     3. Submits via the same sendLead() endpoint as the forms.

   Conversation is driven by a state machine — `state.step` advances through a
   list of nodes. Each node is either a `bot` step (write a message + show
   chips/await input), or a `branch` based on user choice.
   ============================================================================ */

function setupChatbot() {
  const root = document.getElementById("chatbot");
  if (!root) return;

  const launcher = document.getElementById("chatbotLauncher");
  const minBtn = document.getElementById("chatbotMin");
  const tease = document.getElementById("chatbotTease");
  const panel = document.getElementById("chatbotPanel");
  const messagesEl = document.getElementById("chatbotMessages");
  const chipsEl = document.getElementById("chatbotChips");
  const form = document.getElementById("chatbotInputForm");
  const input = document.getElementById("chatbotInput");
  const badge = document.getElementById("chatbotBadge");

  // Conversation state — collected lead fields + current step pointer.
  const state = {
    step: 0,
    started: false,
    lead: {
      situation: "",
      postcode: "",
      name: "",          // combined "First Last" (for display)
      first_name: "",    // Zoho: First_Name
      last_name: "",     // Zoho: Last_Name (mandatory)
      phone: "",
      email: "",
      address: "",
      property_type: "",
      bedrooms: "",
      sell_timeline: "",      // explicit "How quickly" answer — empty if "Not sure"
      estimated_value: "",
      mortgage_remaining: "", // 26 May — captured between bedrooms and how-quickly
    },
  };

  // Abandoned-lead tracking. Once the user has given us enough to push
  // (last_name + phone OR email) and they leave the page WITHOUT
  // completing the chat, we beacon what we have to Zoho.
  //
  // Two scenarios — same Lead_Source ("PPB CB" / "PPB CB Abandoned"),
  // distinguished only by a note in the Description:
  //   reachedSummary=true  → "PPB CB" + note "user closed tab on summary
  //                          screen — all fields captured, may need a nudge"
  //                          (treat as normal completed lead)
  //   reachedSummary=false → "PPB CB Abandoned" (bailed mid-chat,
  //                          partial data only)
  let leadSubmitted = false;       // flips true on successful step 11 send
  let reachedSummary = false;      // flips true the first time step 10 runs

  // ─────────────────────────────────────────────────────────────────
  // Google Ads conversion fire for CHATBOT leads.
  // Chatbot leads bypass the multi-step form chain (they POST direct to
  // /api/lead) so the page-flow conversion tag that fires on
  // /additional-info/ never runs for them. We fire the same
  // Lead event here, once, when sendLead() succeeds in step 11.
  // sessionStorage sentinel guards against double-fire on retry.
  // ─────────────────────────────────────────────────────────────────
  function fireLeadConversion(name, phone, email) {
    if (typeof gtag !== "function") return;                           // gtag not loaded yet
    if (sessionStorage.getItem("lead_fired_chatbot")) return;         // already fired this session

    const toE164UK = (raw) => {
      if (!raw) return "";
      let d = String(raw).replace(/\D/g, "");
      if (d.charAt(0) === "0") d = "44" + d.substring(1);
      else if (d.substring(0, 2) !== "44") d = "44" + d;
      return "+" + d;
    };

    const phoneE164  = toE164UK(phone);
    const emailClean = (email || "").trim().toLowerCase();

    // 1. Enhanced Conversions — Google reads these exact keys
    gtag("set", "user_data", { email: emailClean, phone_number: phoneE164 });

    // 2. dataLayer push (for any GTM-side tags)
    window.dataLayer = window.dataLayer || [];
    window.dataLayer.push({
      event: "lead_submission",
      enhanced_conversion_data: { email: emailClean, phone_number: phoneE164 },
    });

    // 3. Lead event sent to Google Ads
    gtag("event", "Lead", {
      lead_name: name,
      lead_phone: phoneE164,
      lead_email: emailClean,
      event_label: "Chatbot Submission",
      event_category: "Lead",
    });

    sessionStorage.setItem("lead_fired_chatbot", "1");
    console.log("[Lead fired from chatbot — Sarah]", { name, phone: phoneE164, email: emailClean });
  }
  // When the user edits their POSTCODE from the summary screen, we have to
  // re-run the house-number → Fetchify → address-pick mini-flow because
  // the previously-picked address is now stale. This flag tells those
  // steps "we came from edit — once you've got a new address, jump straight
  // back to the summary; DON'T re-ask the user's name/phone (they're set)."
  let editPostcodeReturnToSummary = false;
  // Persist the "already-beaconed" flag in sessionStorage so a tab refresh
  // (or the user navigating Back and re-opening the page) doesn't re-fire
  // the beacon and duplicate the Zoho lead within the same browser session.
  const ABANDONED_BEACON_KEY = "ppb_chatbot_beacon_sent_v2";
  function alreadyBeaconed()  { try { return !!sessionStorage.getItem(ABANDONED_BEACON_KEY); } catch (_) { return false; } }
  function markBeaconed()     { try { sessionStorage.setItem(ABANDONED_BEACON_KEY, "1"); } catch (_) {} }

  function maybeSendAbandonedLead() {
    if (leadSubmitted || alreadyBeaconed()) return;
    const ln    = (state.lead.last_name || "").trim();
    const phone = (state.lead.phone || "").trim();
    const email = (state.lead.email || "").trim();
    const addr  = (state.lead.address || "").trim();

    // Minimum useful lead for the sales team =
    //   ADDRESS (so they know which property) +
    //   LAST_NAME (Zoho requires it; in our flow this means step 4 done) +
    //   (PHONE OR EMAIL) (so they can make contact)
    // If any of those is missing we silently skip — better no lead than a
    // ghost record with no way to follow up.
    if (!addr || !ln || (!phone && !email)) return;

    markBeaconed();
    // If they reached the summary they're a full lead — same Lead_Source as
    // a clicked-send chat. Only the in-Description note differs.
    const beaconSource = reachedSummary ? "chatbot" : "chatbot-abandoned";
    const payload = {
      action: "chatbot",
      source: beaconSource,
      reached_summary: reachedSummary,   // PHP uses this to add the note
      first_name: state.lead.first_name || "",
      last_name:  ln,
      name:       state.lead.name || (state.lead.first_name + " " + ln).trim(),
      phone:      phone,
      email:      email,
      postcode:   state.lead.postcode || "",
      address:    state.lead.address || "",
      situation:  state.lead.situation || "",
      situation_label: situationLabel(state.lead.situation),
      property_type:   state.lead.property_type || "",
      bedrooms:        state.lead.bedrooms || "",
      sell_timeline:   state.lead.sell_timeline || "",
      estimated_value: state.lead.estimated_value || "",
      mortgage_remaining: state.lead.mortgage_remaining || "",
      abandoned_at_step: state.step,
    };
    // sendBeacon is the only reliable way to push during page unload —
    // regular fetch() gets cancelled. Same endpoint as completed leads.
    try {
      const blob = new Blob([JSON.stringify(payload)], { type: "application/json" });
      navigator.sendBeacon("/api/lead", blob);
      console.log("[chatbot] abandoned-lead beacon sent at step", state.step);
    } catch (e) {
      console.warn("[chatbot] abandoned-lead beacon failed:", e);
    }
  }
  // Fire ONLY on actual page-leaving events. Earlier draft also listened
  // to `visibilitychange` but that fires every time a user switches tabs
  // or briefly checks another app mid-chat — too aggressive, would create
  // duplicate leads (one abandoned + one completed) for normal users.
  // beforeunload + pagehide cover the real cases (close tab, navigate
  // away, browser back, mobile Safari swipe-away).
  window.addEventListener("beforeunload", maybeSendAbandonedLead);
  window.addEventListener("pagehide", maybeSendAbandonedLead);

  // ── Open / close panel ──────────────────────────────────────────────────
  // Track scroll position so we can restore it when we unlock the body
  // (we use position:fixed on body for mobile lock, which resets scroll).
  let savedScrollY = 0;

  function openPanel() {
    root.classList.add("is-open");
    launcher.setAttribute("aria-expanded", "true");
    panel.setAttribute("aria-hidden", "false");
    hideTease();
    hideBadge();
    // Lock body scroll on mobile (CSS rule scopes the lock to <=600px)
    savedScrollY = window.scrollY;
    document.body.style.top = `-${savedScrollY}px`;
    document.body.classList.add("chat-open");
    if (!state.started) {
      state.started = true;
      runStep(0);  // Kick off the conversation on first open
    }
    // Focus the input once panel finishes opening — only on desktop, to
    // avoid the iOS keyboard popping up unexpectedly when the user just
    // tapped to read the conversation.
    if (window.matchMedia("(min-width: 601px)").matches) {
      setTimeout(() => input.focus({ preventScroll: true }), 280);
    }
  }
  function closePanel() {
    root.classList.remove("is-open");
    launcher.setAttribute("aria-expanded", "false");
    panel.setAttribute("aria-hidden", "true");
    // Unlock body and restore scroll position
    document.body.classList.remove("chat-open");
    document.body.style.top = "";
    if (savedScrollY) {
      window.scrollTo(0, savedScrollY);
      savedScrollY = 0;
    }
    launcher.focus({ preventScroll: true });
  }
  launcher.addEventListener("click", () => {
    if (root.classList.contains("is-open")) closePanel();
    else openPanel();
  });
  minBtn.addEventListener("click", closePanel);

  // Any element with [data-open-chatbot] (e.g. the CTA bar's mobile chat
  // button) opens the chat panel.
  document.querySelectorAll("[data-open-chatbot]").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.preventDefault();
      if (!root.classList.contains("is-open")) openPanel();
    });
  });

  // ── Tease bubble (auto-show after 7s of being on the page) ──────────────
  function showTease() {
    if (sessionStorage.getItem("ppb_chat_tease_dismissed") === "1") return;
    if (root.classList.contains("is-open")) return;
    tease.classList.add("is-visible");
  }
  function hideTease() {
    tease.classList.remove("is-visible");
  }
  function dismissTease() {
    hideTease();
    sessionStorage.setItem("ppb_chat_tease_dismissed", "1");
  }
  tease.addEventListener("click", (e) => {
    // X button inside the tease
    if (e.target.closest("[data-close-tease]")) {
      e.stopPropagation();
      dismissTease();
      return;
    }
    dismissTease();
    openPanel();
  });
  setTimeout(showTease, 7000);

  // ── Unread badge on launcher ────────────────────────────────────────────
  function showBadge(count = 1) {
    if (root.classList.contains("is-open")) return;
    badge.textContent = String(count);
    badge.classList.add("is-visible");
  }
  function hideBadge() { badge.classList.remove("is-visible"); }

  // ── Render helpers ──────────────────────────────────────────────────────
  function scrollToBottom() {
    requestAnimationFrame(() => {
      messagesEl.scrollTop = messagesEl.scrollHeight;
    });
  }
  function addBotMessage(html) {
    const el = document.createElement("div");
    el.className = "chat-msg chat-msg-bot";
    el.innerHTML = html;
    messagesEl.appendChild(el);
    scrollToBottom();
    return el;
  }
  function addUserMessage(text) {
    const el = document.createElement("div");
    el.className = "chat-msg chat-msg-user";
    el.textContent = text;
    messagesEl.appendChild(el);
    scrollToBottom();
    return el;
  }
  function addSystemMessage(text) {
    const el = document.createElement("div");
    el.className = "chat-msg chat-msg-system";
    el.textContent = text;
    messagesEl.appendChild(el);
    scrollToBottom();
  }
  function showTyping() {
    const el = document.createElement("div");
    el.className = "chat-typing";
    el.innerHTML = "<span></span><span></span><span></span>";
    el.dataset.typing = "1";
    messagesEl.appendChild(el);
    scrollToBottom();
    return el;
  }
  function clearTyping() {
    messagesEl.querySelectorAll('[data-typing="1"]').forEach((n) => n.remove());
  }
  function setChips(items) {
    chipsEl.innerHTML = "";
    if (!items || !items.length) return;
    items.forEach((it) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "chip" + (it.skip ? " chip-skip" : "");
      btn.textContent = it.label;
      btn.addEventListener("click", () => {
        clearChips();
        // Echo the choice as a user message (unless explicitly silent)
        if (!it.silent) addUserMessage(it.label);
        if (typeof it.onPick === "function") it.onPick(it.value);
      });
      chipsEl.appendChild(btn);
    });
    // Chips can take significant vertical space (10+ situation options).
    // After they render, auto-scroll the messages area to the bottom so the
    // most recent bot message is still visible above them.
    requestAnimationFrame(scrollToBottom);
  }
  function clearChips() { chipsEl.innerHTML = ""; }
  function setInputMode(mode) {
    // mode: "text", "tel", "email", "off" (disabled)
    if (mode === "off") {
      form.classList.add("is-disabled");
      input.value = "";
      input.placeholder = "";
      return;
    }
    form.classList.remove("is-disabled");
    if (mode === "tel") {
      input.type = "tel";
      input.placeholder = "";              // clean, no confusing examples
      input.inputMode = "tel";
    } else if (mode === "email") {
      input.type = "email";
      input.placeholder = "you@email.com";
      input.inputMode = "email";
    } else if (mode === "postcode") {
      input.type = "text";
      input.placeholder = "e.g. SW1A 1AA";
      input.inputMode = "text";
      input.style.textTransform = "uppercase";
    } else {
      input.type = "text";
      input.placeholder = "Type your reply…";
      input.inputMode = "text";
      input.style.textTransform = "";
    }
    input.value = "";
  }

  /**
   * Send a sequence of bot messages with realistic typing delays between them.
   * Each item is either a string (HTML) or { html, delay }.
   * Resolves when the last message is shown.
   *
   * Tuned to feel like a human typing — slower than instant, faster than
   * a 70wpm typist. Default per-character pace is roughly equivalent to
   * 90-100 wpm with a settle-time minimum, which feels considered without
   * being frustrating to wait for.
   */
  function botSay(items) {
    return new Promise((resolve) => {
      const queue = items.map((it) => typeof it === "string" ? { html: it } : it);
      let i = 0;
      function next() {
        if (i >= queue.length) {
          if (!root.classList.contains("is-open")) showBadge();
          resolve();
          return;
        }
        const item = queue[i++];
        const typing = showTyping();
        // Strip HTML tags before counting chars so markup doesn't inflate delay
        const visibleLen = item.html.replace(/<[^>]*>/g, "").length;
        const delay = item.delay != null
          ? item.delay
          : Math.min(2400, 900 + visibleLen * 22);
        setTimeout(() => {
          typing.remove();
          addBotMessage(item.html);
          setTimeout(next, 450);  // pause between sequential messages
        }, delay);
      }
      next();
    });
  }

  // ── Free-text input handling (resolved per-step) ────────────────────────
  let pendingInputResolve = null;
  function awaitTextInput(validator) {
    return new Promise((resolve) => {
      pendingInputResolve = (text) => {
        const result = validator ? validator(text) : { ok: true, value: text };
        if (!result.ok) {
          // Validation failed — show inline error + stay listening
          botSay([result.error || "Hmm, that doesn't look right. Mind trying again?"]);
          return;  // don't resolve, keep waiting
        }
        pendingInputResolve = null;
        resolve(result.value);
      };
    });
  }
  form.addEventListener("submit", (e) => {
    e.preventDefault();
    let text = input.value.trim();
    if (!text) return;
    // If the chat is asking for a phone, auto-format to +44 XXXX XXX XXX.
    // The user sees their input formatted in the chat bubble AND the
    // resolved value (passed to state.lead.phone, fireLead, future Zoho
    // push) is already normalised. Idempotent — safe if they already
    // typed it in +44 format.
    if (input.type === "tel") {
      const pretty = prettifyUKPhone(text);
      if (pretty) text = pretty;
    }
    addUserMessage(text);
    input.value = "";
    if (pendingInputResolve) pendingInputResolve(text);
  });

  // ── Validators ──────────────────────────────────────────────────────────
  function validatePostcode(text) {
    const v = (text || "").trim().toUpperCase().replace(/\s+/g, " ");
    const ok = /^[A-Z]{1,2}\d[A-Z\d]?\s*\d[A-Z]{2}$/.test(v);
    if (!ok) return { ok: false, error: "Hmm, that postcode doesn't look quite right. Could you double-check it? <em>(e.g. SW1A 1AA)</em>" };
    // Normalise spacing
    const normalised = v.replace(/\s+/g, "").replace(/^(.*)(\d[A-Z]{2})$/, "$1 $2");
    return { ok: true, value: normalised };
  }
  // Tracks a single-word first-name input across two validateName() calls
  // so the loop can combine "jamie" + "farrugia" → "jamie farrugia"
  // instead of asking for the surname a second time. Reset on success.
  let _namePendingFirst = null;
  function validateName(text) {
    // Collapse any double-spaces into single, strip leading/trailing whitespace
    const t = (text || "").trim().replace(/\s+/g, " ");
    if (!t) return { ok: false, error: "Could I get your name?" };
    const parts = t.split(" ");

    // Single-word input
    if (parts.length < 2) {
      if (parts[0].length < 2) {
        return { ok: false, error: "That doesn't look quite right. Could I get your full name? <em>(e.g. Jane Smith)</em>" };
      }
      if (_namePendingFirst) {
        // They previously gave one word (the first name); this is the surname.
        const full = _namePendingFirst + " " + t;
        _namePendingFirst = null;   // reset
        return { ok: true, value: full };
      }
      // First time they give one word — remember it and ask for the surname.
      _namePendingFirst = t;
      return {
        ok: false,
        error: `Thanks ${escapeHtml(t)}! And your surname? <em>Just so I can pass your details over properly.</em>`,
      };
    }

    // Two-or-more-word input — ignore any pending first name and take this as the full name.
    if (parts[0].length < 2 || parts[parts.length - 1].length < 2) {
      return { ok: false, error: "That doesn't look quite right. Could I get your full name? <em>(e.g. Jane Smith)</em>" };
    }
    _namePendingFirst = null;   // reset
    return { ok: true, value: t };
  }
  function validateAddress(text) {
    const t = (text || "").trim();
    if (t.length < 3) return { ok: false, error: "Just the house number and street is fine. Like '23 Oak Road'." };
    return { ok: true, value: t };
  }
  // Phone + email use a confirm-on-suspicious flow (askPhoneWithConfirm
  // and askEmailWithConfirm below) instead of hard rejection. We accept
  // the value if the user explicitly confirms it after we flag concerns.
  function looksLikeUKPhone(text) {
    const stripped = (text || "").replace(/\s+/g, "").replace(/[-()]/g, "");
    return /^(\+?44|0)\d{9,11}$/.test(stripped);
  }
  function looksLikeEmail(text) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test((text || "").trim());
  }
  // Accepts £, $, €, commas, spaces, optional k/m suffix.
  // Examples that pass: "350000", "£350,000", "350k", "0.35m", "350 K", "£1.2M"
  function looksLikeMoney(text) {
    const stripped = (text || "").replace(/[£$€,\s]/g, "").toLowerCase();
    return /^\d+(\.\d+)?[km]?$/.test(stripped);
  }

  /**
   * Ask for a value, validate it loosely, and if it looks suspicious
   * (e.g. wrong UK number format) show the user what they typed and
   * give them confirm-or-retype chips. Resolves once we have a confirmed
   * answer (either valid-on-first-try or explicitly confirmed).
   *
   * `minLength` only guards against accidental empty/super-short input —
   * everything longer flows through `looksValidFn` and the confirm chips.
   */
  async function askWithConfirm({ inputMode, looksValidFn, suspiciousMessage, minLength = 3 }) {
    while (true) {
      setInputMode(inputMode);
      const text = await awaitTextInput((t) => {
        const trimmed = (t || "").trim();
        if (trimmed.length < minLength) {
          return { ok: false, error: "That looks a bit short, could you type it again?" };
        }
        return { ok: true, value: trimmed };
      });
      if (looksValidFn(text)) return text;
      // Doesn't match expected format — confirm rather than reject
      setInputMode("off");
      await botSay([`<p>${suspiciousMessage.replace("{value}", `<strong>${escapeHtml(text)}</strong>`)}</p>`]);
      const confirmed = await new Promise((resolve) => {
        setChips([
          { label: "Yes, that's right", value: "yes", onPick: () => resolve(true) },
          { label: "Let me retype", value: "no", onPick: () => resolve(false) },
        ]);
      });
      if (confirmed) return text;
      // Otherwise loop and re-ask
    }
  }

  // ── Conversation flow (the actual script) ────────────────────────────────
  // Keys map to step IDs we jump between. The flow is mostly linear but the
  // situation question branches into a tailored empathy line.
  const SITUATION_REPLIES = {
    probate: "Sorry to hear that. Probate sales can be a real headache, but we've helped a lot of families through them and we always work at your pace.",
    divorce: "That sounds stressful. We'll keep things simple and discreet, no fuss.",
    fast: "Got it. Speed is something we're really good at. We can complete in as little as 48 hours, or take longer if you'd rather. Weeks, months, whatever timeline suits.",
    chain: "That's such a frustrating one. The good news is, we never break a chain because we use our own funds.",
    repossession: "Sorry you're dealing with that. We can move very fast in repossession cases and often stop things in their tracks.",
    relocation: "No problem. We can work to whatever timeline suits the move, fast or flexible.",
    emigration: "Big move! We can handle everything remotely if you need and complete on your schedule.",
    health: "Sorry to hear that. We'll keep the whole process easy and low-stress, at your pace.",
    knotweed: "Don't worry, we buy properties with knotweed regularly. Most agents won't touch it but we will.",
    other: "No problem. We can help with most situations, just tell us a bit more as we go.",
  };

  async function runStep(step) {
    state.step = step;

    if (step === 0) {
      await botSay([
        { html: "<p>Hi 👋 I'm <strong>Sarah</strong> from Prime Property Buyers.</p>", delay: 400 },
        "<p>Mind if I ask a few quick questions to see how we can help? It only takes about 60 seconds.</p>",
      ]);
      setInputMode("off");
      setChips([
        { label: "Yes, sure 👍", value: "yes", onPick: () => runStep(1) },
        { label: "Just looking around", value: "browse", onPick: () => runStep("browse") },
      ]);
      return;
    }

    if (step === "browse") {
      await botSay([
        "<p>No problem at all, take your time. If you want to chat anytime, I'll be here.</p>",
        "<p>Or call us free on <a href=\"tel:08000122239\"><strong>0800 0122 239</strong></a>, 7 days a week, 8am to 8pm.</p>",
      ]);
      setInputMode("off");
      setChips([
        { label: "Actually, ask me the questions", value: "yes", onPick: () => runStep(1) },
      ]);
      return;
    }

    // STEP 1: Situation chips. Drives the empathy reply in step 3 + maps to
    // Zoho's Reason_for_Sale field via the PHP endpoint.
    if (step === 1) {
      await botSay([
        "<p>Brilliant. First up: what's prompting you to think about selling?</p>",
      ]);
      setInputMode("off");
      setChips([
        { label: "Probate / inheritance", value: "probate", onPick: (v) => pickSituation(v) },
        { label: "Divorce / separation", value: "divorce", onPick: (v) => pickSituation(v) },
        { label: "Quick sale", value: "fast", onPick: (v) => pickSituation(v) },
        { label: "Broken property chain", value: "chain", onPick: (v) => pickSituation(v) },
        { label: "Stop repossession", value: "repossession", onPick: (v) => pickSituation(v) },
        { label: "Relocation", value: "relocation", onPick: (v) => pickSituation(v) },
        { label: "Emigration", value: "emigration", onPick: (v) => pickSituation(v) },
        { label: "Ill health", value: "health", onPick: (v) => pickSituation(v) },
        { label: "Japanese knotweed", value: "knotweed", onPick: (v) => pickSituation(v) },
        { label: "Something else", value: "other", onPick: (v) => pickSituation(v) },
      ]);
      return;
    }

    // STEP 2: EMAIL — captured EARLY so the abandoned-lead beacon has it
    // if the user bails further down. Was at step 8 in the old flow.
    if (step === 2) {
      await botSay([
        "<p>Got it. Quick one before we go further. What's the best email for you?</p>",
        "<p><em>Just in case we get disconnected, we'll keep you in the loop and send your offer in writing.</em></p>",
      ]);
      const email = await askWithConfirm({
        inputMode: "email",
        looksValidFn: looksLikeEmail,
        suspiciousMessage: "Hmm, {value} doesn't look quite right. Is that the correct email?",
      });
      state.lead.email = email;
      runStep(3);
      return;
    }

    // STEP 3: Empathy reply + KSP #1 + ask POSTCODE
    if (step === 3) {
      await botSay([
        `<p>${SITUATION_REPLIES[state.lead.situation] || SITUATION_REPLIES.other}</p>`,
        "<p>Quick thing worth knowing: <strong>we're an actual buyer</strong>, not a site that finds buyers for you. We use our own funds, that's why we can move when others can't.</p>",
        "<p>What's the postcode of the property?</p>",
      ]);
      setInputMode("postcode");
      const postcode = await awaitTextInput(validatePostcode);
      state.lead.postcode = postcode;
      runStep("house-number");
      return;
    }

    // STEP "house-number": After we have the postcode, ask just the house
    // number or property name. We'll then use Fetchify to look up the FULL
    // address and ask the user to confirm — they don't type the street
    // name themselves. Single exact match → confirmation chip. Multiple
    // (flats / suffixes) → small chip list. None → free-text fallback.
    if (step === "house-number") {
      await botSay([
        "<p>Great, I know that area. 🗺️</p>",
        "<p>What's the <strong>house number</strong>? <em>(Or property name if it doesn't have a number, e.g. 'The Cottage'.)</em></p>",
      ]);
      setInputMode("text");
      const houseNoOrName = await awaitTextInput((t) => {
        const v = (t || "").trim();
        if (!v) return { ok: false, error: "Could I get the house number or property name? E.g. <em>12</em> or <em>The Cottage</em>." };
        return { ok: true, value: v };
      });
      state.lead.house_no = houseNoOrName;
      runStep("address-pick");
      return;
    }

    // STEP "address-pick": Use Fetchify with `"{house_no} {postcode}"` so
    // results are narrowed to the specific property. Then either confirm
    // an exact match (1 result), pick from a small chip list (2-6 results),
    // or fall back to free-text.
    if (step === "address-pick") {
      // small typing pause for natural rhythm while Fetchify resolves
      await new Promise((resolve) => {
        const t = showTyping();
        setTimeout(() => { t.remove(); resolve(); }, 350);
      });

      const hno = (state.lead.house_no || "").trim();
      const pc  = (state.lead.postcode || "").trim();
      let addresses = [];
      try {
        // Search with house number + postcode for a narrowed result set.
        // Fetchify returns matches sorted by relevance — exact-prefix house
        // numbers come first.
        const data = await fetchifyFind(`${hno} ${pc}`.trim());
        addresses = (data && data.results) || [];
      } catch (e) {
        console.warn("[chatbot] Fetchify find failed:", e);
      }

      // Filter to addresses where the leading house number/name matches
      // what the user typed (loose, case-insensitive). Avoids surfacing
      // the whole street when Fetchify returns broad results.
      const hnoLower = hno.toLowerCase();
      const tightMatches = addresses.filter((a) => {
        const label = (a.labels ? a.labels.join(", ") : (a.summaryline || ""))
          .toLowerCase().trim();
        return label.startsWith(hnoLower);
      });
      // If the tight filter wipes everything (e.g. Fetchify summary doesn't
      // start with the number — common for flats), fall back to ALL results.
      const candidates = tightMatches.length ? tightMatches : addresses;

      // Helper: where to land once we have an address.
      // - Edit-postcode flow → go straight back to the summary (don't
      //   re-ask name/phone, they're already set).
      // - Normal flow → continue to step 4 (name).
      const afterAddressStep = () => {
        if (editPostcodeReturnToSummary) {
          editPostcodeReturnToSummary = false;
          return 10;
        }
        return 4;
      };

      if (!candidates.length) {
        // 0 matches — free-text fallback.
        await botSay([
          "<p>Hmm, I couldn't find that one. Could you type the full property address? Just the house number and street is fine.</p>",
        ]);
        setInputMode("text");
        const addr = await awaitTextInput(validateAddress);
        // Strip trailing postcode if the user typed the full thing — the
        // postcode lives separately in state.lead.postcode and getting it
        // mixed into address would push the town into Street and the
        // postcode into City when Zoho splits.
        state.lead.address = stripPostcodeSuffix(addr.replace(/,?\s*$/, "").trim());
        runStep(afterAddressStep());
        return;
      }

      // Helper: when a chip is picked, retrieve full address + advance.
      const onAddressChip = async (a) => {
        try {
          const detail = await fetchifyRetrieve(a.id);
          const r = (detail && detail.result) || {};
          // Compose: "<line1>, <line2>, <town>" — NOT the postcode (kept
          // separate in state.lead.postcode). The summaryline fallback
          // typically DOES include the postcode at the end ("8 The Courtyard,
          // Witham, CM8 2FW"), so we run it through stripPostcodeSuffix to
          // keep Zoho's City field clean.
          const composed = [r.line_1, r.line_2, r.town_or_city]
            .filter((s) => s && s.trim())
            .join(", ");
          state.lead.address = stripPostcodeSuffix(composed || a.summaryline || "");
        } catch (e) {
          console.warn("[chatbot] Fetchify retrieve failed:", e);
          state.lead.address = stripPostcodeSuffix(a.summaryline || a.id || "");
        }
        runStep(afterAddressStep());
      };

      // Helper: free-text fallback if none of the chips fit. Used both
      // when the user hits "Different address" on the confirmation and
      // when there are no Fetchify matches at all.
      const manualChip = {
        label: "Different address, let me type it",
        value: "manual",
        skip: true,
        silent: true,
        onPick: async () => {
          await botSay(["<p>No problem. What's the address? House number and street is fine.</p>"]);
          setInputMode("text");
          const addr = await awaitTextInput(validateAddress);
          // Strip trailing postcode (kept separately in state.lead.postcode)
          // so Zoho's City field doesn't get the postcode when PHP splits.
          state.lead.address = stripPostcodeSuffix(addr.replace(/,?\s*$/, "").trim());
          runStep(afterAddressStep());
        },
      };

      if (candidates.length === 1) {
        // Single exact match — confirm with a clear "Yes / No, change it"
        // pair. The user shouldn't have to guess what the chip means.
        const a = candidates[0];
        const label = a.labels ? a.labels.join(", ") : (a.summaryline || "");
        await botSay([
          `<p>I think I've found it. Is this the right address?</p>`,
          `<p style="font-size:1.05em"><strong>${escapeHtml(label)}</strong></p>`,
        ]);
        setInputMode("off");
        setChips([
          { label: "✓ Yes, that's correct", value: a.id, onPick: () => onAddressChip(a) },
          manualChip,
        ]);
        return;
      }

      // 2-6 matches — short chip list (flats, A/B suffixes, etc.)
      await botSay([
        "<p>I found a few options. Is your address one of these?</p>",
      ]);
      setInputMode("off");
      setChips([
        ...candidates.slice(0, 6).map((a) => ({
          label: a.labels ? a.labels.join(", ") : (a.summaryline || a.id),
          value: a.id,
          onPick: () => onAddressChip(a),
        })),
        manualChip,
      ]);
      return;
    }

    // STEP 4: NAME (moved here from old step 9 — after address is picked).
    // KSP #2 (no tie-ins) sits with the name ask.
    if (step === 4) {
      await botSay([
        "<p>Perfect.</p>",
        "<p>Worth knowing: <strong>we don't tie you into anything</strong>. No contracts, no fees. If our offer doesn't work for you, you walk away.</p>",
        "<p>Could I get your full name?</p>",
      ]);
      setInputMode("text");
      const fullName = await awaitTextInput(validateName);
      const parts = fullName.split(" ");
      state.lead.first_name = parts[0];
      state.lead.last_name  = parts.slice(1).join(" ");
      state.lead.name       = fullName;
      runStep(5);
      return;
    }

    // STEP 5: PHONE — KSP #3 (offer is fixed) + ask phone.
    if (step === 5) {
      await botSay([
        `<p>Thanks ${escapeHtml(state.lead.first_name)}.</p>`,
        "<p>And just so you know, <strong>what we agree at the start is what we pay at completion</strong>. Our offer is fixed, no 'subject to' clauses, no last-minute negotiations.</p>",
        "<p>What's the best mobile number for you? <em>We can SMS or WhatsApp you your offer once we've run the numbers, whichever's easier.</em></p>",
      ]);
      const phone = await askWithConfirm({
        inputMode: "tel",
        looksValidFn: looksLikeUKPhone,
        suspiciousMessage: "Hmm, {value} doesn't look like a typical UK number. Is that definitely correct?",
      });
      state.lead.phone = phone;
      runStep(6);
      return;
    }

    // STEP 6: Property TYPE — KSP #4 (we cover legal fees) sits here.
    if (step === 6) {
      await botSay([
        "<p>Got it. Once we've worked out the numbers we'll be in touch. Whatever suits you, whether that's a quick text, WhatsApp, or a call.</p>",
        "<p>One more thing to know: <strong>we cover all your legal fees</strong>. No surprises at completion.</p>",
        "<p>What type of property is it?</p>",
      ]);
      setInputMode("off");
      setChips([
        { label: "Terraced", value: "Terraced", onPick: (v) => pickPropertyType(v) },
        { label: "End-of-terrace", value: "End-of-terrace", onPick: (v) => pickPropertyType(v) },
        { label: "Semi-detached", value: "Semi-detached", onPick: (v) => pickPropertyType(v) },
        { label: "Detached", value: "Detached", onPick: (v) => pickPropertyType(v) },
        { label: "Bungalow", value: "Bungalow", onPick: (v) => pickPropertyType(v) },
        { label: "Flat", value: "Flat", onPick: (v) => pickPropertyType(v) },
        { label: "Maisonette", value: "Maisonette", onPick: (v) => pickPropertyType(v) },
        { label: "Other", value: "Other", onPick: (v) => pickPropertyType(v) },
      ]);
      return;
    }

    // STEP 7: Bedrooms
    if (step === 7) {
      await botSay([
        "<p>And how many bedrooms?</p>",
      ]);
      setInputMode("off");
      setChips([
        { label: "Studio", value: "Studio", onPick: (v) => pickBedrooms(v) },
        { label: "1", value: "1", onPick: (v) => pickBedrooms(v) },
        { label: "2", value: "2", onPick: (v) => pickBedrooms(v) },
        { label: "3", value: "3", onPick: (v) => pickBedrooms(v) },
        { label: "4+", value: "4+", onPick: (v) => pickBedrooms(v) },
      ]);
      return;
    }

    // STEP "mortgage": NEW (26 May). Mirrors the WP form's
    // "Mortgage Remaining (Approx £)" question from /additional-info/.
    // The WP form asks for a number; chatbot mirrors that but also lets the
    // user say "None" (= owned outright, sent as 0 to Zoho) so we capture
    // the equity story even when there's nothing left to pay off.
    if (step === "mortgage") {
      await botSay([
        "<p>Roughly how much is still owed on the mortgage? A ballpark is fine — or <strong>None</strong> if it's owned outright.</p>",
      ]);
      setInputMode("off");
      setChips([
        { label: "None (owned outright)", value: "none",  onPick: () => pickMortgage("none") },
        { label: "Let me type the amount", value: "type", onPick: () => askMortgageAmount() },
      ]);
      return;
    }

    // STEP "how-quickly": NEW (20 May). Mirrors the WP form's
    // "How Quickly do you want to Sell?" dropdown EXACTLY so the value
    // pushes cleanly to Zoho's How_Quickly_do_you_want_to_Sell field.
    // Replaces the old infer-from-situation logic (which only set this
    // for fast/chain/repossession → "1-5 days" and left blank for others).
    if (step === "how-quickly") {
      await botSay([
        "<p>And how quickly are you looking to sell?</p>",
      ]);
      setInputMode("off");
      setChips([
        { label: "1 to 5 days",   value: "1-5 days",   onPick: (v) => pickTimeline(v) },
        { label: "2 to 4 weeks",  value: "2-4 weeks",  onPick: (v) => pickTimeline(v) },
        { label: "4 to 8 weeks",  value: "4-8 weeks",  onPick: (v) => pickTimeline(v) },
        { label: "2 months+",  value: "2 months+",  onPick: (v) => pickTimeline(v) },
        { label: "6 months+",  value: "6 months+",  onPick: (v) => pickTimeline(v) },
        { label: "Not sure",   value: "",           onPick: (v) => pickTimeline(v) },
      ]);
      return;
    }

    // STEP 8: Estimated value — last functional question before summary.
    if (step === 8) {
      await botSay([
        "<p>Roughly what do you think it's worth? A ballpark is fine. This helps us see if we can give you a quick indication.</p>",
      ]);
      const value = await askWithConfirm({
        inputMode: "text",
        looksValidFn: looksLikeMoney,
        suspiciousMessage: "Hmm, {value} doesn't look like an amount. Did you mean something like £350,000? Want me to use what you typed anyway?",
      });
      state.lead.estimated_value = value;
      runStep(10);
      return;
    }

    if (step === 10) {
      // KSP #5 (48h + flexible) + summary + confirm.
      // Mark that the user reached the summary so the abandoned-lead beacon
      // can label them as "Pending" (hot — all data captured) rather than
      // "Abandoned" (cooler — bailed mid-chat) if they leave without
      // clicking the final "Yes, send it ✓" button.
      reachedSummary = true;
      clearChips();
      const summary = `
        <p>That's everything, <strong>${escapeHtml(state.lead.name)}</strong>. One last thing worth knowing: <strong>we can complete in as little as 48 hours, or take whatever timeline suits you. Weeks, months, whatever works.</strong></p>
        <p>Here's what I've got:</p>
        <ul>
          <li><strong>Address:</strong> ${escapeHtml(state.lead.address)}, ${escapeHtml(state.lead.postcode)}</li>
          <li><strong>Property:</strong> ${escapeHtml(state.lead.property_type)}, ${escapeHtml(state.lead.bedrooms)} bed</li>
          <li><strong>Estimated value:</strong> ${escapeHtml(state.lead.estimated_value)}</li>
          <li><strong>Mortgage left:</strong> ${escapeHtml(formatMortgageDisplay(state.lead.mortgage_remaining))}</li>
          <li><strong>Looking to sell:</strong> ${escapeHtml(state.lead.sell_timeline || "Not sure / TBC")}</li>
          <li><strong>Phone:</strong> ${escapeHtml(state.lead.phone)}</li>
          <li><strong>Email:</strong> ${escapeHtml(state.lead.email)}</li>
          <li><strong>Situation:</strong> ${escapeHtml(situationLabel(state.lead.situation))}</li>
        </ul>
      `;
      await botSay([
        summary,
        "<p>Shall I send this to our buying team for a free no-obligation cash offer?</p>",
      ]);
      setInputMode("off");
      setChips([
        { label: "Yes, send it ✓", value: "send", onPick: () => runStep(11) },
        { label: "Wait, let me edit", value: "edit", onPick: () => runStep("edit") },
      ]);
      return;
    }

    if (step === "edit") {
      await botSay([
        "<p>No problem. Which bit do you want to change?</p>",
      ]);
      setChips([
        { label: "Postcode",  value: "postcode",         onPick: () => editField("postcode") },
        { label: "Address",   value: "address",          onPick: () => editField("address") },
        { label: "Type",      value: "property_type",    onPick: () => editField("property_type") },
        { label: "Bedrooms",  value: "bedrooms",         onPick: () => editField("bedrooms") },
        { label: "Value",     value: "estimated_value",  onPick: () => editField("estimated_value") },
        { label: "Phone",     value: "phone",            onPick: () => editField("phone") },
        { label: "Email",     value: "email",            onPick: () => editField("email") },
        { label: "Name",      value: "name",             onPick: () => editField("name") },
        { label: "All good, send it ✓", value: "done",   onPick: () => runStep(11) },
      ]);
      return;
    }

    if (step === 11) {
      // Submit lead
      const sending = showTyping();
      try {
        await sendLead({
          source: "chatbot",
          situation: state.lead.situation,
          situation_label: situationLabel(state.lead.situation),
          postcode: state.lead.postcode,
          name:       state.lead.name,         // combined "First Last" (display)
          first_name: state.lead.first_name,   // Zoho: First_Name
          last_name:  state.lead.last_name,    // Zoho: Last_Name (mandatory)
          phone: state.lead.phone,
          email: state.lead.email,
          address: state.lead.address,
          property_type: state.lead.property_type,
          bedrooms: state.lead.bedrooms,
          sell_timeline: state.lead.sell_timeline,   // → Zoho How_Quickly_do_you_want_to_Sell
          estimated_value: state.lead.estimated_value,
          mortgage_remaining: state.lead.mortgage_remaining,  // → Zoho Mortgage_Remaining (26 May)
        });
        leadSubmitted = true;   // suppresses any abandoned-lead beacon

        // Fire Google Ads Lead conversion now — chatbot leads don't touch
        // /additional-info/ so the WP-side Custom Code never runs for them.
        // This is the only place a chatbot conversion gets reported.
        fireLeadConversion(state.lead.name, state.lead.phone, state.lead.email);

        sending.remove();
        addSystemMessage("Sent ✓");
        await botSay([
          { html: `<p>All done! 🎉</p>`, delay: 600 },
          `<p><strong>${escapeHtml(state.lead.name)}</strong>, one of our buyers will call (or WhatsApp) you within an hour during office hours <em>(8am to 8pm, 7 days a week)</em>. We'll also email confirmation to <strong>${escapeHtml(state.lead.email)}</strong>.</p>`,
          "<p>Thanks for your time. Talk soon! 👋</p>",
        ]);
        setInputMode("off");
        setChips([
          { label: "Call now: 0800 0122 239", value: "call", onPick: () => { window.location.href = "tel:08000122239"; } },
        ]);
      } catch (err) {
        console.error("Chatbot lead failed:", err);
        sending.remove();
        await botSay([
          "<p>Oh, something went wrong our end. 😬</p>",
          "<p>Could you give us a quick call? <a href=\"tel:08000122239\"><strong>0800 0122 239</strong></a>, free, 7 days a week.</p>",
        ]);
        setChips([
          { label: "Try sending again", value: "retry", onPick: () => runStep(11) },
        ]);
      }
      return;
    }
  }

  // Step transitions for chip picks. Step numbers reflect the reorganised
  // flow (see runStep above): situation→email→postcode/address→name→phone
  // →property type→bedrooms→how-quickly→value→summary.
  async function pickPropertyType(value) {
    state.lead.property_type = value;
    runStep(7);   // → bedrooms
  }
  async function pickBedrooms(value) {
    state.lead.bedrooms = value;
    runStep("mortgage");   // → mortgage question (NEW 26 May), then how-quickly
  }
  async function pickMortgage(value) {
    // "none" → store as "0" so PHP/Zoho see a real number (owned outright).
    // Anything else triggers the free-text "type the amount" path which
    // calls this with a £ string and we let it through as-is — PHP
    // normalises via ppb_chatbot_normalise_money() server-side.
    state.lead.mortgage_remaining = value === "none" ? "0" : value;
    runStep("how-quickly");
  }
  async function askMortgageAmount() {
    await botSay([
      "<p>Roughly how much is left? You can say something like <em>£120,000</em> or <em>180k</em>.</p>",
    ]);
    const value = await askWithConfirm({
      inputMode: "text",
      looksValidFn: looksLikeMoney,
      suspiciousMessage: "Hmm, {value} doesn't look like an amount. Did you mean something like £120,000? Want me to use what you typed anyway?",
    });
    pickMortgage(value);
  }
  async function pickTimeline(value) {
    // "Not sure" picks send "" — but PHP's infer_timeline only fills in for
    // fast/chain/repossession situations, so for everything else (other,
    // probate, illness, etc.) the field lands blank in Zoho. Default
    // unknowns to "2 months+" so the sales team always sees SOME signal.
    state.lead.sell_timeline = value || "2 months+";
    runStep(8);   // → estimated value
  }
  async function pickSituation(value) {
    state.lead.situation = value;
    runStep(2);   // → email (capture early in case of disconnect)
  }

  async function editField(field) {
    // Property type and bedrooms re-show chips. Phone + email + value use
    // the confirm-on-suspicious flow. Postcode/name/address use the simple
    // validators.
    const prompts = {
      postcode:         "What's the correct postcode?",
      name:             "What name should I use?",
      phone:            "What's the correct phone number?",
      email:            "What's your correct email?",
      address:          "What's the correct address?",
      property_type:    "What type of property is it?",
      bedrooms:         "How many bedrooms?",
      estimated_value:  "Roughly what do you think it's worth?",
    };
    await botSay([`<p>${prompts[field]}</p>`]);

    if (field === "property_type") {
      setInputMode("off");
      const choice = await new Promise((resolve) => {
        setChips([
          { label: "Terraced",       value: "Terraced",       onPick: (v) => resolve(v) },
          { label: "End-of-terrace", value: "End-of-terrace", onPick: (v) => resolve(v) },
          { label: "Semi-detached",  value: "Semi-detached",  onPick: (v) => resolve(v) },
          { label: "Detached",       value: "Detached",       onPick: (v) => resolve(v) },
          { label: "Bungalow",       value: "Bungalow",       onPick: (v) => resolve(v) },
          { label: "Flat",           value: "Flat",           onPick: (v) => resolve(v) },
          { label: "Maisonette",     value: "Maisonette",     onPick: (v) => resolve(v) },
          { label: "Other",          value: "Other",          onPick: (v) => resolve(v) },
        ]);
      });
      state.lead.property_type = choice;
      runStep(10);
      return;
    }

    if (field === "bedrooms") {
      setInputMode("off");
      const choice = await new Promise((resolve) => {
        setChips([
          { label: "Studio", value: "Studio", onPick: (v) => resolve(v) },
          { label: "1",      value: "1",      onPick: (v) => resolve(v) },
          { label: "2",      value: "2",      onPick: (v) => resolve(v) },
          { label: "3",      value: "3",      onPick: (v) => resolve(v) },
          { label: "4+",     value: "4+",     onPick: (v) => resolve(v) },
        ]);
      });
      state.lead.bedrooms = choice;
      runStep(10);
      return;
    }

    let value;
    if (field === "phone") {
      value = await askWithConfirm({
        inputMode: "tel",
        looksValidFn: looksLikeUKPhone,
        suspiciousMessage: "Hmm, {value} doesn't look like a typical UK number. Is that definitely correct?",
      });
    } else if (field === "email") {
      value = await askWithConfirm({
        inputMode: "email",
        looksValidFn: looksLikeEmail,
        suspiciousMessage: "Hmm, {value} doesn't look quite right. Is that the correct email?",
      });
    } else if (field === "estimated_value") {
      value = await askWithConfirm({
        inputMode: "text",
        looksValidFn: looksLikeMoney,
        suspiciousMessage: "Hmm, {value} doesn't look like an amount. Want me to use what you typed anyway?",
      });
    } else {
      const validators = {
        postcode: validatePostcode,
        name: validateName,
        address: validateAddress,
      };
      const inputModes = { postcode: "postcode", name: "text", address: "text" };
      setInputMode(inputModes[field]);
      value = await awaitTextInput(validators[field]);
    }
    state.lead[field] = value;
    // If the user edited their name, re-split into first/last for Zoho
    if (field === "name") {
      const parts = value.split(" ");
      state.lead.first_name = parts[0];
      state.lead.last_name  = parts.slice(1).join(" ");
    }
    // Editing the POSTCODE invalidates the previously-picked address —
    // re-run the house-number + Fetchify pick flow so the address matches
    // the new postcode. The editPostcodeReturnToSummary flag tells the
    // address-pick handler to jump back to the summary (step 10) instead
    // of step 4 (name), so we don't re-ask name + phone the user already
    // gave us.
    if (field === "postcode") {
      state.lead.address  = "";
      state.lead.house_no = "";
      editPostcodeReturnToSummary = true;
      runStep("house-number");
      return;
    }
    runStep(10);
  }

  function situationLabel(v) {
    return ({
      probate: "Probate / inherited property",
      divorce: "Divorce / separation",
      fast: "Quick sale needed",
      chain: "Broken property chain",
      repossession: "Stop repossession",
      relocation: "Relocation",
      emigration: "Emigration",
      health: "Ill health",
      knotweed: "Japanese knotweed",
      other: "Other situation",
    })[v] || "Not specified";
  }

  function escapeHtml(str) {
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }
}

/* ===================================================================
   Testimonials carousel — JS marquee + drag / swipe.
   Progressive enhancement, shared by every page that has a
   .testimonials-carousel (content pages + landing pages). It adds
   `.js-carousel` (CSS then disables the keyframe animation) and drives
   the scroll itself, so the user can grab / swipe to scroll. No-ops
   when the element is absent or the user prefers reduced motion (CSS
   keeps a static, readable layout in that case).
   =================================================================== */
(function () {
  function initTestimonialsDrag() {
    var carousels = document.querySelectorAll(".testimonials-carousel");
    if (!carousels.length) return;
    if (window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    carousels.forEach(function (carousel) {
      var track = carousel.querySelector(".testimonials-track");
      if (!track) return;
      carousel.classList.add("js-carousel");        // CSS then turns off the keyframe animation

      var x = 0, half = 0, speed = 0.35, paused = false;
      var dragging = false, startX = 0, startPos = 0, moved = 0;

      // Loop distance = the exact x where the duplicated 2nd set begins (the
      // offsetLeft of the first card of set 2). scrollWidth/2 is off by the
      // inter-set gap, which makes the marquee visibly jump every cycle.
      function measure() {
        var kids = track.children;
        half = kids.length >= 2 ? kids[Math.floor(kids.length / 2)].offsetLeft : track.scrollWidth / 2;
      }
      measure();
      if (window.ResizeObserver) { new ResizeObserver(measure).observe(track); }
      else { window.addEventListener("resize", measure); }

      function wrap() { if (half) { if (x <= -half) x += half; else if (x > 0) x -= half; } }
      function render() { track.style.transform = "translate3d(" + x + "px,0,0)"; }

      function tick() {
        if (!dragging && !paused && half) { x -= speed; wrap(); render(); }
        requestAnimationFrame(tick);
      }
      requestAnimationFrame(tick);

      carousel.addEventListener("mouseenter", function () { paused = true; });
      carousel.addEventListener("mouseleave", function () { paused = false; });

      carousel.addEventListener("pointerdown", function (e) {
        dragging = true; moved = 0; startX = e.clientX; startPos = x;
        carousel.classList.add("is-grabbing");
        if (carousel.setPointerCapture) { try { carousel.setPointerCapture(e.pointerId); } catch (err) {} }
      });
      carousel.addEventListener("pointermove", function (e) {
        if (!dragging) return;
        var d = e.clientX - startX;
        if (Math.abs(d) > moved) moved = Math.abs(d);
        x = startPos + d; wrap(); render();
      });
      function endDrag() { dragging = false; carousel.classList.remove("is-grabbing"); }
      carousel.addEventListener("pointerup", endDrag);
      carousel.addEventListener("pointercancel", endDrag);

      // a genuine drag must not also fire a click on a card / link inside
      carousel.addEventListener("click", function (e) { if (moved > 6) { e.preventDefault(); e.stopPropagation(); } }, true);
      track.addEventListener("dragstart", function (e) { e.preventDefault(); });
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initTestimonialsDrag);
  } else {
    initTestimonialsDrag();
  }
})();
