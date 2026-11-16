(() => {
  "use strict";
  const KEY = "masar_auth_session";
  const config = () => window.MASAR_CONFIG || {};
  let refreshInFlight = null;
  let sessionRevision = 0;

  function read() {
    try {
      const value = JSON.parse(window.sessionStorage.getItem(KEY) || "null");
      return value && typeof value === "object" ? value : null;
    } catch {
      return null;
    }
  }

  function save(session) {
    if (!session?.access_token || !session?.refresh_token) throw new Error("تعذر استعادة الجلسة. سجّل الدخول مجدداً.");
    const expiresAt = Number(session.expires_at) || (Number(session.expires_in) > 0
      ? Math.floor(Date.now() / 1000) + Number(session.expires_in)
      : tokenExpiry(session.access_token));
    const stored = {
      access_token: session.access_token,
      refresh_token: session.refresh_token,
      expires_at: expiresAt,
      token_type: session.token_type || "bearer"
    };
    window.sessionStorage.setItem(KEY, JSON.stringify(stored));
    return stored;
  }

  function tokenExpiry(token) {
    try {
      const payload = token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/");
      const parsed = JSON.parse(atob(payload));
      return Number(parsed.exp) || 0;
    } catch {
      return 0;
    }
  }

  function valid(session) {
    const exp = Number(session?.expires_at) || tokenExpiry(session?.access_token || "");
    return !!session?.access_token && exp > Math.floor(Date.now() / 1000) + 60;
  }

  function loginRequired() {
    const error = new Error("انتهت الجلسة أو تعذر تجديدها. سجّل الدخول مجدداً.");
    error.code = "MASAR_SESSION_EXPIRED";
    return error;
  }

  function temporaryAuthError() {
    const error = new Error("تعذر الاتصال بخدمة الجلسة حالياً. تحقق من اتصالك وحاول مجدداً.");
    error.code = "MASAR_AUTH_TEMPORARY";
    return error;
  }

  function invalidRefreshToken(data) {
    const code = String(data?.error || data?.code || "").toLowerCase();
    const message = String(data?.error_description || data?.message || "");
    return ["invalid_grant", "refresh_token_not_found", "refresh_token_already_used"].includes(code)
      || /invalid refresh token|refresh token (?:not found|expired|revoked|already used)/i.test(message);
  }

  function supersedingSession(revision) {
    if (sessionRevision === revision) return { changed: false, session: null };
    const current = read();
    return { changed: true, session: valid(current) ? current : null };
  }

  async function refresh(observedSession = null) {
    const beforeWait = read();
    if (observedSession && beforeWait?.access_token !== observedSession.access_token && valid(beforeWait)) return beforeWait;
    if (refreshInFlight) {
      const pending = refreshInFlight;
      if (pending.revision === sessionRevision) return pending.promise;
      await pending.promise.catch(() => {});
      if (refreshInFlight === pending) refreshInFlight = null;
      const latest = read();
      if (valid(latest)) return latest;
      return refresh(observedSession);
    }
    const revision = sessionRevision;
    const current = read();
    if (!current?.refresh_token) throw loginRequired();
    let promise;
    promise = (async () => {
      const cfg = config();
      let response;
      try {
        response = await fetch(cfg.supabaseUrl.replace(/\/$/, "") + "/auth/v1/token?grant_type=refresh_token", {
          method: "POST",
          headers: { apikey: cfg.supabaseAnonKey, "Content-Type": "application/json" },
          body: JSON.stringify({ refresh_token: current.refresh_token })
        });
      } catch {
        const newer = supersedingSession(revision);
        if (newer.changed) {
          if (newer.session) return newer.session;
          throw temporaryAuthError();
        }
        throw temporaryAuthError();
      }
      const data = await response.json().catch(() => ({}));
      const newer = supersedingSession(revision);
      if (newer.changed) {
        if (newer.session) return newer.session;
        throw temporaryAuthError();
      }
      if (response.status === 429 || response.status >= 500) throw temporaryAuthError();
      if (!response.ok) {
        if (!invalidRefreshToken(data)) throw temporaryAuthError();
        window.sessionStorage.removeItem(KEY);
        sessionRevision++;
        throw loginRequired();
      }
      if (!data.access_token || !data.refresh_token) throw temporaryAuthError();
      try {
        const saved = save(data);
        sessionRevision++;
        return saved;
      } catch {
        window.sessionStorage.removeItem(KEY);
        sessionRevision++;
        throw loginRequired();
      }
    })();
    refreshInFlight = { revision, promise };
    try {
      return await promise;
    } finally {
      if (refreshInFlight?.promise === promise) refreshInFlight = null;
    }
  }

  async function getValidSession() {
    const current = read();
    if (valid(current)) return current;
    return refresh();
  }

  async function authorizedFetch(url, options = {}) {
    const session = await getValidSession();
    const requestRevision = sessionRevision;
    const headers = new Headers(options.headers || {});
    headers.set("Authorization", "Bearer " + session.access_token);
    let response = await fetch(url, { ...options, headers });
    if (response.status !== 401) return response;
    if (sessionRevision !== requestRevision) return response;
    const renewed = await refresh(session);
    headers.set("Authorization", "Bearer " + renewed.access_token);
    response = await fetch(url, { ...options, headers });
    return response;
  }

  function accept(session) {
    const saved = save(session);
    sessionRevision++;
    return saved;
  }

  function clear() {
    window.sessionStorage.removeItem(KEY);
    sessionRevision++;
  }

  window.MASARAuthSession = {
    accept,
    clear,
    getValidSession,
    authorizedFetch
  };
})();
