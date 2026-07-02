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
