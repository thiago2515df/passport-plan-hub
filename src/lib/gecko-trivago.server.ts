/** Trivago extraction through the existing GeckoAPI server secret. Never expose the token client-side. */
const ENDPOINT = "https://api.geckoapi.com.br/v1/extract";

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
