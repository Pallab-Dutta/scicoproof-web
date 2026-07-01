/* SciCoproof Google OAuth client.
   Uses the standard authorization-code flow: browser redirects to Google,
   Google sends back ?code=… to REDIRECT_URL (app.html), then app.html POSTs
   the code to the backend /auth/google endpoint and stores the returned JWT.

   Exposes window.SciCoProofAuth with the same interface shape as the
   SciCo-Search SciCoAuth so shell.js can stay symmetric. */
(function () {
  const cfg = window.SCICOPROOF_CONFIG || {};
  const LS_TOKEN = "scicoproof_token";
  const LS_USER  = "scicoproof_user";

  let _user = null;
  let _cbs  = [];

  function _fire(user) {
    _user = user;
    _cbs.forEach(cb => { try { cb(user); } catch (_) {} });
  }

  function _load() {
    try {
      const raw = localStorage.getItem(LS_USER);
      return raw ? JSON.parse(raw) : null;
    } catch (_) { return null; }
  }

  // Restore session from localStorage on load.
  _user = _load();

  const Auth = {
    /** Redirect the browser to Google's OAuth consent page. */
    signInWithGoogle() {
      const state = btoa(Math.random().toString());
      sessionStorage.setItem("oauth_state", state);
      const params = new URLSearchParams({
        response_type: "code",
        client_id: cfg.GOOGLE_CLIENT_ID || "",
        redirect_uri: cfg.REDIRECT_URL || window.location.origin + "/app.html",
        scope: "openid email profile",
        state,
        prompt: "select_account",
      });
      window.location.href = "https://accounts.google.com/o/oauth2/v2/auth?" + params;
    },

    /** Exchange the authorization code that Google placed in ?code= with the backend. */
    async handleCallback() {
      const params = new URLSearchParams(window.location.search);
      const code = params.get("code");
      if (!code) return false;

      // Remove code from the URL bar immediately to prevent double-exchange on reload.
      const clean = window.location.pathname + window.location.hash;
      window.history.replaceState({}, "", clean);

      const base = (cfg.API_BASE || "").replace(/\/$/, "");
      const redirect_uri = cfg.REDIRECT_URL || window.location.origin + "/app.html";
      const res = await fetch(base + "/auth/google", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code, redirect_uri }),
      });
      if (!res.ok) throw new Error("Auth exchange failed: " + res.statusText);

      const data = await res.json();
      localStorage.setItem(LS_TOKEN, data.token);
      localStorage.setItem(LS_USER, JSON.stringify(data.user));
      _fire(data.user);
      return true;
    },

    signOut() {
      localStorage.removeItem(LS_TOKEN);
      localStorage.removeItem(LS_USER);
      _fire(null);
    },

    getToken() {
      return localStorage.getItem(LS_TOKEN);
    },

    getUser() {
      return _user || _load();
    },

    /** Calls cb(user|null) immediately and on every auth-state change. */
    onChange(cb) {
      _cbs.push(cb);
      cb(_user || _load());
    },
  };

  window.SciCoProofAuth = Auth;
})();
