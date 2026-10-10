import { Loader2, Plane } from "lucide-react";
import { type Flight } from "@/lib/hotels";
import { FlightCard } from "@/components/FlightCard";

type Leg = { list: Flight[]; loading: boolean; error?: string | undefined };

export function FlightPicker({ title, leg, selected, onSelect }: { title: string; leg: Leg; selected?: string | undefined; onSelect: (f: Flight) => void }) {
  return <section className="min-w-0 border-t border-border pt-4">
    <h2 className="mb-3 flex items-center gap-2 font-semibold"><Plane className="h-4 w-4" />{title} {leg.list.length > 0 && <span className="text-sm font-normal text-muted-foreground">({leg.list.length})</span>}</h2>
    {leg.loading && <p className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" />Buscando voos… até 1 minuto.</p>}
    {leg.error && <p role="alert" className="text-sm text-destructive">{leg.error}</p>}
    {!leg.loading && !leg.error && !leg.list.length && <p className="text-sm text-muted-foreground">Os voos aparecem depois da busca.</p>}
    <div className="max-h-[720px] space-y-3 overflow-y-auto overscroll-contain p-1">
      {leg.list.map(f => <FlightCard key={f.id} flight={f} selected={f.id === selected} onSelect={() => onSelect(f)} />)}
    </div>
  </section>;
}
