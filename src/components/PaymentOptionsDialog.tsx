import { useMemo } from "react";
import { CreditCard, Landmark, QrCode, ShieldCheck } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { brl } from "@/lib/hotels";
import { DEFAULT_PAYMENT_RULES, installmentQuote, installmentQuoteFromCustomerTotal, normalizePaymentRules, pixTotal, type PaymentRules } from "@/lib/payment-rules";
import { PAYMENT_CARD_BRANDS_IMAGE, PAYMENT_PIX_IMAGE } from "@/assets/payment-brand-assets";

export function PaymentOptionsDialog({
  open, onOpenChange, total, rules, hotelName, travelers = 1, interestFreeInstallments = 6,
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
  const cardQuotes = useMemo(() => payment.card.visaMaster.map((rate, index) => ({
    installments: index + 1,
    rate,
    quote: installmentQuoteFromCustomerTotal(total, index + 1, rate, payment.card.embeddedFeePercent, interestFreeInstallments),
  })), [interestFreeInstallments, payment.card.embeddedFeePercent, payment.card.visaMaster, total]);
  const pixValue = pixTotal(total, payment.card.embeddedFeePercent);
  const safeTravelers = Math.max(1, Math.floor(travelers || 1));
  const perPerson = Math.round((total / safeTravelers + Number.EPSILON) * 100) / 100;

  return <Dialog open={open} onOpenChange={onOpenChange}>
    <DialogContent className="max-h-[92vh] w-[calc(100%-1rem)] max-w-3xl overflow-y-auto rounded-2xl p-0 sm:rounded-3xl">
      <DialogHeader className="border-b border-border px-4 pb-4 pt-5 text-left sm:px-6">
        <DialogTitle className="text-xl font-extrabold text-navy sm:text-2xl">Formas de pagamento</DialogTitle>
        <DialogDescription className="text-xs sm:text-sm">
          {hotelName} · total do pacote <strong className="text-foreground">{brl(total)}</strong> · <strong className="text-foreground">{brl(perPerson)} por pessoa</strong>
        </DialogDescription>
      </DialogHeader>

      <div className="space-y-4 px-4 pb-6 sm:px-6">
        {payment.card.enabled && <section className="overflow-hidden rounded-2xl border border-border bg-card">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border bg-primary/5 p-4">
            <div className="flex items-center gap-2"><span className="grid h-10 w-10 place-items-center rounded-xl bg-primary text-primary-foreground"><CreditCard className="h-5 w-5"/></span><div><h3 className="font-bold text-navy">Cartão de crédito</h3><p className="text-xs text-muted-foreground">Até {interestFreeInstallments}x sem juros{interestFreeInstallments < 12 ? ` · de ${interestFreeInstallments + 1}x a 12x com juros` : ""}</p></div></div>
            <img src={PAYMENT_CARD_BRANDS_IMAGE} alt="Visa, Mastercard, American Express, Elo e Hipercard" className="h-7 max-w-[230px] object-contain sm:h-8"/>
          </div>
          <div className="p-4">
            <div className="divide-y divide-border rounded-xl border border-border">
              {cardQuotes.map(({ installments, rate, quote }) => quote && <div key={installments} className="grid grid-cols-[48px_1fr_auto] items-center gap-2 px-3 py-2.5 text-sm">
                <strong className="text-primary">{installments}x</strong>
                <div><span className="font-semibold">{installments}× de {brl(quote.installment)}</span><p className="text-[11px] text-muted-foreground">Total do pacote {brl(quote.total)} · {brl(Math.round((quote.total / safeTravelers + Number.EPSILON) * 100) / 100)} por pessoa</p></div>
                <span className={`rounded-full px-2 py-1 text-[10px] font-semibold ${installments <= interestFreeInstallments ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-800"}`}>{installments <= interestFreeInstallments ? "Sem juros" : `${rate.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}% juros`}</span>
              </div>)}
            </div>
          </div>
        </section>}

        <div className="grid gap-4 sm:grid-cols-2">
          {payment.pix.enabled && <section className="rounded-2xl border border-border bg-card p-4">
            <div className="flex items-center gap-3">
              <span className="grid h-11 w-11 place-items-center rounded-xl bg-[#32b8ad]/10"><QrCode className="h-5 w-5 text-[#249f96]"/></span>
              <div><h3 className="font-bold text-navy">Pix</h3><p className="text-xs text-muted-foreground">Pix à vista com desconto</p></div>
            </div>
            <img src={PAYMENT_PIX_IMAGE} alt="Pix" className="my-3 h-9 max-w-[150px] object-contain object-left"/>
            <p className="text-2xl font-black text-navy">{brl(pixValue)}</p>
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
