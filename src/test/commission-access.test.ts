import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@tanstack/react-start", () => ({
  createServerFn: () => {
    let validate = (data: unknown) => data;
    const builder = {
      middleware: () => builder,
      inputValidator: (fn: typeof validate) => {
        validate = fn;
        return builder;
      },
      handler: (fn: (args: unknown) => unknown) => (args: { data: unknown; context: unknown }) =>
        fn({ ...args, data: validate(args.data) }),
    };
    return builder;
  },
}));
vi.mock("@/integrations/supabase/auth-middleware", () => ({ requireSupabaseAuth: {} }));
vi.mock("@/lib/passhub.server", () => ({ passhub: vi.fn() }));
vi.mock("@/lib/gecko-airbnb.server", () => ({
  geckoAirbnbSearch: vi.fn(),
  geckoAirbnbDetails: vi.fn(),
}));
vi.mock("@/lib/gecko-trivago.server", () => ({
  geckoTrivagoSearch: vi.fn(),
  geckoTrivagoDetails: vi.fn(),
}));
vi.mock("@/lib/airbnb-proposal-snapshot.server", () => ({ addAirbnbDetailsToProposal: vi.fn() }));
import { getSellerCommissions, saveSellerCommissions } from "@/lib/commissions.functions";
import { searchHotels, searchDestinations } from "@/lib/passhub.functions";
import { searchFlights } from "@/lib/flights.functions";
import { searchAirbnb, getAirbnbDetails } from "@/lib/airbnb.functions";
import { searchTrivago, refreshTrivagoQuote } from "@/lib/trivago.functions";
import { saveProposal } from "@/lib/proposals.functions";
import { encodeProposal } from "@/lib/hotels";
import { passhub } from "@/lib/passhub.server";
import { geckoAirbnbSearch, geckoAirbnbDetails } from "@/lib/gecko-airbnb.server";
import { geckoTrivagoSearch, geckoTrivagoDetails } from "@/lib/gecko-trivago.server";
import { addAirbnbDetailsToProposal } from "@/lib/airbnb-proposal-snapshot.server";

const userId = "10000000-0000-4000-8000-000000000001";
const otherId = "10000000-0000-4000-8000-000000000002";
const rates = {
  hotel: { kind: "percent", value: 20 },
  air: { kind: "percent", value: 20 },
  bus: { kind: "fixed", value: 50 },
};
const configuredAt = "2026-10-21T17:00:00.123456+00:00";
const row = {
  hotel_kind: "percent",
  hotel_value: 20,
  air_kind: "percent",
  air_value: 20,
  bus_kind: "fixed",
  bus_value: 50,
  configured_at: configuredAt,
};
function client({
  admin = false,
  commission = null as typeof row | null,
  proposalOwner = otherId,
} = {}) {
  const query = {
    select: vi.fn(() => query),
    eq: vi.fn(() => query),
    maybeSingle: vi.fn(async () => ({ data: commission, error: null })),
    then: (resolve: (result: unknown) => unknown, reject: (reason: unknown) => unknown) =>
      Promise.resolve({ data: commission ? [commission] : [], error: null }).then(resolve, reject),
    insert: vi.fn(async () => ({ error: null })),
    update: vi.fn(() => query),
    upsert: vi.fn(async () => ({ error: null })),
  };
  const supabase = {
    rpc: vi.fn(async (name: string) => ({
      data: name === "seller_can" ? true : admin,
      error: null,
    })),
    from: vi.fn((table: string) => {
      if (table === "proposals")
        query.maybeSingle.mockResolvedValueOnce({
          data: { owner_id: proposalOwner } as unknown as typeof row,
          error: null,
        });
      if (table === "proposal_acceptances")
        query.maybeSingle.mockResolvedValueOnce({ data: null, error: null });
      return query;
    }),
  };
  return { context: { userId, supabase }, query };
}
const invoke = (fn: unknown, data: unknown, context: unknown) =>
  (fn as (args: unknown) => Promise<unknown>)({ data, context });
beforeEach(() => vi.clearAllMocks());
describe("commission authorization before provider and proposal operations", () => {
  it("prevents a seller from saving their own or another seller's commission", async () => {
    const { context, query } = client();
    for (const target of [userId, otherId]) {
      await expect(
        invoke(saveSellerCommissions, { userId: target, ...rates }, context),
      ).rejects.toThrow("somente ao administrador");
    }
    expect(query.upsert).not.toHaveBeenCalled();
  });
  it("allows the administrator to set all three rules for any seller", async () => {
    const { context, query } = client({ admin: true });
    await invoke(saveSellerCommissions, { userId: otherId, ...rates }, context);
    expect(query.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        user_id: otherId,
        hotel_kind: "percent",
        hotel_value: 20,
        air_value: 20,
        bus_value: 50,
      }),
    );
  });
  it("does not turn another seller's invisible configuration into an implicit zero", async () => {
    const { context } = client();
    await expect(invoke(getSellerCommissions, { userId: otherId }, context)).rejects.toThrow(
      "somente ao administrador",
    );
    await expect(invoke(getSellerCommissions, {}, context)).resolves.toMatchObject({
      configured: false,
      updatedAt: null,
    });
  });
  it("blocks all supplier searches before any paid request when commissions are missing", async () => {
    const { context } = client();
    const dates = { checkinDate: "2027-01-10", checkoutDate: "2027-01-12" };
    const requests: [unknown, unknown][] = [
      [searchDestinations, { q: "Rio" }],
      [
        searchHotels,
        {
          destinationId: "rio",
          checkinDate: dates.checkinDate,
          nights: 2,
          adults: 2,
          childAges: [],
          rooms: 1,
          rav: 0,
        },
      ],
      [searchFlights, { from: "BSB", to: "RIO", date: dates.checkinDate, adults: 2, children: 0 }],
      [
        searchAirbnb,
        { destination: "Rio", checkin: dates.checkinDate, checkout: dates.checkoutDate, adults: 2 },
      ],
      [getAirbnbDetails, { listingId: "123456789" }],
      [searchTrivago, { location: "Rio", ...dates, numAdults: 2, numChildren: 0, numRooms: 1 }],
      [
        refreshTrivagoQuote,
        {
          id: "trivago:1:123",
          url: "https://www.trivago.com.br/pt-BR/oar/hotel-test?search=100-123",
          ...dates,
          numAdults: 2,
          numChildren: 0,
          numRooms: 1,
        },
      ],
    ];
    for (const [fn, data] of requests)
      await expect(invoke(fn, data, context)).rejects.toThrow("administrador precisa cadastrar");
    for (const provider of [
      passhub,
      geckoAirbnbSearch,
      geckoAirbnbDetails,
      geckoTrivagoSearch,
      geckoTrivagoDetails,
    ])
      expect(provider).not.toHaveBeenCalled();
  });
  it("uses zero supplier RAV so an arbitrary request cannot replace the admin markup", async () => {
    const { context } = client({ commission: row });
    vi.mocked(passhub).mockResolvedValue({ offers: [] });
    await invoke(
      searchHotels,
      {
        destinationId: "rio",
        checkinDate: "2027-01-10",
        nights: 2,
        adults: 2,
        childAges: [],
        rooms: 1,
        rav: 50,
      },
      context,
    );
    expect(passhub).toHaveBeenCalledWith(
      "/searches",
      expect.objectContaining({ body: expect.objectContaining({ ravPercentage: 0 }) }),
    );
  });
  it("checks the original owner's commission when an admin edits a proposal", async () => {
    const { context, query } = client({ admin: true, commission: row });
    const payload = encodeProposal({
      s: { destino: "Rio", checkin: "2027-01-10", checkout: "2027-01-12", hospedes: "2", rav: 0 },
      hotels: [],
    });
    await expect(
      invoke(
        saveProposal,
        { code: "test1234", payload, commissionUpdatedAt: "2026-10-20T17:00:00Z" },
        context,
      ),
    ).rejects.toThrow("comissão foi atualizada");
    expect(query.eq).toHaveBeenCalledWith("user_id", otherId);
    expect(addAirbnbDetailsToProposal).not.toHaveBeenCalled();
    expect(query.update).not.toHaveBeenCalled();
  });
});
