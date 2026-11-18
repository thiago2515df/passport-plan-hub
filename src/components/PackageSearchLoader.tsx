import { Plane } from "lucide-react";

export function PackageSearchLoader({ air = false }: { air?: boolean }) {
  return (
    <section role="status" aria-live="polite" className="mt-6 overflow-hidden rounded-3xl border border-primary/15 bg-gradient-to-b from-primary/[0.04] to-card px-6 py-12 shadow-sm">
      <style>{`
        @keyframes package-plane-flight {
          0% { transform: translateX(-92px) translateY(10px) rotate(-8deg); opacity: .15; }
          18% { opacity: 1; }
          48% { transform: translateX(0) translateY(-7px) rotate(0deg); opacity: 1; }
          82% { opacity: 1; }
          100% { transform: translateX(92px) translateY(7px) rotate(8deg); opacity: .15; }
        }
        @keyframes package-cloud-drift {
          0%,100% { transform: translateX(-7px); opacity: .25; }
          50% { transform: translateX(7px); opacity: .55; }
        }
        @media (prefers-reduced-motion: reduce) {
          .package-search-plane, .package-search-cloud { animation: none !important; }
        }
      `}</style>
      <div className="mx-auto flex max-w-xl flex-col items-center text-center">
        <div className="relative mb-5 h-24 w-64 overflow-hidden">
          <div className="package-search-cloud absolute left-5 top-12 h-2 w-16 rounded-full bg-primary/15" style={{ animation: "package-cloud-drift 2.8s ease-in-out infinite" }} />
          <div className="package-search-cloud absolute right-8 top-6 h-2 w-12 rounded-full bg-primary/10" style={{ animation: "package-cloud-drift 3.2s ease-in-out infinite reverse" }} />
          <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
            <Plane
              className="package-search-plane h-12 w-12 fill-primary/10 text-primary drop-shadow-sm"
              style={{ animation: "package-plane-flight 2.15s ease-in-out infinite" }}
            />
          </div>
        </div>
        <h2 className="text-xl font-bold text-foreground sm:text-2xl">Buscando melhores opções…</h2>
        <p className="mt-2 max-w-md text-sm leading-relaxed text-muted-foreground">
          {air
            ? "Consultando hotéis e voos ao mesmo tempo. Os resultados aparecem assim que a busca terminar."
            : "Consultando as melhores hospedagens disponíveis para as datas selecionadas."}
        </p>
        <div className="mt-5 flex items-center gap-1.5" aria-hidden="true">
          <span className="h-2 w-2 animate-pulse rounded-full bg-primary" />
          <span className="h-2 w-2 animate-pulse rounded-full bg-primary [animation-delay:180ms]" />
          <span className="h-2 w-2 animate-pulse rounded-full bg-primary [animation-delay:360ms]" />
        </div>
      </div>
    </section>
  );
}
