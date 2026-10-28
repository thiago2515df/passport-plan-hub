/**
 * Separate, read-only PassHub Data API client.
 *
 * IMPORTANT: This is NOT the existing partner hotel/flight search API.
 * The new Data API's "Abrir o guia" documentation is not public; set its
 * documented base URL, paths and authentication header before enabling reads.
 * Never assume the partner-api /v1 endpoints also expose agency records.
 */
export type PasshubDataResource = "reservations" | "issuances" | "payment_links" | "users";
export const PASSHUB_DATA_RESOURCES = ["reservations", "issuances", "payment_links", "users"] as const;

const RESOURCE_PATH_ENV: Record<PasshubDataResource, string> = {
  reservations: "PASSHUB_DATA_RESERVATIONS_PATH",
  issuances: "PASSHUB_DATA_ISSUANCES_PATH",
  payment_links: "PASSHUB_DATA_PAYMENT_LINKS_PATH",
  users: "PASSHUB_DATA_USERS_PATH",
};

export type PasshubDataReadiness = {
  keyConfigured: boolean;
  baseUrlConfigured: boolean;
  authConfigured: boolean;
  resources: Record<PasshubDataResource, boolean>;
  ready: boolean;
};

export function passhubDataReadiness(env: NodeJS.ProcessEnv = process.env): PasshubDataReadiness {
  const keyConfigured = Boolean(env.PASSHUB_DATA_API_KEY?.trim());
  const baseUrlConfigured = Boolean(env.PASSHUB_DATA_API_BASE_URL?.trim());
  // Header/prefix must follow official documentation, not guessing Bearer.
  const authConfigured = Boolean(env.PASSHUB_DATA_API_AUTH_HEADER?.trim());
  const resources = Object.fromEntries(PASSHUB_DATA_RESOURCES.map(resource =>
    [resource, Boolean(env[RESOURCE_PATH_ENV[resource]]?.trim())],
  )) as Record<PasshubDataResource, boolean>;
  return {
    keyConfigured, baseUrlConfigured, authConfigured, resources,
    ready: keyConfigured && baseUrlConfigured && authConfigured &&
      Object.values(resources).some(Boolean),
  };
}

export class PasshubDataError extends Error {
  constructor(message: string, public readonly status?: number) {
    super(message);
    this.name = "PasshubDataError";
  }
}

/** Validates HTTPS + official PassHub domains. Blocks SSRF, localhost and arbitrary URLs. */
export function validatedPasshubDataUrl(base: string, endpoint: string): URL {
  let url: URL;
  try { url = new URL(base); } catch { throw new PasshubDataError("URL base da API de dados inválida."); }
  if (url.protocol !== "https:" || (url.hostname !== "passhub.com.br" && !url.hostname.endsWith(".passhub.com.br")) ||
      url.username || url.password || url.port || url.search || url.hash)
    throw new PasshubDataError("A API de dados deve usar um endereço HTTPS oficial da PassHub.");
  if (!endpoint.startsWith("/") || endpoint.startsWith("//") || endpoint.includes("?") ||
      endpoint.includes("#") || endpoint.includes("\\") || endpoint.split("/").some(part => part === ".." || part === "."))
    throw new PasshubDataError("Caminho da API de dados inválido.");
  const result = new URL(endpoint, url);
  if (result.origin !== url.origin) throw new PasshubDataError("Endereço da API de dados não permitido.");
  return result;
}

/** Server-only, read-only GET. No route is exposed to anonymous users. */
export async function readPasshubData(
  resource: PasshubDataResource,
  env: NodeJS.ProcessEnv = process.env,
  requester: typeof fetch = fetch,
): Promise<unknown> {
  if (!PASSHUB_DATA_RESOURCES.includes(resource)) throw new PasshubDataError("Recurso não permitido.");
  const key = env.PASSHUB_DATA_API_KEY?.trim();
  const base = env.PASSHUB_DATA_API_BASE_URL?.trim();
  const endpoint = env[RESOURCE_PATH_ENV[resource]]?.trim();
  const header = env.PASSHUB_DATA_API_AUTH_HEADER?.trim();
  const prefix = env.PASSHUB_DATA_API_AUTH_PREFIX ?? "";
  if (!key || !base || !endpoint || !header)
    throw new PasshubDataError("API de dados incompleta. Cadastre a chave e as configurações do guia PassHub.");
  if (!/^(Authorization|X-Api-Key)$/i.test(header))
    throw new PasshubDataError("Cabeçalho de autenticação não permitido.");
  if (prefix.length > 32 || /[\r\n]/.test(prefix))
    throw new PasshubDataError("Prefixo de autenticação inválido.");
  const url = validatedPasshubDataUrl(base, endpoint);
  let response: Response;
  try {
    response = await requester(url.toString(), {
      method: "GET", redirect: "error", signal: AbortSignal.timeout(15000),
      headers: { [header]: prefix + key, Accept: "application/json" },
    });
  } catch {
    throw new PasshubDataError("Não foi possível conectar à API de dados PassHub.");
  }
  if (!response.ok) {
    const message = response.status === 401 || response.status === 403 ? "Chave rejeitada ou sem permissão."
      : response.status === 404 ? "Endpoint não encontrado. Confira o guia da PassHub."
      : response.status === 429 ? "Limite de consultas excedido." : "Consulta de dados indisponível.";
    throw new PasshubDataError(message, response.status);
  }
  if (!response.headers.get("content-type")?.toLowerCase().includes("application/json"))
    throw new PasshubDataError("Resposta inesperada: a API não retornou JSON.");
  const length = Number(response.headers.get("content-length") ?? 0);
  if (length > 2_000_000) throw new PasshubDataError("Resposta excessivamente grande.");
  // Intentionally no logging: reservations, users and payment records contain PII.
  return response.json().catch(() => { throw new PasshubDataError("A API retornou dados JSON inválidos."); });
}
