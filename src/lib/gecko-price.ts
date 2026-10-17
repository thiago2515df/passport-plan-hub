/**
 * Monetary fields returned by GeckoAPI Airbnb PLP.
 * A price may be absent or may refer to a currency other than BRL.
 * Do not create a bookable quote for a zero/unknown or non-BRL price.
 */
export type GeckoPrice = {
  nightly: number;
  total: number;
  totalEstimated: boolean;
};

export function parseGeckoBrlTotal(label?: string): number | undefined {
  const match = label?.match(/R\$\s*([\d.]+(?:,\d{1,2})?)/i);
  if (!match?.[1]) return undefined;
  const number = Number(match[1].replace(/\./g, "").replace(",", "."));
  return Number.isFinite(number) && number > 0 ? number : undefined;
}

export function geckoAirbnbPrice(
  item: { currency?: string; currencyRaw?: string; price?: number; totalPriceLabel?: string },
  nights: number,
): GeckoPrice | null {
  if (!Number.isInteger(nights) || nights < 1) return null;
  if (item.currency && item.currency.toUpperCase() !== "BRL") return null;
  if (item.currencyRaw && item.currencyRaw.trim() !== "R$") return null;

  const totalWithFees = parseGeckoBrlTotal(item.totalPriceLabel);
  const rawNightly = typeof item.price === "number" && Number.isFinite(item.price) && item.price > 0 ? item.price : undefined;
  const nightly = rawNightly ?? (totalWithFees ? totalWithFees / nights : undefined);
  const total = totalWithFees ?? (rawNightly ? rawNightly * nights : undefined);

  if (!nightly || !total || !Number.isFinite(total)) return null;
  return { nightly, total, totalEstimated: totalWithFees === undefined };
}
