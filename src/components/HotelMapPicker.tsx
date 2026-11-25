import { useEffect, useMemo, useRef, useState } from "react";
import { Check, MapPin, Plus, X } from "lucide-react";
import type { Hotel } from "@/lib/hotels";
import { brl } from "@/lib/hotels";
import { Button } from "@/components/ui/button";

declare global {
  interface Window {
    L?: any;
    __leafletLoading?: Promise<any>;
  }
}

const LEAFLET_CSS = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
const LEAFLET_JS = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js";
const CLUSTER_CSS = "https://unpkg.com/leaflet.markercluster@1.5.3/dist/MarkerCluster.css";
const CLUSTER_DEFAULT_CSS = "https://unpkg.com/leaflet.markercluster@1.5.3/dist/MarkerCluster.Default.css";
const CLUSTER_JS = "https://unpkg.com/leaflet.markercluster@1.5.3/dist/leaflet.markercluster.js";

function ensureLeaflet() {
  if (typeof window === "undefined") return Promise.reject(new Error("Mapa indisponível no servidor."));
  if (window.L) return Promise.resolve(window.L);
  if (window.__leafletLoading) return window.__leafletLoading;

  window.__leafletLoading = new Promise((resolve, reject) => {
    if (!document.querySelector(`link[href="${LEAFLET_CSS}"]`)) {
      const link = document.createElement("link");
      link.rel = "stylesheet";
      link.href = LEAFLET_CSS;
      link.integrity = "sha256-p4NxAoJBhIIN+hmNHrzRCf9tD/miZyoHS5obTRR9BMY=";
      link.crossOrigin = "";
      document.head.appendChild(link);
    }

    const existing = document.querySelector<HTMLScriptElement>(`script[src="${LEAFLET_JS}"]`);
    if (existing) {
      existing.addEventListener("load", () => resolve(window.L));
      existing.addEventListener("error", () => reject(new Error("Não foi possível carregar o mapa.")));
      return;
    }

    const script = document.createElement("script");
    script.src = LEAFLET_JS;
    script.integrity = "sha256-20nQCchB9co0qIjJZRGuk2/Z9VM+kNiyxNV1lvTlZBo=";
    script.crossOrigin = "";
    script.async = true;
    script.onload = () => window.L ? resolve(window.L) : reject(new Error("Mapa não inicializado."));
    script.onerror = () => reject(new Error("Não foi possível carregar o mapa."));
    document.head.appendChild(script);
  }).then(async (L) => {
    if (L.markerClusterGroup) return L;

    for (const href of [CLUSTER_CSS, CLUSTER_DEFAULT_CSS]) {
      if (!document.querySelector(`link[href="${href}"]`)) {
        const link = document.createElement("link");
        link.rel = "stylesheet";
        link.href = href;
        document.head.appendChild(link);
      }
    }

    await new Promise<void>((resolve, reject) => {
      const existing = document.querySelector<HTMLScriptElement>(`script[src="${CLUSTER_JS}"]`);
      if (existing) {
        if (L.markerClusterGroup) return resolve();
        existing.addEventListener("load", () => resolve(), { once: true });
        existing.addEventListener("error", () => reject(new Error("Não foi possível carregar o agrupamento do mapa.")), { once: true });
        return;
      }
      const script = document.createElement("script");
      script.src = CLUSTER_JS;
      script.async = true;
      script.onload = () => resolve();
      script.onerror = () => reject(new Error("Não foi possível carregar o agrupamento do mapa."));
      document.head.appendChild(script);
    });

    return L;
  });

  return window.__leafletLoading;
}

const validCoordinate = (value: unknown, min: number, max: number): value is number =>
  typeof value === "number" && Number.isFinite(value) && value >= min && value <= max;

export function HotelMapPicker({
  hotels,
  selectedIds,
  onToggle,
  onClose,
}: {
  hotels: Hotel[];
  selectedIds: string[];
  onToggle: (id: string) => void;
  onClose: () => void;
}) {
  const mapEl = useRef<HTMLDivElement>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [mapError, setMapError] = useState("");
  const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds]);
  const mappable = useMemo(() => hotels.filter(h =>
    validCoordinate(h.latitude, -90, 90) && validCoordinate(h.longitude, -180, 180)
  ), [hotels]);
  const active = hotels.find(h => h.id === activeId) ?? null;

  useEffect(() => {
    if (activeId && !hotels.some(h => h.id === activeId)) setActiveId(null);
  }, [activeId, hotels]);

  useEffect(() => {
    let disposed = false;
    let map: any = null;

    void ensureLeaflet().then((L) => {
      if (disposed || !mapEl.current) return;
      mapEl.current.innerHTML = "";
      map = L.map(mapEl.current, { zoomControl: true, closePopupOnClick: false });
      L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 19,
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      }).addTo(map);

      const bounds: [number, number][] = [];
      const cluster = L.markerClusterGroup({
        showCoverageOnHover: false,
        spiderfyOnMaxZoom: true,
        zoomToBoundsOnClick: true,
        removeOutsideVisibleBounds: true,
        maxClusterRadius: 52,
        disableClusteringAtZoom: 16,
        spiderfyDistanceMultiplier: 1.35,
        iconCreateFunction: (group: any) => {
          const count = group.getChildCount();
          const size = count >= 50 ? 46 : count >= 20 ? 42 : count >= 10 ? 38 : 34;
          return L.divIcon({
            className: "",
            html: `<div style="
              width:${size}px;height:${size}px;border-radius:999px;
              display:grid;place-items:center;
              background:#0b63ce;color:white;
              border:3px solid rgba(255,255,255,.95);
              box-shadow:0 3px 12px rgba(15,23,42,.30);
              font:800 12px/1 system-ui,-apple-system,sans-serif;
            ">${count}</div>`,
            iconSize: [size, size],
            iconAnchor: [size / 2, size / 2],
          });
        },
      });

      for (const hotel of mappable) {
        const lat = hotel.latitude as number;
        const lng = hotel.longitude as number;
        bounds.push([lat, lng]);

        const selected = selectedSet.has(hotel.id);
        const price = hotel.nightly > 0
          ? brl(Math.round(hotel.nightly)).replace(",00", "")
          : "Ver";
        const width = Math.max(52, Math.min(78, 18 + price.length * 7));
        const icon = L.divIcon({
          className: "",
          html: `<div style="
            width:${width}px;height:28px;
            display:flex;align-items:center;justify-content:center;
            white-space:nowrap;
            border-radius:10px;
            padding:0 7px;
            font:800 11px/1 system-ui,-apple-system,sans-serif;
            box-shadow:0 2px 8px rgba(15,23,42,.24);
            border:2px solid ${selected ? "#083b81" : "#fff"};
            background:${selected ? "#0b63ce" : "#fff"};
            color:${selected ? "#fff" : "#0b3b82"};
          ">${price}</div>`,
          iconSize: [width, 28],
          iconAnchor: [width / 2, 14],
        });

        const marker = L.marker([lat, lng], { icon });
        marker.on("click", () => setActiveId(hotel.id));
        cluster.addLayer(marker);
      }

      map.addLayer(cluster);

      if (bounds.length === 1) map.setView(bounds[0], 14);
      else if (bounds.length > 1) map.fitBounds(bounds, { padding: [70, 70], maxZoom: 14 });
      else map.setView([-15.7797, -47.9297], 4);

      window.setTimeout(() => map?.invalidateSize(), 50);
    }).catch((error) => {
      if (!disposed) setMapError(error instanceof Error ? error.message : "Não foi possível abrir o mapa.");
    });

    return () => {
      disposed = true;
      if (map) map.remove();
    };
  }, [mappable, selectedSet]);

  return (
    <div className="fixed inset-0 z-[100] bg-slate-950/45 backdrop-blur-[2px]" role="dialog" aria-modal="true" aria-label="Mapa das hospedagens">
      <div className="absolute inset-2 overflow-hidden rounded-2xl border border-border bg-card shadow-2xl md:inset-5">
        <div className="absolute inset-x-0 top-0 z-[1001] flex items-center justify-between gap-3 border-b border-border bg-card/95 px-4 py-3 backdrop-blur">
          <div className="min-w-0">
            <h2 className="truncate text-base font-bold md:text-lg">Mapa das hospedagens</h2>
            <p className="text-xs text-muted-foreground">
              {mappable.length} com localização no mapa · {selectedIds.length} selecionadas
            </p>
          </div>
          <Button type="button" variant="outline" onClick={onClose} className="shrink-0 gap-2 rounded-xl">
            Fechar <X className="h-4 w-4" />
          </Button>
        </div>

        <div ref={mapEl} className="absolute inset-0 pt-[65px]" />

        {mapError && (
          <div className="absolute left-1/2 top-1/2 z-[1002] -translate-x-1/2 -translate-y-1/2 rounded-xl bg-card p-4 text-sm text-destructive shadow-xl">
            {mapError}
          </div>
        )}

        {!mapError && mappable.length === 0 && (
          <div className="absolute left-1/2 top-1/2 z-[1002] w-[min(90%,420px)] -translate-x-1/2 -translate-y-1/2 rounded-2xl bg-card p-6 text-center shadow-xl">
            <MapPin className="mx-auto mb-3 h-7 w-7 text-primary" />
            <h3 className="font-bold">Estas hospedagens não vieram com coordenadas.</h3>
            <p className="mt-2 text-sm text-muted-foreground">Faça uma nova busca de hotéis para carregar latitude e longitude reais.</p>
          </div>
        )}

        {active && (
          <aside className="absolute bottom-4 left-4 right-4 z-[1002] overflow-hidden rounded-2xl border border-border bg-card shadow-2xl md:bottom-auto md:right-auto md:top-24 md:w-[360px]">
            <button type="button" className="absolute right-2 top-2 z-10 rounded-full bg-card/90 p-1 shadow" onClick={() => setActiveId(null)} aria-label="Fechar hospedagem">
              <X className="h-4 w-4" />
            </button>
            <div className="grid grid-cols-[110px_minmax(0,1fr)] md:block">
              <div className="h-full min-h-[120px] bg-muted md:h-44">
                {active.image
                  ? <img src={active.image} alt="" className="h-full w-full object-cover" />
                  : <div className="grid h-full place-items-center text-muted-foreground"><MapPin /></div>}
              </div>
              <div className="min-w-0 p-3 md:p-4">
                <h3 className="pr-6 font-bold leading-tight">{active.name}</h3>
                <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{active.address}</p>
                {active.rating != null && <p className="mt-2 text-xs font-semibold">★ {active.rating.toLocaleString("pt-BR")}{active.reviewCount ? ` · ${active.reviewCount} avaliações` : ""}</p>}
                <div className="mt-3">
                  <strong className="text-xl text-navy">{brl(active.nightly)}</strong>
                  <span className="text-xs text-muted-foreground"> / noite</span>
                  <p className="text-xs text-muted-foreground">Total {brl(active.total)}</p>
                </div>
                <Button
                  type="button"
                  onClick={() => onToggle(active.id)}
                  variant={selectedSet.has(active.id) ? "outline" : "default"}
                  className="mt-3 w-full gap-2 rounded-xl"
                >
                  {selectedSet.has(active.id) ? <><Check className="h-4 w-4" />Selecionado · remover</> : <><Plus className="h-4 w-4" />Adicionar à proposta</>}
                </Button>
              </div>
            </div>
          </aside>
        )}
      </div>
    </div>
  );
}
