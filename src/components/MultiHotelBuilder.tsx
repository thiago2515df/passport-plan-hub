import { useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Building2, CalendarDays, Check, ChevronRight, Loader2, MapPin, Plus, Search, Trash2 } from "lucide-react";
import { getValidAccessToken } from "@/integrations/supabase/session";
import { searchHotels } from "@/lib/passhub.functions";
import { searchAirbnb } from "@/lib/airbnb.functions";
import type { Hotel } from "@/lib/hotels";
import { brl, nightsBetween } from "@/lib/hotels";
import type { RoomOccupancy } from "@/lib/room-occupancy";
import { addDays, appendMultiHotelStay, moveMultiHotelBoundary, multiHotelStayCost, removeLastMultiHotelStay, type MultiHotelStay } from "@/lib/multi-hotel";
import { Button } from "@/components/ui/button";
import { HotelGallery } from "@/components/HotelGallery";
import { HotelMapPicker } from "@/components/HotelMapPicker";

type Source = "hotel" | "airbnb";
const dateLabel = (iso: string) => new Date(iso + "T12:00").toLocaleDateString("pt-BR");
const sourceName = (source: Source) => source === "hotel" ? "Hotéis" : "Airbnb";

export function MultiHotelBuilder({
  destinationId, destination, stays, onChange,
  rooms, adults, childAges, roomOccupancies, enabled,
}: {
  destinationId: string;
  destination: string;
  stays: MultiHotelStay[];
  onChange: (stays: MultiHotelStay[]) => void;
  rooms: number;
  adults: number;
  childAges: number[];
  roomOccupancies: RoomOccupancy[];
  enabled: boolean;
}) {
  const findHotels = useServerFn(searchHotels);
  const findAirbnb = useServerFn(searchAirbnb);
  const [activeIndex, setActiveIndex] = useState(0);
  const [source, setSource] = useState<Source>("hotel");
  const [cache, setCache] = useState<Record<string, Hotel[]>>({});
  const [pending, setPending] = useState("");
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [gallery, setGallery] = useState<Hotel | null>(null);
  const [mapOpen, setMapOpen] = useState(false);

  const active = stays[Math.min(activeIndex, stays.length - 1)];
  const key = active ? [destinationId, destination, rooms, adults, childAges.join(","), active.checkin, active.checkout, source].join("|") : "";
  const results = cache[key] ?? [];
  const hasResults = Object.prototype.hasOwnProperty.call(cache, key);
  const filtered = useMemo(() => results.filter(h => h.name.toLocaleLowerCase("pt-BR").includes(query.toLocaleLowerCase("pt-BR"))), [results, query]);
  const selected = active?.hotel;
  const selectedCount = stays.filter(stay => Boolean(stay.hotel)).length;
  const allPriced = stays.length >= 2 && selectedCount === stays.length;

  const modify = (next: MultiHotelStay[], focus = activeIndex) => {
    onChange(next);
    setActiveIndex(Math.max(0, Math.min(next.length - 1, focus)));
    setError("");
  };

  const choose = (hotel: Hotel) => {
    if (!active || !Number.isFinite(hotel.total) || hotel.total <= 0) return;
    modify(stays.map((stay, i) => i === activeIndex
      ? { ...stay, hotel: stay.hotel?.id === hotel.id ? undefined : { ...hotel, provider: hotel.provider ?? "hotel" } }
      : stay));
  };

  const search = async () => {
    if (!active || !enabled || pending) return;
    if (source === "hotel" && !destinationId) {
      setError("Escolha o destino na lista de sugestões para pesquisar as tarifas da PassHub.");
      return;
    }
    setPending(key);
    setError("");
    try {
      let hotels: Hotel[] = [];
      if (source === "hotel") {
        const accessToken = await getValidAccessToken();
        const response = await findHotels({ data: {
          accessToken,
          destinationId,
          checkinDate: active.checkin,
          nights: nightsBetween(active.checkin, active.checkout),
          adults,
          childAges,
          rooms,
          roomOccupancies,
          rav: 0,
        } });
        if (response.error) throw new Error(response.error);
        hotels = response.hotels;
      } else {
        const accessToken = await getValidAccessToken();
        const response = await findAirbnb({ data: {
          destination,
          checkin: active.checkin,
          checkout: active.checkout,
          adults: adults + childAges.length,
          page: 1,
          accessToken,
        } });
        if (response.error) throw new Error(response.error);
        hotels = response.listings;
      }
      setCache(prev => ({ ...prev, [key]: hotels }));
      if (!hotels.length) setError("Nenhuma hospedagem disponível neste período. Tente outras datas.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Não foi possível consultar o fornecedor.");
    } finally {
      setPending("");
    }
  };

  if (!stays.length) return null;

  return <section className="space-y-4" aria-label="Hospedagens por período">
    <div className="rounded-2xl border border-primary/20 bg-primary/5 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-lg font-bold text-foreground">Roteiro Multi-hotel</h2>
          <p className="mt-1 text-xs text-muted-foreground">Escolha um hotel para cada período. As diárias são pesquisadas separadamente, nas datas exatas.</p>
        </div>
        <span className="rounded-full bg-primary px-3 py-1 text-xs font-bold text-primary-foreground">{selectedCount}/{stays.length} hotéis</span>
      </div>
      <div className="mt-3 space-y-2">
        {stays.map((stay, index) => <div key={index} className={`rounded-xl border p-3 ${index === activeIndex ? "border-primary bg-card shadow-sm" : "border-border bg-card/70"}`}>
          <button type="button" onClick={() => { setActiveIndex(index); setError(""); setQuery(""); }} className="flex w-full items-center justify-between gap-2 text-left">
            <span className="flex min-w-0 items-center gap-2">
              <span className={`grid h-7 w-7 shrink-0 place-items-center rounded-full text-xs font-bold ${index === activeIndex ? "bg-primary text-primary-foreground" : "bg-secondary"}`}>{index + 1}</span>
              <span className="min-w-0">
                <strong className="block truncate text-sm">{stay.hotel?.name ?? `Escolher hotel ${index + 1}`}</strong>
                <span className="text-xs text-muted-foreground">{dateLabel(stay.checkin)} a {dateLabel(stay.checkout)} · {nightsBetween(stay.checkin, stay.checkout)} noites</span>
              </span>
            </span>
            <span className="flex items-center gap-2">
              {stay.hotel && <Check className="h-4 w-4 text-primary" />}
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            </span>
          </button>
          {index < stays.length - 1 && <label className="mt-3 flex flex-wrap items-center gap-2 border-t border-border pt-3 text-xs text-muted-foreground">
            <CalendarDays className="h-4 w-4" />
            Saída deste hotel / entrada no próximo:
            <input type="date" value={stay.checkout}
              min={addDays(stay.checkin, 1)}
              max={addDays(stays[index + 1]!.checkout, -1)}
              onChange={e => {
                const next = moveMultiHotelBoundary(stays, index, e.target.value);
                if (next !== stays) { modify(next, index); setQuery(""); }
              }}
              className="rounded-lg border border-border bg-card p-2 text-foreground" />
          </label>}
        </div>)}
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        <Button type="button" variant="outline" size="sm" disabled={nightsBetween(stays[stays.length - 1]!.checkin, stays[stays.length - 1]!.checkout) < 2 || stays.length >= 20} onClick={() => modify(appendMultiHotelStay(stays), stays.length)} className="gap-1.5"><Plus className="h-4 w-4" />Adicionar outro hotel</Button>
        {stays.length > 2 && <Button type="button" variant="ghost" size="sm" className="gap-1.5 text-destructive" onClick={() => modify(removeLastMultiHotelStay(stays), stays.length - 2)}><Trash2 className="h-4 w-4" />Remover último período</Button>}
      </div>
      <p className="mt-2 text-[11px] text-muted-foreground">Mudar uma data recalcula os dois períodos vizinhos e limpa os hotéis escolhidos nesses períodos, pois a tarifa anterior não vale para as novas datas.</p>
    </div>

    {active && <div className="rounded-2xl border border-border bg-card p-3 sm:p-4">
      <h3 className="font-bold">Hotel {activeIndex + 1} · {dateLabel(active.checkin)} a {dateLabel(active.checkout)}</h3>
      <p className="mt-1 text-xs text-muted-foreground">{nightsBetween(active.checkin, active.checkout)} noites · {rooms} {rooms === 1 ? "quarto" : "quartos"} · {adults + childAges.length} hóspedes</p>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        {(["hotel", "airbnb"] as const).map(item => <Button type="button" key={item} size="sm" variant={source === item ? "default" : "outline"} onClick={() => { setSource(item); setQuery(""); setError(""); }}>{sourceName(item)}</Button>)}
        <Button type="button" size="sm" variant="outline" onClick={() => setMapOpen(true)} disabled={!filtered.some(h => h.latitude != null && h.longitude != null)} className="gap-1"><MapPin className="h-4 w-4" />Mapa</Button>
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        <Button type="button" onClick={() => void search()} disabled={Boolean(pending) || !enabled} className="gap-2">
          {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
          {pending ? "Consultando tarifas..." : `Buscar ${sourceName(source)} neste período`}
        </Button>
        {!!results.length && <input value={query} onChange={e => setQuery(e.target.value)} placeholder="Filtrar hospedagem por nome..." aria-label="Filtrar hospedagens" className="min-w-0 flex-1 rounded-xl border border-border bg-card px-3 text-sm" />}
      </div>
      {source === "airbnb" && <p className="mt-2 text-[11px] text-muted-foreground">Consulta somente a lista PLP; não faz chamadas PDP adicionais.</p>}
      {error && <p role="alert" className="mt-3 rounded-xl border border-destructive/20 bg-destructive/5 p-3 text-sm text-destructive">{error}</p>}
      {hasResults && !results.length && !error && <p className="mt-3 text-sm text-muted-foreground">Nenhum resultado para este período.</p>}
      <div className="mt-3 max-h-[560px] space-y-2 overflow-y-auto">
        {filtered.map(h => <article key={h.id} className={`flex gap-3 rounded-xl border p-2 ${selected?.id === h.id ? "border-primary bg-primary/5" : "border-border"}`}>
          <button type="button" className="h-24 w-24 shrink-0 overflow-hidden rounded-lg bg-secondary" onClick={() => setGallery(h)} aria-label={`Ver fotos de ${h.name}`}>
            {h.image ? <img src={h.image} alt="" className="h-full w-full object-cover" loading="lazy" /> : <Building2 className="mx-auto h-8 w-8 text-muted-foreground" />}
          </button>
          <div className="min-w-0 flex-1">
            <button type="button" className="line-clamp-2 text-left text-sm font-bold hover:underline" onClick={() => setGallery(h)}>{h.name}</button>
            <p className="line-clamp-1 text-[11px] text-muted-foreground">{h.address}</p>
            <p className="mt-1 text-sm font-bold text-primary">{brl(h.total)} <span className="text-[11px] font-normal text-muted-foreground">pelo período · {brl(h.nightly)}/noite</span></p>
            {h.totalEstimated && <p className="text-[11px] text-amber-700">Tarifa estimada: confirme taxas no anúncio.</p>}
            <Button type="button" size="sm" variant={selected?.id === h.id ? "outline" : "default"} onClick={() => choose(h)} className="mt-2 gap-1.5">
              {selected?.id === h.id ? <><Check className="h-3 w-3" />Selecionado · remover</> : "Escolher para este período"}
            </Button>
          </div>
        </article>)}
      </div>
    </div>}

    <div className="rounded-xl border border-primary/20 bg-primary/5 p-3">
      <strong className="text-sm">Hospedagens do roteiro: {brl(multiHotelStayCost(stays))}</strong>
      <p className="text-xs text-muted-foreground">{allPriced ? "Todas as hospedagens escolhidas. O resumo ao lado soma também o transporte e a comissão uma única vez." : `Faltam ${stays.length - selectedCount} hospedagens para completar o roteiro.`}</p>
    </div>
    {mapOpen && <HotelMapPicker hotels={filtered} selectedIds={selected ? [selected.id] : []} onToggle={id => { const hotel = filtered.find(h => h.id === id); if (hotel) choose(hotel); }} onClose={() => setMapOpen(false)} />}
    {gallery && active && <HotelGallery hotel={gallery} stay={{ checkin: active.checkin, checkout: active.checkout, adults: adults + childAges.length }} allowRemoteDetails={false} onClose={() => setGallery(null)} />}
  </section>;
}
