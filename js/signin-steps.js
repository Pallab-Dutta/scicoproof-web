/* Counts the sign-in steps a visitor reaches (seen on Telegram with /signins). No dependencies; never
   shows anything to the visitor and never throws. Each step counts once per visitor per day on the
   server; the visitor is a random id kept in this browser (no email, no name).
   Steps: page (a signed-out visitor saw the home or pricing page), window_open (the sign-in window),
   google_click, email_click ("Continue with email" pressed),
   email_sent, onetap_offered / onetap_picked / onetap_failed / onetap_skipped, signed_in (+ how). */
(function () {
  var cfg = window.SCICOPROOF_CONFIG || {};
  var BASE = (cfg.API_BASE || "").replace(/\/$/, "");
  var VIA_KEY = "benjamin_signin_via";          // how the sign-in under way was started, until it lands
  var VIA_MAX_MS = 60 * 60 * 1000;

  function store(k, v) { try { v === null ? localStorage.removeItem(k) : localStorage.setItem(k, v); } catch (e) {} }
  function load(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }

  var vid = load("benjamin_vid");
  if (!vid) {
    vid = "v" + Math.random().toString(36).slice(2) + Date.now().toString(36);
    store("benjamin_vid", vid);
  }

  function signedInHere() {                     // a Supabase session is saved in this browser
    try {
      for (var i = 0; i < localStorage.length; i++) {
        var k = localStorage.key(i);
        if (/^sb-.*-auth-token$/.test(k) && localStorage.getItem(k)) return true;
      }
    } catch (e) {}
    return false;
  }

  function fromOutreach() {
    try {
      var p = JSON.parse(load("benjamin_trial") || "null");
      return !!(p && p.paper);
    } catch (e) { return false; }
  }

  function step(name, detail, extra) {
    try {
      if (!BASE) return;
      var body = { step: name, vid: vid, detail: detail || "", outreach: fromOutreach() };
      if (extra && extra.new_user) body.new_user = true;
      fetch(BASE + "/client/signin-step", {
        method: "POST", headers: { "Content-Type": "text/plain" },   // simple request: no CORS preflight
        body: JSON.stringify(body), keepalive: true,       // still sent if the page is leaving
      }).catch(function () {});
    } catch (e) {}
  }

  function setVia(method) { store(VIA_KEY, JSON.stringify({ m: method, at: Date.now() })); }

  // A session appeared (auth.js calls this). Counted only when this browser started a sign-in, or came
  // back from Google / an email link, so an already signed-in visitor opening the app isn't counted.
  var landed = false;
  function signedIn(user) {
    try {
      if (landed) return;
      var via = null;
      try { via = JSON.parse(load(VIA_KEY) || "null"); } catch (e) {}
      if (via && Date.now() - (via.at || 0) > VIA_MAX_MS) via = null;
      if (!via && !window.__hadAuthCode) return;
      landed = true;
      store(VIA_KEY, null);
      var created = user && user.created_at ? Date.parse(user.created_at) : NaN;
      var isNew = !isNaN(created) && Date.now() - created < VIA_MAX_MS;
      step("signed_in", via ? via.m : "other", { new_user: isNew });
    } catch (e) {}
  }

  window.SciCoSigninSteps = { step: step, setVia: setVia, signedIn: signedIn, signedInHere: signedInHere };

  var page = (location.pathname.split("/").pop() || "index.html").toLowerCase();
  var signedOut = !signedInHere();

  if (signedOut && (page === "index.html" || page === "pricing.html" || page === "")) step("page");

  // "Try Benjamin" links (app.html?try=1) go straight to Google: that's a Google click too.
  try {
    if (signedOut && page === "app.html" && new URLSearchParams(location.search).get("try") === "1" &&
        !window.__hadAuthCode) {
      step("google_click", "try_link");
      setVia("google");
    }
  } catch (e) {}

  document.addEventListener("click", function (e) {
    try {
      var t = e.target.closest && e.target.closest(".js-signin, .js-signin-open");
      if (!t || signedInHere()) return;
      if (t.classList.contains("js-signin-open")) step("window_open");
      else { step("google_click"); setVia("google"); }
    } catch (err) {}
  }, true);
})();
