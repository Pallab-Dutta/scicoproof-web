/* SciCoproof frontend configuration.
   Safe to expose: the Supabase anon key is public by design; RLS and backend
   service-role credentials protect private data. */
window.SCICOPROOF_CONFIG = {
  // HuggingFace Space API base URL (no trailing slash)
  API_BASE: "https://pallab-dutta-1997-scicoproof-api.hf.space",

  // Shared SciCo Supabase project used by SciCo-Search.
  SUPABASE_URL: "https://gjwhhdlocxxycczlsfgy.supabase.co",
  SUPABASE_ANON_KEY: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imdqd2hoZGxvY3h4eWNjemxzZmd5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODI2MTU2NjYsImV4cCI6MjA5ODE5MTY2Nn0.vyj5PZyFZxspFzMqN4vwUjkQQXMk2qXB3zt1BQxs7Rw",

  // Where Google OAuth returns to (must be registered in Supabase Auth URL config).
  REDIRECT_URL: "https://proofread.scicoagent.com/app.html",
};
