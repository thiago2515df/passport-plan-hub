/**
 * PassHub Data API — separate from the paid supplier/search API.
 * GET-only, X-Api-Key only, never authenticates with /auth/token.
 * Source: PassHub API de dados integration guide provided by agency.
 */
export const PASSHUB_DATA_RESOURCES = [
  "air", "bus", "car", "hotel", "insurance", "payment_links", "users",
] as const;
export type PasshubDataResource = (typeof PASSHUB_DATA_RESOURCES)[number];

export const PASSHUB_DATA_PATHS: Record<PasshubDataResource, string> = {
  air: "/v1/orders",
  bus: "/v1/bus/orders",
  car: "/v1/car/orders",
  hotel: "/v1/hotel/orders",
  insurance: "/v1/insurance/orders",
  payment_links: "/v1/payment-links",
  users: "/v1/users",
};

const BASE_URL = "https://partner-api.passhub.com.br";
const MAX_REQUESTS_PER_MINUTE = 55; // reserve headroom under PassHub's 60/min/key
const requests: number[] = [];

export type PasshubDataReadiness = {
  keyConfigured: boolean;
  ready: boolean;
  resources: Record<PasshubDataResource, boolean>;
};

export function passhubDataReadiness(env: NodeJS.ProcessEnv = process.env): PasshubDataReadiness {
  const keyConfigured = Boolean(env.PASSHUB_DATA_API_KEY?.trim());
  return {
    keyConfigured,
    ready: keyConfigured,
    resources: Object.fromEntries(PASSHUB_DATA_RESOURCES.map(r => [r, true])) as Record<PasshubDataResource, boolean>,
  };
}

export class PasshubDataError extends Error {
  constructor(message: string, public readonly status?: number, public readonly retryAfterSeconds?: number) {
    super(message);
    this.name = "PasshubDataError";
  }
}

export function validatedPasshubDataUrl(endpoint: string): URL {
  // Paths are exclusively selected by the server, not provided by browsers.
  const url = new URL(endpoint, BASE_URL);
  if (url.origin !== BASE_URL || !url.pathname.startsWith("/v1/") ||
      url.username || url.password || url.hash)
    throw new PasshubDataError("Caminho de consulta inválido.");
  return url;
}

function resourcePath(resource: PasshubDataResource): string {
  if (!PASSHUB_DATA_RESOURCES.includes(resource))
    throw new PasshubDataError("Recurso não permitido.");
  return PASSHUB_DATA_PATHS[resource];
}

function validateRecordId(id: string): string {
  if (!/^[a-zA-Z0-9_-]{1,128}$/.test(id)) throw new PasshubDataError("Identificador de registro inválido.");
  return encodeURIComponent(id);
}

function checkLocalRateLimit(now = Date.now()): void {
  while (requests.length && requests[0]! <= now - 60_000) requests.shift();
  if (requests.length >= MAX_REQUESTS_PER_MINUTE) {
    const retry = Math.max(1, Math.ceil((60_000 - (now - requests[0]!)) / 1000));
    throw new PasshubDataError("Muitas consultas. Aguarde antes de tentar novamente.", 429, retry);
  }
  requests.push(now);
}

function parseRetryAfter(res: Response): number | undefined {
  const seconds = Number(res.headers.get("Retry-After"));
  return Number.isFinite(seconds) && seconds >= 0 ? Math.min(3600, Math.ceil(seconds)) : undefined;
}

export async function passhubDataGet(
  path: string,
  params: Record<string, string | number | undefined> = {},
  env: NodeJS.ProcessEnv = process.env,
  requester: typeof fetch = fetch,
): Promise<unknown> {
  const key = env.PASSHUB_DATA_API_KEY?.trim();
  if (!key) throw new PasshubDataError("Cadastre PASSHUB_DATA_API_KEY nos Secrets do Lovable.");
  const url = validatedPasshubDataUrl(path);
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined) url.searchParams.set(k, String(v));
  }
  for (let attempt = 0; attempt < 2; attempt++) {
    checkLocalRateLimit();
    let res: Response;
    try {
      res = await requester(url.toString(), {
        method: "GET",
        headers: { "X-Api-Key": key, Accept: "application/json" },
        redirect: "error",
        signal: AbortSignal.timeout(20000),
      });
    } catch {
      throw new PasshubDataError("Não foi possível conectar à API de dados PassHub.");
    }
    if (!res.ok) {
      if (res.status === 503 && attempt === 0) {
        await new Promise(resolve => setTimeout(resolve, 700));
        continue;
      }
      const retry = parseRetryAfter(res);
      const message = res.status === 401 ? "Chave da API de dados inválida ou revogada (401)." :
        res.status === 403 ? "Acesso não permitido para esta chave (403). Contate a PassHub." :
        res.status === 404 ? "Registro não encontrado (404)." :
        res.status === 429 ? `Limite da PassHub atingido (429). Aguarde ${retry ?? 60}s.` :
        res.status === 422 ? "Parâmetros inválidos. Use páginas a partir de 1 e até 100 registros." :
        res.status === 503 ? "PassHub indisponível temporariamente (503)." :
        `Consulta PassHub indisponível (HTTP ${res.status}).`;
      // Don't echo provider body — may contain PII, signed URLs or secrets.
      throw new PasshubDataError(message, res.status, retry);
    }
    if (!res.headers.get("content-type")?.toLowerCase().includes("json"))
      throw new PasshubDataError("Resposta inesperada: a API não retornou JSON.");
    const length = Number(res.headers.get("content-length") ?? 0);
    if (length > 2_000_000) throw new PasshubDataError("Resposta muito grande.");
    try { return await res.json() as unknown; }
    catch { throw new PasshubDataError("A PassHub retornou JSON inválido."); }
  }
  throw new PasshubDataError("PassHub indisponível.");
}

export function listPasshubData(
  resource: PasshubDataResource,
  page = 1,
  pageSize = 20,
  env: NodeJS.ProcessEnv = process.env,
  requester: typeof fetch = fetch,
): Promise<unknown> {
  if (!Number.isInteger(page) || page < 1 || page > 100_000 ||
      !Number.isInteger(pageSize) || pageSize < 1 || pageSize > 100)
    throw new PasshubDataError("Paginação inválida.");
  return passhubDataGet(resourcePath(resource), { page, pageSize }, env, requester);
}

export function detailPasshubData(
  resource: Exclude<PasshubDataResource, "users">,
  id: string,
  env: NodeJS.ProcessEnv = process.env,
  requester: typeof fetch = fetch,
): Promise<unknown> {
  return passhubDataGet(`${resourcePath(resource)}/${validateRecordId(id)}`, {}, env, requester);
}

export function linkPaymentsPasshubData(
  id: string,
  env: NodeJS.ProcessEnv = process.env,
  requester: typeof fetch = fetch,
): Promise<unknown> {
  return passhubDataGet(`${resourcePath("payment_links")}/${validateRecordId(id)}/payments`, {}, env, requester);
}

/** Retained wrapper for checks/older tests: list first page, never return data to public clients. */
export const readPasshubData = (
  resource: PasshubDataResource,
  env: NodeJS.ProcessEnv = process.env,
  requester: typeof fetch = fetch,
): Promise<unknown> => listPasshubData(resource, 1, 20, env, requester);
