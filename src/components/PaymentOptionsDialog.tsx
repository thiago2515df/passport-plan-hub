import { useMemo } from "react";
import { CreditCard, Landmark, QrCode, ShieldCheck } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { brl } from "@/lib/hotels";
import { DEFAULT_PAYMENT_RULES, installmentQuote, installmentQuoteFromCustomerTotal, normalizePaymentRules, pixTotal, resolveInterestFreeSelection, type PaymentRules } from "@/lib/payment-rules";
import { PAYMENT_CARD_BRANDS_IMAGE, PAYMENT_PIX_IMAGE } from "@/assets/payment-brand-assets";

export function PaymentOptionsDialog({
  open, onOpenChange, total, rules, hotelName, travelers = 1, interestFreeInstallments,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  total: number;
  rules?: PaymentRules;
  hotelName: string;
  travelers?: number;
  interestFreeInstallments?: number;
}) {
  const payment = normalizePaymentRules(rules ?? DEFAULT_PAYMENT_RULES);
  const selection = resolveInterestFreeSelection(payment, interestFreeInstallments);
  const freeThrough = selection.installments;
  const selectedRate = selection.rate;
  const cardQuotes = useMemo(() => payment.card.visaMaster.map((rate, index) => ({
    installments: index + 1,
    rate,
    quote: installmentQuoteFromCustomerTotal(total, index + 1, rate, selectedRate, freeThrough),
  })), [freeThrough, payment.card.visaMaster, selectedRate, total]);
  const pixValue = pixTotal(total, selectedRate);

  return <Dialog open={open} onOpenChange={onOpenChange}>
    <DialogContent className="max-h-[92vh] w-[calc(100%-1rem)] max-w-3xl overflow-y-auto rounded-2xl p-0 sm:rounded-3xl">
      <DialogHeader className="border-b border-border px-4 pb-4 pt-5 text-left sm:px-6">
        <DialogTitle className="text-xl font-extrabold text-navy sm:text-2xl">Formas de pagamento</DialogTitle>
        <DialogDescription className="text-xs sm:text-sm">
          {hotelName} · total do pacote <strong className="text-foreground">{brl(total)}</strong>
        </DialogDescription>
      </DialogHeader>

      <div className="space-y-4 px-4 pb-6 sm:px-6">
        {payment.card.enabled && <section className="overflow-hidden rounded-2xl border border-border bg-card">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border bg-primary/5 p-4">
            <div className="flex items-center gap-3">
              <span className="grid h-10 w-10 place-items-center rounded-xl bg-primary text-primary-foreground"><CreditCard className="h-5 w-5"/></span>
              <div>
                <h3 className="font-bold text-navy">Cartão de crédito</h3>
                <span className="mt-1 inline-flex rounded-full bg-emerald-100 px-3 py-1 text-xs font-extrabold text-emerald-700">
                  Até {freeThrough}x sem juros
                </span>
              </div>
            </div>
            <img src={PAYMENT_CARD_BRANDS_IMAGE} alt="Visa, Mastercard, American Express, Elo e Hipercard" className="h-7 max-w-[230px] object-contain sm:h-8"/>
          </div>
          <div className="p-4">
            <div className="divide-y divide-border rounded-xl border border-border">
              {cardQuotes.map(({ installments, quote }) => {
                if (!quote) return null;
                const interestFree = installments <= freeThrough;
                return <div
                  key={installments}
                  className={`grid grid-cols-[44px_1fr_auto] items-center gap-3 px-3 py-3 text-sm sm:px-4 ${
                    interestFree ? "bg-emerald-50/70" : "bg-amber-50/40"
                  }`}
                >
                  <strong className={interestFree ? "text-emerald-700" : "text-amber-800"}>{installments}x</strong>
                  <div className="min-w-0">
                    <p className="font-semibold text-foreground">{installments}× de {brl(quote.installment)}</p>
                    <p className="mt-0.5 text-[11px] text-muted-foreground">Total do pacote {brl(quote.total)}</p>
                  </div>
                  <span className={`rounded-full px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-wide ${
                    interestFree
                      ? "bg-emerald-100 text-emerald-700"
                      : "bg-amber-100 text-amber-800"
                  }`}>
                    {interestFree ? "Sem juros" : "Com juros"}
                  </span>
                </div>;
              })}
            </div>
          </div>
        </section>}

        <div className="grid gap-4 sm:grid-cols-2">
          {payment.pix.enabled && <section className="overflow-hidden rounded-2xl border border-[#32b8ad]/30 bg-gradient-to-br from-[#32b8ad]/10 via-card to-card p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <span className="grid h-11 w-11 place-items-center rounded-xl bg-[#32b8ad]/15"><QrCode className="h-5 w-5 text-[#249f96]"/></span>
                <div>
                  <h3 className="font-bold text-navy">Pix à vista com desconto</h3>
                  <p className="text-xs text-muted-foreground">Pagamento à vista com valor especial</p>
                </div>
              </div>
              <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-[11px] font-bold text-emerald-700">
                {selectedRate.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}% OFF
              </span>
            </div>
            <img src={PAYMENT_PIX_IMAGE} alt="Pix" className="my-3 h-9 max-w-[150px] object-contain object-left"/>
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Valor no Pix</p>
            <p className="mt-1 text-2xl font-black text-navy sm:text-3xl">{brl(pixValue)}</p>
            <p className="mt-2 text-xs text-emerald-700">Economize pagando à vista pelo Pix.</p>
          </section>}

          {payment.boleto.enabled && <section className="rounded-2xl border border-border bg-card p-4">
            <div className="flex items-center gap-3">
              <span className="grid h-11 w-11 place-items-center rounded-xl bg-primary/10"><Landmark className="h-5 w-5 text-primary"/></span>
              <div><h3 className="font-bold text-navy">Boleto</h3><p className="text-xs text-muted-foreground">Até {payment.boleto.maxInstallments}x conforme regra da agência</p></div>
            </div>
            <div className="mt-3 space-y-2">
              {Array.from({ length: payment.boleto.maxInstallments }).map((_, index) => {
                const installments = index + 1;
                const quote = installmentQuote(total, installments, payment.boleto.fees[index] ?? 0);
                if (!quote) return null;
                return <div key={installments} className="flex items-center justify-between gap-3 rounded-lg bg-secondary/70 px-3 py-2 text-sm">
                  <strong>{installments}x de {brl(quote.installment)}</strong>
                  <span className="text-xs text-muted-foreground">{brl(quote.total)}</span>
                </div>;
              })}
            </div>
            {payment.boleto.note && <p className="mt-3 text-xs leading-relaxed text-muted-foreground">{payment.boleto.note}</p>}
          </section>}
        </div>

        <div className="flex items-start gap-2 rounded-xl bg-secondary p-3 text-[11px] leading-relaxed text-muted-foreground sm:text-xs">
          <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-primary"/>
          <span>Os valores de parcelamento são uma simulação conforme as condições cadastradas nesta proposta. Disponibilidade, aprovação e condições finais são confirmadas no momento do pagamento.</span>
        </div>
      </div>
    </DialogContent>
  </Dialog>;
}
