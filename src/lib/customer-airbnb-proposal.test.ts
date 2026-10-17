import { describe, expect, it } from "vitest";
import { customerProposal } from "./customer-proposal";
import type { Search } from "./hotels";

const search: Search = {
  destino: "Curitiba",
  checkin: "2026-10-24",
  checkout: "2026-10-25",
  hospedes: "1 quarto · 2 hóspedes",
  rav: 0,
};

describe("Airbnb proposal shared with a customer", () => {
  it("retains safe Airbnb identity, pictures and rating without exposing supplier cost", () => {
    const publicProposal = customerProposal({
      s: search,
      hotels: [{
        provider: "airbnb",
        providerListingId: "1501379416546185177",
        sourceUrl: "https://www.airbnb.com.br/rooms/1501379416546185177",
        name: "Apartamento Curitiba",
        address: "Curitiba", stars: 0, nightly: 298, total: 650,
        room: "1 quarto", image: "https://a0.muscache.com/thumb.jpg",
        images: ["https://a0.muscache.com/main.jpg"],
        rating: 4.97,
        reviewCount: 115,
        publicDetails: {
          photos: ["https://a0.muscache.com/main.jpg", "https://a0.muscache.com/bedroom.jpg"],
          description: "Apartamento bem localizado",
          amenities: ["Wi-Fi"],
          highlights: ["2 hóspedes"],
          propertyType: "Apartamento inteiro",
          cancellationPolicy: "Flexível",
          hostName: "Camila",
          rating: 4.97,
          reviewCount: 115,
        },
      }],
    });
    const hotel = publicProposal.hotels[0];
    expect(hotel).toMatchObject({
      provider: "airbnb",
      providerListingId: "1501379416546185177",
      rating: 4.97,
      reviewCount: 115,
      publicDetails: { description: "Apartamento bem localizado" },
    });
    expect(hotel?.nightly).toBe(0);
    expect(hotel?.total).toBe(650);
    expect(hotel?.publicDetails?.photos).toEqual([
      "https://a0.muscache.com/main.jpg", "https://a0.muscache.com/bedroom.jpg",
    ]);
    expect(hotel?.publicDetails?.description).toBe("Apartamento bem localizado");
    expect(hotel?.publicDetails?.amenities).toEqual(["Wi-Fi"]);
  });

  it("retains normal hotel details unchanged", () => {
    const preview = customerProposal({
      s: search,
      hotels: [{
        name: "Hotel Centro",
        address: "Curitiba", stars: 3, nightly: 100, total: 200,
        image: "https://cdn.example.com/hotel.jpg", hotelId: 123,
      }],
    });
    expect(preview.hotels[0]).toMatchObject({ hotelId: 123, stars: 3 });
    expect(preview.hotels[0]).not.toHaveProperty("provider");
  });
});
