import { describe, expect, it } from "vitest";
import { normalizeBookingProperty, bookingStayPrice } from "./booking-adapter";
describe("Booking.com via StayingAPI", () => {
  it("normalizes a dated BRL stay without multiplying the total", () => {
    const h = normalizeBookingProperty({ platform: "booking", platformListingId: "hotel-a", name: "Hotel A", location: { lat: -15.8, lng: -47.9, city: "Brasília" }, price: { currency: "BRL", totalPrice: 600, nights: 3 }, images: ["https://example.com/a.jpg"], guestRating: 9, ratingScale: 10 }, 3);
    expect(h).toMatchObject({ id: "booking:hotel-a", provider: "booking", total: 600, nightly: 200, latitude: -15.8, rating: 9, priceConfirmed: false });
  });
  it("rejects wrong currencies, mismatched nights, missing totals and other platforms", () => {
    expect(bookingStayPrice({currency:"USD",totalPrice:600,nights:3},3)).toBeNull();
    expect(bookingStayPrice({currency:"BRL",totalPrice:600,nights:2},3)).toBeNull();
    expect(bookingStayPrice({currency:"BRL",nightlyPrice:200,nights:3},3)).toBeNull();
    expect(normalizeBookingProperty({platform:"airbnb",name:"A",platformListingId:"a"},3)).toBeNull();
  });
});
