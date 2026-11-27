import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const legSchema = z.object({
  direction: z.enum(["out", "back", "unknown"]),
  airline: z.string().max(80),
  flightNumber: z.string().max(30),
  from: z.string().max(8),
  to: z.string().max(8),
  departureDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable(),
  arrivalDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable(),
  departure: z.string().regex(/^\d{2}:\d{2}$/).nullable(),
  arrival: z.string().regex(/^\d{2}:\d{2}$/).nullable(),
  duration: z.string().max(30),
  stops: z.string().max(80),
  travelClass: z.string().max(50),
  fareCategory: z.string().max(80),
  baggage: z.object({
    personal: z.boolean().nullable(),
    carryOn: z.boolean().nullable(),
    checked: z.boolean().nullable(),
  }),
});

const extractedSchema = z.object({
  legs: z.array(legSchema).min(1).max(4),
  totalPrice: z.number().nonnegative().nullable(),
  perPersonPrice: z.number().nonnegative().nullable(),
  currency: z.string().max(8),
  confidence: z.number().min(0).max(1),
  notes: z.array(z.string().max(180)).max(8),
});

export type FlightImageExtraction = z.infer<typeof extractedSchema>;

const normalizeDataUrl = (value: string) => {
  if (!/^data:image\/(png|jpe?g|webp);base64,/i.test(value)) throw new Error("Envie uma imagem PNG, JPG ou WebP.");
  const comma = value.indexOf(",");
  const base64 = value.slice(comma + 1);
  if (base64.length > 8_000_000) throw new Error("A imagem é muito grande. Use uma captura com até aproximadamente 6 MB.");
  return value;
};

const toText = (value: unknown, max: number) => (typeof value === "string" ? value.trim().slice(0, max) : "");
const toDate = (value: unknown) => (typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value.trim()) ? value.trim() : null);
const toTime = (value: unknown) => (typeof value === "string" && /^\d{2}:\d{2}$/.test(value.trim()) ? value.trim() : null);
const toBool = (value: unknown) => (typeof value === "boolean" ? value : null);
const toPrice = (value: unknown) => (typeof value === "number" && Number.isFinite(value) && value >= 0 ? value : null);
const toConfidence = (value: unknown) => (typeof value === "number" && Number.isFinite(value) ? Math.min(1, Math.max(0, value)) : 0.5);
const toNotes = (value: unknown) => (Array.isArray(value)
  ? value.filter((note): note is string => typeof note === "string").map(note => note.trim().slice(0, 180)).filter(Boolean).slice(0, 8)
  : []);

const normalizeFlightNumber = (value: string) => value
  .trim()
  .toUpperCase()
  .replace(/^([A-Z0-9]{2,3})\s*[-–—]\s*(\d{1,5})$/, "$1 $2");

const AIRLINE_BY_PREFIX: Record<string, string> = {
  LA: "LATAM Airlines",
  JJ: "LATAM Airlines",
  G3: "GOL Linhas Aéreas",
  AD: "Azul Linhas Aéreas",
  "2Z": "Voepass",
  TP: "TAP Air Portugal",
  AR: "Aerolíneas Argentinas",
  AV: "Avianca",
  CM: "Copa Airlines",
  AA: "American Airlines",
  DL: "Delta Air Lines",
  UA: "United Airlines",
  AC: "Air Canada",
  AF: "Air France",
  KL: "KLM",
  IB: "Iberia",
  UX: "Air Europa",
  EK: "Emirates",
  QR: "Qatar Airways",
  AZ: "ITA Airways",
  LH: "Lufthansa",
  LX: "SWISS",
};

const airlineFromFlightNumber = (flightNumberRaw: string) => {
  const flightNumber = normalizeFlightNumber(flightNumberRaw);
  const match = flightNumber.match(/^([A-Z0-9]{2})\s*\d{1,5}$/);
  return match ? AIRLINE_BY_PREFIX[match[1]] ?? "" : "";
};

const normalizeAirline = (airlineRaw: string, flightNumberRaw: string) => {
  const airline = airlineRaw.trim();
  const flightNumber = normalizeFlightNumber(flightNumberRaw);
  const fromPrefix = airlineFromFlightNumber(flightNumber);
  if (fromPrefix) return fromPrefix;

  const combined = `${airline} ${flightNumber}`;
  if (/\blatam\b/i.test(combined)) return "LATAM Airlines";
  if (/\bgol\b/i.test(combined)) return "GOL Linhas Aéreas";
  if (/\bazul\b/i.test(combined)) return "Azul Linhas Aéreas";
  if (/\bvoepass\b/i.test(combined)) return "Voepass";
  if (/\btap\b/i.test(combined)) return "TAP Air Portugal";
  if (/aerol[ií]neas argentinas/i.test(combined)) return "Aerolíneas Argentinas";
  if (/\bavianca\b/i.test(combined)) return "Avianca";
  if (/\bcopa\b/i.test(combined)) return "Copa Airlines";

  if (!airline || /^(companhia a[eé]rea|operadora|light\s*-?\s*operadora)$/i.test(airline)) return "";
  return airline;
};

const sanitizeRoute = (from: string, to: string) => {
  if (from && to && from === to) return { from, to: "" };
  return { from, to };
};

export const analyzeFlightImage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({
    imageDataUrl: z.string().min(100),
    directionHint: z.enum(["out", "back", "auto"]).default("auto"),
  }).parse(input))
  .handler(async ({ data, context }): Promise<FlightImageExtraction> => {
    const { assertSearchPermission } = await import("./access.server");
    await assertSearchPermission(context.supabase, context.userId, "search_flights");

    const { extractFlightFromImage } = await import("./ai/flight-image-ai.server.ts");
    const raw = await extractFlightFromImage({
      imageDataUrl: normalizeDataUrl(data.imageDataUrl),
      directionHint: data.directionHint,
    });

    if (!raw.legs.length) throw new Error("A IA não retornou dados do voo.");

    const result = extractedSchema.parse({
      legs: raw.legs.slice(0, 4).map((leg) => {
        const flightNumber = normalizeFlightNumber(toText(leg.flightNumber, 30));
        const airlineRaw = toText(leg.airline, 80);
        const airline = normalizeAirline(airlineRaw, flightNumber);
        const route = sanitizeRoute(toText(leg.from, 8), toText(leg.to, 8));
        return {
        direction: leg.direction === "out" || leg.direction === "back" ? leg.direction : "unknown",
        airline,
        flightNumber,
        from: route.from,
        to: route.to,
        departureDate: toDate(leg.departureDate),
        arrivalDate: toDate(leg.arrivalDate),
        departure: toTime(leg.departure),
        arrival: toTime(leg.arrival),
        duration: toText(leg.duration, 30),
        stops: toText(leg.stops, 80),
        travelClass: toText(leg.travelClass, 50),
        fareCategory: toText(leg.fareCategory, 80),
        baggage: {
          personal: toBool(leg.baggage?.personal),
          carryOn: toBool(leg.baggage?.carryOn),
          checked: toBool(leg.baggage?.checked),
        },
      };
      }),
      totalPrice: toPrice(raw.totalPrice),
      perPersonPrice: toPrice(raw.perPersonPrice),
      currency: toText(raw.currency, 8) || "BRL",
      confidence: toConfidence(raw.confidence),
      notes: toNotes(raw.notes),
    });

    if (!result.legs.some(leg => leg.from || leg.to || leg.flightNumber || leg.airline)) {
      throw new Error("Não consegui identificar um voo nessa imagem.");
    }
    return result;
  });


export const analyzeFlightText = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({
    text: z.string().trim().min(5).max(20_000),
    directionHint: z.enum(["out", "back", "auto"]).default("auto"),
  }).parse(input))
  .handler(async ({ data, context }): Promise<FlightImageExtraction> => {
    const { assertSearchPermission } = await import("./access.server");
    await assertSearchPermission(context.supabase, context.userId, "search_flights");

    const { extractFlightFromText } = await import("./ai/flight-image-ai.server.ts");
    const raw = await extractFlightFromText({ text: data.text, directionHint: data.directionHint });
    if (!raw.legs.length) throw new Error("A IA não retornou dados do voo.");

    const result = extractedSchema.parse({
      legs: raw.legs.slice(0, 4).map((leg) => {
        const flightNumber = normalizeFlightNumber(toText(leg.flightNumber, 30));
        const airlineRaw = toText(leg.airline, 80);
        const airline = normalizeAirline(airlineRaw, flightNumber);
        return {
          direction: leg.direction === "out" || leg.direction === "back" ? leg.direction : "unknown",
          airline,
          flightNumber,
          from: toText(leg.from, 8),
          to: toText(leg.to, 8),
          departureDate: toDate(leg.departureDate),
          arrivalDate: toDate(leg.arrivalDate),
          departure: toTime(leg.departure),
          arrival: toTime(leg.arrival),
          duration: toText(leg.duration, 30),
          stops: toText(leg.stops, 80),
          travelClass: toText(leg.travelClass, 50),
          fareCategory: toText(leg.fareCategory, 80),
          baggage: {
            personal: toBool(leg.baggage?.personal),
            carryOn: toBool(leg.baggage?.carryOn),
            checked: toBool(leg.baggage?.checked),
          },
        };
      }),
      totalPrice: toPrice(raw.totalPrice),
      perPersonPrice: toPrice(raw.perPersonPrice),
      currency: toText(raw.currency, 8) || "BRL",
      confidence: toConfidence(raw.confidence),
      notes: toNotes(raw.notes),
    });

    if (!result.legs.some(leg => leg.from || leg.to || leg.flightNumber || leg.airline)) {
      throw new Error("Não consegui identificar um voo nesse texto.");
    }
    return result;
  });


export const analyzeFlightImageWithClaudia = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({
    imageDataUrl: z.string().min(100),
    directionHint: z.enum(["out", "back", "auto"]).default("auto"),
  }).parse(input))
  .handler(async ({ data, context }): Promise<FlightImageExtraction> => {
    const { assertSearchPermission } = await import("./access.server");
    await assertSearchPermission(context.supabase, context.userId, "search_flights");

    const { claudiaExtractFlightFromImage } = await import("./ai/claudia-flight.server.ts");
    const raw = await claudiaExtractFlightFromImage({
      imageDataUrl: normalizeDataUrl(data.imageDataUrl),
      directionHint: data.directionHint,
    });

    if (!raw.legs.length) throw new Error("A Claudia não retornou dados do voo.");

    const result = extractedSchema.parse({
      legs: raw.legs.slice(0, 4).map((leg) => {
        const flightNumber = normalizeFlightNumber(toText(leg.flightNumber, 30));
        const airlineRaw = toText(leg.airline, 80);
        const airline = normalizeAirline(airlineRaw, flightNumber);
        return {
          direction: leg.direction === "out" || leg.direction === "back" ? leg.direction : "unknown",
          airline,
          flightNumber,
          from: toText(leg.from, 8),
          to: toText(leg.to, 8),
          departureDate: toDate(leg.departureDate),
          arrivalDate: toDate(leg.arrivalDate),
          departure: toTime(leg.departure),
          arrival: toTime(leg.arrival),
          duration: toText(leg.duration, 30),
          stops: toText(leg.stops, 80),
          travelClass: toText(leg.travelClass, 50),
          fareCategory: toText(leg.fareCategory, 80),
          baggage: {
            personal: toBool(leg.baggage?.personal),
            carryOn: toBool(leg.baggage?.carryOn),
            checked: toBool(leg.baggage?.checked),
          },
        };
      }),
      totalPrice: toPrice(raw.totalPrice),
      perPersonPrice: toPrice(raw.perPersonPrice),
      currency: toText(raw.currency, 8) || "BRL",
      confidence: toConfidence(raw.confidence),
      notes: toNotes(raw.notes),
    });

    if (!result.legs.some(leg => leg.from || leg.to || leg.flightNumber || leg.airline)) {
      throw new Error("A Claudia não conseguiu identificar um voo nessa imagem.");
    }
    return result;
  });

export const analyzeFlightTextWithClaudia = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({
    text: z.string().trim().min(5).max(20_000),
    directionHint: z.enum(["out", "back", "auto"]).default("auto"),
  }).parse(input))
  .handler(async ({ data, context }): Promise<FlightImageExtraction> => {
    const { assertSearchPermission } = await import("./access.server");
    await assertSearchPermission(context.supabase, context.userId, "search_flights");

    const { claudiaExtractFlightFromText } = await import("./ai/claudia-flight.server.ts");
    const raw = await claudiaExtractFlightFromText({
      text: data.text,
      directionHint: data.directionHint,
    });

    if (!raw.legs.length) throw new Error("A Claudia não retornou dados do voo.");

    const result = extractedSchema.parse({
      legs: raw.legs.slice(0, 4).map((leg) => {
        const flightNumber = normalizeFlightNumber(toText(leg.flightNumber, 30));
        const airlineRaw = toText(leg.airline, 80);
        const airline = normalizeAirline(airlineRaw, flightNumber);
        return {
          direction: leg.direction === "out" || leg.direction === "back" ? leg.direction : "unknown",
          airline,
          flightNumber,
          from: toText(leg.from, 8),
          to: toText(leg.to, 8),
          departureDate: toDate(leg.departureDate),
          arrivalDate: toDate(leg.arrivalDate),
          departure: toTime(leg.departure),
          arrival: toTime(leg.arrival),
          duration: toText(leg.duration, 30),
          stops: toText(leg.stops, 80),
          travelClass: toText(leg.travelClass, 50),
          fareCategory: toText(leg.fareCategory, 80),
          baggage: {
            personal: toBool(leg.baggage?.personal),
            carryOn: toBool(leg.baggage?.carryOn),
            checked: toBool(leg.baggage?.checked),
          },
        };
      }),
      totalPrice: toPrice(raw.totalPrice),
      perPersonPrice: toPrice(raw.perPersonPrice),
      currency: toText(raw.currency, 8) || "BRL",
      confidence: toConfidence(raw.confidence),
      notes: toNotes(raw.notes),
    });

    if (!result.legs.some(leg => leg.from || leg.to || leg.flightNumber || leg.airline)) {
      throw new Error("A Claudia não conseguiu identificar um voo nesse texto.");
    }
    return result;
  });
