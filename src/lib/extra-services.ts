import type { ExtraService } from "./hotels";

/** Empty add-service rows are UI placeholders, not actual services. Never
 * silently discard a paid unnamed row: that could hide a charge from the
 * customer while keeping it in the package total. */
export function normalizeExtraServices(
  extras: ExtraService[] | undefined,
  context = "a proposta",
): ExtraService[] {
  return (extras ?? []).flatMap((item, index) => {
    const name = typeof item?.name === "string" ? item.name.trim() : "";
    const cost = item?.cost;
    if (typeof cost !== "number" || !Number.isFinite(cost) || cost < 0) {
      throw new Error(`Informe um valor válido para o serviço ${index + 1} de ${context}.`);
    }
    if (!name) {
      if (cost === 0) return [];
      throw new Error(`Preencha o nome do serviço adicional ${index + 1} de ${context} (valor de R$ ${cost.toFixed(2).replace(".", ",")}).`);
    }
    if (name.length > 120) {
      throw new Error(`O serviço adicional ${index + 1} de ${context} deve ter até 120 caracteres.`);
    }
    return [{ name, cost }];
  });
}
