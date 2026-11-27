import { Check, Hotel, Plane, Wallet } from "lucide-react";
import { brl, type Search } from "@/lib/hotels";
import { multiHotelStayCost, type MultiHotelStay } from "@/lib/multi-hotel";
import { packagePricing, transportCost, type SellerCommissions, emptyCommissions } from "@/lib/package-pricing";

import { customerPackageTotal, DEFAULT_PAYMENT_RULES, rateForInterestFreeInstallments, type PaymentRules } from "@/lib/payment-rules";

const date = (iso: string) => new Date(iso + "T12:00").toLocaleDateString("pt-BR");

export function MultiHotelPriceSummary({
  stays, search, commissions, rules = DEFAULT_PAYMENT_RULES,
}: {
  stays: MultiHotelStay[];
  search: Search;
  commissions?: SellerCommissions;
  rules?: PaymentRules;
}) {
  const hotelCost = multiHotelStayCost(stays);
  const transport = transportCost(search);
  const breakdown = packagePricing(hotelCost, search, commissions ?? emptyCommissions);
  const count = search.interestFreeInstallments ?? 6;
  const total = customerPackageTotal(breakdown.total, rateForInterestFreeInstallments(rules, count)) ?? breakdown.total;
  const complete = stays.length >= 2 && stays.every(stay => Boolean(stay.hotel && stay.hotel.total > 0));

  return <div className="rounded-xl border border-primary/25 bg-primary/5 p-3">
    <h3 className="mb-3 flex items-center gap-2 text-sm font-bold"><Hotel className="h-4 w-4" />Roteiro Multi-hotel</h3>
    <div className="space-y-2">
      {stays.map((stay, index) => <div key={index} className="flex items-start justify-between gap-3 border-b border-border/70 pb-2 text-xs">
        <div className="min-w-0">
          <strong className="block">{index + 1}. {stay.hotel?.name ?? "Aguardando hotel"}</strong>
          <span className="text-muted-foreground">{date(stay.checkin)} a {date(stay.checkout)}</span>
        </div>
        <strong className="shrink-0">{stay.hotel ? brl(stay.hotel.total) : "—"}</strong>
      </div>)}
    </div>
    <div className="mt-3 space-y-1 text-xs">
      <p className="flex justify-between"><span>Hospedagens</span><strong>{brl(hotelCost)}</strong></p>
      {search.transport && search.transport.mode !== "none" && <p className="flex justify-between"><span className="flex items-center gap-1"><Plane className="h-3 w-3" />Transporte (uma vez)</span><strong>{brl(transport)}</strong></p>}
      {breakdown.commission > 0 && <p className="flex justify-between"><span>Comissão</span><strong>{brl(breakdown.commission)}</strong></p>}
      {(search.extras ?? []).length > 0 && <p className="flex justify-between"><span>Adicionais</span><strong>{brl((search.extras ?? []).reduce((sum, item) => sum + item.cost, 0))}</strong></p>}
    </div>
    <div className="mt-3 flex items-center justify-between gap-2 border-t border-primary/25 pt-3">
      <span className="flex items-center gap-2 text-sm font-bold"><Wallet className="h-4 w-4" />{count === 0 ? "Total no Pix à vista" : "Total do pacote"}</span>
      <strong className="text-xl text-primary">{complete ? brl(total) : "A completar"}</strong>
    </div>
    <p className="mt-1 text-[11px] text-muted-foreground">{complete ? <><Check className="mr-1 inline h-3 w-3" />Todos os hotéis + transporte somados uma única vez. Não são alternativas.</> : "Escolha todos os hotéis antes de gerar a proposta."}</p>
  </div>;
}
