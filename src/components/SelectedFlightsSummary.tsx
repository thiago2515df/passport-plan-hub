import { BriefcaseBusiness, Clock3, CreditCard, Eye, Luggage, Trash2, X } from "lucide-react";
import { brl, type Flight } from "@/lib/hotels";
import { AZUL_LOGO, GOL_LOGO, LATAM_LOGO } from "@/lib/airline-logos";

type Direction = "out" | "back";

type SelectedFlightsSummaryProps = {
  outbound?: Flight;
  inbound?: Flight;
  outboundDate?: string;
  inboundDate?: string;
  onRemove: (direction: Direction) => void;
  onShowOptions: (direction: Direction) => void;
};

const datePt = (value?: string, fallback?: string) => {
  const raw = value || fallback;
  if (!raw) return "";
  const iso = raw.match(/\d{4}-\d{2}-\d{2}/)?.[0] ?? raw.slice(0, 10);
  const d = new Date(`${iso}T12:00:00`);
  return Number.isNaN(d.getTime()) ? raw : d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "2-digit" });
};

const timePt = (value?: string) => {
  if (!value) return "--:--";
  const match = value.match(/(?:T|\s)?(\d{2}):(\d{2})/);
  return match ? `${match[1]}:${match[2]}` : value;
};

const airlineLogo = (flight: Flight) => {
  const key = `${flight.airline ?? ""} ${flight.flightNumber ?? ""}`.toUpperCase();
  if (key.includes("GOL") || /\bG3\s*\d/.test(key)) return { src: GOL_LOGO, alt: "GOL" };
  if (key.includes("LATAM") || /\bLA\s*\d/.test(key)) return { src: LATAM_LOGO, alt: "LATAM" };
  if (key.includes("AZUL") || /\bAD\s*\d/.test(key)) return { src: AZUL_LOGO, alt: "Azul" };
  return null;
};

function BaggageIcons({ flight }: { flight: Flight }) {
  const baggage = flight.baggage;
  const generic = (flight.bags ?? "").toLowerCase();
  const personal = baggage?.personal ?? /pessoal|personal/.test(generic);
  const carryOn = baggage?.carryOn ?? /m[aã]o|carry/.test(generic);
  const checked = baggage?.checked ?? /despach|checked/.test(generic);

  return (
    <div className="selected-flight-bags">
      <span title={personal ? "Item pessoal incluído" : "Item pessoal"}><BriefcaseBusiness className={personal ? "" : "opacity-55"} /></span>
      <span title={carryOn ? "Bagagem de mão incluída" : "Bagagem de mão"}><Luggage className={carryOn ? "" : "opacity-55"} /></span>
      <span className="relative" title={checked ? "Bagagem despachada incluída" : "Bagagem despachada não incluída"}>
        <Luggage className={checked ? "" : "opacity-65"} />
        {!checked && <X className="selected-flight-bag-x" />}
      </span>
    </div>
  );
}

function SelectedFlightCard({ direction, flight, fallbackDate, onRemove, onShowOptions }: {
  direction: Direction;
  flight: Flight;
  fallbackDate?: string;
  onRemove: (direction: Direction) => void;
  onShowOptions: (direction: Direction) => void;
}) {
  const logo = airlineLogo(flight);
  const departureDate = datePt(flight.departureDate, fallbackDate);
  const arrivalDate = datePt(flight.arrivalDate, fallbackDate);
  const installments = flight.installments?.count;
  const commission = flight.commission ?? 0;
  const title = direction === "out" ? "Voo de ida selecionado" : "Voo de volta selecionado";
  const travelClass = (flight.travelClass || flight.fareCategory || "Econômica").toUpperCase();

  return (
    <section className="selected-flight-wrapper">
      <div className="selected-flight-heading">
        <div><h3>{title}</h3><span>{departureDate}</span></div>
        <div className="selected-flight-actions">
          <button type="button" title="Visualizar voo" aria-label={`Visualizar ${title.toLowerCase()}`} onClick={() => onShowOptions(direction)}><Eye /></button>
          <button type="button" onClick={() => onShowOptions(direction)}>Ver todas as opções</button>
        </div>
      </div>

      <div className="selected-flight-card">
        <div className="selected-flight-airline">
          {logo ? <img src={logo.src} alt={logo.alt} /> : <div className="selected-flight-airline-fallback">{flight.airline || flight.flightNumber?.slice(0, 2)}</div>}
        </div>

        <div className="selected-flight-details">
          <div className="selected-flight-class">{travelClass} <span>•</span> {flight.flightNumber}</div>
          <div className="selected-flight-route">
            <div className="selected-flight-point">
              <strong>{departureDate}</strong><span>{timePt(flight.departure)}</span><b>{flight.from}</b>
            </div>
            <div className="selected-flight-duration"><div /><span><Clock3 />{flight.duration || "Direto"}</span><div /></div>
            <div className="selected-flight-point selected-flight-point-right">
              <strong>{arrivalDate}</strong><span>{timePt(flight.arrival)}</span><b>{flight.to}</b>
            </div>
          </div>
          <div className="selected-flight-info-icons"><span>i</span><CreditCard /></div>
        </div>

        <div className="selected-flight-price">
          <strong>{brl(flight.price)}</strong>
          <span>{installments ? `até ${installments}x${flight.installments?.interestFree === false ? "" : " s/ juros"}` : "valor da passagem"}</span>
          {commission > 0 && <div className="selected-flight-commission">Comissão: {brl(commission)}</div>}
          <BaggageIcons flight={flight} />
          <button className="selected-flight-remove" type="button" aria-label={`Remover ${title.toLowerCase()}`} onClick={() => onRemove(direction)}><Trash2 /></button>
        </div>
      </div>
    </section>
  );
}

export function SelectedFlightsSummary({ outbound, inbound, outboundDate, inboundDate, onRemove, onShowOptions }: SelectedFlightsSummaryProps) {
  if (!outbound && !inbound) return null;
  return (
    <div className="selected-flights-summary">
      {outbound && <SelectedFlightCard direction="out" flight={outbound} fallbackDate={outboundDate} onRemove={onRemove} onShowOptions={onShowOptions} />}
      {inbound && <SelectedFlightCard direction="back" flight={inbound} fallbackDate={inboundDate} onRemove={onRemove} onShowOptions={onShowOptions} />}
    </div>
  );
}
