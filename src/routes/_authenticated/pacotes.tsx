import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Plane, Bus, Shield, Building2, Users, MapPin, Calendar, Search as SearchIcon, Filter, Star, CreditCard, Trash2, Link2, Check, ChevronDown, Loader2, Settings, UserRound } from "lucide-react";
import { brl, nightsBetween, encodeProposal, decodeProposal, makeTransport, isCaldasNovas, iataOf, cityIata, type Flight, type TransportMode, type Search, type Hotel } from "@/lib/hotels";
import { searchDestinations, searchHotels } from "@/lib/passhub.functions";
import { RoomOccupancyPicker } from "@/components/RoomOccupancyPicker";
import { allChildAges, countAdults, restoreRoomOccupancies, type RoomOccupancy } from "@/lib/room-occupancy";
import { searchAirbnb } from "@/lib/airbnb.functions";
import { searchTrivago, refreshTrivagoQuote } from "@/lib/trivago.functions";
import { sellerAirbnbUrl } from "@/lib/seller-airbnb-url";
import logoAsset from "@/assets/excursao-brasilia.png.asset.json";
import { HotelPhoto, HotelGallery } from "@/components/HotelGallery";
import { TransportPanel } from "@/components/TransportPanel";
import { FlightPicker } from "@/components/FlightPicker";
import { SelectedFlightsSummary } from "@/components/SelectedFlightsSummary";
import { paginateHotels } from "@/lib/result-pagination";
import { flightToTransportLeg } from "@/lib/customer-itinerary";
import { toggleHotelSelection, nextFlightSelectionStep, type ProposalSelectionStep } from "@/lib/proposal-selection";
import { searchFlights } from "@/lib/flights.functions";
import { saveProposal, getEditableProposal } from "@/lib/proposals.functions";
import { normalizeExtraServices } from "@/lib/extra-services";
import { ManagementNav } from "@/components/ManagementNav";
import { Button } from "@/components/ui/button";
import { Calendar as DayPicker } from "@/components/ui/calendar";
import { calendarFirstMonth, calendarOpenMonth, defaultTravelDates, localCalendarDay } from "@/lib/travel-calendar-dates";
import { ptBR } from "react-day-picker/locale";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useCitySuggestions } from "@/hooks/use-city-suggestions";
import { useAccess } from "@/components/AccessProvider";
import { SignOutButton } from "@/components/AuthScreen";
import { useSellerCommissions } from "@/hooks/use-seller-commissions";
import { CommissionNotice } from "@/components/CommissionNotice";
import { COMMISSION_REQUIRED, requireConfiguredCommissions } from "@/lib/commission-rules";
import { packagePricing, transportCost, emptyCommissions, commissionForSearch, commissionLabel } from "@/lib/package-pricing";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { filterFlightResults, mergeFlights } from "@/lib/flight-results";
import { useIsMobile } from "@/hooks/use-mobile";
import { availablePackageStep, packageSearchKey, parsePackageStep, type PackageStep } from "@/lib/package-flow";
import { MobilePackageHeader, MobilePackageSearching, MobilePackageFooter, MobileHotelTools, MobilePackageHotelCard } from "@/components/MobilePackageFlow";

const toD = (iso: string) => new Date(iso + "T12:00");
const isoD = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const fmtD = (iso: string) => toD(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "2-digit" });
const compactDate = (iso: string) => toD(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });

export const Route = createFileRoute("/_authenticated/pacotes")({
  validateSearch: (search: Record<string, unknown>): { code?: string; mode?: "air" | "bus"; etapa?: PackageStep } => ({ ...(typeof search['code'] === "string" && /^[a-z0-9]{6,12}$/.test(search['code']) ? { code: search['code'] } : {}), ...(search['mode'] === "air" || search['mode'] === "bus" ? { mode: search['mode'] } : {}), ...(parsePackageStep(search['etapa']) ? { etapa: parsePackageStep(search['etapa']) } : {}) }),
  head: () => ({
    meta: [
      { title: "Pacotes — Excursão Brasília" },
      { name: "description", content: "Busque hotéis, selecione opções e gere propostas em segundos." },
      { property: "og:title", content: "Pacotes — Excursão Brasília" },
      { property: "og:description", content: "Busque hotéis e gere propostas em segundos." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: Index,
});

const nav = [["COTAÇÕES", [[Building2, "Pacotes"], [Plane, "Aéreo"], [Bus, "Rodoviário"], [Shield, "Seguros"]]]] as const;

function Index() {
  const { code: editingCode, mode, etapa } = Route.useSearch();
  const navigate = Route.useNavigate();
  const mobile = useIsMobile(1024);
  const searchEpoch = useRef(0);
  const flightSearchKey = useRef("");
  const [searchedKey, setSearchedKey] = useState("");
  const [minimumStars, setMinimumStars] = useState(0);
  const stepTopRef = useRef<HTMLElement>(null);
  const queryClient = useQueryClient();
  const loadEditable = useServerFn(getEditableProposal);
  const access = useAccess();
  const [ownerId, setOwnerId] = useState<string | undefined>();
  const commissions = useSellerCommissions(ownerId);
  const findHotels = useServerFn(searchHotels);
  const findAirbnb = useServerFn(searchAirbnb);
  const findTrivago = useServerFn(searchTrivago);
  const refetchTrivagoQuote = useServerFn(refreshTrivagoQuote);
  const [s, setS] = useState<Search>(() => ({ destino: "", ...defaultTravelDates(), hospedes: "", rav: 0 }));
  const [destId, setDestId] = useState("");
  const [cityFocus, setCityFocus] = useState<"origin" | "destination" | null>(null);
  const [chosenOrigin, setChosenOrigin] = useState("");
  const originCities = useCitySuggestions(commissions.ready && cityFocus === "origin" && s.origem !== chosenOrigin ? s.origem ?? "" : "");
  const destinationCities = useCitySuggestions(commissions.ready && cityFocus === "destination" && !destId ? s.destino : "");
  const [roomGuests, setRoomGuests] = useState<RoomOccupancy[]>([{ adults: 2, childAges: [] }]);
  const rooms = roomGuests.length;
  const adults = countAdults(roomGuests);
  const kids = allChildAges(roomGuests);
  const [hotels, setHotels] = useState<Hotel[]>([]);
  const [airbnbListings, setAirbnbListings] = useState<Hotel[]>([]);
  const [airbnbLoading, setAirbnbLoading] = useState(false);
  const [airbnbError, setAirbnbError] = useState("");
  const [airbnbNextPage, setAirbnbNextPage] = useState<number | undefined>();
  const [airbnbTotal, setAirbnbTotal] = useState(0);
  const [trivagoListings, setTrivagoListings] = useState<Hotel[]>([]);
  const [trivagoLoading, setTrivagoLoading] = useState(false);
  const [trivagoError, setTrivagoError] = useState("");
  const [trivagoWarning, setTrivagoWarning] = useState("");
  const [trivagoQuoteBusy, setTrivagoQuoteBusy] = useState<string | null>(null);
  const [trivagoNextPage, setTrivagoNextPage] = useState<number | undefined>();
  const [accommodationSource, setAccommodationSource] = useState<"hotel" | "airbnb" | "trivago">("hotel");
  // Snapshot independente dos resultados visíveis: trocar de aba ou refazer busca não perde seleções.
  const [selectedOffers, setSelectedOffers] = useState<Record<string, Hotel>>({});
  const [gallery, setGallery] = useState<Hotel | null>(null);
  const [loading, setLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [err, setErr] = useState("");
  const [q, setQ] = useState("");
  const [sort, setSort] = useState<"asc" | "desc">("asc");
  const [hotelPage, setHotelPage] = useState(1);
  const [sel, setSel] = useState<string[]>([]);
  const outboundRef = useRef<HTMLDivElement>(null);
  const returnRef = useRef<HTMLDivElement>(null);
  const summaryRef = useRef<HTMLDivElement>(null);
  const [advanceTo, setAdvanceTo] = useState<ProposalSelectionStep | null>(null);
  const [link, setLink] = useState("");
  const [uploading, setUploading] = useState(false);
  const findFlights = useServerFn(searchFlights);
  type Leg = { list: Flight[]; loading: boolean; error?: string | undefined };
  const empty: Leg = { list: [], loading: false };
  const [outF, setOutF] = useState<Leg>(empty);
  const [backF, setBackF] = useState<Leg>(empty);
  const [destIata, setDestIata] = useState("");
  const [flightQuery, setFlightQuery] = useState("");
  const [outNum, setOutNum] = useState(""), [backNum, setBackNum] = useState("");
  const [numBusy, setNumBusy] = useState<{ out: boolean; back: boolean }>({ out: false, back: false });
  const [numMsg, setNumMsg] = useState<{ out: string; back: string }>({ out: "", back: "" });
  const [flightSort, setFlightSort] = useState<"asc" | "desc">("asc");
  const [directOnly, setDirectOnly] = useState(false);
  const [picking, setPicking] = useState(false);
  const [calMonth, setCalMonth] = useState<Date>(() => calendarOpenMonth());
  const [pickF, setPickF] = useState<{ out?: Flight | undefined; back?: Flight | undefined }>({});
  const [editLoading, setEditLoading] = useState(false);
  useEffect(() => {
    if (!mode) return;
    setS(previous => ({ ...previous, transport: makeTransport(mode, previous.destino) }));
  }, [mode]);
  useEffect(() => {
    if (!editingCode) return;
    let alive = true; setEditLoading(true);
    loadEditable({ data: editingCode }).then(row => {
      if (!alive) return;
      const proposal = decodeProposal(row.payload);
      setOwnerId(row.ownerId ?? undefined);
      if (!proposal) throw new Error("Proposta inválida.");
      const restored = proposal.hotels.map((hotel, index) => ({ ...hotel, id: `saved-${index}`, x: 50, y: 50 }));
      setS(proposal.s); setHotels(restored.filter(h => !h.provider || h.provider === "hotel")); setAirbnbListings(restored.filter(h => h.provider === "airbnb")); setTrivagoListings(restored.filter(h => h.provider === "trivago")); setSelectedOffers(Object.fromEntries(restored.map(h => [h.id, h]))); setSel(restored.map(h => h.id)); setChosenOrigin(proposal.s.origem ?? "");
      setHasSearched(true);
      setSearchedKey(packageSearchKey(proposal.s, proposal.s.destinationId ?? "", restoreRoomOccupancies(proposal.s.roomOccupancies, proposal.s.rooms ?? 1, proposal.s.adults ?? Number(proposal.s.hospedes.match(/(\d+) hóspede/)?.[1] ?? 2), proposal.s.childAges ?? [])));
      setDestId(proposal.s.destinationId ?? ""); setRoomGuests(restoreRoomOccupancies(proposal.s.roomOccupancies, proposal.s.rooms ?? 1, proposal.s.adults ?? Number(proposal.s.hospedes.match(/(\d+) hóspede/)?.[1] ?? 2), proposal.s.childAges ?? [])); setCalMonth(calendarOpenMonth(new Date(), proposal.s.checkin));
    }).catch(error => { if (alive) setErr(error instanceof Error ? error.message : "Não foi possível abrir a proposta."); }).finally(() => { if (alive) setEditLoading(false); });
    return () => { alive = false; };
  }, [editingCode, loadEditable]);
  const transport = s.transport ?? makeTransport("none", s.destino);
  const pricingSearch: Search = { ...s, roomOccupancies: roomGuests, rooms, adults, childAges: kids, hospedes: `${rooms} quarto · ${adults + kids.length} hóspedes` };
  const effectiveTransport = transport.mode === "bus" && isCaldasNovas(s.destino) ? { ...transport, price: transportCost(pricingSearch) } : transport;
  const savedLegReady = (leg: typeof transport.outbound) => Boolean(editingCode && leg.company && leg.departure && leg.arrival);
  const freshFlights = Boolean(pickF.out || pickF.back);
  const outboundReady = Boolean(pickF.out || (!freshFlights && savedLegReady(transport.outbound)));
  const inboundReady = Boolean(pickF.back || (!freshFlights && savedLegReady(transport.inbound)));
  const flightsReady = outboundReady && inboundReady;
  const requestedStep = etapa ?? (editingCode && hasSearched ? "resumo" : "pesquisa");
  const step = availablePackageStep(requestedStep, { hasSearch: hasSearched, hotelCount: sel.length, mode: transport.mode, flightsReady });
  const flowActive = mobile && step !== "pesquisa";
  const accommodationLoading = accommodationSource === "hotel" ? loading : accommodationSource === "airbnb" ? airbnbLoading : trivagoLoading;
  const flowLoading = (step === "hoteis" && accommodationLoading) || (step === "voos" && transport.mode === "air" && (outF.loading || backF.loading));
  const goStep = useCallback((next: PackageStep, replace = false) => { void navigate({ search: previous => ({ ...previous, etapa: next === "pesquisa" ? undefined : next }), replace, resetScroll: true }); }, [navigate]);
  const searchKey = packageSearchKey(s, destId, roomGuests);
  useEffect(() => {
    if (!searchedKey || searchedKey === searchKey || editLoading) return;
    searchEpoch.current += 1; flightSearchKey.current = "";
    setHasSearched(false); setSearchedKey(""); setLoading(false); setAirbnbLoading(false); setTrivagoLoading(false);
    setHotels([]); setAirbnbListings([]); setTrivagoListings([]); setSelectedOffers({}); setSel([]);
    setOutF({ list: [], loading: false }); setBackF({ list: [], loading: false }); setPickF({});
    setS(previous => previous.transport?.mode === "air" ? { ...previous, transport: makeTransport("air", previous.destino) } : previous);
    setDestIata(""); setFlightQuery(""); setOutNum(""); setBackNum("");
    setNumMsg({ out: "", back: "" }); setNumBusy({ out: false, back: false });
    setLink(""); setErr("");
  }, [searchKey, searchedKey, editLoading]);
  useEffect(() => {
    if (mobile && !editLoading && etapa && etapa !== step) goStep(step, true);
  }, [mobile, editLoading, etapa, step, goStep]);
  useEffect(() => {
    if (!mobile || step === "pesquisa") return;
    window.scrollTo({ top: 0, behavior: "instant" });
    stepTopRef.current?.focus({ preventScroll: true });
  }, [mobile, step]);
  useEffect(() => {
    if (!advanceTo || (mobile && advanceTo !== "summary" && step !== "voos")) return;
    const target = advanceTo === "out" ? outboundRef.current : advanceTo === "back" ? returnRef.current : summaryRef.current;
    if (!target) return;
    target.focus({ preventScroll: true });
    target.scrollIntoView({ behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth", block: "start" });
    setAdvanceTo(null);
  }, [advanceTo, mobile, step]);

  const changeDestination = (destination: string) => setS(previous => {
    const current = previous.transport;
    const changedCity = previous.destino.split(",")[0] !== destination.split(",")[0];
    return { ...previous, destino: destination, transport: current && changedCity && (isCaldasNovas(destination) !== isCaldasNovas(previous.destino) || current.standard) ? makeTransport(current.mode, destination) : current ?? makeTransport("none", destination) };
  });
  useEffect(() => { setLink(""); }, [s, roomGuests, commissions.data?.updatedAt]);
  const nights = nightsBetween(s.checkin, s.checkout);
  const hosp = `${rooms} quarto${rooms > 1 ? "s" : ""} · ${adults + kids.length} hóspede${adults + kids.length > 1 ? "s" : ""}`;

  const changeRoomGuests = (next: RoomOccupancy[]) => {
    searchEpoch.current += 1; flightSearchKey.current = "";
    setLoading(false); setAirbnbLoading(false); setTrivagoLoading(false);
    setRoomGuests(next);
    // Existing supplier prices were for the old room allocation.
    setHotels([]); setAirbnbListings([]); setTrivagoListings([]);
    setOutF({ list: [], loading: false }); setBackF({ list: [], loading: false }); setPickF({});
    // A selected flight fare may belong to a different number of passengers.
    setS(previous => previous.transport?.mode === "air"
      ? { ...previous, transport: makeTransport("air", previous.destino) } : previous);
    setSel([]); setSelectedOffers({}); setGallery(null);
    setHasSearched(false); setLink(""); setHotelPage(1); setErr("");
  };

  const fetchAirbnbListings = async (page = 1) => {
    const epoch = searchEpoch.current;
    if (!commissions.ready) { setAirbnbError(COMMISSION_REQUIRED); return; }
    if (!access.allowed) { setAirbnbError("Seu acesso precisa ser liberado pelo administrador."); return; }
    if (rooms > 1 || kids.length > 0) {
      setAirbnbError("Esta API do Airbnb não permite reservar quartos separados nem informar idades das crianças. Para essa ocupação, use Hotéis.");
      return;
    }
    if (!s.destino.trim()) { setAirbnbError("Escolha um destino antes de buscar Airbnb."); return; }
    if (s.checkout <= s.checkin) { setAirbnbError("A data de volta precisa ser posterior à de ida."); return; }
    setAirbnbLoading(true);
    setAirbnbError("");
    try {
      const result = await findAirbnb({ data: {
        destination: s.destino, checkin: s.checkin, checkout: s.checkout, adults, page,
      } });
      if (epoch !== searchEpoch.current) return;
      if (result.error) { setAirbnbError(result.error); return; }
      setAirbnbListings(previous => page === 1 ? result.listings : [
        ...previous, ...result.listings.filter(item => !previous.some(known => known.id === item.id)),
      ]);
      setAirbnbNextPage(result.nextPage);
      setAirbnbTotal(result.totalResults);
      setHotelPage(1);
    } catch (error) {
      if (epoch !== searchEpoch.current) return;
      setAirbnbError(error instanceof Error ? error.message : "Não foi possível consultar a GeckoAPI.");
    } finally { if (epoch === searchEpoch.current) setAirbnbLoading(false); }
  };

  const openAirbnb = () => {
    setAccommodationSource("airbnb");
    setHotelPage(1); setQ("");
    if (!airbnbListings.length && !airbnbLoading) void fetchAirbnbListings(1);
  };

  const fetchTrivagoListings = async (page = 1) => {
    const epoch = searchEpoch.current;
    if (!commissions.ready) { setTrivagoError(COMMISSION_REQUIRED); return; }
    if (!access.allowed) { setTrivagoError("Seu acesso precisa ser liberado pelo administrador."); return; }
    if (rooms > 1) {
      setTrivagoError("A API do Trivago não permite informar a distribuição de adultos e crianças por quarto. Para vários quartos, use Hotéis.");
      return;
    }
    if (!s.destino.trim()) { setTrivagoError("Informe uma cidade ou região para buscar no Trivago."); return; }
    if (s.checkout <= s.checkin) { setTrivagoError("A data de volta precisa ser posterior à de ida."); return; }
    setTrivagoLoading(true); setTrivagoError(""); setTrivagoWarning("");
    try {
      const result = await findTrivago({ data: {
        location: s.destino, checkinDate: s.checkin, checkoutDate: s.checkout,
        numAdults: adults, numChildren: kids.length, numRooms: rooms, page,
      } });
      if (epoch !== searchEpoch.current) return;
      // Keep next group available if some hotels could not be quoted.
      setTrivagoNextPage(result.nextPage);
      setTrivagoWarning(result.warning ?? "");
      if (result.error && !result.listings.length) { setTrivagoError(result.error); return; }
      if (result.error) setTrivagoWarning(result.error);
      setTrivagoListings(previous => page === 1 ? result.listings :
        [...previous, ...result.listings.filter(h => !previous.some(known => known.id === h.id))]);
      setHotelPage(1);
    } catch (error) {
      if (epoch !== searchEpoch.current) return;
      setTrivagoError(error instanceof Error ? error.message : "Não foi possível consultar o Trivago.");
    } finally { if (epoch === searchEpoch.current) setTrivagoLoading(false); }
  };

  const retryTrivagoHotel = async (hotel: Hotel) => {
    if (!commissions.ready) { setErr(COMMISSION_REQUIRED); return; }
    if (!hotel.sourceUrl || trivagoQuoteBusy) return;
    if (rooms > 1) { setTrivagoError("Trivago não aceita ocupação individual de vários quartos. Use Hotéis."); return; }
    const epoch = searchEpoch.current;
    setTrivagoQuoteBusy(hotel.id);
    try {
      const quote = await refetchTrivagoQuote({ data: {
        id: hotel.id, url: hotel.sourceUrl,
        checkinDate: s.checkin, checkoutDate: s.checkout,
        numAdults: adults, numChildren: kids.length, numRooms: rooms,
      } });
      if (epoch !== searchEpoch.current) return;
      setTrivagoListings(previous => previous.map(h => {
        if (h.id !== hotel.id) return h;
        if (quote.error || quote.total === undefined || quote.nightly === undefined) {
          return { ...h, quoteError: quote.error || "Tarifa não disponível." };
        }
        return { ...h, total: quote.total, nightly: quote.nightly,
          supplierName: quote.supplierName, room: quote.room || h.room,
          quoteError: undefined, totalEstimated: true, priceConfirmed: false };
      }));
    } catch (error) {
      if (epoch !== searchEpoch.current) return;
      setTrivagoListings(previous => previous.map(h => h.id === hotel.id
        ? { ...h, quoteError: error instanceof Error ? error.message : "Falha na consulta." } : h));
    } finally { setTrivagoQuoteBusy(null); }
  };

  const openTrivago = () => {
    setAccommodationSource("trivago"); setHotelPage(1); setQ(""); setSort("asc");
    if (!trivagoListings.length && !trivagoLoading) void fetchTrivagoListings(1);
  };

  const startFlightSearch = (force = false) => {
    if (!commissions.ready) { setErr(COMMISSION_REQUIRED); return; }
    const key = `${searchKey}:${destIata}`;
    if (!force && flightSearchKey.current === key) return;
    if (flightSearchKey.current && flightSearchKey.current !== key) {
      setPickF({});
      setS(previous => ({ ...previous, transport: makeTransport("air", previous.destino) }));
    }
    flightSearchKey.current = key;
    const epoch = searchEpoch.current;
    const from = iataOf(s.origem) || cityIata(s.origem ?? ""), to = iataOf(destIata) || cityIata(destIata) || cityIata(s.destino);
    if (!from || !to) {
      setOutF({ list: [], loading: false, error: "Não reconheci os aeroportos. Confira a origem da pesquisa e o aeroporto de destino." });
      setBackF({ list: [], loading: false }); return;
    }
    const run = (a: string, b: string, date: string, set: (leg: Leg) => void) => {
      set({ list: [], loading: true });
      findFlights({ data: { from: a, to: b, date, adults, children: kids.length } })
        .then(result => { if (epoch === searchEpoch.current) set({ list: result.flights, loading: false, error: result.error ?? (result.flights.length ? undefined : "Nenhum voo encontrado.") }); })
        .catch(error => { if (epoch === searchEpoch.current) set({ list: [], loading: false, error: error instanceof Error ? error.message : "Não foi possível buscar os voos." }); });
    };
    run(from, to, s.checkin, setOutF); run(to, from, s.checkout, setBackF);
  };

  const buscar = async () => {
    if (!commissions.ready) { setErr(COMMISSION_REQUIRED); return; }
    if (!access.allowed) { setErr("Seu acesso precisa ser liberado pelo administrador."); return; }
    if (!s.destino.trim() || (accommodationSource === "hotel" && !destId)) { setErr("Escolha um destino da lista de sugestões."); return; }
    if (s.checkout <= s.checkin) { setErr("A data de volta precisa ser posterior à de ida."); return; }
    if (rooms < 1 || roomGuests.some(r => r.adults < 1)) { setErr("Cada quarto precisa ter pelo menos um adulto."); return; }
    searchEpoch.current += 1;
    const epoch = searchEpoch.current;
    setHasSearched(true); setSearchedKey(searchKey);
    setErr(""); setLink(""); setHotelPage(1); setQ(""); setMinimumStars(0);
    if (mobile) goStep("hoteis");
    if (!mobile && transport.mode === "air") startFlightSearch(true);
    if (accommodationSource === "airbnb") { await fetchAirbnbListings(1); return; }
    if (accommodationSource === "trivago") { await fetchTrivagoListings(1); return; }
    setLoading(true);
    try {
      const result = await findHotels({ data: { destinationId: destId, checkinDate: s.checkin, nights: Math.min(30, nights), adults, childAges: kids, rooms, roomOccupancies: roomGuests, rav: 0 } });
      if (epoch !== searchEpoch.current) return;
      setHotels(result.hotels);
      if (result.error) setErr(result.error); else if (!result.hotels.length) setErr("Nenhum hotel encontrado para essa busca. Tente outras datas ou outro destino.");
    } catch (error) { if (epoch === searchEpoch.current) setErr(error instanceof Error ? error.message : "Não foi possível buscar os hotéis."); }
    finally { if (epoch === searchEpoch.current) setLoading(false); }
  };
  const nextStep = () => {
    if (!commissions.ready) { setErr(COMMISSION_REQUIRED); return; }
    if (!sel.length) return;
    if (step === "hoteis") {
      if (transport.mode === "air") startFlightSearch();
      goStep(transport.mode === "none" ? "resumo" : "voos");
    } else if (step === "voos" && (transport.mode !== "air" || flightsReady)) goStep("resumo");
  };
  const previousStep = () => { const previous = step === "resumo" ? (transport.mode === "none" ? "hoteis" : "voos") : step === "voos" ? "hoteis" : "pesquisa"; if (previous === "voos" && transport.mode === "air") startFlightSearch(); goStep(previous); };

  const displayedAccommodations = accommodationSource === "hotel" ? hotels : accommodationSource === "airbnb" ? airbnbListings : trivagoListings;
  const list = useMemo(() => displayedAccommodations.filter(h => (h.name ?? "").toLowerCase().includes(q.toLowerCase()) && (!mobile || minimumStars === 0 || h.stars >= minimumStars)).sort((a, b) => {
    const aPriced = a.total > 0, bPriced = b.total > 0;
    if (aPriced !== bPriced) return aPriced ? -1 : 1;
    if (!aPriced && !bPriced) return a.name.localeCompare(b.name, "pt-BR");
    return sort === "asc" ? a.total - b.total : b.total - a.total;
  }), [displayedAccommodations, q, sort, mobile, minimumStars]);
  const hotelResults = paginateHotels(list, hotelPage);
  const outboundResults = filterFlightResults(filterFlightResults(outF.list, flightQuery, directOnly, flightSort), outNum, false, flightSort);
  const returnResults = filterFlightResults(filterFlightResults(backF.list, flightQuery, directOnly, flightSort), backNum, false, flightSort);
  const searchByNumber = async (which: "out" | "back") => {
    if (!commissions.ready) { setErr(COMMISSION_REQUIRED); return; }
    const epoch = searchEpoch.current;
    const number = (which === "out" ? outNum : backNum).trim();
    if (!/\d/.test(number)) return;
    const from = iataOf(s.origem) || cityIata(s.origem ?? ""), to = iataOf(destIata) || cityIata(destIata) || cityIata(s.destino);
    if (!from || !to) { setNumMsg(m => ({ ...m, [which]: "Não reconheci os aeroportos da rota." })); return; }
    setNumBusy(b => ({ ...b, [which]: true })); setNumMsg(m => ({ ...m, [which]: "" }));
    try {
      const r = await findFlights({ data: which === "out" ? { from, to, date: s.checkin, adults, children: kids.length } : { from: to, to: from, date: s.checkout, adults, children: kids.length } });
      if (epoch !== searchEpoch.current) return;
      const setLeg = which === "out" ? setOutF : setBackF;
      const current = which === "out" ? outF.list : backF.list;
      const merged = mergeFlights(current, r.flights);
      setLeg(l => ({ ...l, list: mergeFlights(l.list, r.flights), error: undefined }));
      const found = filterFlightResults(merged, number, false, "asc").length;
      setNumMsg(m => ({ ...m, [which]: r.error ?? (found ? `Voo ${number} encontrado na API.` : `Voo ${number} não encontrado na API para esta data e rota.`) }));
    } catch (e) { if (epoch !== searchEpoch.current) return; setNumMsg(m => ({ ...m, [which]: (e as Error).message })); }
    finally { setNumBusy(b => ({ ...b, [which]: false })); }
  };
  const numberField = (which: "out" | "back") => <div className="mb-3"><form onSubmit={e => { e.preventDefault(); void searchByNumber(which); }} className="flex h-11 items-center gap-2 rounded-xl border border-border bg-card px-4"><SearchIcon className="h-4 w-4 shrink-0 text-muted-foreground" /><input aria-label={which === "out" ? "Número do voo de ida" : "Número do voo de volta"} placeholder={which === "out" ? "Número do voo de ida (ex.: G3 1682)" : "Número do voo de volta (ex.: G3 1683)"} className="min-w-0 w-full bg-transparent text-sm outline-none" value={which === "out" ? outNum : backNum} onChange={e => which === "out" ? setOutNum(e.target.value) : setBackNum(e.target.value)} /><Button type="submit" size="sm" variant="outline" disabled={!commissions.ready || numBusy[which]}>{numBusy[which] ? "Buscando..." : "Buscar na API"}</Button></form>{numMsg[which] && <p role="status" className="mt-1 text-xs text-muted-foreground">{numMsg[which]}</p>}</div>;

  const toggle = (id: string) => { const offer = selectedOffers[id] ?? [...hotels, ...airbnbListings, ...trivagoListings].find(h => h.id === id); if (!offer || (offer.provider === "trivago" && offer.total <= 0)) return; setLink(""); setSelectedOffers(previous => { const next = { ...previous }; if (next[id]) delete next[id]; else next[id] = { ...offer, provider: offer.provider ?? "hotel" }; return next; }); setSel(previous => toggleHotelSelection(previous, id)); if (!mobile && sel.length === 0 && transport.mode === "air") setAdvanceTo("out"); };
  const updateSelectedOffer = (id: string, updater: (offer: Hotel) => Hotel) => {
    setSelectedOffers(previous => previous[id] ? { ...previous, [id]: updater(previous[id]) } : previous);
    setHotels(previous => previous.map(offer => offer.id === id ? updater(offer) : offer));
    setAirbnbListings(previous => previous.map(offer => offer.id === id ? updater(offer) : offer));
    setTrivagoListings(previous => previous.map(offer => offer.id === id ? updater(offer) : offer));
  };
  const saveProp = useServerFn(saveProposal);
  const [saving, setSaving] = useState(false);
  const [clientNameError, setClientNameError] = useState("");
  const gerar = async () => {
    if (!commissions.ready) { setErr(COMMISSION_REQUIRED); return; }
    if (mobile && transport.mode === "air" && !flightsReady) { setErr("Selecione os voos de ida e volta antes de gerar a proposta."); goStep("voos"); return; }
    const clientName = s.cliente?.trim();
    if (!clientName) {
      setClientNameError("Preencha o nome do cliente para gerar a proposta.");
      return;
    }
    setClientNameError("");
    setErr("");
    const pendingTrivago = sel.map(id => selectedOffers[id]).find(h => h?.provider === "trivago" && !h.priceConfirmed);
    if (pendingTrivago) {
      setErr(`Confirme o custo total de ${pendingTrivago.name} com o fornecedor antes de gerar a proposta. O preço do Trivago é apenas uma previsão.`);
      summaryRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      return;
    }
    setSaving(true);
    try {
      const chosen = sel.map(id => selectedOffers[id]).filter((h): h is Hotel => Boolean(h)).map(({ id: _i, x: _x, y: _y, ...h }) => ({ ...h, name: h.name.slice(0, 120), extras: normalizeExtraServices(h.extras, h.name) }));
      const fresh = await commissions.refetch();
      if (fresh.error || !fresh.data) throw new Error("Não foi possível verificar as comissões. Tente novamente.");
      const confirmed = requireConfiguredCommissions(fresh.data, commissions.data?.updatedAt ?? "");
      const { extras: _extras, telefone: _telefone, email: _email, ...proposalSearch } = s;
      const { code } = await saveProp({ data: { commissionUpdatedAt: confirmed.updatedAt!, ...(editingCode ? { code: editingCode } : {}), payload: encodeProposal({ s: { ...proposalSearch, rav: 0, cliente: clientName, hospedes: hosp, destinationId: destId, rooms, adults, childAges: kids, roomOccupancies: roomGuests }, hotels: chosen }) } });
      const url = `${window.location.origin}/p/${code}`; setLink(url); navigator.clipboard?.writeText(url).catch(() => {});
      queryClient.invalidateQueries({ queryKey: ["proposal-board"] }); queryClient.invalidateQueries({ queryKey: ["settings"] });
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Não foi possível gerar a proposta.");
      summaryRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    } finally { setSaving(false); }
  };
  const choose = (k: "out" | "back", f: Flight) => {
    const next = { ...pickF, [k]: f }; setPickF(next); setLink(""); if (!mobile || k === "out") setAdvanceTo(nextFlightSelectionStep(k));
    setS(prev => { const t = prev.transport ?? makeTransport("air", prev.destino); const leg = flightToTransportLeg; return { ...prev, transport: { ...t, ...(next.out ? { outbound: { ...t.outbound, ...leg(next.out) } } : {}), ...(next.back ? { inbound: { ...t.inbound, ...leg(next.back) } } : {}), price: (next.out?.price ?? 0) + (next.back?.price ?? 0), travelClass: f.travelClass, bags: f.bags } }; });
  };
  const field = "package-search-control flex h-10 items-center gap-2 rounded-xl border border-border bg-card px-3 text-sm";

  return <div className={`workspace-layout package-workspace ${mobile ? `mobile-step-${step}` : ""} ${flowActive ? `package-mobile-flow mobile-step-${step} ${flowLoading ? "package-search-pending" : ""}` : ""} flex min-h-screen bg-background font-sans text-foreground`}><ManagementNav current="packages" /><main ref={stepTopRef} tabIndex={-1} className="min-w-0 flex-1 p-3 outline-none md:p-6">
    <CommissionNotice query={commissions} />
    {flowActive && commissions.ready && <MobilePackageHeader step={step} mode={transport.mode} destination={s.destino} dates={`${compactDate(s.checkin)} – ${compactDate(s.checkout)}`} guests={`${adults + kids.length} hóspedes${rooms > 1 ? ` · ${rooms} quartos` : ""}`} onBack={previousStep} onStep={next => { if (next === "voos" && transport.mode === "air") startFlightSearch(); goStep(next); }} />}
    {flowActive && commissions.ready && flowLoading && <MobilePackageSearching kind={step === "hoteis" ? "hotels" : "flights"} destination={s.destino} dates={`${compactDate(s.checkin)} – ${compactDate(s.checkout)}`} guests={`${adults + kids.length} hóspedes${rooms > 1 ? ` · ${rooms} quartos` : ""}`} />}

    {editingCode && <div className="mb-4 flex items-center justify-between gap-3 border-b border-border pb-4"><h1 className="font-semibold">{editLoading ? "Abrindo proposta…" : "Editar proposta"} · {editingCode}</h1><Button variant="outline" asChild><Link to="/vendedor" search={{ q: "" }}>Voltar às propostas</Link></Button></div>}
    <section aria-label="Busca de pacotes" className="package-search-compact"><div className="package-search-heading"><span>Pacotes de viagens</span><small>Encontre a melhor opção para seu cliente</small></div><div className="package-search-fields grid grid-cols-2 gap-3 rounded-2xl border border-border bg-card p-3 md:grid-cols-2 2xl:grid-cols-[1.4fr_1.6fr_1.4fr_1.3fr_1.1fr_auto] md:items-end">
      <div className="relative col-span-2 text-sm md:col-span-1"><label htmlFor="origin-city">Origem</label><div className={field + " mt-2"}><Plane className="h-4 w-4" /><input id="origin-city" autoComplete="off" placeholder="Ex.: Brasília (BSB)" className="min-w-0 w-full bg-transparent outline-none" value={s.origem ?? ""} onFocus={() => setCityFocus("origin")} onBlur={() => setCityFocus(null)} onChange={e => { setChosenOrigin(""); setS({ ...s, origem: e.target.value }); }} /></div>{cityFocus === "origin" && (originCities.loading || originCities.error || originCities.items.length > 0) && <div className="absolute z-20 mt-1 w-full overflow-hidden rounded-lg border border-border bg-card shadow-lg">{originCities.loading && <p className="flex items-center gap-2 px-4 py-2 text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" />Buscando cidades…</p>}{originCities.error && <p className="px-4 py-2 text-destructive">{originCities.error}</p>}{originCities.items.map((d, i) => <Button variant="ghost" type="button" key={d.id + i} onMouseDown={e => e.preventDefault()} onClick={() => { setChosenOrigin(d.name); setS(prev => ({ ...prev, origem: d.name })); setCityFocus(null); }} className="h-auto w-full justify-start whitespace-normal rounded-none px-4 py-2 text-left"><span className="text-[10px] text-muted-foreground">{d.type}</span>{d.name}</Button>)}</div>}</div>
      <div className="relative col-span-2 text-sm md:col-span-1"><label htmlFor="destination-city">Destino</label><div className={field + " mt-2"}><MapPin className="h-4 w-4" /><input id="destination-city" autoComplete="off" disabled={uploading} placeholder="Cidade ou região" className="min-w-0 w-full bg-transparent outline-none" value={s.destino} onFocus={() => setCityFocus("destination")} onBlur={() => setCityFocus(null)} onChange={e => { setDestId(""); changeDestination(e.target.value); }} /></div>{cityFocus === "destination" && (destinationCities.loading || destinationCities.error || destinationCities.items.length > 0) && <div className="absolute z-20 mt-1 w-full overflow-hidden rounded-lg border border-border bg-card shadow-lg">{destinationCities.loading && <p className="flex items-center gap-2 px-4 py-2 text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" />Buscando cidades…</p>}{destinationCities.error && <p className="px-4 py-2 text-destructive">{destinationCities.error}</p>}{destinationCities.items.map((d, i) => <Button variant="ghost" type="button" key={d.id + i} disabled={uploading} onMouseDown={e => e.preventDefault()} onClick={() => { setDestId(d.id); changeDestination(d.name); setCityFocus(null); }} className="h-auto w-full justify-start whitespace-normal rounded-none px-4 py-2 text-left"><span className="text-[10px] text-muted-foreground">{d.type}</span>{d.name}</Button>)}</div>}</div>
      <div className="col-span-2 text-sm md:col-span-1"><label htmlFor="package-travel-dates">Ida e volta</label><Popover onOpenChange={open => { if (open) { setCalMonth(calendarOpenMonth(new Date(), editingCode ? s.checkin : undefined)); setPicking(false); } }}><PopoverTrigger asChild><button id="package-travel-dates" type="button" className={field + " mt-2 w-full text-left"}><Calendar className="h-4 w-4" />{fmtD(s.checkin)} → {fmtD(s.checkout)}</button></PopoverTrigger><PopoverContent className="w-auto p-0" align="start"><DayPicker mode="range" locale={ptBR} numberOfMonths={2} month={calMonth} onMonthChange={setCalMonth} disabled={{ before: localCalendarDay(new Date()) }} selected={{ from: toD(s.checkin), to: picking ? undefined : toD(s.checkout) }} onSelect={(_r, day) => { if (!day) return; if (!picking || day <= toD(s.checkin)) { setS(prev => ({ ...prev, checkin: isoD(day), checkout: isoD(new Date(day.getFullYear(), day.getMonth(), day.getDate() + 1)) })); setPicking(true); return; } setS(prev => ({ ...prev, checkout: isoD(day) })); setPicking(false); }} className="pointer-events-auto p-3" /><p className="px-3 pb-3 text-xs text-muted-foreground">{picking ? "Agora clique no dia da volta." : "Clique na ida e depois na volta."} {nights} {nights === 1 ? "noite" : "noites"}.</p></PopoverContent></Popover></div>
      <RoomOccupancyPicker value={roomGuests} onChange={changeRoomGuests} summary={hosp} />
      <label className="col-span-2 text-sm md:col-span-1">Transporte<div className={field + " mt-2"}><select aria-label="Transporte" disabled={uploading} className="min-w-0 w-full bg-transparent outline-none" value={transport.mode} onChange={e => setS(previous => ({ ...previous, transport: makeTransport(e.target.value as TransportMode, previous.destino) }))}><option value="none">Sem transporte</option><option value="air">Aéreo</option><option value="bus">Ônibus</option></select></div></label>
      <button onClick={buscar} disabled={!commissions.ready || loading || editLoading} className="col-span-2 flex h-11 items-center justify-center gap-2 rounded-xl bg-primary px-5 text-sm font-bold text-primary-foreground hover:opacity-90 disabled:opacity-60 md:col-span-1">{loading && <Loader2 className="h-4 w-4 animate-spin" />}<SearchIcon className="h-4 w-4" /> BUSCAR PACOTES</button>
    </div></section>
    {err && <div role="alert" className="mt-3 rounded-xl border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">{err}{flowActive && step === "hoteis" && <button type="button" onClick={() => void buscar()} disabled={accommodationLoading} className="mt-2 block min-h-11 font-semibold underline">Tentar novamente</button>}</div>}
    {hasSearched && commissions.ready && <div className={`package-results-grid mt-6 grid grid-cols-1 items-start gap-6 ${transport.mode === "air" ? "xl:grid-cols-[300px_minmax(0,1fr)] 2xl:grid-cols-[minmax(340px,.6fr)_minmax(0,1.4fr)]" : "xl:grid-cols-[minmax(0,1fr)_380px]"}`}><section className="package-hotel-results min-w-0">{mobile && <MobileHotelTools source={accommodationSource} onSource={source => { setMinimumStars(0); if (source === "airbnb") openAirbnb(); else if (source === "trivago") openTrivago(); else { setAccommodationSource("hotel"); setHotelPage(1); setQ(""); } }} count={list.length} query={q} onQuery={value => { setQ(value); setHotelPage(1); }} sort={sort} onSort={() => { setSort(sort === "asc" ? "desc" : "asc"); setHotelPage(1); }} stars={minimumStars} onStars={value => { setMinimumStars(value); setHotelPage(1); }} />}<div className="package-hotel-desktop-tools mb-4 space-y-3"><h1 className="text-2xl font-semibold">{accommodationSource === "hotel" ? "Hotéis encontrados" : accommodationSource === "airbnb" ? "Airbnb" : "Trivago"} {displayedAccommodations.length > 0 && <span className="text-base font-normal text-muted-foreground">({displayedAccommodations.length})</span>}</h1><div className="flex flex-wrap gap-2"><button className="flex items-center gap-2 rounded-xl border border-border bg-card px-4 py-2 text-sm text-muted-foreground"><Filter className="h-4 w-4" />Filtros</button><button onClick={() => { setSort(sort === "asc" ? "desc" : "asc"); setHotelPage(1); }} className="flex items-center gap-2 rounded-xl border border-border bg-card px-4 py-2 text-sm text-muted-foreground">{sort === "asc" ? "Mais barato" : "Mais caro"}<ChevronDown className="h-4 w-4" /></button><div role="group" aria-label="Escolher fornecedor de hospedagem" className="flex flex-wrap items-center gap-1 rounded-xl border border-border bg-card p-1"><button type="button" aria-pressed={accommodationSource === "hotel"} onClick={() => { setAccommodationSource("hotel"); setHotelPage(1); setQ(""); }} className={`rounded-lg px-3 py-1.5 text-sm font-semibold transition ${accommodationSource === "hotel" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted"}`}>Hotéis</button><button type="button" aria-pressed={accommodationSource === "airbnb"} onClick={openAirbnb} className={`rounded-lg px-3 py-1.5 text-sm font-semibold transition ${accommodationSource === "airbnb" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted"}`}>Airbnb</button><button type="button" aria-pressed={accommodationSource === "trivago"} onClick={openTrivago} className={`rounded-lg px-3 py-1.5 text-sm font-semibold transition ${accommodationSource === "trivago" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted"}`}>Trivago</button></div></div></div><div className="mb-4 flex h-11 items-center gap-2 rounded-xl border border-border bg-card px-4"><SearchIcon className="h-4 w-4 text-muted-foreground" /><input placeholder={accommodationSource === "airbnb" ? "Buscar nos Airbnb..." : accommodationSource === "trivago" ? "Buscar no Trivago..." : "Buscar nos hotéis..."} className="w-full bg-transparent text-sm outline-none" value={q} onChange={e => { setQ(e.target.value); setHotelPage(1); }} /></div>{accommodationSource === "hotel" && loading && <div className="flex items-center gap-2 rounded-2xl border border-border bg-card p-6 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" />Buscando nas operadoras... pode levar até 1 minuto.</div>}{accommodationSource === "airbnb" && airbnbLoading && <div className="mb-4 flex items-center gap-2 rounded-xl border border-primary/20 bg-primary/5 p-4 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" />Buscando imóveis pela GeckoAPI...</div>}{accommodationSource === "airbnb" && airbnbError && <div role="alert" className="mb-4 rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900"><strong>Busca Airbnb indisponível.</strong><p className="mt-1">{airbnbError}</p><p className="mt-2 text-xs">A API usa o segredo GECKO_API_TOKEN configurado no servidor. Nenhuma seleção de hotel foi perdida.</p><button type="button" onClick={() => void fetchAirbnbListings(1)} disabled={airbnbLoading} className="mt-2 rounded-lg border border-amber-400 px-3 py-1.5 font-semibold">Tentar novamente</button></div>}{accommodationSource === "airbnb" && !airbnbLoading && !airbnbError && airbnbListings.length === 0 && <div className="mb-4 rounded-xl border border-primary/20 bg-primary/5 p-4 text-sm text-muted-foreground">Nenhum imóvel Airbnb disponível nesta busca. Verifique destino e datas ou tente novamente.</div>}{accommodationSource === "trivago" && trivagoLoading && <div role="status" className="mb-4 flex items-center gap-2 rounded-xl border border-primary/20 bg-primary/5 p-4 text-sm"><Loader2 className="h-4 w-4 animate-spin" />Consultando hotéis Trivago...</div>}
{accommodationSource === "trivago" && trivagoWarning && <div role="status" className="mb-3 rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">{trivagoWarning}</div>}{accommodationSource === "trivago" && trivagoError && <div role="alert" className="mb-4 rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900"><strong>Busca Trivago indisponível.</strong><p className="mt-1">{trivagoError}</p><button type="button" className="mt-2 rounded-lg border px-3 py-1.5" onClick={() => void fetchTrivagoListings(1)}>Tentar novamente</button></div>}
{accommodationSource === "trivago" && !trivagoLoading && !trivagoError && !trivagoListings.length && <p className="mb-4 rounded-xl border bg-card p-4 text-sm text-muted-foreground">Nenhum hotel retornado nesta etapa. Carregue os próximos hotéis Trivago ou altere a busca.</p>}
{accommodationSource === "trivago" && !!trivagoListings.length && <p className="mb-3 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-900">A consulta busca o menor total de estadia anunciado por fornecedor (PDP), não o valor previsto da listagem. O preço do pacote inclui transporte e comissão. Taxas obrigatórias, disponibilidade e condições finais devem ser conferidas no fornecedor antes do envio.</p>}
{accommodationSource === "hotel" && !loading && !hotels.length && !err && <div className="rounded-2xl border border-border bg-card p-6 text-sm text-muted-foreground">Nenhum hotel disponível para esta busca.</div>}{mobile && !accommodationLoading && displayedAccommodations.length > 0 && !list.length && <p role="status" className="rounded-xl border border-border bg-card p-4 text-sm">Nenhuma hospedagem corresponde aos filtros. Altere o nome ou a categoria.</p>}<div className="space-y-3">{hotelResults.items.map(h => { const on = sel.includes(h.id); return mobile ? <MobilePackageHotelCard key={h.id} hotel={h} selected={on} nights={nights} guests={adults + kids.length} commission={packagePricing(h.total, { ...pricingSearch, extras: h.extras ?? [] }, commissions.data ?? emptyCommissions).commission} sourceLink={h.provider === "airbnb" ? sellerAirbnbUrl(h, { checkin: s.checkin, checkout: s.checkout, adults }) ?? undefined : h.provider === "trivago" ? h.sourceUrl : undefined} quoteBusy={trivagoQuoteBusy !== null} onSelect={() => toggle(h.id)} onDetails={() => setGallery(h)} onQuote={() => void retryTrivagoHotel(h)} /> : <article key={h.id} aria-label={h.name} className={`flex overflow-hidden rounded-lg border bg-card transition ${on ? "border-primary ring-2 ring-primary/30" : "border-border"}`}><button type="button" onClick={() => setGallery(h)} className="w-20 shrink-0 sm:w-28 [&_img]:h-full [&_img]:min-h-32 [&_img]:w-full [&>div]:h-full [&>div]:min-h-32 [&>div]:w-full" aria-label="Ver fotos"><HotelPhoto hotel={h} /></button><div className="flex min-w-0 flex-1 flex-col p-2.5"><div className="flex items-start justify-between gap-2"><button type="button" onClick={() => setGallery(h)} className="text-left font-semibold hover:underline">{h.name}</button><div className="flex items-center gap-2"><div className="flex">{Array.from({ length: h.stars }).map((_, i) => <Star key={i} className="h-3.5 w-3.5 fill-star text-star" />)}</div><button aria-label="Selecionar" onClick={() => toggle(h.id)} className={`grid h-6 w-6 place-items-center rounded-full border-2 ${on ? "border-primary" : "border-border"}`}>{on && <span className="h-3 w-3 rounded-full bg-primary" />}</button></div></div><div className="mt-1 flex items-center gap-1 truncate text-xs text-muted-foreground"><MapPin className="h-3 w-3 shrink-0" /><span className="truncate">{h.address}</span></div>{h.room && <div className="mt-1 truncate text-xs text-muted-foreground">{h.room}</div>}<div className="mt-2 flex items-baseline gap-1"><span className="text-xl font-bold">{h.provider === "trivago" && h.total <= 0 ? "Tarifa indisponível" : brl(h.provider === "trivago" ? packagePricing(h.total, { ...pricingSearch, extras: h.extras ?? [] }, commissions.data ?? emptyCommissions).total : h.nightly)}</span><span className="text-xs text-muted-foreground">{h.provider === "trivago" ? h.total > 0 ? "preço do pacote" : "consulte o hotel" : "/ noite"}</span><CreditCard className="ml-2 h-4 w-4 text-muted-foreground" /></div><div className="text-[11px] text-muted-foreground">{h.provider === "trivago" && h.total <= 0 ? <span className="text-amber-800">A API não retornou preço total de estadia. {h.quoteError}</span> :
      <>{h.provider === "trivago" ? `Menor hospedagem anunciada (${h.supplierName || "fornecedor"}): ` : h.totalEstimated ? "Total estimado, taxas a confirmar: " : "Total de "}{brl(h.total)}</>}</div><div className="mt-auto flex flex-wrap items-end justify-between gap-2 pt-2">{(h.provider !== "trivago" || h.total > 0) && <span className="rounded-md bg-success px-2 py-1 text-xs text-success-foreground">Comissão: {brl(packagePricing(h.total, { ...pricingSearch, extras: h.extras ?? [] }, commissions.data ?? emptyCommissions).commission)}</span>}<div className="flex flex-wrap items-center gap-2">{h.provider === "trivago" && h.total <= 0 && <Button size="sm" variant="outline" disabled={trivagoQuoteBusy !== null} onClick={() => void retryTrivagoHotel(h)}>{trivagoQuoteBusy === h.id ? "Consultando..." : "Consultar tarifa"}</Button>}{h.provider === "trivago" && h.sourceUrl && <a href={h.sourceUrl} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-8 items-center justify-center rounded-lg border border-primary px-3 py-1.5 text-xs font-semibold text-primary">Ver fornecedores no Trivago ↗</a>}{h.provider === "airbnb" && sellerAirbnbUrl(h, { checkin: s.checkin, checkout: s.checkout, adults }) && <a href={sellerAirbnbUrl(h, { checkin: s.checkin, checkout: s.checkout, adults })!} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-8 items-center justify-center rounded-lg border border-primary px-3 py-1.5 text-xs font-semibold text-primary hover:bg-primary/5">Abrir anúncio no Airbnb ↗</a>}<Button size="sm" variant="secondary" disabled={h.provider === "trivago" && h.total <= 0} onClick={() => toggle(h.id)}>{h.provider === "trivago" && h.total <= 0 ? "Sem tarifa" : on ? "Remover" : "Adicionar"}</Button></div></div></div></article>; })}</div>{!loading && list.length > 0 && <nav aria-label="Paginação dos hotéis" className="mt-4 grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 border-t border-border pt-4"><div className="text-xs text-muted-foreground">{hotelResults.start}–{hotelResults.end} de {list.length} hotéis <span className="block mt-1">Página {hotelResults.page} de {list.length ? hotelResults.pages : 1}</span></div><div className="flex gap-2"><Button variant="outline" size="sm" disabled={hotelResults.page === 1} onClick={() => setHotelPage(hotelResults.page - 1)}>Anterior</Button><Button variant="outline" size="sm" disabled={hotelResults.page === hotelResults.pages} onClick={() => setHotelPage(hotelResults.page + 1)}>Próxima</Button></div></nav>}{accommodationSource === "trivago" && !!trivagoNextPage && <button type="button" onClick={() => void fetchTrivagoListings(trivagoNextPage)} disabled={trivagoLoading} className="mt-3 w-full rounded-xl border border-primary px-4 py-2 text-sm font-semibold text-primary disabled:opacity-50">{trivagoLoading ? "Carregando..." : "Carregar mais hotéis Trivago"}</button>}{accommodationSource === "airbnb" && !!airbnbNextPage && <button type="button" onClick={() => void fetchAirbnbListings(airbnbNextPage)} disabled={airbnbLoading} className="mt-3 w-full rounded-xl border border-primary px-4 py-2 text-sm font-semibold text-primary hover:bg-primary/5 disabled:opacity-50">{airbnbLoading ? "Carregando..." : `Carregar mais Airbnb (${airbnbTotal} encontrados)`}</button>}</section>
      <div className="package-flight-column min-w-0 space-y-4">{transport.mode === "air" && <div className="package-flight-results">{mobile && <div className="mb-4 flex flex-wrap items-center justify-between gap-2"><h2 className="text-xl font-bold">Escolha os voos</h2><Button variant="outline" disabled={outF.loading || backF.loading} onClick={() => startFlightSearch(true)}>Atualizar voos</Button></div>}<div><div className="mb-4 space-y-3"><h2 className="text-2xl font-semibold">Voos encontrados {(outF.list.length + backF.list.length) > 0 && <span className="text-base font-normal text-muted-foreground">({outF.list.length + backF.list.length})</span>}</h2><div className="flex flex-wrap gap-2"><Popover><PopoverTrigger asChild><Button variant="outline" className="h-10 rounded-xl bg-card px-4 text-muted-foreground"><Filter />Filtros{directOnly && <span className="text-primary">· 1</span>}</Button></PopoverTrigger><PopoverContent align="start" className="w-72 space-y-4"><label className="flex items-center gap-2 text-sm"><Checkbox checked={directOnly} onCheckedChange={value => setDirectOnly(value === true)} />Somente voos diretos</label><label className="block space-y-2 text-sm"><span>Aeroporto de destino</span><Input aria-label="Aeroporto de destino" placeholder="Ex.: Maceió ou MCZ" value={destIata} onChange={e => setDestIata(e.target.value)} /></label><Button variant="ghost" size="sm" onClick={() => { setDirectOnly(false); setDestIata(""); setFlightQuery(""); }}>Limpar filtros</Button></PopoverContent></Popover><Button variant="outline" className="h-10 rounded-xl bg-card px-4 text-muted-foreground" onClick={() => setFlightSort(previous => previous === "asc" ? "desc" : "asc")}>{flightSort === "asc" ? "Mais barato" : "Mais caro"}<ChevronDown /></Button></div></div><div className="mb-4 flex h-11 items-center gap-2 rounded-xl border border-border bg-card px-4"><SearchIcon className="h-4 w-4 shrink-0 text-muted-foreground" /><input aria-label="Buscar nos voos" placeholder="Aeroporto, cidade, companhia ou voo (ex.: G3 1682)" className="min-w-0 w-full bg-transparent text-sm outline-none" value={flightQuery} onChange={e => setFlightQuery(e.target.value)} /></div>{(flightQuery || directOnly) && !outF.loading && !backF.loading && <p role="status" className="mb-3 text-xs text-muted-foreground">{outboundResults.length + returnResults.length} de {outF.list.length + backF.list.length} voos</p>}<div ref={outboundRef} tabIndex={-1} aria-label="Escolher voo de ida" className="scroll-mt-6 outline-none focus-visible:ring-2 focus-visible:ring-ring">{numberField("out")}<FlightPicker title="Voos de ida" leg={{ ...outF, list: outboundResults }} emptyMessage={outF.list.length ? "Nenhum voo de ida corresponde aos filtros." : undefined} selected={pickF.out?.id} onSelect={f => choose("out", f)} /></div></div><div ref={returnRef} tabIndex={-1} aria-label="Escolher voo de volta" className="scroll-mt-6 outline-none focus-visible:ring-2 focus-visible:ring-ring">{numberField("back")}<FlightPicker title="Voos de volta" leg={{ ...backF, list: returnResults }} emptyMessage={backF.list.length ? "Nenhum voo de volta corresponde aos filtros." : undefined} selected={pickF.back?.id} onSelect={f => choose("back", f)} /></div></div>}
        {transport.mode === "bus" ? <div className="package-bus-section"><TransportPanel s={pricingSearch} value={effectiveTransport} onBusyChange={setUploading} onChange={value => setS(previous => ({ ...previous, transport: value }))} /></div> : transport.mode === "none" ? <div className="package-hotel-map relative h-[380px] overflow-hidden rounded-2xl border border-border bg-secondary">{list.slice(0, 40).map(h => <button key={h.id} onClick={() => toggle(h.id)} style={{ left: `${h.x}%`, top: `${h.y}%` }} className={`absolute -translate-x-1/2 rounded-full border px-2 py-1 text-xs font-bold shadow ${sel.includes(h.id) ? "z-10 border-primary bg-primary text-primary-foreground" : "border-border bg-card"}`}>{brl(Math.round(h.total)).replace(",00", "")}</button>)}{!hotels.length && <span className="absolute inset-0 grid place-items-center text-sm text-muted-foreground">O mapa aparece depois da busca</span>}</div> : null}
        <div ref={summaryRef} tabIndex={-1} aria-label="Resumo da proposta" className="package-summary-section scroll-mt-6 rounded-2xl border border-border bg-card p-4 outline-none focus-visible:ring-2 focus-visible:ring-ring"><div className="mb-3 flex justify-between"><h2 className="font-semibold">Seu resumo</h2><span className="text-sm text-muted-foreground">{sel.length} {sel.length === 1 ? "hospedagem" : "hospedagens"}</span></div>{sel.length === 0 && <p className="text-sm text-muted-foreground">Nenhuma hospedagem selecionada.</p>}<div className="space-y-2">{sel.map(id => { const h = selectedOffers[id]; if (!h) return null; const hotelSearch = { ...pricingSearch, extras: h.extras ?? [] }; const price = packagePricing(h.total, hotelSearch, commissions.data ?? emptyCommissions); return <div key={id} className="rounded-xl border border-border p-3"><button type="button" className="summary-hotel-photo" aria-label={`Ver fotos de ${h.name}`} onClick={() => setGallery(h)}><HotelPhoto hotel={h} /></button><div className="flex justify-between"><span className="text-sm font-semibold">{h.provider === "airbnb" ? "Airbnb · " : h.provider === "trivago" ? "Trivago · " : "Hotel · "}{h.name}</span><button aria-label="Remover" onClick={() => toggle(id)}><Trash2 className="h-4 w-4 text-muted-foreground" /></button></div><div className="text-[11px] text-muted-foreground">{h.address}</div>{h.provider === "trivago" ? <p className="mt-2 text-[11px] text-amber-700">Menor oferta de estadia anunciada pelo fornecedor: confira impostos, taxas, disponibilidade e valor no checkout antes de confirmar.</p> : h.totalEstimated && <p className="mt-2 text-[11px] text-amber-700">Valor estimado: confirme taxas e disponibilidade antes de enviar a proposta.</p>}<label className="mt-2 block text-xs text-muted-foreground">Custo da hospedagem (R$)<Input aria-label={`Custo de ${h.name}`} type="number" min={0} step="0.01" value={h.total} onChange={e => { const total = Math.max(0, Number(e.target.value)); updateSelectedOffer(id, item => ({ ...item, total, nightly: total / nights, ...(item.provider === "trivago" ? { priceConfirmed: false, totalEstimated: true } : {}) })); setLink(""); }} /></label>{h.provider === "trivago" && <div className="mt-2"><button type="button" aria-pressed={!!h.priceConfirmed} onClick={() => { updateSelectedOffer(id, item => ({ ...item, priceConfirmed: !item.priceConfirmed, totalEstimated: item.priceConfirmed })); setLink(""); }} className={`rounded-lg border px-3 py-2 text-xs font-semibold ${h.priceConfirmed ? "border-green-500 bg-green-50 text-green-900" : "border-amber-500 bg-amber-50 text-amber-900"}`}>{h.priceConfirmed ? "✓ Total confirmado com o fornecedor" : "Confirmar que conferi o valor total no fornecedor"}</button></div>}<div className="mt-3 space-y-2 border-t border-border pt-3"><h3 className="text-xs font-semibold">Serviços adicionais desta hospedagem</h3>{(h.extras ?? []).map((item, i) => <div key={i} className="grid grid-cols-[minmax(0,1fr)_100px_auto] gap-2"><Input aria-label={`Serviço adicional ${i + 1} de ${h.name}`} placeholder="Ex.: Almoço" value={item.name} onChange={e => { setLink(""); updateSelectedOffer(id, hotel => ({ ...hotel, extras: (hotel.extras ?? []).map((v, j) => j === i ? { ...v, name: e.target.value } : v) })); }} /><Input aria-label={`Valor do serviço adicional ${i + 1} de ${h.name}`} type="number" min={0} step="0.01" value={item.cost} onChange={e => { setLink(""); updateSelectedOffer(id, hotel => ({ ...hotel, extras: (hotel.extras ?? []).map((v, j) => j === i ? { ...v, cost: Math.max(0, Number(e.target.value)) } : v) })); }} /><Button aria-label={`Remover serviço adicional ${i + 1} de ${h.name}`} variant="ghost" size="icon" onClick={() => { setLink(""); updateSelectedOffer(id, hotel => ({ ...hotel, extras: (hotel.extras ?? []).filter((_, j) => j !== i) })); }}><Trash2 className="h-4 w-4" /></Button></div>)}<div className="flex flex-wrap gap-2">{["Almoço", "Passeio"].map(n => <Button key={n} variant="outline" size="sm" onClick={() => { setLink(""); updateSelectedOffer(id, hotel => ({ ...hotel, extras: [...(hotel.extras ?? []), { name: n, cost: 0 }] })); }}>+ {n}</Button>)}<Button variant="outline" size="sm" onClick={() => { setLink(""); updateSelectedOffer(id, hotel => ({ ...hotel, extras: [...(hotel.extras ?? []), { name: "", cost: 0 }] })); }}>+ Adicionar serviço</Button></div></div><dl className="mt-3 space-y-1 text-xs"><div className="flex justify-between"><dt>Custo dos serviços</dt><dd>{brl(price.cost)}</dd></div><div className="flex justify-between"><dt>Comissão ({commissionLabel(commissionForSearch(pricingSearch, commissions.data ?? emptyCommissions))})</dt><dd>{brl(price.commission)}</dd></div><div className="flex justify-between pt-1 text-sm font-bold"><dt>Preço final do pacote</dt><dd>{brl(price.total)}</dd></div></dl></div>; })}</div>
        <SelectedFlightsSummary
          outbound={pickF.out}
          inbound={pickF.back}
          outboundDate={s.checkin}
          inboundDate={s.checkout}
          onShowOptions={direction => {
            if (mobile) { startFlightSearch(); goStep("voos"); setAdvanceTo(direction); return; }
            const target = direction === "out" ? outboundRef.current : returnRef.current;
            target?.scrollIntoView({ behavior: "smooth", block: "start" });
            target?.focus({ preventScroll: true });
          }}
          onRemove={direction => {
            const next = { ...pickF, [direction]: undefined };
            setPickF(next);
            setLink("");
            setS(prev => {
              const t = prev.transport;
              if (!t) return prev;
              return { ...prev, transport: { ...t, [direction === "out" ? "outbound" : "inbound"]: { company: "", departure: "", arrival: "" }, price: (next.out?.price ?? 0) + (next.back?.price ?? 0) } };
            });
          }}
        />
        {mobile && (transport.mode === "bus" || (transport.mode === "air" && !pickF.out && !pickF.back && flightsReady)) && <TransportPanel s={pricingSearch} value={effectiveTransport} />}
        {transport.mode === "air" && <label className="mt-4 block text-xs text-muted-foreground">Custo total das passagens (R$)<Input aria-label="Custo das passagens" type="number" min={0} step="0.01" value={transport.price ?? 0} onChange={e => setS(previous => ({ ...previous, transport: { ...transport, price: Math.max(0, Number(e.target.value)) } }))} /></label>}
        <div className="mt-4">
          <label htmlFor="client-name" className="mb-1 flex items-center justify-between text-sm font-semibold text-foreground">
            <span>Nome do cliente</span>
            <span className="text-xs font-bold text-destructive">* obrigatório</span>
          </label>
          <input
            id="client-name"
            required
            disabled={editLoading}
            aria-invalid={!!clientNameError}
            aria-describedby={clientNameError ? "client-name-error" : undefined}
            placeholder="Digite o nome do cliente"
            value={s.cliente ?? ""}
            onChange={e => { setLink(""); setClientNameError(""); setS({ ...s, cliente: e.target.value }); }}
            className={`w-full rounded-xl border bg-card px-3 py-3 text-sm outline-none transition ${clientNameError ? "border-destructive ring-2 ring-destructive/25" : "border-border focus:border-primary focus:ring-2 focus:ring-primary/20"}`}
          />
          {clientNameError && (
            <div id="client-name-error" role="alert" className="mt-3 rounded-xl border-2 border-destructive bg-destructive/10 px-4 py-4 text-center text-lg font-extrabold text-destructive shadow-sm">
              ⚠️ {clientNameError}
            </div>
          )}
        </div><Button disabled={!access.allowed || !commissions.ready || !sel.length || uploading || saving || editLoading} onClick={gerar} className="mt-4 h-11 w-full"><Link2 className="h-4 w-4" />{uploading ? "Enviando passagem…" : saving ? "Salvando…" : editingCode ? "Salvar alterações" : mobile ? "Gerar proposta" : "Gerar link"}</Button>{!access.loading && !access.allowed && <p className="mt-2 text-xs text-muted-foreground">Geração de propostas disponível após a liberação do seu acesso.</p>}{link && <div className="mt-3 rounded-lg bg-success p-2 text-xs text-success-foreground"><Check className="mr-1 inline h-3 w-3" />Link copiado! <a href={link} target="_blank" rel="noreferrer" className="underline">Abrir proposta</a></div>}</div></div></div>}
    {flowActive && commissions.ready && !flowLoading && (step === "hoteis" || step === "voos") && <MobilePackageFooter label={step === "hoteis" ? transport.mode === "air" ? "Próximo: voos" : transport.mode === "bus" ? "Próximo: transporte" : "Próximo: resumo" : "Próximo: resumo"} detail={step === "hoteis" ? `${sel.length} ${sel.length === 1 ? "hotel selecionado" : "hotéis selecionados"}` : transport.mode === "air" ? `${Number(outboundReady) + Number(inboundReady)}/2 voos selecionados` : "Confira os dados do transporte"} disabled={flowLoading || !sel.length || uploading || (step === "voos" && transport.mode === "air" && !flightsReady)} onNext={nextStep} />}
  </main>{gallery && <HotelGallery hotel={gallery} stay={{ checkin: s.checkin, checkout: s.checkout, adults }} onClose={() => setGallery(null)} />}</div>;
}
