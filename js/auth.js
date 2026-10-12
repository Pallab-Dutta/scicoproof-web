/* SciCoproof auth client.
   Uses the same Supabase Google OAuth session format as SciCo-Search. */
(function () {
  const cfg = window.SCICOPROOF_CONFIG || {};
  let client = null;

  function getClient() {
    if (client) return client;
    if (!window.supabase || !cfg.SUPABASE_URL) return null;
    client = window.supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_ANON_KEY);
    return client;
  }

  const Auth = {
    client: getClient,

    async signInWithGoogle() {
      const c = getClient();
      if (!c) throw new Error("Supabase not configured");
      return c.auth.signInWithOAuth({
        provider: "google",
        options: { redirectTo: cfg.REDIRECT_URL || window.location.origin + "/app.html" },
      });
    },

    // Email sign-in (no password): Supabase emails a one-time link AND a 6-digit code (when the
    // "Magic Link" email template includes {{ .Token }}). The same address as a Google account
    // signs in to that same account (Supabase links identities with the same verified email).
    async signInWithEmail(email) {
      const c = getClient();
      if (!c) throw new Error("Supabase not configured");
      const { error } = await c.auth.signInWithOtp({
        email: email,
        options: { emailRedirectTo: cfg.REDIRECT_URL || window.location.origin + "/app.html",
                   shouldCreateUser: true },
      });
      if (error) throw error;
    },

    async verifyEmailCode(email, code) {
      const c = getClient();
      if (!c) throw new Error("Supabase not configured");
      const { data, error } = await c.auth.verifyOtp({ email: email, token: code, type: "email" });
      if (error) throw error;
      return data;
    },

    async handleCallback() {
      return false;
    },

    async signOut() {
      const c = getClient();
      if (c) await c.auth.signOut();
    },

    async getUser() {
      const c = getClient();
      if (!c) return null;
      const { data } = await c.auth.getUser();
      return data ? data.user : null;
    },

    async getToken() {
      const c = getClient();
      if (!c) return null;
      const { data } = await c.auth.getSession();
      return data && data.session ? data.session.access_token : null;
    },

    onChange(cb) {
      const c = getClient();
      if (!c) { cb(null); return; }
      c.auth.getUser().then(({ data }) => cb(data ? data.user : null));
      c.auth.onAuthStateChange((_event, session) => cb(session ? session.user : null));
    },
  };

  window.SciCoProofAuth = Auth;
  window.SciCoAuth = Auth;
})();
