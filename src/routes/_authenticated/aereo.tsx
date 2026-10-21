import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useState, useRef, useEffect } from "react";
import { Plane, Bus, Shield, Building2, Search as SearchIcon, Calendar, Check, Trash2, Link2, ArrowRightLeft, Users, ChevronDown, Filter } from "lucide-react";
import { brl, iataOf, cityIata, encodeProposal, makeTransport, type Flight, type Search } from "@/lib/hotels";
import { searchFlights } from "@/lib/flights.functions";
import { saveProposal } from "@/lib/proposals.functions";
import { ManagementNav } from "@/components/ManagementNav";
import { FlightCard } from "@/components/FlightCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar as DayPicker } from "@/components/ui/calendar";
import { ptBR } from "react-day-picker/locale";
import { useCitySuggestions } from "@/hooks/use-city-suggestions";
import { useAccess } from "@/components/AccessProvider";
import { useSellerCommissions } from "@/hooks/use-seller-commissions";
import { CommissionNotice } from "@/components/CommissionNotice";
import { COMMISSION_REQUIRED, requireConfiguredCommissions } from "@/lib/commission-rules";
import { flightToTransportLeg } from "@/lib/customer-itinerary";
import { emptyCommissions, packagePricing, commissionLabel } from "@/lib/package-pricing";

export const Route = createFileRoute("/_authenticated/aereo")({
  head: () => ({ meta: [{ title: "Aéreo — Excursão Brasília" }, { name: "description", content: "Busque passagens aéreas e monte propostas de voos para seus clientes." }, { property: "og:title", content: "Aéreo — Excursão Brasília" }, { property: "og:description", content: "Busque passagens aéreas e monte propostas de voos para seus clientes." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary_large_image" }] }),
  component: AereoPage,
});

const nav = [
  ["COTAÇÕES", [[Building2, "Pacotes"], [Plane, "Aéreo"], [Bus, "Rodoviário"], [Shield, "Seguros"]]],
] as const;

export default function AereoPage() {
  const access = useAccess();
  const findFlights = useServerFn(searchFlights);
  const saveProp = useServerFn(saveProposal);
  const commissions = useSellerCommissions();

  const [tripType, setTripType] = useState<"roundtrip" | "oneway" | "multicity">("roundtrip");
  const [travelClass, setTravelClass] = useState("Econômica");
  const [passengersCount, setPassengersCount] = useState(2);

  const [origin, setOrigin] = useState("Brasília (BSB)");
  const [destination, setDestination] = useState("Porto Seguro (BPS)");
  const [departureDate, setDepartureDate] = useState("2026-11-29");
  const [returnDate, setReturnDate] = useState("2026-12-04");

  const [cityFocus, setCityFocus] = useState<"origin" | "destination" | null>(null);
  const originCities = useCitySuggestions(commissions.ready && cityFocus === "origin" ? origin : "");
  const destinationCities = useCitySuggestions(commissions.ready && cityFocus === "destination" ? destination : "");

  const [recentSearches, setRecentSearches] = useState<Array<{ from: string; to: string }>>([
    { from: "BSB", to: "RIO" },
    { from: "BSB", to: "BPS" },
    { from: "BPS", to: "BSB" },
  ]);

  type LegState = { list: Flight[]; loading: boolean; error?: string | undefined };
  const [outboundLeg, setOutboundLeg] = useState<LegState>({ list: [], loading: false });
  const [returnLeg, setReturnLeg] = useState<LegState>({ list: [], loading: false });

  const [selectedOutbound, setSelectedOutbound] = useState<Flight | undefined>();
  const [selectedReturn, setSelectedReturn] = useState<Flight | undefined>();

  const [clientName, setClientName] = useState("");
  const [clientPhone, setClientPhone] = useState("");
  const [clientEmail, setClientEmail] = useState("");
  const [link, setLink] = useState("");
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");

  const outboundRef = useRef<HTMLDivElement>(null);
  const returnRef = useRef<HTMLDivElement>(null);

  const handleSearch = async () => {
    if (!commissions.ready) { setErr(COMMISSION_REQUIRED); return; }
    if (!access.allowed) {
      setErr("Seu acesso precisa ser liberado pelo administrador.");
      return;
    }
    setErr("");
    setLink("");
    setSelectedOutbound(undefined);
    setSelectedReturn(undefined);

    const fromIata = iataOf(origin) || cityIata(origin) || "BSB";
    const toIata = iataOf(destination) || cityIata(destination) || "BPS";

    setOutboundLeg({ list: [], loading: true });
    setReturnLeg({ list: [], loading: true });

    try {
      const outRes = await findFlights({ data: { from: fromIata, to: toIata, date: departureDate, adults: passengersCount, children: 0 } });
      setOutboundLeg({ list: outRes.flights, loading: false, error: outRes.error || (outRes.flights.length ? undefined : "Nenhum voo de ida encontrado.") });
    } catch (e) {
      setOutboundLeg({ list: [], loading: false, error: (e as Error).message });
    }

    if (tripType === "roundtrip") {
      try {
        const retRes = await findFlights({ data: { from: toIata, to: fromIata, date: returnDate, adults: passengersCount, children: 0 } });
        setReturnLeg({ list: retRes.flights, loading: false, error: retRes.error || (retRes.flights.length ? undefined : "Nenhum voo de volta encontrado.") });
      } catch (e) {
        setReturnLeg({ list: [], loading: false, error: (e as Error).message });
      }
    } else {
      setReturnLeg({ list: [], loading: false });
    }
  };

  const handleSelectOutbound = (f: Flight) => {
    setSelectedOutbound(f);
    setTimeout(() => {
      returnRef.current?.scrollIntoView({ behavior: "smooth" });
    }, 150);
  };

  const generateProposal = async () => {
    if (!commissions.ready) { setErr(COMMISSION_REQUIRED); return; }
    if (!selectedOutbound || (tripType === "roundtrip" && !selectedReturn)) return;
    setSaving(true);
    setErr("");
    try {
      const fresh = await commissions.refetch();
      if (fresh.error || !fresh.data) throw new Error("Não foi possível verificar as comissões. Tente novamente.");
      const confirmed = requireConfiguredCommissions(fresh.data, commissions.data?.updatedAt ?? "");
      const searchObj: Search = {
        origem: origin,
        destino: destination,
        checkin: departureDate,
        checkout: returnDate,
        hospedes: `${passengersCount} passageiro${passengersCount > 1 ? "s" : ""}`,
        rav: 0,
        cliente: clientName || "Cliente Aéreo",
        telefone: clientPhone,
        email: clientEmail,
        transport: {
          mode: "air",
          price: (selectedOutbound?.price ?? 0) + (selectedReturn?.price ?? 0),
          travelClass,
          outbound: flightToTransportLeg(selectedOutbound),
          inbound: selectedReturn ? flightToTransportLeg(selectedReturn) : { company: "N/A", departure: "", arrival: "" },
        },
      };

      const payload = encodeProposal({ s: searchObj, hotels: [{ name: "Passagens aéreas", address: `${origin} → ${destination}`, stars: 0, room: travelClass, image: "", total: 0, nightly: 0 }] });
      const res = await saveProp({ data: { payload, commissionUpdatedAt: confirmed.updatedAt! } });
      const url = `${window.location.origin}/p/${res.code}`;
      setLink(url);
      navigator.clipboard?.writeText(url).catch(() => {});
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const totalFlightPrice = (selectedOutbound?.price ?? 0) + (selectedReturn?.price ?? 0);
  const flightPricing = packagePricing(0, { destino: destination, checkin: departureDate, checkout: returnDate, hospedes: String(passengersCount), rav: 0, transport: { ...makeTransport("air", destination), price: totalFlightPrice } }, commissions.data ?? emptyCommissions);
  useEffect(() => { setLink(""); }, [commissions.data?.updatedAt, selectedOutbound, selectedReturn]);

  return (
    <div className="workspace-layout flex min-h-screen bg-background text-foreground">
      <ManagementNav current="aereo" />
      <main className="mx-auto min-w-0 w-full max-w-7xl px-4 py-8 sm:px-8">
        <CommissionNotice query={commissions} />
        <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="mb-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Cotações</div>
            <h1 className="text-3xl font-bold">Busca Aérea</h1>
          </div>
          <span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-bold text-primary">Módulo Aéreo Profissional</span>
        </div>

        {/* Search Header Box like reference image */}
        <div className="mb-8 rounded-3xl border border-border bg-card p-6 shadow-sm">
          <div className="mb-6 flex flex-wrap items-center justify-between gap-4 border-b border-border pb-4">
            <div className="flex flex-wrap items-center gap-2">
              <Button variant={tripType === "roundtrip" ? "default" : "outline"} className="rounded-full font-semibold" onClick={() => setTripType("roundtrip")}>
                <ArrowRightLeft className="mr-2 h-4 w-4" /> Ida e Volta
              </Button>
              <Button variant={tripType === "oneway" ? "default" : "outline"} className="rounded-full font-semibold" onClick={() => setTripType("oneway")}>
                Só ida
              </Button>
              <Button variant={tripType === "multicity" ? "default" : "outline"} className="rounded-full font-semibold" onClick={() => setTripType("multicity")}>
                MultiTrecho
              </Button>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="rounded-full text-xs font-semibold">
                    {travelClass} <ChevronDown className="ml-1 h-3 w-3" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-44 p-2">
                  {["Econômica", "Executiva", "Primeira Classe"].map(c => (
                    <button key={c} onClick={() => setTravelClass(c)} className="w-full rounded-lg px-3 py-2 text-left text-xs font-medium hover:bg-secondary">
                      {c}
                    </button>
                  ))}
                </PopoverContent>
              </Popover>

              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="rounded-full text-xs font-semibold">
                    <Users className="mr-1 h-3.5 w-3.5" /> {passengersCount} Passageiro{passengersCount > 1 ? "s" : ""} <ChevronDown className="ml-1 h-3 w-3" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-48 p-3">
                  <div className="flex items-center justify-between text-xs">
                    <span>Passageiros</span>
                    <div className="flex items-center gap-2">
                      <Button size="sm" variant="outline" onClick={() => setPassengersCount(Math.max(1, passengersCount - 1))}>-</Button>
                      <span className="font-bold">{passengersCount}</span>
                      <Button size="sm" variant="outline" onClick={() => setPassengersCount(Math.min(9, passengersCount + 1))}>+</Button>
                    </div>
                  </div>
                </PopoverContent>
              </Popover>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_auto_1fr_1fr_1fr_auto] items-center">
            <div className="relative">
              <label className="block text-xs font-semibold text-muted-foreground mb-1">Origem</label>
              <div className="relative">
                <Input value={origin} onFocus={() => setCityFocus("origin")} onChange={e => setOrigin(e.target.value)} placeholder="Cidade ou aeroporto" className="rounded-xl bg-background pr-8" />
                {origin && <button onClick={() => setOrigin("")} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">×</button>}
              </div>
              {cityFocus === "origin" && originCities.items.length > 0 && (
                <div className="absolute z-20 mt-1 max-h-56 w-full overflow-y-auto rounded-xl border border-border bg-card p-1 shadow-lg">
                  {originCities.items.map(c => (
                    <button key={c.id} onClick={() => { setOrigin(c.name); setCityFocus(null); }} className="w-full rounded-lg px-3 py-2 text-left text-xs hover:bg-secondary">
                      {c.name}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="flex justify-center">
              <Button variant="outline" size="icon" className="rounded-full" onClick={() => { const tmp = origin; setOrigin(destination); setDestination(tmp); }} title="Inverter rotas">
                <ArrowRightLeft className="h-4 w-4" />
              </Button>
            </div>

            <div className="relative">
              <label className="block text-xs font-semibold text-muted-foreground mb-1">Destino</label>
              <div className="relative">
                <Input value={destination} onFocus={() => setCityFocus("destination")} onChange={e => setDestination(e.target.value)} placeholder="Cidade ou aeroporto" className="rounded-xl bg-background pr-8" />
                {destination && <button onClick={() => setDestination("")} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">×</button>}
              </div>
              {cityFocus === "destination" && destinationCities.items.length > 0 && (
                <div className="absolute z-20 mt-1 max-h-56 w-full overflow-y-auto rounded-xl border border-border bg-card p-1 shadow-lg">
                  {destinationCities.items.map(c => (
                    <button key={c.id} onClick={() => { setDestination(c.name); setCityFocus(null); }} className="w-full rounded-lg px-3 py-2 text-left text-xs hover:bg-secondary">
                      {c.name}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div>
              <label className="block text-xs font-semibold text-muted-foreground mb-1">Data de ida</label>
              <Input type="date" value={departureDate} onChange={e => setDepartureDate(e.target.value)} className="rounded-xl bg-background" />
            </div>

            <div>
              <label className="block text-xs font-semibold text-muted-foreground mb-1">Data de volta</label>
              <Input type="date" value={returnDate} disabled={tripType === "oneway"} onChange={e => setReturnDate(e.target.value)} className="rounded-xl bg-background" />
            </div>

            <div className="flex items-end">
              <Button disabled={!commissions.ready || outboundLeg.loading || returnLeg.loading} onClick={handleSearch} className="w-full h-11 rounded-xl bg-primary text-primary-foreground font-bold hover:bg-primary/90">
                <SearchIcon className="mr-2 h-4 w-4" /> BUSCAR
              </Button>
            </div>
          </div>

          <div className="mt-4 flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-semibold">Últimas buscas:</span>
              {recentSearches.map((s, i) => (
                <button key={i} onClick={() => { setOrigin(s.from); setDestination(s.to); }} className="rounded-lg border border-border bg-background px-2.5 py-1 hover:border-primary">
                  {s.from} → {s.to}
                </button>
              ))}
            </div>
            <button onClick={() => { setOrigin(""); setDestination(""); }} className="hover:text-destructive">× Limpar</button>
          </div>
        </div>

        {err && <div className="mb-6 rounded-xl border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">{err}</div>}

        {/* Sequential Flights Display: Outbound first, then Return upon selection */}
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-8">
          <div className="space-y-8 min-w-0">
            {/* Outbound Section */}
            <div ref={outboundRef} className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold flex items-center gap-2">
                  <Plane className="h-5 w-5 text-primary" /> Escolha seu voo de ida
                </h2>
                <span className="text-sm text-muted-foreground">{departureDate.split("-").reverse().join("/")}</span>
              </div>

              {outboundLeg.loading && (
                <div className="flex items-center justify-center py-12 rounded-2xl border border-border bg-card">
                  <div className="text-center">
                    <div className="mx-auto h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent mb-3" />
                    <p className="text-sm text-muted-foreground">Buscando melhores tarifas aéreas de ida…</p>
                  </div>
                </div>
              )}

              {outboundLeg.error && (
                <div className="rounded-2xl border border-border bg-card p-6 text-center text-sm text-muted-foreground">
                  {outboundLeg.error}
                </div>
              )}

              {!outboundLeg.loading && !outboundLeg.error && outboundLeg.list.length === 0 && (
                <div className="rounded-2xl border border-border bg-card p-8 text-center text-sm text-muted-foreground">
                  Preencha a origem, destino e datas acima e clique em <strong>BUSCAR</strong> para ver os voos disponíveis.
                </div>
              )}

              <div className="space-y-4">
                {outboundLeg.list.map(f => (
                  <FlightCard key={f.id} flight={f} selected={selectedOutbound?.id === f.id} onSelect={() => handleSelectOutbound(f)} />
                ))}
              </div>
            </div>

            {/* Return Section - only displayed after outbound selection or if roundtrip and outbound chosen */}
            {tripType === "roundtrip" && selectedOutbound && (
              <div ref={returnRef} className="space-y-4 pt-6 border-t border-border">
                <div className="flex items-center justify-between">
                  <h2 className="text-xl font-bold flex items-center gap-2">
                    <Plane className="h-5 w-5 text-primary rotate-180" /> Escolha seu voo de volta
                  </h2>
                  <span className="text-sm text-muted-foreground">{returnDate.split("-").reverse().join("/")}</span>
                </div>

                {returnLeg.loading && (
                  <div className="flex items-center justify-center py-12 rounded-2xl border border-border bg-card">
                    <div className="text-center">
                      <div className="mx-auto h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent mb-3" />
                      <p className="text-sm text-muted-foreground">Buscando voos de volta…</p>
                    </div>
                  </div>
                )}

                {returnLeg.error && (
                  <div className="rounded-2xl border border-border bg-card p-6 text-center text-sm text-muted-foreground">
                    {returnLeg.error}
                  </div>
                )}

                <div className="space-y-4">
                  {returnLeg.list.map(f => (
                    <FlightCard key={f.id} flight={f} selected={selectedReturn?.id === f.id} onSelect={() => setSelectedReturn(f)} />
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Summary Sidebar */}
          <div className="space-y-4">
            <div className="sticky top-6 rounded-3xl border border-border bg-card p-6 shadow-sm">
              <h3 className="font-bold text-lg mb-4">Resumo da Cotação</h3>

              <div className="space-y-3 mb-6">
                <div className="rounded-2xl border border-border p-3 bg-background">
                  <span className="text-xs font-semibold text-muted-foreground block mb-1">Voo de Ida</span>
                  {selectedOutbound ? (
                    <div>
                      <div className="font-bold text-sm">{selectedOutbound.airline} · {selectedOutbound.flightNumber}</div>
                      <div className="text-xs text-muted-foreground">{selectedOutbound.from} → {selectedOutbound.to} · {selectedOutbound.departure}</div>
                      <div className="mt-1 font-black text-primary">{brl(selectedOutbound.price)}</div>
                    </div>
                  ) : (
                    <span className="text-xs text-muted-foreground italic">Nenhum voo selecionado ainda</span>
                  )}
                </div>

                {tripType === "roundtrip" && (
                  <div className="rounded-2xl border border-border p-3 bg-background">
                    <span className="text-xs font-semibold text-muted-foreground block mb-1">Voo de Volta</span>
                    {selectedReturn ? (
                      <div>
                        <div className="font-bold text-sm">{selectedReturn.airline} · {selectedReturn.flightNumber}</div>
                        <div className="text-xs text-muted-foreground">{selectedReturn.from} → {selectedReturn.to} · {selectedReturn.departure}</div>
                        <div className="mt-1 font-black text-primary">{brl(selectedReturn.price)}</div>
                      </div>
                    ) : (
                      <span className="text-xs text-muted-foreground italic">{selectedOutbound ? "Selecione o voo de volta abaixo" : "Aguardando seleção de ida"}</span>
                    )}
                  </div>
                )}
              </div>

              <div className="border-t border-border pt-4 mb-6">
                <div className="flex justify-between items-center text-sm font-semibold mb-1">
                  <span>Custo das passagens</span>
                  <span>{brl(totalFlightPrice)}</span>
                </div>
                {commissions.ready && selectedOutbound && <>
                  <div className="flex justify-between gap-3 text-sm"><span>Comissão ({commissionLabel(commissions.data!.air)})</span><strong>{brl(flightPricing.commission)}</strong></div>
                  <div className="mt-2 flex justify-between gap-3 text-sm font-bold"><span>Preço final da proposta</span><strong className="text-xl text-primary">{brl(flightPricing.total)}</strong></div>
                </>}
              </div>

              <div className="space-y-3 mb-6 border-t border-border pt-4">
                <Input placeholder="Nome do cliente" value={clientName} onChange={e => setClientName(e.target.value)} className="rounded-xl bg-background text-sm" />
                <Input placeholder="Telefone do cliente" value={clientPhone} onChange={e => setClientPhone(e.target.value)} className="rounded-xl bg-background text-sm" />
                <Input placeholder="E-mail do cliente" type="email" value={clientEmail} onChange={e => setClientEmail(e.target.value)} className="rounded-xl bg-background text-sm" />
              </div>

              <Button disabled={!access.allowed || !commissions.ready || !selectedOutbound || (tripType === "roundtrip" && !selectedReturn) || saving} onClick={generateProposal} className="w-full h-11 rounded-xl font-bold">
                <Link2 className="mr-2 h-4 w-4" /> {saving ? "Gerando…" : "Gerar Link de Proposta"}
              </Button>

              {link && (
                <div className="mt-4 rounded-xl bg-success/15 p-3 text-xs text-success text-center">
                  <Check className="inline mr-1 h-3.5 w-3.5" /> Link gerado e copiado! <a href={link} target="_blank" rel="noreferrer" className="underline block mt-1 font-bold">Abrir proposta</a>
                </div>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
