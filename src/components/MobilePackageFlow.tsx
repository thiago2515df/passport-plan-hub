import { useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Building2,
  Check,
  ChevronDown,
  Camera,
  Filter,
  MapPin,
  Plane,
  Search,
  Star,
} from "lucide-react";
import { brl, type Hotel, type TransportMode } from "@/lib/hotels";
import { packageFlowSteps, type PackageStep } from "@/lib/package-flow";
import { HotelPhoto } from "@/components/HotelGallery";
import "@/package-flow.css";

type Source = "hotel" | "airbnb" | "trivago";

export function MobilePackageHeader({
  step,
  mode,
  destination,
  dates,
  guests,
  onBack,
  onStep,
}: {
  step: PackageStep;
  mode: TransportMode;
  destination: string;
  dates: string;
  guests: string;
  onBack: () => void;
  onStep: (step: PackageStep) => void;
}) {
  const steps = packageFlowSteps(mode);
  const index = steps.findIndex((item) => item.id === step);
  return (
    <header className="package-flow-header">
      <div className="package-flow-trip">
        <button type="button" onClick={onBack} aria-label="Voltar à etapa anterior">
          <ArrowLeft />
        </button>
        <div>
          <h1>{destination}</h1>
          <p>
            {dates} · {guests}
          </p>
        </div>
        <button type="button" onClick={() => onStep("pesquisa")} aria-label="Editar pesquisa">
          <Search />
        </button>
      </div>
      <nav aria-label="Etapas da proposta">
        <ol className="package-flow-steps">
          {steps.map((item, i) => (
            <li key={item.id} aria-current={item.id === step ? "step" : undefined}>
              <button type="button" disabled={i > index} onClick={() => onStep(item.id)}>
                <span>{i < index ? <Check aria-hidden="true" /> : i + 1}</span>
                {item.label}
              </button>
            </li>
          ))}
        </ol>
      </nav>
    </header>
  );
}

export function MobilePackageSearching({
  kind,
  destination,
  dates,
  guests,
}: {
  kind: "hotels" | "flights";
  destination: string;
  dates: string;
  guests: string;
}) {
  const Icon = kind === "hotels" ? Building2 : Plane;
  return (
    <section className="package-flow-searching" role="status" aria-live="polite" aria-busy="true">
      <div className="package-flow-search-icon">
        <Icon aria-hidden="true" />
        <span />
      </div>
      <h2>
        {kind === "hotels" ? `Buscando hotéis em ${destination}` : "Buscando voos para sua viagem"}
      </h2>
      <p>
        {dates} · {guests}
      </p>
      <div className="package-flow-progress" aria-hidden="true">
        <span />
      </div>
      <p className="package-flow-search-help">
        {kind === "hotels"
          ? "Estamos consultando as opções de hospedagem."
          : "Estamos consultando os voos de ida e volta."}
      </p>
    </section>
  );
}

export function MobilePackageFooter({
  label,
  detail,
  disabled,
  onNext,
}: {
  label: string;
  detail: string;
  disabled: boolean;
  onNext: () => void;
}) {
  return (
    <footer className="package-flow-footer">
      <p role="status">{detail}</p>
      <button type="button" disabled={disabled} onClick={onNext}>
        {label}
        <ArrowRight aria-hidden="true" />
      </button>
    </footer>
  );
}

export function MobileHotelTools({
  source,
  onSource,
  count,
  query,
  onQuery,
  sort,
  onSort,
  stars,
  onStars,
}: {
  source: Source;
  onSource: (source: Source) => void;
  count: number;
  query: string;
  onQuery: (query: string) => void;
  sort: "asc" | "desc";
  onSort: () => void;
  stars: number;
  onStars: (stars: number) => void;
}) {
  const [filtersOpen, setFiltersOpen] = useState(false);
  return (
    <div className="package-hotel-tools">
      <div className="package-hotel-sources" role="group" aria-label="Fornecedor de hospedagem">
        {(
          [
            ["hotel", "Hotéis"],
            ["airbnb", "Airbnb"],
            ["trivago", "Trivago"],
          ] as const
        ).map(([id, label]) => (
          <button key={id} type="button" aria-pressed={source === id} onClick={() => onSource(id)}>
            {label}
          </button>
        ))}
      </div>
      <div className="package-hotel-tool-row">
        <button
          type="button"
          aria-expanded={filtersOpen}
          aria-controls="mobile-hotel-filters"
          onClick={() => setFiltersOpen(!filtersOpen)}
        >
          <Filter />
          Filtros
          {stars > 0 || query.trim()
            ? ` · ${Number(stars > 0) + Number(Boolean(query.trim()))}`
            : ""}
        </button>
        <button type="button" onClick={onSort}>
          <ChevronDown />
          {sort === "asc" ? "Menor preço" : "Maior preço"}
        </button>
      </div>
      {filtersOpen && (
        <div id="mobile-hotel-filters" className="package-hotel-filters">
          <label>
            Categoria mínima
            <select
              aria-label="Categoria mínima do hotel"
              value={stars}
              onChange={(e) => onStars(Number(e.target.value))}
            >
              <option value={0}>Todas as categorias</option>
              <option value={3}>3 estrelas</option>
              <option value={4}>4 estrelas</option>
              <option value={5}>5 estrelas</option>
            </select>
          </label>
          <button
            type="button"
            onClick={() => {
              onStars(0);
              onQuery("");
            }}
          >
            Limpar filtros
          </button>
        </div>
      )}
      {filtersOpen && (
        <label className="package-hotel-name-search">
          <Search aria-hidden="true" />
          <input
            aria-label="Buscar hospedagem pelo nome"
            placeholder="Buscar pelo nome da hospedagem"
            value={query}
            onChange={(e) => onQuery(e.target.value)}
          />
        </label>
      )}
      <p className="package-hotel-result-count" role="status">
        {count} {count === 1 ? "hospedagem encontrada" : "hospedagens encontradas"}
      </p>
    </div>
  );
}

export function MobilePackageHotelCard({
  hotel: h,
  selected,
  nights,
  guests,
  commission,
  sourceLink,
  quoteBusy,
  onSelect,
  onDetails,
  onQuote,
}: {
  hotel: Hotel;
  selected: boolean;
  nights: number;
  guests: number;
  commission: number;
  sourceLink?: string;
  quoteBusy: boolean;
  onSelect: () => void;
  onDetails: () => void;
  onQuote: () => void;
}) {
  const unavailable = h.provider === "trivago" && h.total <= 0;
  return (
    <article aria-label={h.name} className={`package-hotel-card ${selected ? "is-selected" : ""}`}>
      <div className="package-hotel-photo">
        <button type="button" aria-label={`Ver fotos de ${h.name}`} onClick={onDetails}>
          <HotelPhoto hotel={h} />
          <span className="package-hotel-photo-label">
            <Camera aria-hidden="true" />
            Ver fotos
          </span>
        </button>
        <button
          type="button"
          className="package-hotel-select"
          aria-label={`${selected ? "Remover" : "Selecionar"} ${h.name}`}
          aria-pressed={selected}
          disabled={unavailable}
          onClick={onSelect}
        >
          {selected ? <Check /> : <span>+</span>}
        </button>
      </div>
      <div className="package-hotel-content">
        <div className="package-hotel-title">
          <button type="button" onClick={onDetails}>
            <h2>{h.name}</h2>
          </button>
          {typeof h.rating === "number" && h.rating > 0 && (
            <span aria-label={`Avaliação ${h.rating}`}>{h.rating.toLocaleString("pt-BR")}</span>
          )}
        </div>
        {h.stars > 0 && (
          <div className="package-hotel-stars" aria-label={`${h.stars} estrelas`}>
            {Array.from({ length: Math.min(5, h.stars) }).map((_, i) => (
              <Star key={i} aria-hidden="true" />
            ))}
          </div>
        )}
        <div className="package-hotel-price">
          <strong>{unavailable ? "Tarifa indisponível" : brl(h.total)}</strong>
          <span>
            {nights} {nights === 1 ? "noite" : "noites"} · {guests}{" "}
            {guests === 1 ? "hóspede" : "hóspedes"}
          </span>
        </div>
        <p className="package-hotel-price-note">
          {unavailable
            ? "Consulte a disponibilidade da tarifa."
            : h.provider === "trivago" || h.totalEstimated
              ? "Hospedagem estimada. Confirme taxas e disponibilidade."
              : "Total da hospedagem"}
        </p>
        {h.address && (
          <p className="package-hotel-address">
            <MapPin aria-hidden="true" />
            {h.address}
          </p>
        )}
        {h.room && <p className="package-hotel-room">{h.room}</p>}
        {!unavailable && <p className="package-hotel-commission">Comissão: {brl(commission)}</p>}
        <div className="package-hotel-actions">
          <button type="button" onClick={onDetails}>
            Ver detalhes
          </button>
          {unavailable ? (
            <button type="button" disabled={quoteBusy} onClick={onQuote}>
              {quoteBusy ? "Consultando…" : "Consultar tarifa"}
            </button>
          ) : (
            <button type="button" aria-pressed={selected} onClick={onSelect}>
              {selected ? "Selecionado ✓" : "Selecionar hotel"}
            </button>
          )}
        </div>
        {sourceLink && (
          <a
            className="package-hotel-source-link"
            href={sourceLink}
            target="_blank"
            rel="noopener noreferrer"
          >
            {h.provider === "airbnb" ? "Abrir anúncio no Airbnb" : "Ver fornecedores no Trivago"} ↗
          </a>
        )}
      </div>
    </article>
  );
}
