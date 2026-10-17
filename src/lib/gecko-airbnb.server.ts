const GECKO_BASE = "https://api.geckoapi.com.br/v1";

export class GeckoApiError extends Error {
  constructor(public status: number, public code: string, message: string) {
    super(message);
  }
}

function token() {
  const value = process.env["GECKO_API_TOKEN"]?.trim();
  if (!value) throw new GeckoApiError(500, "CONFIG", "Token da GeckoAPI não configurado no servidor (GECKO_API_TOKEN).");
  return value;
}

type AirbnbItem = {
  position?: number;
  listingId: string;
  url?: string;
  title?: string;
  name?: string;
  category?: string;
  city?: string;
  latitude?: number;
  longitude?: number;
  thumbnail?: string;
  images?: { url?: string }[];
  currency?: string;
  currencyRaw?: string;
  price?: number;
  regularPrice?: number;
  totalPriceLabel?: string;
  aggregateRating?: { rating?: number; reviewCount?: number };
  badges?: string[];
  highlights?: string[];
  superhost?: boolean;
  guestFavorite?: boolean;
};

export type GeckoAirbnbResponse = {
  requestId?: string;
  executionId?: string;
  notFound?: boolean;
  data?: null | {
    address?: string;
    query?: string;
    startDate?: string;
    endDate?: string;
    numAdults?: number;
    totalResults?: number;
    primaryResults?: number;
    page?: number;
    resultsPerPage?: number;
    nextPage?: number;
    nextPageUrl?: string;
    items?: AirbnbItem[];
  };
};

async function readError(response: Response) {
  const body = await response.json().catch(() => ({}));
  const code = body?.errorCode ?? body?.error?.code ?? "GECKO_ERROR";
  const message = body?.message ?? body?.error?.message ?? response.statusText ?? "Falha na GeckoAPI";
  console.error(`GeckoAPI ${response.status}: ${JSON.stringify(body)}`);
  return new GeckoApiError(response.status, code, message);
}

export async function geckoAirbnbSearch(input: {
  address: string;
  startDate: string;
  endDate: string;
  numAdults: number;
  page?: number;
}): Promise<GeckoAirbnbResponse> {
  const response = await fetch(`${GECKO_BASE}/extract`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token()}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      target: "airbnb.com.br",
      type: "plp",
      address: input.address,
      startDate: input.startDate,
      endDate: input.endDate,
      numAdults: input.numAdults,
      page: input.page ?? 1,
    }),
  });
  if (!response.ok) throw await readError(response);
  return (await response.json()) as GeckoAirbnbResponse;
}

/**
 * Extracts a single Airbnb listing (PDP) for gallery, description and amenities.
 * Construct URL only from a numeric listing ID to avoid passing untrusted URLs.
 */
export type GeckoAirbnbPdpResponse = {
  notFound?: boolean;
  data?: null | {
    data?: null | {
      listingId?: string;
      name?: string;
      title?: string;
      description?: string;
      propertyType?: string;
      city?: string;
      personCapacity?: number;
      roomType?: string;
      isSuperhost?: boolean;
      aggregateRating?: { rating?: number; reviewCount?: number };
      badges?: string[];
      mainImage?: { url?: string };
      image?: { url?: string }[];
      amenities?: string[];
      highlights?: string[];
      cancellationPolicy?: string;
      host?: { name?: string; isSuperhost?: boolean; highlights?: string[] };
    };
  };
};

export async function geckoAirbnbDetails(input: {
  listingId: string; startDate?: string; endDate?: string; numAdults?: number;
}): Promise<GeckoAirbnbPdpResponse> {
  const { listingId, startDate, endDate, numAdults } = input;
  if (!/^\d{6,22}$/.test(listingId)) {
    throw new GeckoApiError(400, "INVALID_LISTING", "Identificador de imóvel Airbnb inválido.");
  }
  const url = `https://www.airbnb.com.br/rooms/${listingId}`;
  const response = await fetch(`${GECKO_BASE}/extract`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token()}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      target: "airbnb.com.br",
      type: "pdp",
      url,
      ...(startDate ? { startDate } : {}),
      ...(endDate ? { endDate } : {}),
      ...(numAdults ? { numAdults } : {}),
    }),
    signal: AbortSignal.timeout(45000),
  });
  if (!response.ok) throw await readError(response);
  return (await response.json()) as GeckoAirbnbPdpResponse;
}
