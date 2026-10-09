import { useState } from "react";
import { Backpack, Check, Clock3, CreditCard, Info, Luggage, BriefcaseBusiness, X, HelpCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { brl, type Flight } from "@/lib/hotels";
import latam from "@/assets/latam-logo.png.asset.json";
import gol from "@/assets/gol-logo.png.asset.json";
import azul from "@/assets/azul-logo.png.asset.json";

const dateLabel = (date?: string) => date && /^\d{4}-\d{2}-\d{2}/.test(date) ? date.slice(0, 10).split("-").reverse().map((v, i) => i === 2 ? v.slice(-2) : v).join("/") : "Data não informada";

export function FlightCard({ flight: f, selected, onSelect }: { flight: Flight; selected: boolean; onSelect: () => void }) {
  const [dialog, setDialog] = useState<"details" | "rules" | null>(null);
  const [logoFailed, setLogoFailed] = useState(false);
  const logo = /latam/i.test(f.airline) ? latam.url : /gol/i.test(f.airline) ? gol.url : /azul/i.test(f.airline) ? azul.url : undefined;
  const baggage = [
    { name: "Item pessoal", Icon: Backpack, included: f.baggage?.personal },
    { name: "Bagagem de mão", Icon: BriefcaseBusiness, included: f.baggage?.carryOn },
    { name: "Bagagem despachada", Icon: Luggage, included: f.baggage?.checked },
  ];
  return <article aria-label={`${f.airline} ${f.flightNumber}`} className={`@container min-w-0 rounded-lg border bg-card p-4 transition ${selected ? "border-primary ring-2 ring-primary/20" : "border-border"}`}>
    <div className="grid min-w-0 grid-cols-1 gap-4 @min-[600px]:grid-cols-[80px_minmax(0,1fr)_180px] @min-[600px]:gap-5">
      <div className="flex min-w-0 items-center gap-3 @min-[600px]:justify-center">
        {logo && !logoFailed ? <img src={logo} alt={f.airline} onError={() => setLogoFailed(true)} className="h-10 w-20 shrink-0 object-contain" /> : <span className="break-words text-sm font-semibold">{f.airline}</span>}
        <span className="text-xs text-muted-foreground @min-[600px]:hidden">{f.airline}</span>
      </div>
      <div className="min-w-0">
        <div className="mb-4 break-words text-xs font-semibold leading-relaxed text-muted-foreground">{f.fareCategory || f.travelClass || "Tarifa não informada"} <span className="px-1">·</span> {f.flightNumber}</div>
        <div className="grid grid-cols-[minmax(0,1fr)_minmax(64px,1.2fr)_minmax(0,1fr)] items-center gap-2">
          <div className="min-w-0"><div className="text-base font-bold tabular-nums @min-[600px]:text-lg">{dateLabel(f.departureDate)}</div><div className="mt-1 text-base font-semibold tabular-nums">{f.departure || "—"}</div><div className="mt-1 text-sm font-semibold">{f.from}</div></div>
          <div className="min-w-0 text-center text-xs text-muted-foreground"><div className="flex items-center gap-1.5"><span className="h-px flex-1 bg-border" /><span className="flex shrink-0 items-center gap-1"><Clock3 className="h-3 w-3" />{f.duration || "—"}</span><span className="h-px flex-1 bg-border" /></div><div className="mt-2 break-words leading-relaxed">{f.connections?.length ? `Conexão em: ${f.connections.join(" / ")}` : f.stops}</div></div>
          <div className="min-w-0 text-right"><div className="text-base font-bold tabular-nums @min-[600px]:text-lg">{dateLabel(f.arrivalDate)}</div><div className="mt-1 text-base font-semibold tabular-nums">{f.arrival || "—"}</div><div className="mt-1 text-sm font-semibold">{f.to}</div></div>
        </div>
        <div className="mt-3 flex gap-1"><Button variant="ghost" size="icon" aria-label="Detalhes do voo" title="Detalhes do voo" onClick={() => setDialog("details")}><Info className="text-muted-foreground" /></Button><Button variant="ghost" size="icon" aria-label="Regras da tarifa" title="Regras da tarifa" onClick={() => setDialog("rules")}><CreditCard className="text-muted-foreground" /></Button></div>
      </div>
      <div className="min-w-0 border-t border-border pt-3 @min-[600px]:border-l @min-[600px]:border-t-0 @min-[600px]:pl-4 @min-[600px]:pt-0">
        <div className="text-2xl font-extrabold tabular-nums @min-[600px]:text-right">{brl(f.price)}</div>
        <div className="mt-1 text-xs text-muted-foreground @min-[600px]:text-right">{f.installments ? `Até ${f.installments.count}x${f.installments.interestFree === true ? " sem juros" : ""}` : "Parcelamento não informado"}</div>
        {f.commission != null ? <div className="mt-3 rounded-md bg-success px-2 py-1.5 text-center text-xs font-semibold text-success-foreground">Comissão: {brl(f.commission)}</div> : <div className="mt-3 text-xs text-muted-foreground @min-[600px]:text-right">Comissão não informada</div>}
        <div className="mt-3 flex justify-end gap-3">{baggage.map(({ name, Icon, included }) => <span key={name} role="img" aria-label={`${name}: ${included === true ? "incluída" : included === false ? "não incluída" : "não informada"}`} title={`${name}: ${included === true ? "incluída" : included === false ? "não incluída" : "não informada"}`} className={`relative inline-flex h-7 w-6 items-center justify-center ${included === false ? "text-muted-foreground/50" : "text-muted-foreground"}`}><Icon className="h-6 w-6" />{included === false ? <X className="absolute -right-1 -top-1 h-3.5 w-3.5 text-destructive" /> : included === true ? <Check className="absolute -right-1 -top-1 h-3 w-3 text-success-foreground" /> : <HelpCircle className="absolute -right-1 -top-1 h-3 w-3" />}</span>)}</div>
        <Button variant={selected ? "default" : "outline"} size="sm" aria-pressed={selected} onClick={onSelect} className="mt-3 w-full">{selected && <Check />}{selected ? "Selecionado" : "Selecionar"}</Button>
      </div>
    </div>
    <Dialog open={dialog !== null} onOpenChange={open => { if (!open) setDialog(null); }}><DialogContent className="max-h-[85vh] overflow-auto"><DialogTitle>{dialog === "rules" ? "Regras da tarifa" : "Detalhes do voo"}</DialogTitle><DialogDescription>{f.airline} · {f.flightNumber}</DialogDescription>{dialog === "rules" ? <p className="whitespace-pre-line text-sm">{f.fareRules || "As regras de alteração, cancelamento e reembolso não foram disponibilizadas pela companhia nesta busca."}</p> : <div className="space-y-3 text-sm"><p>{dateLabel(f.departureDate)} · {f.departure} {f.from} → {dateLabel(f.arrivalDate)} · {f.arrival} {f.to}</p><p>{f.duration} · {f.stops}{f.connections?.length ? ` · ${f.connections.join(" / ")}` : ""}</p><p>{f.fareCategory || f.travelClass}</p>{baggage.map(b => <p key={b.name}>{b.name}: {b.included === true ? "Incluída" : b.included === false ? "Não incluída" : "Não informada pela companhia"}</p>)}<p>{f.bags}</p><p className="font-bold">{brl(f.price)}</p></div>}</DialogContent></Dialog>
  </article>;
}