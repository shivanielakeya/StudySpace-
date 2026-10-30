(function (global) {
  const config = global.STUDYSPACE_SUPABASE_CONFIG || {};
  function isPublishableKey(value) {
    if (typeof value !== "string") return false;
    if (value.startsWith("sb_publishable_")) return value.length > 20;
    if (value.startsWith("sb_secret_")) return false;
    const parts = value.split(".");
    if (parts.length !== 3) return false;
    try {
      const encoded = parts[1].replace(/-/g, "+").replace(/_/g, "/");
      const padded = encoded.padEnd(Math.ceil(encoded.length / 4) * 4, "=");
      const payload = JSON.parse(global.atob(padded));
      return payload.role === "anon";
    } catch {
      return false;
    }
  }
  let projectUrl = "";
  try {
    const url = new URL(config.url);
    if (url.protocol === "https:" && !url.hostname.includes("YOUR_PROJECT_ID")) projectUrl = url.href.replace(/\/$/, "");
  } catch {
    projectUrl = "";
  }
  const configured = Boolean(
    global.supabase &&
    projectUrl &&
    isPublishableKey(config.publishableKey)
  );

  global.StudySpaceSupabase = {
    configured,
    client: configured
      ? global.supabase.createClient(projectUrl, config.publishableKey, {
        auth: {
          autoRefreshToken: true,
          detectSessionInUrl: true,
          persistSession: true,
        },
      })
      : null,
  };
})(window);
