import { Link } from "@tanstack/react-router";
import { Building2, Settings, UserRound, Plane, Bus, Shield, PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { useState } from "react";
import logo from "@/assets/excursao-brasilia.png.asset.json";
import { Button } from "@/components/ui/button";
import { SignOutButton } from "@/components/AuthScreen";
import { useAccess } from "@/components/AccessProvider";

export function ManagementNav({ current }: { current: "settings" | "seller" | "packages" | "aereo" }) {
  const access = useAccess();
  const [collapsed, setCollapsed] = useState(false);
  const item = "w-full justify-start";
  const mobileTitle = current === "packages" ? "Pacotes" : current === "aereo" ? "Aéreo" : current === "seller" ? "Minha página" : "Configurações";

  return <>
    <aside className={`sticky top-0 hidden h-screen shrink-0 flex-col border-r border-border bg-card p-4 lg:flex ${collapsed ? "w-16" : "w-60"}`}>
      <Link to="/pacotes" className="mb-6 flex justify-center"><img src={logo.url} alt="Excursão Brasília" className={collapsed ? "h-10 w-10 object-contain" : "h-24 w-36 object-contain"} /></Link>
      <Button variant="ghost" size="icon" className="mb-5 self-center" title={collapsed ? "Expandir menu" : "Recolher menu"} aria-label={collapsed ? "Expandir menu" : "Recolher menu"} onClick={() => setCollapsed(!collapsed)}>{collapsed ? <PanelLeftOpen /> : <PanelLeftClose />}</Button>
      <nav className={`space-y-2 ${collapsed ? "[&_span]:hidden" : "[&_span]:inline"}`} aria-label="Menu principal">
        <Button title="Pacotes" variant={current === "packages" ? "secondary" : "ghost"} className={item} asChild><Link to="/pacotes" search={{}}><Building2 /><span>Pacotes</span></Link></Button>
        <Button title="Aéreo" variant={current === "aereo" ? "secondary" : "ghost"} className={item} asChild><Link to="/aereo"><Plane /><span>Aéreo</span></Link></Button>
        <Button title="Rodoviário" variant="ghost" className={item} asChild><Link to="/pacotes" search={{ mode: "bus" }}><Bus /><span>Rodoviário</span></Link></Button>
        <Button title="Seguros — indisponível" variant="ghost" className={item} disabled><Shield /><span>Seguros</span></Button>
        <div className="my-4 border-t border-border" />
        <Button title="Minha página" variant={current === "seller" ? "secondary" : "ghost"} className={item} asChild><Link to="/vendedor" search={{ q: "" }}><UserRound /><span>Minha página</span></Link></Button>
        {access.admin && <Button title="Configurações" variant={current === "settings" ? "secondary" : "ghost"} className={item} asChild><Link to="/configuracoes"><Settings /><span>Configurações</span></Link></Button>}
      </nav>
      <div className={`mt-auto overflow-hidden border-t border-border pt-4 ${collapsed ? "[&_span]:hidden" : ""}`}><SignOutButton compact /></div>
    </aside>

    <section className="mobile-dashboard-header lg:hidden" aria-label="Navegação rápida">
      <Link to="/pacotes" search={{}} className="mobile-brand-link" aria-label="Ir para Pacotes">
        <img src={logo.url} alt="Excursão Brasília" className="mobile-dashboard-logo" />
      </Link>
      <div className="mobile-service-grid">
        <Link to="/pacotes" search={{}} className={`mobile-service-item ${current === "packages" ? "is-active" : ""}`}>
          <span className="mobile-service-icon"><Building2 /></span><span>Pacotes</span>
        </Link>
        <Link to="/aereo" className={`mobile-service-item ${current === "aereo" ? "is-active" : ""}`}>
          <span className="mobile-service-icon"><Plane /></span><span>Aéreo</span>
        </Link>
        <Link to="/pacotes" search={{ mode: "bus" }} className="mobile-service-item">
          <span className="mobile-service-icon"><Bus /></span><span>Ônibus</span>
        </Link>
      </div>
      <h1 className="mobile-section-title">{mobileTitle}</h1>
    </section>

    <nav className="mobile-bottom-nav lg:hidden" aria-label="Menu inferior">
      <Link to="/vendedor" search={{ q: "" }} className={`mobile-bottom-item ${current === "seller" ? "is-active" : ""}`}><UserRound /><span>Minha página</span></Link>
      {access.admin && <Link to="/configuracoes" className={`mobile-bottom-item ${current === "settings" ? "is-active" : ""}`}><Settings /><span>Configurações</span></Link>}
      <button type="button" disabled className="mobile-bottom-item mobile-bottom-disabled"><Shield /><span>Seguros</span></button>
      <div className="mobile-bottom-item mobile-signout"><SignOutButton /><span>Sair</span></div>
    </nav>
  </>;
}
