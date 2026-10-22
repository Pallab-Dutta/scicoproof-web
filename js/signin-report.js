/* Reports sign-in failures to the owner (Telegram, via the backend). No dependencies, so it works even
   when the sign-in library itself didn't load. Never shows anything to the visitor and never throws.
   window.SciCoSigninReport(stage, message, extra?)  stage: google_start | library | oauth_return |
   code_exchange | email_send | email_code | terms_save */
(function () {
  var cfg = window.SCICOPROOF_CONFIG || {};
  var BASE = (cfg.API_BASE || "").replace(/\/$/, "");

  function trialPaper() {
    try {
      var p = JSON.parse(localStorage.getItem("benjamin_trial") || "null");
      return p && p.paper ? String(p.paper) : "";
    } catch (e) { return ""; }
  }

  function report(stage, message, extra) {
    try {
      if (!BASE) return;
      var body = { stage: stage, message: String(message || "").slice(0, 300),
                   page: location.pathname.replace(/^\//, "") || "index.html", trial: trialPaper() };
      if (extra && extra.email) body.email = String(extra.email).slice(0, 120);
      fetch(BASE + "/client/signin-error", {
        method: "POST", headers: { "Content-Type": "text/plain" },   // simple request: no CORS preflight
        body: JSON.stringify(body), keepalive: true,      // still sent if the page is leaving
      }).catch(function () {});
    } catch (e) {}
  }
  window.SciCoSigninReport = report;

  // Back from Google with a code: if no session comes of it, the app's auth guard reports it.
  try { window.__hadAuthCode = new URLSearchParams(location.search).has("code"); } catch (e) {}

  // Google / Supabase sent the visitor back with an error (e.g. ?error=access_denied&error_description=…)
  try {
    var q = new URLSearchParams(location.search);
    var h = new URLSearchParams(location.hash.replace(/^#/, ""));
    var err = q.get("error") || h.get("error");
    if (err) {
      var desc = q.get("error_description") || h.get("error_description") || "";
      var code = q.get("error_code") || h.get("error_code") || "";
      report("oauth_return", err + (code ? " / " + code : "") + (desc ? ": " + desc : ""));
    }
  } catch (e) {}
})();
