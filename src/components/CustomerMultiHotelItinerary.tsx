import { CalendarDays, MapPin, Moon, Coffee, BedDouble, ArrowRight, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { HotelPhoto } from "@/components/HotelGallery";
import { CustomerPackagePrice } from "@/components/CustomerPackagePrice";
import { hasBreakfast, nightsBetween, type Hotel } from "@/lib/hotels";
import type { MultiHotelStay } from "@/lib/multi-hotel";

const date = (iso: string) =>
  new Date(iso + "T12:00").toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });

export function CustomerMultiHotelItinerary({
  stays,
  total,
  travelers,
  guestSummary,
  transportMode,
  confirmed,
  onGallery,
  onPayment,
}: {
  stays: MultiHotelStay[];
  total: number;
  travelers: number | null;
  guestSummary: string;
  transportMode: "none" | "air" | "bus";
  confirmed: boolean;
  onGallery: (hotel: Hotel, stay: MultiHotelStay) => void;
  onPayment: () => void;
}) {
  return (
    <section className="mt-6 sm:mt-8" aria-label="Roteiro de hospedagens">
      <div className="rounded-3xl border border-primary/15 bg-gradient-to-br from-primary/[0.07] via-card to-card p-4 shadow-sm sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <span className="text-xs font-bold uppercase tracking-[0.18em] text-primary">Seu roteiro de hospedagem</span>
            <h2 className="mt-1 text-2xl font-extrabold text-navy sm:text-3xl">
              {stays.length} hotéis na mesma viagem
            </h2>
            <p className="mt-1 max-w-2xl text-sm leading-relaxed text-muted-foreground">
              Cada hospedagem corresponde a uma parte da viagem. Todos os hotéis abaixo já fazem parte da mesma proposta.
            </p>
          </div>
          {confirmed && (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1.5 text-xs font-bold text-emerald-700">
              <CheckCircle2 className="h-4 w-4" /> Proposta confirmada
            </span>
          )}
        </div>
      </div>

      <div className="relative mt-5 space-y-5 sm:mt-6">
        <div className="absolute bottom-6 left-[22px] top-6 hidden w-px bg-primary/20 sm:block" aria-hidden="true" />
        {stays.map((stay, index) => {
          const h = stay.hotel;
          if (!h) return null;
          const nights = nightsBetween(stay.checkin, stay.checkout);
          const [room, meal] = (h.room ?? "").split(" · ");

          return (
            <article key={index} className="relative overflow-hidden rounded-3xl border border-border bg-card shadow-sm">
              <div className="flex items-center gap-3 border-b border-border bg-primary/[0.06] px-4 py-3 sm:px-5">
                <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-primary text-sm font-black text-primary-foreground shadow-sm">
                  {index + 1}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-primary">Hotel {index + 1}</p>
                  <h3 className="truncate text-lg font-extrabold text-navy sm:text-xl">{h.name}</h3>
                </div>
                <div className="hidden shrink-0 rounded-xl border border-primary/15 bg-card px-3 py-2 text-right sm:block">
                  <span className="block text-[10px] uppercase tracking-wide text-muted-foreground">Período</span>
                  <strong className="text-sm text-navy">{date(stay.checkin)} → {date(stay.checkout)}</strong>
                </div>
              </div>

              <div className="grid gap-4 p-3 sm:grid-cols-[260px_minmax(0,1fr)] sm:p-5">
                <button
                  type="button"
                  onClick={() => onGallery(h, stay)}
                  className="group relative h-52 w-full overflow-hidden rounded-2xl bg-secondary text-left sm:h-56 [&_img]:!h-full [&_img]:!w-full [&_img]:!object-cover"
                >
                  <HotelPhoto hotel={h} />
                  <span className="absolute bottom-2 right-2 rounded-lg bg-slate-950/70 px-2.5 py-1 text-[11px] font-semibold text-white backdrop-blur">
                    Ver fotos
                  </span>
                </button>

                <div className="min-w-0">
                  <div className="rounded-xl bg-primary/[0.05] p-3 sm:hidden">
                    <span className="text-[10px] font-bold uppercase tracking-wide text-primary">Período desta hospedagem</span>
                    <p className="mt-1 flex items-center gap-1.5 text-sm font-bold text-navy">
                      <CalendarDays className="h-4 w-4" />
                      {date(stay.checkin)} a {date(stay.checkout)}
                    </p>
                  </div>

                  <div className="mt-3 space-y-2 text-sm sm:mt-0">
                    <p className="flex items-start gap-2 text-muted-foreground">
                      <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                      <span>{h.address}</span>
                    </p>
                    <p className="flex items-center gap-2">
                      <Moon className="h-4 w-4 text-primary" />
                      <strong>{nights} {nights === 1 ? "noite" : "noites"}</strong> neste hotel
                    </p>
                    {room && (
                      <p className="flex items-center gap-2 text-muted-foreground">
                        <BedDouble className="h-4 w-4 text-primary" />
                        {room}
                      </p>
                    )}
                    {meal && hasBreakfast(meal) && (
                      <p className="flex items-center gap-2 text-muted-foreground">
                        <Coffee className="h-4 w-4 text-primary" />
                        {meal}
                      </p>
                    )}
                  </div>

                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => onGallery(h, stay)}
                    className="mt-4 rounded-xl border-primary/30 text-primary"
                  >
                    Ver fotos e detalhes
                  </Button>
                </div>
              </div>
            </article>
          );
        })}
      </div>

      <section className="mt-7 overflow-hidden rounded-3xl border-2 border-primary/20 bg-card shadow-md">
        <div className="bg-navy px-4 py-4 text-white sm:px-6">
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-turquoise">Resumo da sua proposta</p>
          <h3 className="mt-1 text-xl font-extrabold sm:text-2xl">Valor total da viagem</h3>
          <p className="mt-1 text-xs text-white/70">
            Inclui {stays.length} hospedagens
            {transportMode === "air" ? " + passagem aérea" : transportMode === "bus" ? " + transporte rodoviário" : ""}
            .
          </p>
        </div>

        <div className="p-4 sm:p-6">
          <CustomerPackagePrice
            total={total}
            travelers={travelers}
            subtitle={`Pacote completo · ${guestSummary}`}
          />

          <div className="mt-4 rounded-2xl bg-primary/[0.05] p-3 text-xs leading-relaxed text-muted-foreground">
            As hospedagens acima fazem parte de <strong className="text-foreground">uma única proposta</strong>. O valor não é cobrado por hotel separadamente.
          </div>

          <Button
            type="button"
            onClick={onPayment}
            className="mt-4 h-12 w-full rounded-xl text-sm font-bold sm:w-auto sm:min-w-56"
          >
            Ver formas de pagamento <ArrowRight className="h-4 w-4" />
          </Button>
        </div>
      </section>
    </section>
  );
}
