import { createFileRoute } from "@tanstack/react-router";
import { AuthScreen } from "@/components/AuthScreen";
export const Route = createFileRoute("/auth")({
  head: () => ({ meta: [{ title: "Entrar — Excursão Brasília" }, { name: "description", content: "Acesso da equipe da Excursão Brasília." }, { property: "og:title", content: "Entrar — Excursão Brasília" }, { property: "og:description", content: "Acesso seguro para administradores e vendedores." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }, { name: "robots", content: "noindex, nofollow" }] }),
  component: AuthScreen,
});