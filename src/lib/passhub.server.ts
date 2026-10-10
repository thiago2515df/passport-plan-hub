const BASE = "https://partner-api.passhub.com.br/v1";

const cache = new Map<string, { token: string; exp: number }>();

export class PasshubError extends Error {
  constructor(public status: number, public code: string, message: string, public retriable = false) {
    super(message);
  }
}

function creds(keyName = "PASSHUB_API_KEY") {
  const key = process.env[keyName];
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

async function getToken(keyName: string) {
  const now = Date.now() / 1000;
  const cached = cache.get(keyName);
  if (cached && cached.exp - now > 3600) return cached.token;
  const { key, email, password } = creds(keyName);
  const res = await fetch(`${BASE}/auth/token`, {
    method: "POST",
    headers: { "X-Api-Key": key, "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  if (!res.ok) throw await parseError(res);
  const d = (await res.json()) as { accessToken: string; expiresAt: number };
  cache.set(keyName, { token: d.accessToken, exp: d.expiresAt });
  return d.accessToken;
}

export async function passhub<T>(path: string, init: { method?: string; body?: unknown; keyName?: string } = {}, retried = false): Promise<T> {
  const keyName = init.keyName ?? "PASSHUB_API_KEY";
  const { key } = creds(keyName);
  const token = await getToken(keyName);
  const res = await fetch(`${BASE}${path}`, {
    method: init.method ?? "GET",
    headers: { "X-Api-Key": key, Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: init.body === undefined ? null : JSON.stringify(init.body),
  });
  if (res.status === 401 && !retried) {
    const err = await parseError(res);
    if (err.code === "UNAUTHORIZED") {
      cache.delete(keyName);
      return passhub<T>(path, init, true);
    }
    throw err;
  }
  if (!res.ok) throw await parseError(res);
  return (await res.json()) as T;
}
