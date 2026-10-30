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
  const airlineKey = `${f.airline ?? ""} ${f.flightNumber ?? ""}`;
  const logo = /latam|\bLA\s*\d|\bJJ\s*\d/i.test(airlineKey) ? latam.url : /gol|\bG3\s*\d/i.test(airlineKey) ? gol.url : /azul|\bAD\s*[- ]?\d/i.test(airlineKey) ? azul.url : undefined;
  const baggage = [
    { name: "Item pessoal", Icon: Backpack, included: f.baggage?.personal },
    { name: "Bagagem de mão", Icon: BriefcaseBusiness, included: f.baggage?.carryOn },
    { name: "Bagagem despachada", Icon: Luggage, included: f.baggage?.checked },
  ];
  return <article aria-label={`${f.airline} ${f.flightNumber}`} className={`@container min-w-0 rounded-2xl border bg-card p-5 transition shadow-sm ${selected ? "border-primary ring-2 ring-primary/20 bg-primary/5" : "border-border hover:border-primary/50"}`}>
    <div className="grid min-w-0 grid-cols-1 gap-4 @min-[600px]:grid-cols-[100px_minmax(0,1fr)_200px] @min-[600px]:gap-6 items-center">
      <div className="flex min-w-0 items-center gap-3 @min-[600px]:justify-center">
        {logo && !logoFailed ? <img src={logo} alt={f.airline} onError={() => setLogoFailed(true)} className="h-10 w-24 shrink-0 object-contain" /> : <span className="break-words text-sm font-semibold">{f.airline}</span>}
        <span className="text-xs text-muted-foreground @min-[600px]:hidden">{f.airline}</span>
      </div>
      <div className="min-w-0">
        <div className="mb-3 break-words text-xs font-semibold uppercase tracking-wider text-muted-foreground">{[f.fareCategory || f.travelClass, f.flightNumber].filter(Boolean).join(" · ")}</div>
        <div className="grid grid-cols-[minmax(0,1fr)_minmax(72px,1.2fr)_minmax(0,1fr)] items-center gap-2">
          <div className="min-w-0"><div className="text-sm font-bold tabular-nums text-muted-foreground @min-[600px]:text-base">{dateLabel(f.departureDate)}</div><div className="mt-1 text-lg font-black tabular-nums @min-[600px]:text-2xl">{f.departure || "—"}</div><div className="mt-1 text-sm font-bold text-foreground">{f.from}</div></div>
          <div className="min-w-0 text-center text-xs text-muted-foreground"><div className="flex items-center gap-1.5"><span className="h-px flex-1 bg-border" /><span className="flex shrink-0 items-center gap-1 font-semibold"><Clock3 className="h-3 w-3" />{f.duration || "—"}</span><span className="h-px flex-1 bg-border" /></div><div className="mt-2 break-words leading-relaxed font-semibold text-foreground">{f.connections?.length ? `Conexão: ${f.connections.join(" / ")}` : f.stops}</div></div>
          <div className="min-w-0 text-right"><div className="text-sm font-bold tabular-nums text-muted-foreground @min-[600px]:text-base">{dateLabel(f.arrivalDate)}</div><div className="mt-1 text-lg font-black tabular-nums @min-[600px]:text-2xl">{f.arrival || "—"}</div><div className="mt-1 text-sm font-bold text-foreground">{f.to}</div></div>
        </div>
        <div className="mt-3 flex gap-1"><Button variant="ghost" size="icon" aria-label="Detalhes do voo" title="Detalhes do voo" onClick={() => setDialog("details")}><Info className="h-4 w-4 text-muted-foreground" /></Button><Button variant="ghost" size="icon" aria-label="Regras da tarifa" title="Regras da tarifa" onClick={() => setDialog("rules")}><CreditCard className="h-4 w-4 text-muted-foreground" /></Button></div>
      </div>
      <div className="min-w-0 border-t border-border pt-4 @min-[600px]:border-l @min-[600px]:border-t-0 @min-[600px]:pl-6 @min-[600px]:pt-0 flex flex-col justify-between">
        <div>
          <div className={`font-black @min-[600px]:text-right text-primary ${f.savedPriceUnavailable ? "text-sm leading-snug" : "text-2xl tabular-nums"}`}>{f.savedPriceUnavailable ? "Valor incluído no total das passagens" : brl(f.price)}</div>
          {!f.savedPriceUnavailable && <div className="mt-0.5 text-xs text-muted-foreground @min-[600px]:text-right">{f.installments ? `Até ${f.installments.count}x${f.installments.interestFree === true ? " s/ juros" : ""}` : "até 4x s/ juros"}</div>}
          {f.savedPriceUnavailable ? null : f.commission != null ? (
            <div className="mt-3 rounded-xl bg-success/15 px-3 py-2 text-center text-xs font-bold text-success">
              Comissão: {brl(f.commission)}
            </div>
          ) : (
            <div className="mt-3 rounded-xl bg-success/15 px-3 py-2 text-center text-xs font-bold text-success">
              Comissão: {brl(Math.round(f.price * 0.05 * 100) / 100)}
            </div>
          )}
          <div className="mt-3 flex justify-end gap-2 text-muted-foreground">{baggage.map(({ name, Icon, included }) => <span key={name} role="img" aria-label={`${name}: ${included === true ? "incluída" : included === false ? "não incluída" : "não informada"}`} title={`${name}: ${included === true ? "incluída" : included === false ? "não incluída" : "não informada"}`} className={`relative inline-flex h-7 w-6 items-center justify-center ${included === false ? "text-muted-foreground/40" : "text-foreground"}`}><Icon className="h-5 w-5" />{included === false ? <X className="absolute -right-1 -top-1 h-3.5 w-3.5 text-destructive" /> : included === true ? <Check className="absolute -right-1 -top-1 h-3 w-3 text-success" /> : <HelpCircle className="absolute -right-1 -top-1 h-3 w-3" />}</span>)}</div>
        </div>
        <Button variant={selected ? "default" : "outline"} size="sm" aria-pressed={selected} onClick={onSelect} className="mt-4 w-full rounded-xl font-bold">
          {selected && <Check className="mr-1 h-4 w-4" />}
          {selected ? "Voo selecionado" : "Selecionar voo"}
        </Button>
      </div>
    </div>
    <Dialog open={dialog !== null} onOpenChange={open => { if (!open) setDialog(null); }}><DialogContent className="max-h-[85vh] overflow-auto"><DialogTitle>{dialog === "rules" ? "Regras da tarifa" : "Detalhes do voo"}</DialogTitle><DialogDescription>{f.airline} · {f.flightNumber}</DialogDescription>{dialog === "rules" ? <p className="whitespace-pre-line text-sm">{f.fareRules || "As regras de alteração, cancelamento e reembolso não foram disponibilizadas pela companhia nesta busca."}</p> : <div className="space-y-3 text-sm"><p>{dateLabel(f.departureDate)} · {f.departure} {f.from} → {dateLabel(f.arrivalDate)} · {f.arrival} {f.to}</p><p>{f.duration} · {f.stops}{f.connections?.length ? ` · ${f.connections.join(" / ")}` : ""}</p><p>{f.fareCategory || f.travelClass}</p>{baggage.map(b => <p key={b.name}>{b.name}: {b.included === true ? "Incluída" : b.included === false ? "Não incluída" : "Não informada pela companhia"}</p>)}<p>{f.bags}</p><p className="font-bold">{f.savedPriceUnavailable ? "Valor do trecho não armazenado na proposta antiga. Confira o total das passagens no resumo." : brl(f.price)}</p></div>}</DialogContent></Dialog>
  </article>;
}