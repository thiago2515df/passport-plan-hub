const ORIGIN = "https://api.stayingapi.com";
type ApiError = { code?: string };
export type StayingEnvelope = { data?: unknown; error?: ApiError; meta?: { requestId?: string; partial?: boolean; platformResults?: { platform?: string; status?: string; reason?: string; error?: ApiError }[]; warnings?: { code?: string; platform?: string }[] } };
type Job = { status?: string; pollUrl?: string; result?: unknown; error?: ApiError };
const safeCode = (code: unknown) => typeof code === "string" && /^[a-z0-9_]{1,80}$/.test(code) ? code : "";
export function stayingError(status: number, error?: ApiError): Error {
  const code = safeCode(error?.code);
  const explanations: Record<string,string> = {
    email_unverified: "Confirme seu e-mail na StayingAPI para habilitar consultas reais.",
    free_tier_budget_exhausted: "Limite de consultas reais do plano gratuito atingido.",
    platform_not_enabled: "Booking.com não está habilitado na StayingAPI.",
    no_enabled_platform: "Nenhuma plataforma habilitada para esta chave.",
    scope_insufficient: "A chave não tem permissão para esta consulta.",
    no_availability: "O fornecedor informou falta de disponibilidade para o período.",
    actor_timeout: "O fornecedor demorou demais para responder.",
    actor_blocked: "O fornecedor bloqueou temporariamente a consulta.",
    all_actors_failed: "O fornecedor não conseguiu retornar os resultados.",
    needs_country: "O fornecedor exige o país da hospedagem para consultar detalhes.",
  };
  const fallback = status === 401 || status === 403 ? "Chave inválida ou sem permissão Live." : status === 402 ? "Créditos insuficientes." : status === 429 ? "Limite de consultas atingido." : "Consulta indisponível.";
  return new Error("StayingAPI: " + (explanations[code] ?? fallback) + (code ? " (" + code + ")" : " (HTTP " + status + ")"));
}
export async function stayingGet(path: string, params: URLSearchParams, key: string, options: { fetcher?: typeof fetch; sleep?: (ms: number) => Promise<void> } = {}): Promise<StayingEnvelope> {
  const fetcher = options.fetcher ?? fetch;
  const sleep = options.sleep ?? (ms => new Promise(resolve => setTimeout(resolve, ms)));
  const deadline = Date.now() + 90000;
  let url = new URL("/v1/" + path + "?" + params, ORIGIN);
  for (let attempt = 0; attempt < 24; attempt++) {
    const remaining = deadline - Date.now();
    if (remaining <= 0) break;
    const response = await fetcher(url, { headers: { Authorization: "Bearer " + key, Accept: "application/json" }, redirect: "error", signal: AbortSignal.timeout(Math.min(25000, remaining)) });
    const envelope = await response.json().catch(() => null) as StayingEnvelope | null;
    if (!response.ok) throw stayingError(response.status, envelope?.error);
    if (!envelope || typeof envelope !== "object") throw new Error("StayingAPI: resposta inválida.");
    if (envelope.error) throw stayingError(response.status, envelope.error);
    const job = !Array.isArray(envelope.data) && typeof envelope.data === "object" && envelope.data !== null ? envelope.data as Job : undefined;
    if (job?.status === "failed") throw stayingError(503, job.error);
    if (job?.status === "completed") {
      if (job.result === undefined || job.result === null) throw new Error("StayingAPI: consulta concluída sem dados.");
      return { data: job.result, meta: envelope.meta };
    }
    if (response.status !== 202 && job?.status !== "pending" && job?.status !== "running") {
      if (envelope.data === undefined) throw new Error("StayingAPI: resposta sem dados.");
      return envelope;
    }
    if (typeof job?.pollUrl !== "string") throw new Error("StayingAPI: consulta pendente sem identificador.");
    const next = new URL(job.pollUrl, ORIGIN);
    if (next.origin !== ORIGIN || !/^\/v1\/jobs\/[a-zA-Z0-9_-]+$/.test(next.pathname) || next.username || next.password || next.search || next.hash) throw new Error("StayingAPI: endereço de consulta inválido.");
    const retry = Number(response.headers.get("Retry-After") ?? "3");
    const delay = Number.isFinite(retry) ? Math.max(1000, retry * 1000) : 3000;
    if (Date.now() + delay >= deadline) break;
    await sleep(delay);
    url = next;
  }
  throw new Error("StayingAPI: consulta ainda não concluída. Verifique o painel de uso antes de repetir a busca.");
}
