import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Bus, Plane, Upload, FileText, Trash2, Loader2, ExternalLink } from "lucide-react";
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
  return <section className="min-w-0 space-y-4" aria-label="Passagens de transporte">
    <h2 className="flex items-center gap-2 text-lg font-semibold"><Icon />{value.mode === "bus" ? "Ônibus" : "Aéreo"} · Ida e volta</h2>
    {value.standard && editor && <p className="text-sm text-muted-foreground">Caldas Novas · horários padrão. Empresa ilustrativa, substitua pela operadora real.</p>}
    {(["outbound", "inbound"] as const).map((key) => {
      const leg = value[key]; const outbound = key === "outbound";
      return <article key={key} className="min-w-0 rounded-lg border border-border bg-card p-4">
        <h3 className="font-semibold">{outbound ? "Ida" : "Volta"} · {outbound ? `${origin} → ${destination}` : `${destination} → ${origin}`}</h3>
        <p className="mt-1 text-sm text-muted-foreground">{outbound ? s.checkin : s.checkout}</p>
        {editor ? <div className="mt-3 space-y-3">
          <label className="block text-xs text-muted-foreground">Empresa<input aria-label={`Empresa ${outbound ? "ida" : "volta"}`} value={leg.company} disabled={Boolean(busy)} onChange={e => update(key, { company: e.target.value })} className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground" /></label>
          <div className="grid grid-cols-2 gap-3">{(["departure", "arrival"] as const).map(field => <label key={field} className="text-xs text-muted-foreground">{field === "departure" ? "Saída" : "Chegada"}<input aria-label={`${field === "departure" ? "Saída" : "Chegada"} ${outbound ? "ida" : "volta"}`} type="time" value={leg[field]} disabled={Boolean(busy)} onChange={e => update(key, { [field]: e.target.value })} className="mt-1 w-full min-w-0 rounded-md border border-input bg-background px-2 py-2 text-sm text-foreground" /></label>)}</div>
          <input id={`ticket-${key}`} aria-label={`Enviar passagem de ${outbound ? "ida" : "volta"}`} type="file" accept="application/pdf,image/jpeg,image/png,image/webp" disabled={Boolean(busy)} className="sr-only" onChange={e => { void upload(key, e.target.files?.[0]); e.target.value = ""; }} />
          <Button asChild variant="outline" className={busy ? "pointer-events-none opacity-50" : ""}><label htmlFor={`ticket-${key}`} className="cursor-pointer">{busy === key ? <Loader2 className="animate-spin" /> : <Upload />}{leg.ticket ? "Trocar passagem" : `Passagem de ${outbound ? "ida" : "volta"}`}</label></Button>
          {leg.ticket && <div className="flex min-w-0 items-center gap-2 text-xs text-muted-foreground"><FileText className="h-4 w-4 shrink-0" /><span className="truncate">{leg.ticket.name}</span><Button title="Remover passagem" aria-label={`Remover passagem de ${outbound ? "ida" : "volta"}`} size="icon" variant="ghost" disabled={Boolean(busy)} onClick={() => update(key, { ticket: undefined })}><Trash2 /></Button></div>}
        </div> : <><p className="mt-3 break-words text-sm">{leg.company}</p><p className="mt-2 font-semibold">{leg.departure || "A confirmar"} → {leg.arrival || "A confirmar"}</p>{leg.ticket && <TicketView ticket={leg.ticket} />}</>}
      </article>;
    })}
    {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
  </section>;
}