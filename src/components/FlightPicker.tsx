import { Loader2, Plane } from "lucide-react";
import { brl, type Flight } from "@/lib/hotels";

type Leg = { list: Flight[]; loading: boolean; error?: string | undefined };

export function FlightPicker({ title, leg, selected, onSelect }: { title: string; leg: Leg; selected?: string | undefined; onSelect: (f: Flight) => void }) {
  return <section className="rounded-2xl border border-border bg-card p-4">
    <h2 className="mb-3 flex items-center gap-2 font-semibold"><Plane className="h-4 w-4" />{title} {leg.list.length > 0 && <span className="text-sm font-normal text-muted-foreground">({leg.list.length})</span>}</h2>
    {leg.loading && <p className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" />Buscando voos… até 1 minuto.</p>}
    {leg.error && <p role="alert" className="text-sm text-destructive">{leg.error}</p>}
    {!leg.loading && !leg.error && !leg.list.length && <p className="text-sm text-muted-foreground">Os voos aparecem depois da busca.</p>}
    <div className="max-h-80 space-y-2 overflow-y-auto">
      {leg.list.map(f => {
        const on = f.id === selected;
        return <button key={f.id} type="button" onClick={() => onSelect(f)} className={`grid w-full grid-cols-[1fr_auto] gap-2 rounded-xl border p-3 text-left text-sm ${on ? "border-primary ring-2 ring-primary/30" : "border-border"}`}>
          <div className="min-w-0">
            <div className="truncate font-semibold">{f.airline} · {f.flightNumber}</div>
            <div className="text-base font-bold">{f.departure} {f.from} → {f.arrival} {f.to}</div>
            <div className="text-xs text-muted-foreground">{f.duration} · {f.stops} · {f.travelClass} · {f.bags}</div>
          </div>
          <div className="text-right"><div className="font-black">{brl(f.price)}</div><div className="text-[11px] text-muted-foreground">{on ? "Selecionado" : "Selecionar"}</div></div>
        </button>;
      })}
    </div>
  </section>;
}
