const BASE = "https://partner-api.passhub.com.br/v1";

let cached: { token: string; exp: number } | null = null;

export class PasshubError extends Error {
  constructor(public status: number, public code: string, message: string, public retriable = false) {
    super(message);
  }
}

function creds() {
  const key = process.env["PASSHUB_API_KEY"];
  const email = process.env["PASSHUB_API_EMAIL"];
  const password = process.env["PASSHUB_API_PASSWORD"];
  if (!key || !email || !password) throw new PasshubError(500, "CONFIG", "Credenciais PassHub não configuradas");
  return { key, email, password };
}

async function parseError(res: Response) {
  const body = await res.json().catch(() => ({}));
  const e = body?.error ?? {};
  console.error(`PassHub ${res.status}: ${JSON.stringify(body)}`);
  return new PasshubError(res.status, e.code ?? "UNKNOWN", e.message ?? res.statusText, !!e.retriable);
}

async function getToken(force = false) {
  const now = Date.now() / 1000;
  if (!force && cached && cached.exp - now > 3600) return cached.token;
  const { key, email, password } = creds();
  const res = await fetch(`${BASE}/auth/token`, {
    method: "POST",
    headers: { "X-Api-Key": key, "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  if (!res.ok) throw await parseError(res);
  const d = (await res.json()) as { accessToken: string; expiresAt: number };
  cached = { token: d.accessToken, exp: d.expiresAt };
  return d.accessToken;
}

export async function passhub<T>(path: string, init: { method?: string; body?: unknown } = {}, retried = false): Promise<T> {
  const { key } = creds();
  const token = await getToken();
  const res = await fetch(`${BASE}${path}`, {
    method: init.method ?? "GET",
    headers: { "X-Api-Key": key, Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: init.body === undefined ? null : JSON.stringify(init.body),
  });
  if (res.status === 401 && !retried) {
    const err = await parseError(res);
    if (err.code === "UNAUTHORIZED") {
      cached = null;
      return passhub<T>(path, init, true);
    }
    throw err;
  }
  if (!res.ok) throw await parseError(res);
  return (await res.json()) as T;
}
