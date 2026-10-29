/**
 * Etapas do quadro de propostas. Browser-safe: usado pelo Kanban do vendedor e
 * pela página pública que o cliente abre pelo link.
 */
export type ProposalStatus = "created" | "awaiting" | "approved" | "cancelled" | "archived";

/** Propostas que saem do quadro e vão para o Arquivo. */
export const isArchived = (status: string) => status === "cancelled" || status === "archived";

/** O que a pessoa vê ao abrir um link que já não está disponível. */
export function customerNotice(state: string): { title: string; text: string } | null {
  if (state === "archived") {
    return {
      title: "Proposta arquivada",
      text: "Esta proposta foi arquivada pela nossa equipe. Fale com o seu agente de viagens para receber uma nova cotação.",
    };
  }
  if (state === "cancelled" || state === "expired") {
    return {
      title: "Esta proposta está vencida",
      text: "Esta proposta não está mais válida. Procure o seu agente de viagens para receber uma nova cotação atualizada.",
    };
  }
  return null;
}
