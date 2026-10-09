import { ArrowRight, Check, Loader2, Plane } from "lucide-react";
import { brl, type Flight } from "@/lib/hotels";
import { Button } from "@/components/ui/button";

type Leg = { list: Flight[]; loading: boolean; error?: string | undefined };

export function FlightPicker({ title, leg, selected, onSelect }: { title: string; leg: Leg; selected?: string | undefined; onSelect: (f: Flight) => void }) {
  return <section className="min-w-0 border-t border-border pt-4">
    <h2 className="mb-3 flex items-center gap-2 font-semibold"><Plane className="h-4 w-4" />{title} {leg.list.length > 0 && <span className="text-sm font-normal text-muted-foreground">({leg.list.length})</span>}</h2>
    {leg.loading && <p className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" />Buscando voos… até 1 minuto.</p>}
    {leg.error && <p role="alert" className="text-sm text-destructive">{leg.error}</p>}
    {!leg.loading && !leg.error && !leg.list.length && <p className="text-sm text-muted-foreground">Os voos aparecem depois da busca.</p>}
    <div className="max-h-[560px] space-y-3 overflow-y-auto overscroll-contain p-1">
      {leg.list.map(f => {
        const on = f.id === selected;
        return <Button variant="outline" key={f.id} type="button" aria-pressed={on} onClick={() => onSelect(f)} className={`h-auto w-full min-w-0 flex-col items-stretch justify-start gap-3 whitespace-normal rounded-lg bg-card p-3 text-left text-sm ${on ? "border-primary bg-primary/5 ring-2 ring-primary/30" : "border-border"}`}>
          <div className="break-words font-semibold">{f.airline} · {f.flightNumber}</div>
          <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-2">
            <div><div className="text-xl font-bold tabular-nums">{f.departure}</div><div className="mt-1 text-sm font-semibold">{f.from}</div></div>
            <ArrowRight className="text-muted-foreground" aria-hidden="true" />
            <div className="text-right"><div className="text-xl font-bold tabular-nums">{f.arrival}</div><div className="mt-1 text-sm font-semibold">{f.to}</div></div>
          </div>
          <div className="space-y-1 break-words text-xs font-normal leading-relaxed text-muted-foreground"><div>{f.duration} · {f.stops}</div><div>{f.travelClass} · {f.bags}</div></div>
          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border pt-3"><span className="text-lg font-bold tabular-nums">{brl(f.price)}</span><span className={`flex items-center gap-1 text-xs font-semibold ${on ? "text-primary" : "text-muted-foreground"}`}>{on && <Check aria-hidden="true" />}{on ? "Selecionado" : "Selecionar"}</span></div>
        </Button>;
      })}
    </div>
  </section>;
}
