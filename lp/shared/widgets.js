/* =====================================================================
   Prime Property Buyers — shared WIDGETS injector for content pages:
   the "Sarah" chatbot + the slide-up CTA bar. Injects the same markup the
   landing pages use, then script.js wires the chatbot (setupChatbot) and
   the modal CTA. The CTA bar gets a scroll trigger here because content
   pages have no hero #leadForm for the original observer to watch.
   Load order on a page:  widgets.js -> script.js  (script.js wires it).
   ===================================================================== */
(function () {
  var CTA = `<div class="cta-bar" id="ctaBar" role="region" aria-label="Quick contact" aria-hidden="true">
  <div class="cta-bar-inner">
    <div class="cta-bar-text">
      <strong>Get your free cash offer</strong>
      <span>Within minutes · 7 days · 8am to 8pm</span>
    </div>
    <a class="cta-bar-phone" href="tel:08000122239" aria-label="Call us free on 0800 0122 239">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></svg>
      <span>0800 0122 239</span>
    </a>
    <button type="button" class="cta-bar-chat" aria-label="Open live chat with Sarah" data-open-chatbot>
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/></svg>
      <span class="cta-bar-chat-label">Live chat</span>
    </button>
    <div class="cta-bar-actions">
      <a href="#leadForm" class="btn-primary cta-bar-btn" data-open-modal="leadModal">
        Get my cash offer
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
      </a>
    </div>
  </div>
</div>`;
  var BOT = `<div class="chatbot" id="chatbot" aria-live="polite">

  <!-- Inviting preview bubble that pops up after a few seconds -->
  <button type="button" class="chatbot-tease" id="chatbotTease" aria-label="Open chat with Sarah">
    <span class="tease-avatar">
      <img src="/lp/shared/assets/logo.png?v=2" alt="">
    </span>
    <span class="tease-body">
      <strong>Hi, I'm Sarah 👋</strong>
      <span>Got a quick property to sell? I can help.</span>
    </span>
    <span class="tease-close" data-close-tease aria-label="Dismiss">×</span>
  </button>

  <!-- Persistent floating launcher button -->
  <button type="button" class="chatbot-launcher" id="chatbotLauncher" aria-label="Open chat" aria-expanded="false" aria-controls="chatbotPanel">
    <span class="launcher-icon launcher-icon-chat" aria-hidden="true">
      <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/>
      </svg>
    </span>
    <span class="launcher-icon launcher-icon-close" aria-hidden="true">
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">
        <path d="M18 6 6 18M6 6l12 12"/>
      </svg>
    </span>
    <span class="launcher-pulse" aria-hidden="true"></span>
    <span class="launcher-badge" id="chatbotBadge" aria-hidden="true">1</span>
  </button>

  <!-- Chat panel -->
  <div class="chatbot-panel" id="chatbotPanel" role="dialog" aria-label="Chat with Sarah from Prime Property Buyers" aria-hidden="true">
    <header class="chatbot-header">
      <div class="chatbot-avatar">
        <img src="/lp/shared/assets/logo.png?v=2" alt="Prime Property Buyers">
        <span class="status-dot" aria-hidden="true"></span>
      </div>
      <div class="chatbot-id">
        <strong>Sarah</strong>
        <span>Prime Property Buyers · <em>typically replies in 2 mins</em></span>
      </div>
      <button type="button" class="chatbot-min" id="chatbotMin" aria-label="Minimise chat">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14"/></svg>
      </button>
    </header>

    <div class="chatbot-messages" id="chatbotMessages" role="log" aria-live="polite"></div>

    <div class="chatbot-chips" id="chatbotChips" aria-label="Quick replies"></div>

    <form class="chatbot-input" id="chatbotInputForm" autocomplete="off" novalidate>
      <input type="text" id="chatbotInput" placeholder="Type your reply…" aria-label="Type your reply" inputmode="text">
      <button type="submit" class="chatbot-send" aria-label="Send message">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 2 11 13"/><path d="m22 2-7 20-4-9-9-4 20-7z"/></svg>
      </button>
    </form>

    <footer class="chatbot-footer">
      Powered by Prime Property Buyers · <a href="tel:08000122239">0800 0122 239</a>
    </footer>
  </div>
</div>

`;
  function inject(){
    if (!document.getElementById('ctaBar'))  document.body.insertAdjacentHTML('beforeend', CTA);
    if (!document.getElementById('chatbot')) document.body.insertAdjacentHTML('beforeend', BOT);
    // (the thin sticky header is now injected + wired by the shared nav.js)
    // CTA bar: on pages without a hero form, slide it in once scrolled down.
    var bar = document.getElementById('ctaBar');
    if (bar && !document.getElementById('leadForm')) {
      var upd = function(){ var s = window.pageYOffset > 600;
        bar.classList.toggle('is-visible', s);
        bar.setAttribute('aria-hidden', s ? 'false' : 'true'); };
      window.addEventListener('scroll', upd, {passive:true});
      window.addEventListener('resize', upd, {passive:true});
      upd();
    }
    // "Live chat" button in the bar opens the chatbot (in case script.js
    // doesn't bind data-open-chatbot on this page).
    document.addEventListener('click', function(e){
      var t = e.target.closest && e.target.closest('[data-open-chatbot]');
      if (!t) return;
      var l = document.getElementById('chatbotLauncher');
      if (l && !document.getElementById('chatbot').classList.contains('is-open')) l.click();
    });
  }
  if (document.body) inject(); else document.addEventListener('DOMContentLoaded', inject);
})();
