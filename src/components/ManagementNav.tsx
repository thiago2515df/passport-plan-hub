import { Link } from "@tanstack/react-router";
import { Building2, Settings, UserRound } from "lucide-react";
import logo from "@/assets/excursao-brasilia.png.asset.json";
import { Button } from "@/components/ui/button";

export function ManagementNav({ current }: { current: "settings" | "seller" }) {
  return <header className="border-b border-border bg-card"><div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-4 py-4 sm:px-8">
    <Link to="/"><img src={logo.url} alt="Excursão Brasília" className="h-16 w-auto" /></Link>
    <nav className="flex flex-wrap gap-1">
      <Button variant="ghost" asChild><Link to="/"><Building2 className="h-4 w-4" />Pacotes</Link></Button>
      <Button variant={current === "seller" ? "secondary" : "ghost"} asChild><Link to="/vendedor"><UserRound className="h-4 w-4" />Minha página</Link></Button>
      <Button variant={current === "settings" ? "secondary" : "ghost"} asChild><Link to="/configuracoes"><Settings className="h-4 w-4" />Configurações</Link></Button>
    </nav>
  </div></header>;
}