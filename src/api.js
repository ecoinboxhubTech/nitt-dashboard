// Thin client for the NITT Library REST API (see NITT_Library_API_Guide.pdf).
const BASE = (import.meta.env.VITE_API_URL || "http://127.0.0.1:8000/api").replace(/\/$/, "");
const TOKEN_KEY = "nitt-token";

export const getToken = () => { try { return localStorage.getItem(TOKEN_KEY); } catch { return null; } };
export const setToken = (t) => { try { t ? localStorage.setItem(TOKEN_KEY, t) : localStorage.removeItem(TOKEN_KEY); } catch { /* storage unavailable */ } };

export class ApiError extends Error {
  constructor(status, detail) {
    super(describe(detail));
    this.status = status;
    this.detail = detail;
    this.code = detail && typeof detail === "object" && !Array.isArray(detail) ? detail.code : undefined;
    this.blocks = detail && typeof detail === "object" ? detail.blocks : undefined;
  }
}

function describe(detail) {
  if (!detail) return "Something went wrong. Please try again.";
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail)) return detail.map((d) => `${(d.loc || []).slice(1).join(".")}: ${d.msg}`).join("; ");
  return detail.message || "Something went wrong. Please try again.";
}

export async function api(path, { method = "GET", body, query, form, raw = false } = {}) {
  const url = new URL(BASE + path);
  Object.entries(query || {}).forEach(([k, v]) => { if (v !== undefined && v !== null && v !== "") url.searchParams.set(k, v); });
  const headers = {};
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;
  let payload;
  if (form) payload = form;
  else if (body !== undefined) { headers["Content-Type"] = "application/json"; payload = JSON.stringify(body); }

  let res;
  try { res = await fetch(url, { method, headers, body: payload }); }
  catch { throw new ApiError(0, "Cannot reach the library server. Check your connection and try again."); }

  // Sliding session: the server hands back a fresh token when ours is getting old.
  const fresh = res.headers.get("X-New-Token");
  if (fresh) setToken(fresh);

  if (!res.ok) {
    if (res.status === 401 && token && !path.startsWith("/auth/login")) {
      setToken(null);
      window.dispatchEvent(new Event("nitt:logout"));
    }
    let detail;
    try { detail = (await res.json()).detail; } catch { /* no body */ }
    throw new ApiError(res.status, detail);
  }
  return raw ? res : res.json();
}

export async function downloadCsv(path, query, filename) {
  const res = await api(path, { query: { ...query, format: "csv" }, raw: true });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(await res.blob());
  a.download = filename;
  a.click();
  URL.revokeObjectURL(a.href);
}
