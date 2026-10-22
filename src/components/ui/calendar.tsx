"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import { CalendarDays, ChevronDownIcon, ChevronLeftIcon, ChevronRightIcon } from "lucide-react";
import { DayButton, DayPicker, getDefaultClassNames, type DateRange } from "react-day-picker";

import { cn } from "@/lib/utils";
import { Button, buttonVariants } from "@/components/ui/button";

function rangeLabel(range?: DateRange) {
  if (!range?.from || !range.to) return "Selecione a ida e a volta";
  const month = (date: Date) => date.toLocaleDateString("pt-BR", { month: "short" }).replace(".", "");
  const sameMonth = range.from.getMonth() === range.to.getMonth() && range.from.getFullYear() === range.to.getFullYear();
  return sameMonth
    ? `Selecionar ${range.from.getDate()} - ${range.to.getDate()} ${month(range.to)}.`
    : `Selecionar ${range.from.getDate()} ${month(range.from)}. - ${range.to.getDate()} ${month(range.to)}.`;
}

function Calendar({
  className,
  classNames,
  showOutsideDays = true,
  captionLayout = "label",
  buttonVariant = "ghost",
  formatters,
  components,
  ...props
}: React.ComponentProps<typeof DayPicker> & {
  buttonVariant?: React.ComponentProps<typeof Button>["variant"];
}) {
  const defaultClassNames = getDefaultClassNames();
  const [mobile, setMobile] = React.useState(false);
  const mobileScrollRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    const media = window.matchMedia("(max-width: 1023px)");
    const sync = () => setMobile(media.matches);
    sync();
    media.addEventListener("change", sync);
    return () => media.removeEventListener("change", sync);
  }, []);

  const mobileRange = mobile && props.mode === "range";
  const selectedRange = props.mode === "range" ? (props.selected as DateRange | undefined) : undefined;

  React.useEffect(() => {
    if (!mobileRange) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = previous; };
  }, [mobileRange]);

  const picker = (
    <DayPicker
      {...props}
      showOutsideDays={mobileRange ? false : showOutsideDays}
      className={cn(
        "bg-background group/calendar p-3 [--cell-size:2rem] [[data-slot=card-content]_&]:bg-transparent [[data-slot=popover-content]_&]:bg-transparent",
        mobileRange && "w-full bg-transparent p-0 [--cell-size:2.65rem] [&_[data-range-middle=true]]:!bg-primary/15 [&_[data-range-middle=true]]:!text-primary",
        String.raw`rtl:**:[.rdp-button\_next>svg]:rotate-180`,
        String.raw`rtl:**:[.rdp-button\_previous>svg]:rotate-180`,
        className,
      )}
      captionLayout={captionLayout}
      numberOfMonths={mobileRange ? 12 : props.numberOfMonths}
      hideNavigation={mobileRange ? true : props.hideNavigation}
      formatters={{
        formatMonthDropdown: (date) => date.toLocaleString("default", { month: "short" }),
        ...formatters,
      }}
      classNames={{
        root: cn(mobileRange ? "w-full" : "w-fit", defaultClassNames.root),
        months: cn(
          mobileRange ? "relative flex w-full flex-col gap-8" : "relative flex flex-col gap-4 md:flex-row",
          defaultClassNames.months,
        ),
        month: cn("flex w-full flex-col gap-4", defaultClassNames.month),
        nav: cn(
          "absolute inset-x-0 top-0 flex w-full items-center justify-between gap-1",
          defaultClassNames.nav,
        ),
        button_previous: cn(
          buttonVariants({ variant: buttonVariant }),
          "h-(--cell-size) w-(--cell-size) select-none p-0 aria-disabled:opacity-50",
          defaultClassNames.button_previous,
        ),
        button_next: cn(
          buttonVariants({ variant: buttonVariant }),
          "h-(--cell-size) w-(--cell-size) select-none p-0 aria-disabled:opacity-50",
          defaultClassNames.button_next,
        ),
        month_caption: cn(
          mobileRange
            ? "flex h-10 w-full items-center justify-start px-2"
            : "flex h-(--cell-size) w-full items-center justify-center px-(--cell-size)",
          defaultClassNames.month_caption,
        ),
        dropdowns: cn(
          "flex h-(--cell-size) w-full items-center justify-center gap-1.5 text-sm font-medium",
          defaultClassNames.dropdowns,
        ),
        dropdown_root: cn(
          "has-focus:border-ring border-input shadow-xs has-focus:ring-ring/50 has-focus:ring-[3px] relative rounded-md border",
          defaultClassNames.dropdown_root,
        ),
        dropdown: cn("bg-popover absolute inset-0 opacity-0", defaultClassNames.dropdown),
        caption_label: cn(
          "select-none font-medium",
          mobileRange && "text-lg font-bold capitalize text-foreground",
          !mobileRange && (captionLayout === "label"
            ? "text-sm"
            : "[&>svg]:text-muted-foreground flex h-8 items-center gap-1 rounded-md pl-2 pr-1 text-sm [&>svg]:size-3.5"),
          defaultClassNames.caption_label,
        ),
        table: "w-full border-collapse",
        weekdays: cn(
          "flex",
          mobileRange && "w-full rounded-xl bg-secondary/70 px-1 py-2",
          defaultClassNames.weekdays,
        ),
        weekday: cn(
          "text-muted-foreground flex-1 select-none rounded-md text-[0.8rem] font-normal",
          mobileRange && "text-center text-[11px] font-semibold",
          defaultClassNames.weekday,
        ),
        week: cn("mt-2 flex w-full", defaultClassNames.week),
        week_number_header: cn("w-(--cell-size) select-none", defaultClassNames.week_number_header),
        week_number: cn(
          "text-muted-foreground select-none text-[0.8rem]",
          defaultClassNames.week_number,
        ),
        day: cn(
          "group/day relative aspect-square h-full w-full select-none p-0 text-center [&:first-child[data-selected=true]_button]:rounded-l-md [&:last-child[data-selected=true]_button]:rounded-r-md",
          mobileRange && "flex-1",
          defaultClassNames.day,
        ),
        range_start: cn("bg-accent rounded-l-md", defaultClassNames.range_start),
        range_middle: cn("rounded-none", defaultClassNames.range_middle),
        range_end: cn("bg-accent rounded-r-md", defaultClassNames.range_end),
        today: cn(
          "bg-accent text-accent-foreground rounded-md data-[selected=true]:rounded-none",
          defaultClassNames.today,
        ),
        outside: cn(
          "text-muted-foreground aria-selected:text-muted-foreground",
          defaultClassNames.outside,
        ),
        disabled: cn("text-muted-foreground opacity-50", defaultClassNames.disabled),
        hidden: cn("invisible", defaultClassNames.hidden),
        ...classNames,
      }}
      components={{
        Root: ({ className, rootRef, ...rootProps }) => {
          return <div data-slot="calendar" ref={rootRef} className={cn(className)} {...rootProps} />;
        },
        Chevron: ({ className, orientation, ...chevronProps }) => {
          if (orientation === "left") {
            return <ChevronLeftIcon className={cn("size-4", className)} {...chevronProps} />;
          }

          if (orientation === "right") {
            return <ChevronRightIcon className={cn("size-4", className)} {...chevronProps} />;
          }

          return <ChevronDownIcon className={cn("size-4", className)} {...chevronProps} />;
        },
        DayButton: CalendarDayButton,
        WeekNumber: ({ children, ...weekProps }) => {
          return (
            <td {...weekProps}>
              <div className="flex size-(--cell-size) items-center justify-center text-center">
                {children}
              </div>
            </td>
          );
        },
        ...components,
      }}
    />
  );

  if (mobileRange && typeof document !== "undefined") {
    const ready = !!selectedRange?.from && !!selectedRange.to;
    return createPortal(
      <div className="fixed inset-0 z-[200] flex items-end bg-black/65 lg:hidden" role="dialog" aria-modal="true" aria-label="Selecionar datas da viagem">
        <div className="relative flex h-[92dvh] w-full flex-col overflow-hidden rounded-t-[28px] bg-background shadow-2xl">
          <div className="shrink-0 border-b border-border bg-background px-4 pb-3 pt-2">
            <div className="mx-auto mb-2 h-1.5 w-16 rounded-full bg-muted-foreground/35" />
            <div className="flex items-center gap-2">
              <CalendarDays className="h-5 w-5 shrink-0 text-primary" />
              <div className="min-w-0 flex-1">
                <h2 className="text-base font-bold text-foreground">Escolha as datas</h2>
                <p className="text-xs text-muted-foreground">Toque primeiro na ida e depois na volta.</p>
              </div>
              {props.onMonthChange && (
                <Button type="button" variant="outline" size="sm" className="shrink-0 px-2 text-[11px]"
                  onClick={() => {
                    const now = new Date();
                    props.onMonthChange?.(new Date(now.getFullYear(), now.getMonth(), 1));
                    mobileScrollRef.current?.scrollTo({ top: 0, behavior: "smooth" });
                  }}>
                  Mês atual
                </Button>
              )}
            </div>
          </div>
          <div ref={mobileScrollRef} className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 pb-28 pt-3">
            {picker}
          </div>
          <div className="absolute inset-x-0 bottom-0 border-t border-border bg-background/98 p-4 pb-[max(1rem,env(safe-area-inset-bottom))] backdrop-blur">
            <Button
              type="button"
              disabled={!ready}
              onClick={() => document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }))}
              className="h-14 w-full rounded-2xl text-base font-bold shadow-lg"
            >
              {rangeLabel(selectedRange)}
            </Button>
          </div>
        </div>
      </div>,
      document.body,
    );
  }

  return picker;
}

function CalendarDayButton({
  className,
  day,
  modifiers,
  ...props
}: React.ComponentProps<typeof DayButton>) {
  const defaultClassNames = getDefaultClassNames();

  const ref = React.useRef<HTMLButtonElement>(null);
  React.useEffect(() => {
    if (modifiers["focused"]) ref.current?.focus();
  }, [modifiers]);

  return (
    <Button
      ref={ref}
      variant="ghost"
      size="icon"
      data-day={day.date.toLocaleDateString()}
      data-selected-single={
        modifiers["selected"] &&
        !modifiers["range_start"] &&
        !modifiers["range_end"] &&
        !modifiers["range_middle"]
      }
      data-range-start={modifiers["range_start"]}
      data-range-end={modifiers["range_end"]}
      data-range-middle={modifiers["range_middle"]}
      className={cn(
        "data-[selected-single=true]:bg-primary data-[selected-single=true]:text-primary-foreground data-[range-middle=true]:bg-accent data-[range-middle=true]:text-accent-foreground data-[range-start=true]:bg-primary data-[range-start=true]:text-primary-foreground data-[range-end=true]:bg-primary data-[range-end=true]:text-primary-foreground group-data-[focused=true]/day:border-ring group-data-[focused=true]/day:ring-ring/50 flex aspect-square h-auto w-full min-w-(--cell-size) flex-col gap-1 font-normal leading-none data-[range-end=true]:rounded-md data-[range-middle=true]:rounded-none data-[range-start=true]:rounded-md group-data-[focused=true]/day:relative group-data-[focused=true]/day:z-10 group-data-[focused=true]/day:ring-[3px] [&>span]:text-xs [&>span]:opacity-70",
        defaultClassNames.day,
        className,
      )}
      {...props}
    />
  );
}

export { Calendar, CalendarDayButton };
