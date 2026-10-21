import type { RoomOccupancy } from "@/lib/room-occupancy";
import { allChildAges, countAdults } from "@/lib/room-occupancy";

/** Shared interactive room selector for desktop and mobile. Each room has
 * its own adults/children/ages and updates the search atomically. */
export function RoomOccupancyPicker({
  value, onChange,
}: {
  value: RoomOccupancy[];
  onChange: (next: RoomOccupancy[]) => void;
}) {
  const adults = countAdults(value);
  const children = allChildAges(value).length;
  const setRoom = (index: number, room: RoomOccupancy) =>
    onChange(value.map((v, i) => i === index ? room : v));
  const button = "grid h-9 w-9 shrink-0 place-items-center rounded-full border border-border bg-background text-xl font-bold text-primary disabled:opacity-30";
  const addButton = "grid h-9 w-9 shrink-0 place-items-center rounded-full bg-primary text-xl font-bold text-primary-foreground disabled:opacity-30";
  const counter = (
    label: string, count: number, decrease: () => void, increase: () => void,
    canDecrease: boolean, canIncrease: boolean, context: string,
  ) => (
    <div className="flex items-center justify-between gap-3 py-1.5">
      <span className="text-sm text-foreground">{label}</span>
      <div className="flex items-center gap-2">
        <button type="button" className={button} aria-label={`Diminuir ${label.toLowerCase()} ${context}`} disabled={!canDecrease} onClick={decrease}>−</button>
        <span className="w-6 text-center font-semibold tabular-nums">{count}</span>
        <button type="button" className={addButton} aria-label={`Aumentar ${label.toLowerCase()} ${context}`} disabled={!canIncrease} onClick={increase}>+</button>
      </div>
    </div>
  );
  return (
    <div className="absolute left-0 right-0 z-40 mt-2 max-h-[min(70vh,570px)] space-y-3 overflow-y-auto rounded-2xl border border-border bg-card p-3 shadow-xl md:left-auto md:right-0 md:w-[340px] md:max-w-[90vw]" onClick={e => e.stopPropagation()}>
      <div className="flex items-center justify-between gap-2 border-b border-border pb-2">
        <div><div className="text-sm font-bold">Quartos e hóspedes</div><p className="text-xs text-muted-foreground">Defina quem fica em cada quarto</p></div>
        <span className="text-xs text-muted-foreground">{value.length} {value.length === 1 ? "quarto" : "quartos"}</span>
      </div>
      {value.map((room, i) => (
        <div key={i} className="rounded-xl border border-border bg-background/60 px-3 py-2">
          <div className="mb-1 flex items-center justify-between">
            <h3 className="text-sm font-bold">Quarto {i + 1}</h3>
            {value.length > 1 && <button type="button" className="text-xs font-semibold text-destructive" onClick={() => onChange(value.filter((_, j) => j !== i))}>Remover</button>}
          </div>
          {counter("Adultos", room.adults,
            () => setRoom(i, { ...room, adults: room.adults - 1 }),
            () => setRoom(i, { ...room, adults: room.adults + 1 }),
            room.adults > 1, adults < 9 && room.adults < 9, `do quarto ${i + 1}`)}
          {counter("Crianças", room.childAges.length,
            () => setRoom(i, { ...room, childAges: room.childAges.slice(0, -1) }),
            () => setRoom(i, { ...room, childAges: [...room.childAges, 7] }),
            room.childAges.length > 0, children < 4 && room.childAges.length < 4, `do quarto ${i + 1}`)}
          {room.childAges.map((age, j) => (
            <div key={j}>
              {counter(`Idade criança ${j + 1}`, age,
                () => setRoom(i, { ...room, childAges: room.childAges.map((a, k) => j === k ? a - 1 : a) }),
                () => setRoom(i, { ...room, childAges: room.childAges.map((a, k) => j === k ? a + 1 : a) }),
                age > 0, age < 17, `do quarto ${i + 1}`)}
            </div>
          ))}
        </div>
      ))}
      <button type="button" disabled={value.length >= 9 || adults >= 9}
        onClick={() => onChange([...value, { adults: adults <= 7 ? 2 : 1, childAges: [] }])}
        className="w-full rounded-xl border border-primary px-3 py-2.5 text-sm font-semibold text-primary disabled:opacity-30">
        + Adicionar outro quarto
      </button>
      <p className="text-[11px] leading-relaxed text-muted-foreground">Até 9 adultos, 4 crianças e 9 quartos por busca. A disponibilidade é calculada para a ocupação de cada quarto.</p>
      <button type="button" onClick={e => e.currentTarget.closest("details")?.removeAttribute("open")} className="h-10 w-full rounded-xl bg-primary font-bold text-primary-foreground">Pronto</button>
    </div>
  );
}
