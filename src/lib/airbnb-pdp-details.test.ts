import { describe, expect, it } from "vitest";
import { normalizeAirbnbPdp } from "./airbnb-pdp-details";

describe("Airbnb PDP metadata", () => {
  it("reads photos, guest capacity, description, rating and review count", () => {
    const actual = normalizeAirbnbPdp({
      data: {
        data: {
          listingId: "1501379416546185177",
          name: "Loft elegante no centro de Curitiba",
          propertyType: "Apartamento inteiro",
          city: "Curitiba",
          personCapacity: 2,
          aggregateRating: { rating: 4.95, reviewCount: 87 },
          mainImage: { url: "https://a0.muscache.com/main.jpg" },
          image: [
            { url: "https://a0.muscache.com/main.jpg" },
            { url: "https://a0.muscache.com/room.jpg" },
          ],
          description: "Loft moderno com cozinha equipada e Wi-Fi.",
          amenities: ["Wi-Fi", "Cozinha"],
          highlights: ["2 hóspedes", "1 quarto"],
          host: { name: "Camila", isSuperhost: true },
          cancellationPolicy: "Cancelamento gratuito até 48 horas antes do check-in",
        },
      },
    });
    expect(actual?.photos).toEqual([
      "https://a0.muscache.com/main.jpg",
      "https://a0.muscache.com/room.jpg",
    ]);
    expect(actual).toMatchObject({
      city: "Curitiba",
      propertyType: "Apartamento inteiro",
      rating: 4.95,
      reviewCount: 87,
      personCapacity: 2,
      isSuperhost: true,
      amenities: ["Wi-Fi", "Cozinha"],
      description: "Loft moderno com cozinha equipada e Wi-Fi.",
    });
  });

  it("handles an absent PDP result without throwing", () => {
    expect(normalizeAirbnbPdp({ notFound: true, data: null })).toBeNull();
    expect(normalizeAirbnbPdp({ data: null })).toBeNull();
  });

  it("ignores unsafe URLs and handles omitted arrays", () => {
    const actual = normalizeAirbnbPdp({
      data: { data: {
        image: [{ url: "javascript:alert(1)" }, { url: "http://untrusted.test/unsafe.jpg" }],
        mainImage: { url: "https://a0.muscache.com/safe.jpg" },
      } },
    });
    expect(actual?.photos).toEqual(["https://a0.muscache.com/safe.jpg"]);
    expect(actual?.amenities).toEqual([]);
    expect(actual?.highlights).toEqual([]);
  });

  it("filters invalid review ratings", () => {
    const actual = normalizeAirbnbPdp({ data: { data: {
      aggregateRating: { rating: 88, reviewCount: -1 },
    } } });
    expect(actual?.rating).toBeUndefined();
    expect(actual?.reviewCount).toBeUndefined();
  });
});
