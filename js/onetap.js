/* Google One Tap: a signed-out visitor who is signed in to Google gets a small "Continue as …" card on
   this page; one click signs them in to Benjamin without leaving it (Supabase signInWithIdToken).
   Added next to the existing buttons, which keep working as before. If One Tap isn't available
   (blocked, no Google session, turned off with ONETAP: false in config.js) nothing changes.
   Needs: GOOGLE_CLIENT_ID in config.js, and this site listed as an "Authorized JavaScript origin" on
   that Google OAuth client. Load after auth.js. */
(function () {
  var cfg = window.SCICOPROOF_CONFIG || {};
  var Auth = window.SciCoProofAuth;
  var Steps = window.SciCoSigninSteps;
  if (!cfg.GOOGLE_CLIENT_ID || cfg.ONETAP === false || !Auth || !Auth.signInWithGoogleIdToken) return;
  if (location.hash.indexOf("access_token") >= 0 || /[?&](code|error)=/.test(location.search)) return;
  if (Steps && Steps.signedInHere()) return;

  function step(name, detail) { if (Steps) Steps.step(name, detail); }
  function wait(on) { if (window.__signinWait) window.__signinWait(on); }
  function googleScreenStarted() {             // they already clicked a sign-in button
    var el = document.getElementById("signinWait");
    return !!(el && el.classList.contains("on"));
  }

  var rawNonce = "";
  function randomNonce() {
    var a = new Uint8Array(24);
    crypto.getRandomValues(a);
    return Array.prototype.map.call(a, function (b) { return ("0" + b.toString(16)).slice(-2); }).join("");
  }
  function sha256Hex(s) {
    return crypto.subtle.digest("SHA-256", new TextEncoder().encode(s)).then(function (buf) {
      return Array.prototype.map.call(new Uint8Array(buf), function (b) { return ("0" + b.toString(16)).slice(-2); }).join("");
    });
  }

  function onCredential(resp) {
    step("onetap_picked");
    if (Steps) Steps.setVia("onetap");
    wait(true);
    Auth.signInWithGoogleIdToken(resp.credential, rawNonce).then(function () {
      location.href = "app.html";              // same place the Google button lands
    }).catch(function (err) {
      step("onetap_failed");
      if (window.SciCoSigninReport) window.SciCoSigninReport("onetap", (err && err.message) || String(err));
      wait(false);                             // the buttons are still there to try again
    });
  }

  function onMoment(n) {
    try {
      if (n.isSkippedMoment && n.isSkippedMoment()) step("onetap_skipped", n.getSkippedReason && n.getSkippedReason());
      else if (n.isDismissedMoment && n.isDismissedMoment()) {
        var r = n.getDismissedReason && n.getDismissedReason();
        if (r && r !== "credential_returned") step("onetap_skipped", r);
      } else if (n.isNotDisplayed && n.isNotDisplayed()) {
        step("onetap_skipped", n.getNotDisplayedReason && n.getNotDisplayedReason());
      }
    } catch (e) {}
  }

  function start() {
    if (!window.google || !google.accounts || !google.accounts.id || !window.crypto || !crypto.subtle) return;
    if (googleScreenStarted() || (Steps && Steps.signedInHere())) return;
    rawNonce = randomNonce();
    sha256Hex(rawNonce).then(function (hashed) {
      google.accounts.id.initialize({
        client_id: cfg.GOOGLE_CLIENT_ID,
        callback: onCredential,
        nonce: hashed,                         // Supabase checks the token against the raw nonce
        context: "signin",
        itp_support: true,
        use_fedcm_for_prompt: true,
      });
      if (googleScreenStarted()) return;
      step("onetap_offered");
      google.accounts.id.prompt(onMoment);
    }).catch(function () {});
  }

  // Clicking one of the page's own sign-in buttons closes the card, so the two never overlap.
  document.addEventListener("click", function (e) {
    var t = e.target.closest && e.target.closest(".js-signin, .js-email-signin");
    if (t && window.google && google.accounts && google.accounts.id) {
      try { google.accounts.id.cancel(); } catch (err) {}
    }
  }, true);

  var s = document.createElement("script");
  s.src = "https://accounts.google.com/gsi/client";
  s.async = true;
  s.onload = function () { setTimeout(start, 800); };
  s.onerror = function () { step("onetap_skipped", "script_blocked"); };
  document.head.appendChild(s);
})();
