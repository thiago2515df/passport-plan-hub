import { CalendarDays, Check, ArrowRight, MapPin, Moon, Coffee } from "lucide-react";
import { Button } from "@/components/ui/button";
import { HotelPhoto } from "@/components/HotelGallery";
import { CustomerPackagePrice } from "@/components/CustomerPackagePrice";
import { hasBreakfast, nightsBetween, type Hotel } from "@/lib/hotels";
import type { MultiHotelStay } from "@/lib/multi-hotel";

const date = (iso: string) => new Date(iso + "T12:00").toLocaleDateString("pt-BR");

export function CustomerMultiHotelItinerary({
  stays, total, travelers, guestSummary, transportMode, selected, confirmed, confirming,
  onGallery, onPayment, onSelect,
}: {
  stays: MultiHotelStay[];
  total: number;
  travelers: number | null;
  guestSummary: string;
  transportMode: "none" | "air" | "bus";
  selected: boolean;
  confirmed: boolean;
  confirming: boolean;
  onGallery: (hotel: Hotel, stay: MultiHotelStay) => void;
  onPayment: () => void;
  onSelect: () => void;
}) {
  return <section className="mt-6 sm:mt-8" aria-label="Roteiro Multi-hotel">
    <h2 className="text-xl font-extrabold text-navy sm:text-2xl md:text-3xl">Suas hospedagens</h2>
    <p className="mt-1 text-xs text-muted-foreground sm:text-sm">Você ficará em {stays.length} hospedagens durante a mesma viagem. Todas já estão incluídas no valor do pacote abaixo.</p>
    <div className="mt-4 space-y-3">
      {stays.map((stay, index) => {
        const h = stay.hotel;
        if (!h) return null;
        const nights = nightsBetween(stay.checkin, stay.checkout);
        const [room, meal] = (h.room ?? "").split(" · ");
        return <article key={index} className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-2 bg-primary/5 px-4 py-3">
            <strong className="text-sm text-primary">Hospedagem {index + 1} de {stays.length}</strong>
            <span className="flex items-center gap-1 text-xs font-medium"><CalendarDays className="h-3.5 w-3.5" />{date(stay.checkin)} a {date(stay.checkout)} · {nights} {nights === 1 ? "noite" : "noites"}</span>
          </div>
          <div className="grid gap-4 p-3 sm:grid-cols-[200px_minmax(0,1fr)] sm:p-4">
            <button type="button" onClick={() => onGallery(h, stay)} className="h-44 w-full overflow-hidden rounded-xl bg-secondary text-left [&_img]:!h-full [&_img]:!w-full [&_img]:!object-cover">
              <HotelPhoto hotel={h} />
            </button>
            <div className="min-w-0">
              <button type="button" className="text-left text-lg font-bold text-navy hover:underline" onClick={() => onGallery(h, stay)}>{h.name}</button>
              <p className="mt-1 flex items-center gap-1 text-sm text-muted-foreground"><MapPin className="h-4 w-4 shrink-0" />{h.address}</p>
              {room && <p className="mt-2 text-sm text-muted-foreground">{room}</p>}
              {meal && hasBreakfast(meal) && <p className="mt-2 flex items-center gap-1 text-sm text-foreground"><Coffee className="h-4 w-4 text-primary" />{meal}</p>}
              <p className="mt-3 flex items-center gap-1 text-xs text-muted-foreground"><Moon className="h-3.5 w-3.5" />{nights} {nights === 1 ? "noite" : "noites"} incluídas neste hotel</p>
              <button type="button" onClick={() => onGallery(h, stay)} className="mt-2 text-xs font-semibold text-primary hover:underline">Ver todas as fotos</button>
            </div>
          </div>
        </article>;
      })}
    </div>
    <div className={`mt-5 rounded-2xl border-2 bg-card p-4 shadow-sm ${selected ? "border-primary" : "border-border"}`}>
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-base font-extrabold text-navy">Pacote completo Multi-hotel</h3>
        {selected && <span className="flex items-center gap-1 rounded-full bg-primary/10 px-3 py-1 text-xs font-bold text-primary"><Check className="h-3.5 w-3.5" />{confirmed ? "Confirmado" : "Selecionado"}</span>}
      </div>
      <p className="text-xs leading-relaxed text-muted-foreground">{stays.length} hospedagens com todas as noites da viagem{transportMode === "air" ? " e passagem aérea" : transportMode === "bus" ? " e transporte rodoviário" : ""}. Os hotéis não são opções separadas: fazem parte do mesmo roteiro.</p>
      <CustomerPackagePrice total={total} travelers={travelers} subtitle={`Pacote completo · ${guestSummary}`} />
      <div className="mt-4 grid gap-2 sm:grid-cols-2">
        <Button variant="outline" onClick={onPayment} className="h-11 rounded-xl border-primary text-primary">Ver parcelamento <ArrowRight className="h-4 w-4" /></Button>
        <Button disabled={confirmed || confirming} onClick={onSelect} className="h-11 rounded-xl">{selected ? <><Check className="h-4 w-4" />{confirmed ? "Pacote confirmado" : "Roteiro selecionado"}</> : <>Selecionar roteiro completo <ArrowRight className="h-4 w-4" /></>}</Button>
      </div>
    </div>
  </section>;
}
