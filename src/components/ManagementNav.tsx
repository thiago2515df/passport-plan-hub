import { Link } from "@tanstack/react-router";
import { Building2, Settings, UserRound, Plane, Bus, Shield, PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { useState } from "react";
import logo from "@/assets/excursao-brasilia.png.asset.json";
import { Button } from "@/components/ui/button";
import { SignOutButton } from "@/components/AuthScreen";
import { useAccess } from "@/components/AccessProvider";

export function ManagementNav({ current }: { current: "settings" | "seller" | "packages" }) {
  const access = useAccess();
  const [collapsed, setCollapsed] = useState(false);
  const item = "w-full justify-start";
  return <aside className={`sticky top-0 flex h-screen shrink-0 flex-col border-r border-border bg-card p-2 sm:p-4 ${collapsed ? "w-16" : "w-16 lg:w-60"}`}>
    <Link to="/pacotes" className="mb-6 flex justify-center"><img src={logo.url} alt="Excursão Brasília" className={collapsed ? "h-10 w-10 object-contain" : "h-12 w-12 object-contain lg:h-24 lg:w-36"} /></Link>
    <Button variant="ghost" size="icon" className="mb-5 self-center" title={collapsed ? "Expandir menu" : "Recolher menu"} aria-label={collapsed ? "Expandir menu" : "Recolher menu"} onClick={() => setCollapsed(!collapsed)}>{collapsed ? <PanelLeftOpen /> : <PanelLeftClose />}</Button>
    <nav className={`space-y-2 ${collapsed ? "[&_span]:hidden" : "[&_span]:hidden lg:[&_span]:inline"}`} aria-label="Menu principal">
      <Button title="Pacotes" variant={current === "packages" ? "secondary" : "ghost"} className={item} asChild><Link to="/pacotes" search={{}}><Building2 /><span>Pacotes</span></Link></Button>
      <Button title="Aéreo" variant="ghost" className={item} asChild><Link to="/pacotes" search={{ mode: "air" }}><Plane /><span>Aéreo</span></Link></Button>
      <Button title="Rodoviário" variant="ghost" className={item} asChild><Link to="/pacotes" search={{ mode: "bus" }}><Bus /><span>Rodoviário</span></Link></Button>
      <Button title="Seguros — indisponível" variant="ghost" className={item} disabled><Shield /><span>Seguros</span></Button>
      <div className="my-4 border-t border-border" />
      <Button title="Minha página" variant={current === "seller" ? "secondary" : "ghost"} className={item} asChild><Link to="/vendedor" search={{ q: "" }}><UserRound /><span>Minha página</span></Link></Button>
      {access.admin && <Button title="Configurações" variant={current === "settings" ? "secondary" : "ghost"} className={item} asChild><Link to="/configuracoes"><Settings /><span>Configurações</span></Link></Button>}
    </nav>
    <div className="mt-auto overflow-hidden border-t border-border pt-4"><SignOutButton /></div>
  </aside>;
}