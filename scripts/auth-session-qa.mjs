import { readFileSync } from "node:fs";
import vm from "node:vm";
import assert from "node:assert/strict";

const source = readFileSync(new URL("../assets/masar-auth-session.js", import.meta.url), "utf8");

function jwt(exp) {
  const payload = Buffer.from(JSON.stringify({ exp })).toString("base64url");
  return `header.${payload}.signature`;
}

function harness({ initial, fetchImpl, now = 1_800_000_000_000 }) {
  const data = new Map(initial ? [["masar_auth_session", JSON.stringify(initial)]] : []);
  const storage = {
    getItem(key) { return data.get(key) ?? null; },
    setItem(key, value) { data.set(key, String(value)); },
    removeItem(key) { data.delete(key); }
  };
  const window = {
    sessionStorage: storage,
    MASAR_CONFIG: { supabaseUrl: "https://example.supabase.co", supabaseAnonKey: "public-anon-key" }
  };
  vm.runInNewContext(source, { window, Date: class extends Date { static now() { return now; } }, Promise, JSON, Math, String, Error, Headers, atob, fetch: fetchImpl });
  return { api: window.MASARAuthSession, storage };
}

const now = 1_800_000_000_000;
const valid = { access_token: jwt(now / 1000 + 3600), refresh_token: "refresh-valid", user: { id: "learner-1" } };
{
  let requests = 0;
  const { api } = harness({ initial: valid, fetchImpl: async () => { requests++; throw new Error("unexpected network request"); }, now });
  const session = await api.getValidSession();
  assert.equal(session.access_token, valid.access_token, "valid access token is reused");
  assert.equal(requests, 0, "valid session does not refresh");
}

{
  const expired = { ...valid, access_token: jwt(now / 1000 - 1) };
  let refreshes = 0;
  const { api } = harness({ initial: expired, now, fetchImpl: async (url, options) => {
    refreshes++;
    assert.match(url, /auth\/v1\/token\?grant_type=refresh_token$/);
    assert.equal(JSON.parse(options.body).refresh_token, "refresh-valid");
    return { ok: true, json: async () => ({ ...valid, access_token: jwt(now / 1000 + 3600), refresh_token: "refresh-rotated" }) };
  } });
  const session = await api.getValidSession();
  assert.equal(refreshes, 1, "expired access token is refreshed once");
  assert.equal(session.refresh_token, "refresh-rotated", "rotated refresh token replaces the old value");
}

{
  const expired = { ...valid, access_token: jwt(now / 1000 - 1) };
  let refreshes = 0;
  const { api, storage } = harness({ initial: expired, now, fetchImpl: async () => {
    refreshes++;
    return { ok: false, status: 400, json: async () => ({ error: "invalid_grant", error_description: "Invalid Refresh Token" }) };
  } });
  await assert.rejects(api.getValidSession(), /مجدداً/);
  assert.equal(refreshes, 1, "invalid refresh token is not retried");
  assert.equal(storage.getItem("masar_auth_session"), null, "invalid session is removed");
}

{
  const expired = { ...valid, access_token: jwt(now / 1000 - 1) };
  let refreshes = 0;
  const { api } = harness({ initial: expired, now, fetchImpl: async () => {
    refreshes++;
    throw new Error("offline");
  } });
  await assert.rejects(api.getValidSession(), error => error.code === "MASAR_AUTH_TEMPORARY" && /تعذر الاتصال/.test(error.message));
  assert.equal(refreshes, 1, "network failure does not start a retry loop");
}

{
  const expired = { ...valid, access_token: jwt(now / 1000 - 1) };
  for (const status of [429, 500]) {
    const { api, storage } = harness({ initial: expired, now, fetchImpl: async () => ({
      ok: false,
      status,
      json: async () => ({ code: status === 429 ? "over_request_rate_limit" : "internal_error", message: "Temporary server error" })
    }) });
    await assert.rejects(api.getValidSession(), error => error.code === "MASAR_AUTH_TEMPORARY" && /تعذر الاتصال/.test(error.message));
    assert.deepEqual(JSON.parse(storage.getItem("masar_auth_session")), expired, `HTTP ${status} preserves the current session unchanged`);
  }
}

{
  const expired = { ...valid, access_token: jwt(now / 1000 - 1) };
  let requests = 0;
  const { api, storage } = harness({ initial: expired, now, fetchImpl: async () => {
    requests++;
    if (requests === 1) throw new Error("offline");
    return { ok: true, json: async () => ({ ...valid, access_token: jwt(now / 1000 + 3600), refresh_token: "refresh-after-reconnect" }) };
  } });
  await assert.rejects(api.getValidSession(), error => error.code === "MASAR_AUTH_TEMPORARY");
  assert.deepEqual(JSON.parse(storage.getItem("masar_auth_session")), expired, "temporary network failure leaves both current tokens available");
  const restored = await api.getValidSession();
  assert.equal(requests, 2, "a later call retries once after connectivity returns");
  assert.equal(restored.refresh_token, "refresh-after-reconnect", "successful retry stores the newly rotated refresh token");
}

{
  const expired = { ...valid, access_token: jwt(now / 1000 - 1) };
  let resolveRefresh;
  let gateCalls = 0;
  const freshToken = jwt(now / 1000 + 3600);
  const { api } = harness({ initial: expired, now, fetchImpl: (url, options) => {
    if (url.endsWith("/auth/v1/token?grant_type=refresh_token")) return new Promise(resolve => { resolveRefresh = resolve; });
    gateCalls++;
    assert.equal(options.headers.get("Authorization"), "Bearer " + freshToken, "access check receives the refreshed session token");
    return Promise.resolve({ status: 200 });
  } });
  const responsePromise = api.authorizedFetch("https://example.supabase.co/functions/v1/masar-access-check", { method: "POST" });
  while (!resolveRefresh) await new Promise(resolve => setImmediate(resolve));
  assert.equal(gateCalls, 0, "protected request waits until session restoration finishes");
  resolveRefresh({ ok: true, json: async () => ({ ...valid, access_token: freshToken }) });
  await responsePromise;
  assert.equal(gateCalls, 1, "protected request starts once after session refresh");
}

{
  const expired = { ...valid, access_token: jwt(now / 1000 - 1) };
  let refreshes = 0;
  const { api } = harness({ initial: expired, now, fetchImpl: async () => {
    refreshes++;
    throw new Error("offline");
  } });
  await Promise.allSettled([api.getValidSession(), api.getValidSession(), api.getValidSession()]);
  assert.equal(refreshes, 1, "concurrent callers share one refresh request");
}

{
  const expired = { ...valid, access_token: jwt(now / 1000 - 1) };
  let resolveRefresh;
  const { api, storage } = harness({ initial: expired, now, fetchImpl: () => new Promise(resolve => { resolveRefresh = resolve; }) });
  const oldRefresh = api.getValidSession();
  while (!resolveRefresh) await new Promise(resolve => setImmediate(resolve));
  const newer = { access_token: jwt(now / 1000 + 7200), refresh_token: "refresh-new-login" };
  api.accept(newer);
  resolveRefresh({ ok: true, json: async () => ({ access_token: jwt(now / 1000 + 3600), refresh_token: "refresh-old-rotation" }) });
  const result = await oldRefresh;
  assert.equal(result.refresh_token, "refresh-new-login", "an in-flight refresh resolves to the newer accepted session");
  assert.deepEqual(JSON.parse(storage.getItem("masar_auth_session")), { ...newer, expires_at: now / 1000 + 7200, token_type: "bearer" }, "an older refresh response cannot overwrite the newer access or refresh token");
}

{
  let resolveProtected;
  let protectedCalls = 0;
  const { api, storage } = harness({ initial: valid, now, fetchImpl: () => {
    protectedCalls++;
    return new Promise(resolve => { resolveProtected = resolve; });
  } });
  const oldRequest = api.authorizedFetch("https://example.supabase.co/functions/v1/masar-admin-users", { method: "POST" });
  while (!resolveProtected) await new Promise(resolve => setImmediate(resolve));
  const newer = { access_token: jwt(now / 1000 + 7200), refresh_token: "refresh-other-login" };
  api.accept(newer);
  resolveProtected({ status: 401 });
  const response = await oldRequest;
  assert.equal(response.status, 401, "a request started under the old session is not replayed after another session is accepted");
  assert.equal(protectedCalls, 1, "session replacement prevents cross-account 401 replay");
  assert.equal(JSON.parse(storage.getItem("masar_auth_session")).refresh_token, "refresh-other-login", "the newly accepted session survives the old request response");
}

{
  const expired = { ...valid, access_token: jwt(now / 1000 - 1) };
  let protectedCalls = 0;
  let refreshes = 0;
  const { api, storage } = harness({ initial: expired, now, fetchImpl: async url => {
    if (url.endsWith("/auth/v1/token?grant_type=refresh_token")) {
      refreshes++;
      return { ok: true, json: async () => ({ ...valid, access_token: jwt(now / 1000 + 3600), refresh_token: "refresh-rotated" }) };
    }
    protectedCalls++;
    return { status: 401 };
  } });
  const response = await api.authorizedFetch("https://example.supabase.co/functions/v1/masar-access-check");
  const stored = JSON.parse(storage.getItem("masar_auth_session"));
  assert.equal(protectedCalls, 2, "a 401 gets one refreshed request, not an unbounded retry");
  assert.equal(refreshes, 2, "one proactive refresh and one 401 recovery refresh are bounded");
  assert.equal(response.status, 401, "the final endpoint rejection is returned to the caller for endpoint-specific handling");
  assert.equal(stored.refresh_token, "refresh-rotated", "an endpoint 401 does not erase a session that was successfully refreshed");
}

{
  const { api, storage } = harness({ fetchImpl: async () => { throw new Error("unexpected network request"); }, now });
  api.accept({ ...valid, password: "must-not-be-stored" });
  const saved = JSON.parse(storage.getItem("masar_auth_session"));
  assert.equal(saved.refresh_token, "refresh-valid", "login session preserves the refresh token");
  assert.equal("password" in saved, false, "login password is not persisted in browser storage");
  api.clear();
  assert.equal(storage.getItem("masar_auth_session"), null, "logout clears the tab session");
}

const accountSource = readFileSync(new URL("../account.html", import.meta.url), "utf8");
const adminSource = readFileSync(new URL("../admin.html", import.meta.url), "utf8");
assert.ok(accountSource.includes('if(e.code!=="MASAR_AUTH_TEMPORARY")authSession.clear()'), "account session restoration preserves tokens after temporary failures");
assert.ok(!adminSource.includes('if(e.code!=="MASAR_AUTH_TEMPORARY")authSession.clear()'), "failed admin login or authorization does not clear a separate valid tab session");

console.log("MASAR auth session QA passed: valid/expired sessions, rotated refresh tokens, temporary failures and recovery, awaited protected requests, concurrent refresh deduplication, accept/refresh race protection, bounded 401 recovery, endpoint-401 session preservation, and login/logout storage.");
