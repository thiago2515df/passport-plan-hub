/** Trivago extraction through the existing GeckoAPI server secret. Never expose the token client-side. */
const ENDPOINT = "https://api.geckoapi.com.br/v1/extract";

export type TrivagoStay = { checkinDate: string; checkoutDate: string; numAdults: number; numChildren: number; numRooms: number };
export type TrivagoDeal = {
  advertiser?: { name?: string };
  description?: string;
  roomCategory?: string;
  pricePerStay?: { amount?: number; currency?: string };
};
export type TrivagoDetails = Partial<TrivagoStay> & {
  id?: number; currency?: string; deals?: TrivagoDeal[];
};

export class TrivagoApiError extends Error {
  constructor(public status: number, public code: string, message: string) {
    super(message);
    this.name = "TrivagoApiError";
  }
}

/** Dated supplier deals, not the PLP forecast. See GeckoAPI /docs/trivago-com-br-pdp/. */
export async function geckoTrivagoDetails(url: string, stay: TrivagoStay): Promise<TrivagoDetails | null> {
  const parsed = new URL(url);
  if (parsed.protocol !== "https:" || !["trivago.com.br", "www.trivago.com.br"].includes(parsed.hostname)) return null;
  const key = process.env["GECKO_API_TOKEN"]?.trim();
  if (!key) throw new Error("Credencial GeckoAPI não configurada.");
  // Retry only transient rate-limit/upstream errors; never retry exhausted credits.
  for (let attempt = 0; attempt < 2; attempt++) {
    const response = await fetch(ENDPOINT, {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ target: "trivago.com.br", type: "pdp", url: parsed.href, ...stay, currency: "BRL", lang: "pt-br" }),
      signal: AbortSignal.timeout(45000),
    });
    if (response.ok) {
      const result = await response.json() as {
        notFound?: boolean; data?: { data?: TrivagoDetails } | TrivagoDetails | null;
      };
      if (result.notFound || !result.data) return null;
      const envelope = result.data;
      return ("data" in envelope && envelope.data ? envelope.data : envelope as TrivagoDetails);
    }
    const problem = await response.json().catch(() => ({})) as {
      errorCode?: string; message?: string; error?: { code?: string; message?: string };
      details?: unknown; issues?: unknown; errors?: unknown;
    };
    const code = problem.errorCode ?? problem.error?.code ?? "GECKO_ERROR";
    // The gateway can reply "Validation failed" while the details tell us
    // which field actually failed. Show only safe field names/messages.
    const rawIssues = Array.isArray(problem.details) ? problem.details :
      Array.isArray(problem.issues) ? problem.issues :
      Array.isArray(problem.errors) ? problem.errors : [];
    const issues = rawIssues.slice(0, 3).map((issue: unknown) => {
      if (!issue || typeof issue !== "object") return "";
      const item = issue as { path?: string | string[]; field?: string; message?: string };
      const field = Array.isArray(item.path) ? item.path.join(".") : item.path ?? item.field ?? "";
      return [String(field).slice(0, 60), String(item.message ?? "").slice(0, 120)].filter(Boolean).join(": ");
    }).filter(Boolean).join("; ");
    if (attempt === 0 && (response.status === 429 || response.status >= 500)) {
      await new Promise(resolve => setTimeout(resolve, 700));
      continue;
    }
    const reason = response.status === 402 ? "Créditos GeckoAPI insuficientes." :
      response.status === 401 ? "Token GeckoAPI inválido." :
      response.status === 403 ? "Trivago não autorizado na GeckoAPI." :
      response.status === 429 ? "Limite de requisições da GeckoAPI. Tente novamente em instantes." :
      response.status >= 500 ? "Fornecedor indisponível no momento." :
      problem.message ?? problem.error?.message ?? `Erro GeckoAPI ${code}.`;
    const hint = response.status === 400
      ? (issues ? ` Campos rejeitados: ${issues}.` : " A GeckoAPI rejeitou os parâmetros do anúncio.")
      : "";
    throw new TrivagoApiError(response.status, code, `${reason}${hint} [HTTP ${response.status} / ${code}]`);
  }
  return null;
}

export type TrivagoItem = {
  id?: number;
  namespace?: number;
  url?: string;
  name?: string;
  location?: string;
  accommodationType?: string;
  image?: string;
  starRating?: number;
  reviewScore?: number;
  reviewCount?: number;
  highlights?: string[];
  advertiserCount?: number;
  forecastedPrice?: { arrival?: string; amount?: number; currency?: string };
};
export type TrivagoSearchResponse = {
  notFound?: boolean;
  data?: null | {
    page?: number;
    returnedResults?: number;
    resultsPerPage?: number;
    nextPage?: number;
    items?: TrivagoItem[];
  };
};

export async function geckoTrivagoSearch(input: {
  location: string; checkinDate: string; checkoutDate: string;
  numAdults: number; numChildren: number; numRooms: number; page: number;
}): Promise<TrivagoSearchResponse> {
  const key = process.env["GECKO_API_TOKEN"]?.trim();
  if (!key) throw new Error("Configure GECKO_API_TOKEN nas variáveis secretas do servidor.");
  const response = await fetch(ENDPOINT, {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      target: "trivago.com.br", type: "plp",
      location: input.location,
      checkinDate: input.checkinDate, checkoutDate: input.checkoutDate,
      numAdults: input.numAdults, numChildren: input.numChildren, numRooms: input.numRooms,
      page: input.page, lang: "pt-br", currency: "BRL",
    }),
    signal: AbortSignal.timeout(45000),
  });
  if (!response.ok) {
    const body = await response.json().catch(() => ({})) as { errorCode?: string; message?: string };
    const codes: Record<number, string> = {
      401: "Credencial GeckoAPI inválida.", 402: "Créditos GeckoAPI insuficientes.",
      403: "Acesso ao Trivago não autorizado.", 429: "Muitas consultas. Tente novamente em instantes.",
    };
    throw new Error(codes[response.status] ?? `GeckoAPI: ${body.message ?? body.errorCode ?? "falha na consulta"} (${response.status}).`);
  }
  return await response.json() as TrivagoSearchResponse;
}
