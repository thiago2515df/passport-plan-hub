import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Bus, Plane, Upload, FileText, Trash2, Loader2, ExternalLink, Users, Luggage, UserRound, Baby, Backpack, BriefcaseBusiness, Clock3, Check, X, HelpCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { viewTicket } from "@/lib/tickets.functions";
import type { Search, Ticket, Transport, TransportLeg } from "@/lib/hotels";
import { AirlineLogo } from "@/components/AirlineLogo";
import { passengerCounts } from "@/lib/customer-itinerary";

export function TicketView({ ticket }: { ticket: Ticket }) {
  const getUrl = useServerFn(viewTicket);
  const [url, setUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function open() {
    setBusy(true); setError("");
    try { setUrl((await getUrl({ data: { path: ticket.path } })).url); }
    catch { setError("Não foi possível abrir a passagem. Tente novamente."); }
    finally { setBusy(false); }
  }
  return <div className="mt-3 min-w-0">
    <Button variant="outline" onClick={open} disabled={busy} className="max-w-full"><FileText /><span className="truncate">{ticket.name}</span>{busy ? <Loader2 className="animate-spin" /> : <ExternalLink />}</Button>
    {error && <p role="alert" className="mt-2 text-sm text-destructive">{error}</p>}
    {url && <div className="mt-3">
      {ticket.type === "application/pdf" ? <iframe title={ticket.name} src={url} className="h-96 w-full rounded-lg border border-border" /> : <img src={url} alt={ticket.name} className="max-h-96 w-full rounded-lg object-contain" />}
      <Button asChild variant="link"><a href={url} target="_blank" rel="noreferrer">Abrir passagem <ExternalLink /></a></Button>
    </div>}
  </div>;
}

export function TransportPanel({ s, value, onChange, onBusyChange }: { s: Search; value: Transport; onChange?: (value: Transport) => void; onBusyChange?: (busy: boolean) => void }) {
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState("");
  const editor = Boolean(onChange);
  const destination = s.destino.split(",")[0] || "Destino";
  const origin = s.origem || "Brasília";
  const Icon = value.mode === "bus" ? Bus : Plane;
  function update(key: "outbound" | "inbound", patch: Partial<TransportLeg>) {
    onChange?.({ ...value, [key]: { ...value[key], ...patch } });
  }
  async function upload(key: "outbound" | "inbound", file?: File) {
    if (!file) return;
    const formats: Record<string, string> = { "application/pdf": "pdf", "image/png": "png", "image/jpeg": "jpg", "image/webp": "webp" };
    const extension = formats[file.type];
    if (!extension || file.size > 20 * 1024 * 1024) { setError("Envie PDF, JPG, PNG ou WEBP de até 20 MB."); return; }
    setBusy(key); onBusyChange?.(true); setError("");
    try {
      const path = `${crypto.randomUUID()}/${crypto.randomUUID()}.${extension}`;
      const { error: failed } = await supabase.storage.from("proposal-tickets").upload(path, file, { contentType: file.type, upsert: false });
      if (failed) throw failed;
      update(key, { ticket: { path, name: file.name, type: file.type } });
    } catch { setError("Não foi possível enviar a passagem. Tente novamente."); }
    finally { setBusy(null); onBusyChange?.(false); }
  }
  const input = "mt-1 w-full min-w-0 rounded-md border border-input bg-background px-2 py-2 text-sm text-foreground";
  if (!editor) return <TransportItinerary s={s} value={value} />;
  return <section className="min-w-0 space-y-4" aria-label="Passagens de transporte">
    <h2 className="flex items-center gap-2 text-lg font-semibold"><Icon />{value.mode === "bus" ? "Ônibus" : "Aéreo"} · Ida e volta</h2>
    {value.standard && <p className="text-sm text-muted-foreground">Caldas Novas · horários padrão. Empresa ilustrativa, substitua pela operadora real.</p>}
    <div className="grid grid-cols-3 gap-3">
      <label className="text-xs text-muted-foreground">Valor total (R$)<input aria-label="Valor do transporte" type="number" min={0} step="0.01" value={value.price ?? ""} onChange={e => onChange?.({ ...value, price: e.target.value === "" ? undefined : Math.max(0, +e.target.value) })} className={input} /></label>
      <label className="text-xs text-muted-foreground">Classe<input aria-label="Classe" placeholder={value.mode === "bus" ? "Executivo" : "Econômica"} value={value.travelClass ?? ""} onChange={e => onChange?.({ ...value, travelClass: e.target.value })} className={input} /></label>
      <label className="text-xs text-muted-foreground">Bagagem<input aria-label="Bagagem" placeholder="1 mala 23kg" value={value.bags ?? ""} onChange={e => onChange?.({ ...value, bags: e.target.value })} className={input} /></label>
    </div>
    {(["outbound", "inbound"] as const).map((key) => {
      const leg = value[key]; const outbound = key === "outbound";
      return <article key={key} className="min-w-0 rounded-lg border border-border bg-card p-4">
        <h3 className="font-semibold">{outbound ? "Ida" : "Volta"} · {outbound ? `${origin} → ${destination}` : `${destination} → ${origin}`}</h3>
        <p className="mt-1 text-sm text-muted-foreground">{outbound ? s.checkin : s.checkout}</p>
        <div className="mt-3 space-y-3">
          <label className="block text-xs text-muted-foreground">Empresa<input aria-label={`Empresa ${outbound ? "ida" : "volta"}`} value={leg.company} disabled={Boolean(busy)} onChange={e => update(key, { company: e.target.value })} className={input} /></label>
          <div className="grid grid-cols-2 gap-3">
            <label className="text-xs text-muted-foreground">Origem (ex.: BSB)<input aria-label={`Origem ${outbound ? "ida" : "volta"}`} value={leg.from ?? ""} onChange={e => update(key, { from: e.target.value })} className={input} /></label>
            <label className="text-xs text-muted-foreground">Destino (ex.: MCZ)<input aria-label={`Destino ${outbound ? "ida" : "volta"}`} value={leg.to ?? ""} onChange={e => update(key, { to: e.target.value })} className={input} /></label>
            {(["departure", "arrival"] as const).map(field => <label key={field} className="text-xs text-muted-foreground">{field === "departure" ? "Saída" : "Chegada"}<input aria-label={`${field === "departure" ? "Saída" : "Chegada"} ${outbound ? "ida" : "volta"}`} type="time" value={leg[field]} disabled={Boolean(busy)} onChange={e => update(key, { [field]: e.target.value })} className={input} /></label>)}
            <label className="text-xs text-muted-foreground">Duração<input aria-label={`Duração ${outbound ? "ida" : "volta"}`} placeholder="02h00" value={leg.duration ?? ""} onChange={e => update(key, { duration: e.target.value })} className={input} /></label>
            <label className="text-xs text-muted-foreground">Paradas<input aria-label={`Paradas ${outbound ? "ida" : "volta"}`} placeholder="Direto" value={leg.stops ?? ""} onChange={e => update(key, { stops: e.target.value })} className={input} /></label>
          </div>
          <input id={`ticket-${key}`} aria-label={`Enviar passagem de ${outbound ? "ida" : "volta"}`} type="file" accept="application/pdf,image/jpeg,image/png,image/webp" disabled={Boolean(busy)} className="sr-only" onChange={e => { void upload(key, e.target.files?.[0]); e.target.value = ""; }} />
          <Button asChild variant="outline" className={busy ? "pointer-events-none opacity-50" : ""}><label htmlFor={`ticket-${key}`} className="cursor-pointer">{busy === key ? <Loader2 className="animate-spin" /> : <Upload />}{leg.ticket ? "Trocar passagem" : `Passagem de ${outbound ? "ida" : "volta"}`}</label></Button>
          {leg.ticket && <div className="flex min-w-0 items-center gap-2 text-xs text-muted-foreground"><FileText className="h-4 w-4 shrink-0" /><span className="truncate">{leg.ticket.name}</span><Button title="Remover passagem" aria-label={`Remover passagem de ${outbound ? "ida" : "volta"}`} size="icon" variant="ghost" disabled={Boolean(busy)} onClick={() => update(key, { ticket: undefined })}><Trash2 /></Button></div>}
        </div>
      </article>;
    })}
    {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
  </section>;
}

const longDate = (d: string) => d ? new Date(d + "T12:00").toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" }) : "";

function CustomerFlightTickets({ s, value }: { s: Search; value: Transport }) {
  const passengers = passengerCounts(s);
  const shortCity = (city: string) => (city.split(",")[0] ?? "").replace(/\s*\([A-Z]{3}\)/gi, "").trim();
  const date = (d: string) => d ? new Date(`${d}T12:00`).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "2-digit" }) : "—";
  return <section aria-label="Itinerário" className="min-w-0 space-y-3">
    {(["outbound", "inbound"] as const).map(key => {
      const leg = value[key], out = key === "outbound";
      const fallbackDate = out ? s.checkin : s.checkout;
      const airline = leg.airline || leg.company.split(" · ")[0] || "";
      const number = leg.flightNumber || leg.company.split(" · ").slice(1).join(" · ");
      const bags = [
        { name: "Item pessoal", Icon: Backpack, included: leg.baggage?.personal },
        { name: "Bagagem de mão", Icon: BriefcaseBusiness, included: leg.baggage?.carryOn },
        { name: "Bagagem despachada", Icon: Luggage, included: leg.baggage?.checked },
      ];
      return <article key={key} aria-label={`Passagem de ${out ? "ida" : "volta"}`} className="@container min-w-0 rounded-lg border border-border bg-card p-4 text-foreground sm:p-5">
        <div className="grid min-w-0 grid-cols-1 gap-4 @min-[560px]:grid-cols-[88px_minmax(0,1fr)] @min-[560px]:gap-6">
          <div className="flex items-center justify-between gap-3 @min-[560px]:flex-col @min-[560px]:justify-center"><AirlineLogo airline={airline} /><span className="rounded-md bg-secondary px-2.5 py-1 text-xs font-bold text-primary">{out ? "IDA" : "VOLTA"}</span></div>
          <div className="min-w-0">
            {(leg.fareCategory || value.travelClass || number) && <div className="mb-4 break-words text-xs font-semibold text-muted-foreground">{[leg.fareCategory || value.travelClass, number].filter(Boolean).join(" · ")}</div>}
            <div className="grid min-w-0 grid-cols-[minmax(0,1fr)_minmax(76px,1fr)_minmax(0,1fr)] items-center gap-2 sm:gap-4">
              <div className="min-w-0"><div className="text-sm font-bold tabular-nums sm:text-base">{date(leg.departureDate || fallbackDate)}</div><div className="mt-1 text-xl font-bold tabular-nums sm:text-2xl">{leg.departure || "—"}</div><div className="mt-1 break-words text-sm font-semibold">{leg.from || shortCity(out ? s.origem || "Brasília" : s.destino)}</div></div>
              <div className="min-w-0 text-center text-xs text-muted-foreground"><div className="flex items-center gap-1"><span className="h-px min-w-0 flex-1 bg-border" /><span className="flex items-center gap-1"><Clock3 className="h-3 w-3 shrink-0" />{leg.duration || "—"}</span><span className="h-px min-w-0 flex-1 bg-border" /></div><div className="mt-2 break-words leading-relaxed">{leg.connections?.length ? `Conexão em: ${leg.connections.join(" / ")}` : leg.stops}</div></div>
              <div className="min-w-0 text-right"><div className="text-sm font-bold tabular-nums sm:text-base">{date(leg.arrivalDate || fallbackDate)}</div><div className="mt-1 text-xl font-bold tabular-nums sm:text-2xl">{leg.arrival || "—"}</div><div className="mt-1 break-words text-sm font-semibold">{leg.to || shortCity(out ? s.destino : s.origem || "Brasília")}</div></div>
            </div>
            <div className="mt-4 flex flex-wrap items-center justify-between gap-x-5 gap-y-3 border-t border-border pt-3">
              <div className="flex items-center gap-4 text-sm font-semibold">
                <span className="flex items-center gap-1.5" aria-label={passengers.adults === undefined ? s.hospedes : `${passengers.adults} adultos`} title="Adultos"><UserRound className="h-5 w-5" />{passengers.adults ?? s.hospedes}</span>
                {passengers.children > 0 && <span className="flex items-center gap-1.5" aria-label={`${passengers.children} crianças`} title="Crianças"><Baby className="h-5 w-5" />{passengers.children}</span>}
              </div>
              <div className="flex items-center gap-4">{bags.map(({ name, Icon, included }) => {
                const label = `${name}: ${included === true ? "incluída" : included === false ? "não incluída" : "não informada"}`;
                return <span key={name} role="img" aria-label={label} title={label} className={`relative inline-flex h-7 w-6 items-center justify-center ${included === false ? "text-muted-foreground/50" : "text-muted-foreground"}`}><Icon className="h-6 w-6" />{included === true ? <Check className="absolute -right-1 -top-1 h-3 w-3 text-success-foreground" /> : included === false ? <X className="absolute -right-1 -top-1 h-3 w-3 text-destructive" /> : <HelpCircle className="absolute -right-1 -top-1 h-3 w-3" />}</span>;
              })}</div>
            </div>
            {!leg.baggage && value.bags && <p className="mt-2 text-xs text-muted-foreground">{value.bags}</p>}
            {leg.ticket && <TicketView ticket={leg.ticket} />}
          </div>
        </div>
      </article>;
    })}
  </section>;
}

/** Cartão do itinerário visto pelo cliente (estilo bilhete). */
export function TransportItinerary({ s, value }: { s: Search; value: Transport }) {
  const destination = s.destino.split(",")[0] || "Destino";
  const origin = s.origem || "Brasília";
  const Icon = value.mode === "bus" ? Bus : Plane;
  if (value.mode === "air") return <CustomerFlightTickets s={s} value={value} />;
  return <section aria-label="Itinerário" className="overflow-hidden rounded-3xl bg-navy text-card shadow-md">
    <div className="flex items-center gap-2 px-4 pt-4 text-xs font-semibold tracking-[0.2em] opacity-80 sm:px-5"><Icon className="h-4 w-4" />{value.mode === "bus" ? "SEU ÔNIBUS" : "SEU VOO"}</div>
    {(["outbound", "inbound"] as const).map((key, i) => {
      const leg = value[key]; const out = key === "outbound";
      const date = longDate(out ? s.checkin : s.checkout);
      const a = out ? origin : destination, b = out ? destination : origin;
      return <div key={key} className={`px-4 py-4 sm:px-5 sm:py-5 ${i ? "border-t border-dashed border-card/40" : ""}`}>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <span className="rounded-md bg-card px-3 py-0.5 text-xs font-black text-navy">{out ? "IDA" : "VOLTA"}</span>
          <span className="min-w-0 flex-1 truncate text-xs font-bold">{leg.company || "—"}</span>
          <span className="text-xs opacity-80">{date}</span>
        </div>
        <div className="mt-3 grid grid-cols-[1fr_auto_1fr] items-center gap-2 sm:gap-3">
          <div className="min-w-0"><div className="text-3xl font-black tabular-nums sm:text-4xl md:text-5xl">{leg.departure || "--:--"}</div><div className="text-xs font-semibold sm:text-sm">{a}{leg.from ? ` (${leg.from})` : ""}</div></div>
          <div className="text-center text-xs">
            <div className="whitespace-nowrap font-bold">{leg.duration}</div>
            <div className="mx-auto my-1 w-12 border-t-2 border-dashed border-card/70 sm:w-24 md:w-32" />
            <div className="whitespace-nowrap opacity-80">{leg.stops || (value.mode === "air" ? "Direto" : "")}</div>
          </div>
          <div className="min-w-0 text-right"><div className="text-3xl font-black tabular-nums sm:text-4xl md:text-5xl">{leg.arrival || "--:--"}</div><div className="text-xs font-semibold sm:text-sm">{b}{leg.to ? ` (${leg.to})` : ""}</div></div>
        </div>
        {leg.ticket && <div className="text-foreground [&_button]:bg-card"><TicketView ticket={leg.ticket} /></div>}
      </div>;
    })}
    <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2 border-t border-card/20 px-4 py-3 text-sm sm:px-5">
      <span className="flex items-center gap-2"><Users className="h-4 w-4" />{s.hospedes}</span>
      {value.bags && <span className="flex items-center gap-2"><Luggage className="h-4 w-4" />{value.bags}</span>}
      {value.travelClass && <span className="rounded-full border border-card px-3 py-1 text-xs font-bold">CLASSE: {value.travelClass.toUpperCase()}</span>}
    </div>
  </section>;
}