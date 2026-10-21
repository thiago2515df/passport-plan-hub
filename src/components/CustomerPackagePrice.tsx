import { brl } from "@/lib/hotels";
import { packagePricePerTraveler } from "@/lib/customer-package-price";

type Props = {
  total: number;
  travelers: number | null;
  /** Small summary in the fixed bottom bar of the public proposal. */
  compact?: boolean;
  subtitle?: string;
};

/** Same price hierarchy on phones and desktops: per person, then full total. */
export function CustomerPackagePrice({ total, travelers, compact = false, subtitle }: Props) {
  const individual = packagePricePerTraveler(total, travelers);
  const guestLabel = travelers === 1 ? "1 pessoa" : `${travelers} pessoas`;

  if (compact) {
    return <div className="min-w-0">
      {subtitle && <p className="max-w-[80vw] truncate text-[11px] text-muted-foreground sm:max-w-sm sm:text-xs">{subtitle}</p>}
      {individual !== null ? <>
        <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
          <strong className="text-lg font-black leading-tight tabular-nums text-navy sm:text-xl">{brl(individual)}</strong>
          <span className="text-[11px] font-medium text-muted-foreground">por pessoa</span>
        </div>
        <p className="text-[11px] text-muted-foreground sm:text-xs">
          Total para {guestLabel}: <strong className="font-bold tabular-nums text-foreground">{brl(total)}</strong>
        </p>
      </> : <>
        <p className="text-[11px] text-muted-foreground">Total do pacote</p>
        <strong className="text-lg font-black tabular-nums sm:text-xl">{brl(total)}</strong>
      </>}
    </div>;
  }

  return <div className="mt-2 border-t border-border pt-2 sm:mt-3 sm:pt-3">
    {subtitle && <p className="text-[11px] text-muted-foreground sm:text-xs">{subtitle}</p>}
    {individual !== null ? <>
      <div className="mt-1 flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
        <strong className="text-2xl font-black leading-none tabular-nums text-navy sm:text-[26px]">{brl(individual)}</strong>
        <span className="text-xs font-semibold text-muted-foreground">por pessoa</span>
      </div>
      <div className="mt-2 flex flex-wrap items-center justify-between gap-x-2 gap-y-1 rounded-lg bg-primary/5 px-2.5 py-2 sm:mt-3">
        <span className="text-[11px] font-medium text-muted-foreground sm:text-xs">Total para {guestLabel}</span>
        <strong className="text-sm font-extrabold tabular-nums text-navy sm:text-base">{brl(total)}</strong>
      </div>
    </> : <>
      <span className="text-[11px] text-muted-foreground">Total do pacote</span>
      <div className="text-2xl font-black tabular-nums text-navy">{brl(total)}</div>
    </>}
  </div>;
}
