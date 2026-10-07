import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Bus, Plane, Upload, FileText, Trash2, Loader2, ExternalLink, Users, Luggage } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { viewTicket } from "@/lib/tickets.functions";
import type { Search, Ticket, Transport, TransportLeg } from "@/lib/hotels";

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

const longDate = (d: string) => d ? new Date(d + "T12:00").toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" }) : "";

/** Cartão do itinerário visto pelo cliente (estilo bilhete). */
export function TransportItinerary({ s, value }: { s: Search; value: Transport }) {
  const destination = s.destino.split(",")[0] || "Destino";
  const origin = s.origem || "Brasília";
  const Icon = value.mode === "bus" ? Bus : Plane;
  return <section aria-label="Itinerário" className="overflow-hidden rounded-3xl bg-navy text-card shadow-md">
    <div className="flex items-center gap-2 px-5 pt-4 text-xs font-semibold tracking-[0.2em] opacity-80"><Icon className="h-4 w-4" />{value.mode === "bus" ? "SEU ÔNIBUS" : "SEU VOO"}</div>
    {(["outbound", "inbound"] as const).map((key, i) => {
      const leg = value[key]; const out = key === "outbound";
      const date = longDate(out ? s.checkin : s.checkout);
      const a = out ? origin : destination, b = out ? destination : origin;
      return <div key={key} className={`px-5 py-5 ${i ? "border-t border-dashed border-card/40" : ""}`}>
        <div className="grid grid-cols-[auto_1fr] items-center gap-4 md:grid-cols-[110px_1fr]">
          <div className="text-center">
            <span className="rounded-md bg-card px-3 py-0.5 text-xs font-black text-navy">{out ? "IDA" : "VOLTA"}</span>
            <div className="mt-2 max-w-[110px] break-words text-xs font-bold">{leg.company || "—"}</div>
          </div>
          <div className="grid grid-cols-[1fr_auto_1fr] items-end gap-2">
            <div className="min-w-0"><div className="text-[11px] opacity-80">{date}</div><div className="text-3xl font-black md:text-5xl">{leg.departure || "--:--"}</div><div className="truncate text-xs font-semibold">{a}{leg.from ? ` (${leg.from})` : ""}</div></div>
            <div className="pb-5 text-center text-xs"><div className="font-bold">{leg.duration}</div><div className="my-1 w-16 border-t-2 border-dashed border-card/70 md:w-32" /><div className="opacity-80">{leg.stops || (value.mode === "air" ? "Direto" : "")}</div></div>
            <div className="min-w-0 text-right"><div className="text-[11px] opacity-80">{date}</div><div className="text-3xl font-black md:text-5xl">{leg.arrival || "--:--"}</div><div className="truncate text-xs font-semibold">{b}{leg.to ? ` (${leg.to})` : ""}</div></div>
          </div>
        </div>
        {leg.ticket && <div className="text-foreground [&_button]:bg-card"><TicketView ticket={leg.ticket} /></div>}
      </div>;
    })}
    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-card/20 px-5 py-3 text-sm">
      <span className="flex items-center gap-2"><Users className="h-4 w-4" />{s.hospedes}</span>
      {value.bags && <span className="flex items-center gap-2"><Luggage className="h-4 w-4" />{value.bags}</span>}
      {value.travelClass && <span className="rounded-full border border-card px-3 py-1 text-xs font-bold">CLASSE: {value.travelClass.toUpperCase()}</span>}
    </div>
  </section>;
}