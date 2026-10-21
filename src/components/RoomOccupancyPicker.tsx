import { useId, useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { ChevronDown, Users, X } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useIsMobile } from "@/hooks/use-mobile";
import type { RoomOccupancy } from "@/lib/room-occupancy";
import { allChildAges, countAdults } from "@/lib/room-occupancy";
import "@/room-occupancy.css";

/** One occupancy editor, shown in a modal on phones and a popover on desktop. */
export function RoomOccupancyPicker({
  value,
  onChange,
  summary,
}: {
  value: RoomOccupancy[];
  onChange: (next: RoomOccupancy[]) => void;
  summary: string;
}) {
  const [open, setOpen] = useState(false);
  const mobile = useIsMobile();
  const titleId = useId();
  const descriptionId = useId();
  const adults = countAdults(value);
  const children = allChildAges(value).length;
  const setRoom = (index: number, room: RoomOccupancy) =>
    onChange(value.map((v, i) => (i === index ? room : v)));

  const counter = (
    label: string,
    count: number,
    decrease: () => void,
    increase: () => void,
    canDecrease: boolean,
    canIncrease: boolean,
    context: string,
  ) => (
    <div className="room-occupancy-counter">
      <span>{label}</span>
      <div className="room-occupancy-stepper">
        <button
          type="button"
          aria-label={`Diminuir ${label.toLowerCase()} ${context}`}
          disabled={!canDecrease}
          onClick={decrease}
        >
          −
        </button>
        <span aria-live="polite">{count}</span>
        <button
          type="button"
          className="room-occupancy-increase"
          aria-label={`Aumentar ${label.toLowerCase()} ${context}`}
          disabled={!canIncrease}
          onClick={increase}
        >
          +
        </button>
      </div>
    </div>
  );

  const trigger = (
    <button
      type="button"
      className="room-occupancy-trigger"
      aria-label={`Quartos e hóspedes: ${summary}`}
    >
      <span className="room-occupancy-label">Quartos e hóspedes</span>
      <span className="room-occupancy-value">
        <Users aria-hidden="true" />
        <span>{summary}</span>
        <ChevronDown aria-hidden="true" />
      </span>
    </button>
  );

  const content = (
    <>
      <header className="room-occupancy-header">
        <div>
          {mobile ? (
            <Dialog.Title id={titleId}>Quartos e hóspedes</Dialog.Title>
          ) : (
            <h2 id={titleId}>Quartos e hóspedes</h2>
          )}
          {mobile ? (
            <Dialog.Description id={descriptionId}>
              Defina quem fica em cada quarto
            </Dialog.Description>
          ) : (
            <p id={descriptionId}>Defina quem fica em cada quarto</p>
          )}
        </div>
        <button type="button" aria-label="Fechar quartos e hóspedes" onClick={() => setOpen(false)}>
          <X aria-hidden="true" />
        </button>
      </header>
      <div className="room-occupancy-scroll">
        {value.map((room, i) => (
          <section key={i} className="room-occupancy-room" aria-label={`Quarto ${i + 1}`}>
            <div className="room-occupancy-room-heading">
              <h3>Quarto {i + 1}</h3>
              {value.length > 1 && (
                <button
                  type="button"
                  aria-label={`Remover quarto ${i + 1}`}
                  onClick={() => onChange(value.filter((_, j) => j !== i))}
                >
                  Remover
                </button>
              )}
            </div>
            {counter(
              "Adultos",
              room.adults,
              () => setRoom(i, { ...room, adults: room.adults - 1 }),
              () => setRoom(i, { ...room, adults: room.adults + 1 }),
              room.adults > 1,
              adults < 9 && room.adults < 9,
              `do quarto ${i + 1}`,
            )}
            {counter(
              "Crianças",
              room.childAges.length,
              () => setRoom(i, { ...room, childAges: room.childAges.slice(0, -1) }),
              () => setRoom(i, { ...room, childAges: [...room.childAges, 7] }),
              room.childAges.length > 0,
              children < 4 && room.childAges.length < 4,
              `do quarto ${i + 1}`,
            )}
            {room.childAges.map((age, j) => (
              <div key={j}>
                {counter(
                  `Idade criança ${j + 1}`,
                  age,
                  () =>
                    setRoom(i, {
                      ...room,
                      childAges: room.childAges.map((a, k) => (j === k ? a - 1 : a)),
                    }),
                  () =>
                    setRoom(i, {
                      ...room,
                      childAges: room.childAges.map((a, k) => (j === k ? a + 1 : a)),
                    }),
                  age > 0,
                  age < 17,
                  `do quarto ${i + 1}`,
                )}
              </div>
            ))}
          </section>
        ))}
        <button
          type="button"
          disabled={value.length >= 9 || adults >= 9}
          onClick={() => onChange([...value, { adults: adults <= 7 ? 2 : 1, childAges: [] }])}
          className="room-occupancy-add"
        >
          + Adicionar outro quarto
        </button>
        <p className="room-occupancy-help">
          Até 9 adultos, 4 crianças e 9 quartos por busca. A disponibilidade é calculada para a
          ocupação de cada quarto.
        </p>
      </div>
      <footer className="room-occupancy-footer">
        <button type="button" onClick={() => setOpen(false)}>
          Pronto
        </button>
      </footer>
    </>
  );

  return (
    <div className="room-occupancy-field">
      {mobile ? (
        <Dialog.Root open={open} onOpenChange={setOpen}>
          <Dialog.Trigger asChild>{trigger}</Dialog.Trigger>
          <Dialog.Portal>
            <Dialog.Overlay className="room-occupancy-overlay" />
            <Dialog.Content
              className="room-occupancy-panel room-occupancy-mobile"
              aria-labelledby={titleId}
              aria-describedby={descriptionId}
            >
              {content}
            </Dialog.Content>
          </Dialog.Portal>
        </Dialog.Root>
      ) : (
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>{trigger}</PopoverTrigger>
          <PopoverContent
            align="end"
            collisionPadding={12}
            className="room-occupancy-panel room-occupancy-desktop"
            aria-labelledby={titleId}
            aria-describedby={descriptionId}
          >
            {content}
          </PopoverContent>
        </Popover>
      )}
    </div>
  );
}
