import { useEffect, useMemo, useState } from "react";
import type { DateRange } from "react-day-picker";
import { ptBR } from "react-day-picker/locale";
import { CalendarDays, X } from "lucide-react";
import { Calendar } from "@/components/ui/calendar";
import { Button } from "@/components/ui/button";

type Props = {
  open: boolean;
  from: Date;
  to: Date;
  onClose: () => void;
  onConfirm: (range: { from: Date; to: Date }) => void;
};

const monthShort = (date: Date) => date.toLocaleDateString("pt-BR", { month: "short" }).replace(".", "");

function selectionLabel(range?: DateRange) {
  if (!range?.from || !range.to) return "Selecione ida e volta";
  const sameMonth = range.from.getMonth() === range.to.getMonth() && range.from.getFullYear() === range.to.getFullYear();
  if (sameMonth) return `Selecionar ${range.from.getDate()} - ${range.to.getDate()} ${monthShort(range.to)}.`;
  return `Selecionar ${range.from.getDate()} ${monthShort(range.from)}. - ${range.to.getDate()} ${monthShort(range.to)}.`;
}

export function MobileDateRangeSheet({ open, from, to, onClose, onConfirm }: Props) {
  const [draft, setDraft] = useState<DateRange>({ from, to });
  const today = useMemo(() => {
    const date = new Date();
    date.setHours(0, 0, 0, 0);
    return date;
  }, []);

  useEffect(() => {
    if (!open) return;
    setDraft({ from, to });
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = previous; };
  }, [open, from, to]);

  if (!open) return null;

  const ready = !!draft.from && !!draft.to;

  return (
    <div className="mobile-date-sheet fixed inset-0 z-[100] flex items-end bg-black/65 lg:hidden" role="dialog" aria-modal="true" aria-label="Selecionar datas da viagem">
      <div className="flex h-[92dvh] w-full flex-col overflow-hidden rounded-t-[28px] bg-background shadow-2xl">
        <div className="shrink-0 border-b border-border bg-background px-4 pb-3 pt-2">
          <div className="mx-auto mb-2 h-1.5 w-16 rounded-full bg-muted-foreground/35" />
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <CalendarDays className="h-5 w-5 text-primary" />
              <div>
                <h2 className="text-base font-bold text-foreground">Ida e volta</h2>
                <p className="text-xs text-muted-foreground">Toque no dia da ida e depois no dia da volta.</p>
              </div>
            </div>
            <button type="button" onClick={onClose} aria-label="Fechar calendário" className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-secondary text-foreground">
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 pb-28 pt-3">
          <Calendar
            mode="range"
            locale={ptBR}
            defaultMonth={from}
            numberOfMonths={12}
            hideNavigation
            showOutsideDays={false}
            disabled={{ before: today }}
            selected={draft}
            onSelect={(range) => setDraft(range ?? { from: undefined, to: undefined })}
            className="w-full bg-transparent p-0 [--cell-size:2.6rem]"
            classNames={{
              root: "w-full",
              months: "flex w-full flex-col gap-7",
              month: "flex w-full flex-col gap-2",
              month_caption: "flex h-10 w-full items-center justify-start px-2",
              caption_label: "text-lg font-bold capitalize text-foreground",
              weekdays: "flex w-full rounded-xl bg-secondary/70 px-1 py-2",
              weekday: "flex-1 text-center text-[11px] font-semibold text-muted-foreground",
              week: "mt-1 flex w-full",
              day: "relative aspect-square flex-1 p-0 text-center",
            }}
          />
        </div>

        <div className="absolute inset-x-0 bottom-0 border-t border-border bg-background/98 p-4 pb-[max(1rem,env(safe-area-inset-bottom))] backdrop-blur">
          <Button
            type="button"
            disabled={!ready}
            onClick={() => {
              if (!draft.from || !draft.to) return;
              onConfirm({ from: draft.from, to: draft.to });
            }}
            className="h-14 w-full rounded-2xl text-base font-bold shadow-lg"
          >
            {selectionLabel(draft)}
          </Button>
        </div>
      </div>
    </div>
  );
}
