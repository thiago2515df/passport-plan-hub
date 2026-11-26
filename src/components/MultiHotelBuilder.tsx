import { useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Building2, CalendarDays, Check, ChevronDown, Loader2, MapPin, Plus, Search, Star, Trash2 } from "lucide-react";
import { ptBR } from "react-day-picker/locale";
import { getValidAccessToken } from "@/integrations/supabase/session";
import { searchHotels } from "@/lib/passhub.functions";
import { searchAirbnb } from "@/lib/airbnb.functions";
import type { Hotel } from "@/lib/hotels";
import { brl, nightsBetween } from "@/lib/hotels";
import type { RoomOccupancy } from "@/lib/room-occupancy";
import { addDays, appendMultiHotelStay, moveMultiHotelBoundary, multiHotelStayCost, removeLastMultiHotelStay, type MultiHotelStay } from "@/lib/multi-hotel";
import { Button } from "@/components/ui/button";
import { HotelGallery, HotelPhoto } from "@/components/HotelGallery";
import { HotelMapPicker } from "@/components/HotelMapPicker";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { localCalendarDay } from "@/lib/travel-calendar-dates";

type Source = "hotel" | "airbnb";
type Sort = "asc" | "desc";

const toDate = (iso: string) => new Date(iso + "T12:00");
const iso = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
const dateLabel = (value: string) => toDate(value).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "2-digit" });
const sourceName = (source: Source) => source === "hotel" ? "Hotéis" : "Airbnb";

function PeriodCalendar({
  stays,
  index,
  onChange,
}: {
  stays: MultiHotelStay[];
  index: number;
  onChange: (next: MultiHotelStay[]) => void;
}) {
  const stay = stays[index]!;
  const previous = stays[index - 1];
  const next = stays[index + 1];
  const [month, setMonth] = useState(toDate(stay.checkin));

  // In a consecutive itinerary, only the boundaries between hotels can move.
  // Clicking a day on either neighboring card changes the same shared boundary.
  const canEditStart = index > 0;
  const canEditEnd = index < stays.length - 1;

  const changeStart = (day: Date) => {
    if (!canEditStart) return;
    onChange(moveMultiHotelBoundary(stays, index - 1, iso(day)));
  };
  const changeEnd = (day: Date) => {
    if (!canEditEnd) return;
    onChange(moveMultiHotelBoundary(stays, index, iso(day)));
  };

  return <Popover>
    <PopoverTrigger asChild>
      <button type="button" className="flex min-h-11 w-full items-center gap-2 rounded-xl border border-border bg-card px-3 text-left text-sm shadow-sm hover:border-primary/50">
        <CalendarDays className="h-4 w-4 shrink-0 text-primary" />
        <span className="min-w-0 flex-1">
          <span className="block text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Período do hotel</span>
          <strong className="block truncate">{dateLabel(stay.checkin)} → {dateLabel(stay.checkout)}</strong>
        </span>
        <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
      </button>
    </PopoverTrigger>
    <PopoverContent align="start" className="w-auto max-w-[calc(100vw-2rem)] p-0">
      <div className="border-b border-border px-3 py-2">
        <strong className="text-sm">Hotel {index + 1}</strong>
        <p className="text-xs text-muted-foreground">{nightsBetween(stay.checkin, stay.checkout)} {nightsBetween(stay.checkin, stay.checkout) === 1 ? "noite" : "noites"}</p>
      </div>
      <Calendar
        mode="single"
        locale={ptBR}
        month={month}
        onMonthChange={setMonth}
        selected={undefined}
        disabled={day => {
          const value = iso(day);
          const min = canEditStart ? addDays(previous!.checkin, 1) : stay.checkin;
          const max = canEditEnd ? addDays(next!.checkout, -1) : stay.checkout;
          return value < min || value > max || day < localCalendarDay(new Date());
        }}
        onSelect={day => {
          if (!day) return;
          const value = iso(day);
          const startDistance = Math.abs(day.getTime() - toDate(stay.checkin).getTime());
          const endDistance = Math.abs(day.getTime() - toDate(stay.checkout).getTime());
          if (canEditStart && (!canEditEnd || startDistance <= endDistance)) changeStart(day);
          else if (canEditEnd) changeEnd(day);
          else if (value === stay.checkin || value === stay.checkout) return;
        }}
        className="pointer-events-auto p-3"
      />
      <div className="border-t border-border px-3 py-2 text-[11px] text-muted-foreground">
        {canEditStart && canEditEnd
          ? "Clique perto da entrada para alterar a entrada; perto da saída para alterar a saída."
          : canEditEnd ? "Escolha a data de saída deste hotel." : canEditStart ? "Escolha a data de entrada deste hotel." : "Este é o único período."}
      </div>
    </PopoverContent>
  </Popover>;
}

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
  const [sort, setSort] = useState<Sort>("asc");
  const [gallery, setGallery] = useState<Hotel | null>(null);
  const [mapOpen, setMapOpen] = useState(false);

  const safeIndex = Math.max(0, Math.min(activeIndex, stays.length - 1));
  const active = stays[safeIndex];
  const key = active ? [destinationId, destination, rooms, adults, JSON.stringify(roomOccupancies), active.checkin, active.checkout, source].join("|") : "";
  const results = cache[key] ?? [];
  const hasResults = Object.prototype.hasOwnProperty.call(cache, key);
  const filtered = useMemo(() => results
    .filter(h => h.name.toLocaleLowerCase("pt-BR").includes(query.toLocaleLowerCase("pt-BR")))
    .sort((a, b) => {
      if (a.total <= 0 && b.total > 0) return 1;
      if (b.total <= 0 && a.total > 0) return -1;
      return sort === "asc" ? a.total - b.total : b.total - a.total;
    }), [results, query, sort]);
  const selected = active?.hotel;
  const selectedCount = stays.filter(stay => Boolean(stay.hotel)).length;
  const allPriced = stays.length >= 2 && selectedCount === stays.length;

  const modify = (next: MultiHotelStay[], focus = safeIndex) => {
    onChange(next);
    setActiveIndex(Math.max(0, Math.min(next.length - 1, focus)));
    setError("");
  };

  const choose = (hotel: Hotel) => {
    if (!active || !Number.isFinite(hotel.total) || hotel.total <= 0) return;
    const alreadySelected = active.hotel?.id === hotel.id;
    const next = stays.map((stay, i) => i === safeIndex
      ? { ...stay, hotel: alreadySelected ? undefined : { ...hotel, provider: hotel.provider ?? "hotel" } }
      : stay);
    onChange(next);
    setError("");
    if (!alreadySelected && safeIndex < stays.length - 1) {
      setActiveIndex(safeIndex + 1);
      setQuery("");
      setSource("hotel");
    }
  };

  const changeDates = (next: MultiHotelStay[]) => {
    if (next === stays) return;
    onChange(next);
    setError("");
    setQuery("");
  };

  const search = async () => {
    if (!active || !enabled || pending) return;
    if (source === "hotel" && nightsBetween(active.checkin, active.checkout) > 30) {
      setError("A PassHub permite no máximo 30 noites por consulta. Divida esse período em mais hotéis.");
      return;
    }
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
      setCache(previous => ({ ...previous, [key]: hotels }));
      if (!hotels.length) setError("Nenhuma hospedagem disponível neste período. Tente outras datas.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Não foi possível consultar o fornecedor.");
    } finally {
      setPending("");
    }
  };

  if (!stays.length) return null;

  return <section className="min-w-0 space-y-4" aria-label="Busca Multi-hotel">
    <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
      <div className="border-b border-border bg-primary px-4 py-3 text-primary-foreground">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-base font-bold">Multi-hotel · {destination.split(",")[0] || destination}</h2>
            <p className="text-xs text-primary-foreground/80">Escolha um hotel para cada parte da viagem.</p>
          </div>
          <span className="rounded-full bg-white/15 px-3 py-1 text-xs font-bold">{selectedCount}/{stays.length} escolhidos</span>
        </div>
      </div>

      <div className="grid gap-2 bg-secondary/40 p-3 sm:grid-cols-2 xl:grid-cols-3">
        {stays.map((stay, index) => {
          const isActive = index === safeIndex;
          return <div key={index} className={`rounded-xl border bg-card p-2.5 transition ${isActive ? "border-primary ring-2 ring-primary/15" : "border-border"}`}>
            <button type="button" onClick={() => { setActiveIndex(index); setQuery(""); setError(""); }} className="mb-2 flex w-full items-center gap-2 text-left">
              <span className={`grid h-8 w-8 shrink-0 place-items-center rounded-full text-xs font-bold ${isActive ? "bg-primary text-primary-foreground" : stay.hotel ? "bg-success text-success-foreground" : "bg-secondary"}`}>{stay.hotel ? <Check className="h-4 w-4" /> : index + 1}</span>
              <span className="min-w-0 flex-1">
                <strong className="block truncate text-sm">Hotel {index + 1}</strong>
                <span className="block truncate text-[11px] text-muted-foreground">{stay.hotel?.name ?? "Ainda não escolhido"}</span>
              </span>
              {stay.hotel && <strong className="text-xs text-primary">{brl(stay.hotel.total)}</strong>}
            </button>
            <PeriodCalendar stays={stays} index={index} onChange={changeDates} />
          </div>;
        })}
      </div>

      <div className="flex flex-wrap gap-2 border-t border-border p-3">
        <Button type="button" variant="outline" size="sm"
          disabled={nightsBetween(stays[stays.length - 1]!.checkin, stays[stays.length - 1]!.checkout) < 2 || stays.length >= 20}
          onClick={() => modify(appendMultiHotelStay(stays), stays.length)}
          className="gap-1.5"><Plus className="h-4 w-4" />Adicionar outro hotel</Button>
        {stays.length > 2 && <Button type="button" variant="ghost" size="sm" className="gap-1.5 text-destructive" onClick={() => modify(removeLastMultiHotelStay(stays), stays.length - 2)}><Trash2 className="h-4 w-4" />Remover último</Button>}
      </div>
    </div>

    {active && <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
      <div className="border-b border-border px-4 py-3">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-xl font-semibold">Hotéis para o período {safeIndex + 1}</h2>
            <p className="mt-1 text-xs text-muted-foreground">{dateLabel(active.checkin)} → {dateLabel(active.checkout)} · {nightsBetween(active.checkin, active.checkout)} noites · {rooms} {rooms === 1 ? "quarto" : "quartos"} · {adults + childAges.length} hóspedes</p>
          </div>
          {selected && <div className="rounded-lg bg-primary/5 px-3 py-2 text-right">
            <span className="block text-[10px] uppercase tracking-wide text-muted-foreground">Escolhido neste período</span>
            <strong className="text-xs text-primary">{selected.name}</strong>
          </div>}
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-2">
          <div role="group" aria-label="Fornecedor" className="flex items-center gap-1 rounded-xl border border-border bg-card p-1">
            {(["hotel", "airbnb"] as const).map(item => <button type="button" key={item} aria-pressed={source === item} onClick={() => { setSource(item); setQuery(""); setError(""); }} className={`rounded-lg px-3 py-1.5 text-sm font-semibold transition ${source === item ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted"}`}>{sourceName(item)}</button>)}
          </div>
          <Button type="button" variant="outline" size="sm" onClick={() => setMapOpen(true)} disabled={!filtered.some(h => h.latitude != null && h.longitude != null)} className="gap-1.5"><MapPin className="h-4 w-4" />Ver no mapa</Button>
          <Button type="button" variant="outline" size="sm" onClick={() => setSort(value => value === "asc" ? "desc" : "asc")}>{sort === "asc" ? "Mais barato" : "Mais caro"}<ChevronDown className="h-4 w-4" /></Button>
        </div>

        <div className="mt-3 grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto]">
          <div className="flex h-10 items-center gap-2 rounded-xl border border-border bg-card px-3">
            <Search className="h-4 w-4 text-muted-foreground" />
            <input value={query} onChange={e => setQuery(e.target.value)} placeholder="Buscar nos hotéis..." aria-label="Buscar nos hotéis" className="min-w-0 w-full bg-transparent text-sm outline-none" />
          </div>
          <Button type="button" onClick={() => void search()} disabled={Boolean(pending) || !enabled} className="h-10 gap-2">
            {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
            {pending ? "Buscando..." : "Buscar hotéis"}
          </Button>
        </div>
        {source === "airbnb" && <p className="mt-2 text-[11px] text-muted-foreground">Airbnb usa apenas a busca PLP, sem chamadas PDP extras.</p>}
      </div>

      {error && <p role="alert" className="m-3 rounded-xl border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">{error}</p>}
      {!hasResults && !pending && <div className="p-8 text-center">
        <Building2 className="mx-auto h-8 w-8 text-primary/50" />
        <h3 className="mt-2 font-semibold">Pesquise os hotéis deste período</h3>
        <p className="mt-1 text-sm text-muted-foreground">A tarifa será calculada somente de {dateLabel(active.checkin)} a {dateLabel(active.checkout)}.</p>
      </div>}
      {hasResults && !results.length && !error && <p className="p-6 text-center text-sm text-muted-foreground">Nenhum hotel encontrado para estas datas.</p>}

      {!!filtered.length && <div className="divide-y divide-border">
        {filtered.map(h => {
          const on = selected?.id === h.id;
          return <article key={h.id} className={`flex min-w-0 gap-3 p-3 transition ${on ? "bg-primary/5 ring-1 ring-inset ring-primary/30" : "hover:bg-muted/30"}`}>
            <button type="button" onClick={() => setGallery(h)} className="w-24 shrink-0 overflow-hidden rounded-xl bg-secondary sm:w-32 [&_img]:h-full [&_img]:min-h-32 [&_img]:w-full [&>div]:h-full [&>div]:min-h-32 [&>div]:w-full" aria-label={`Ver fotos de ${h.name}`}>
              <HotelPhoto hotel={h} />
            </button>
            <div className="flex min-w-0 flex-1 flex-col">
              <div className="flex items-start justify-between gap-2">
                <button type="button" onClick={() => setGallery(h)} className="text-left font-semibold leading-tight hover:underline">{h.name}</button>
                <div className="flex shrink-0">{Array.from({ length: Math.min(5, h.stars) }).map((_, i) => <Star key={i} className="h-3.5 w-3.5 fill-star text-star" />)}</div>
              </div>
              <p className="mt-1 flex min-w-0 items-center gap-1 text-xs text-muted-foreground"><MapPin className="h-3 w-3 shrink-0" /><span className="truncate">{h.address}</span></p>
              {h.room && <p className="mt-1 line-clamp-1 text-xs text-muted-foreground">{h.room}</p>}
              <div className="mt-2 flex flex-wrap items-end justify-between gap-2">
                <div>
                  <p><strong className="text-xl text-foreground">{brl(h.nightly)}</strong><span className="text-xs text-muted-foreground"> / noite</span></p>
                  <p className="text-[11px] text-muted-foreground">Total de {brl(h.total)} para este período</p>
                </div>
                <Button type="button" size="sm" variant={on ? "outline" : "secondary"} onClick={() => choose(h)} className={on ? "border-primary text-primary" : ""}>
                  {on ? <><Check className="h-4 w-4" />Selecionado</> : "Adicionar"}
                </Button>
              </div>
            </div>
          </article>;
        })}
      </div>}
    </div>}

    <div className="rounded-2xl border border-primary/20 bg-primary/5 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <strong className="text-sm">Hospedagens selecionadas: {selectedCount}/{stays.length}</strong>
          <p className="mt-1 text-xs text-muted-foreground">{allPriced ? "Roteiro completo. O transporte será somado uma única vez no resumo." : "Escolha um hotel em cada período para concluir."}</p>
        </div>
        <strong className="text-xl text-primary">{brl(multiHotelStayCost(stays))}</strong>
      </div>
    </div>

    {mapOpen && <HotelMapPicker hotels={filtered} selectedIds={selected ? [selected.id] : []} onToggle={id => { const hotel = filtered.find(h => h.id === id); if (hotel) { choose(hotel); setMapOpen(false); } }} onClose={() => setMapOpen(false)} />}
    {gallery && active && <HotelGallery hotel={gallery} stay={{ checkin: active.checkin, checkout: active.checkout, adults: adults + childAges.length }} allowRemoteDetails={false} onClose={() => setGallery(null)} />}
  </section>;
}
