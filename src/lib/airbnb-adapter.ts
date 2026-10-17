import type { Hotel } from "./hotels";

/**
 * Contrato para o futuro conector de hospedagens Airbnb.
 * Nenhuma chamada à API é realizada neste módulo até recebermos a documentação
 * e as credenciais. Credenciais devem ficar somente no servidor.
 *
 * IMPORTANTE: confirme que a API/fornecedor autoriza pesquisa, exibição de
 * anúncios, preços e imagens antes de conectar.
 */
export type AirbnbSearchRequest = {
  destination: string;
  checkin: string;
  checkout: string;
  adults: number;
  childrenAges: number[];
  rooms: number;
};

export type AirbnbSearchResponse = {
  listings: Hotel[];
  error?: string;
};

/** Normaliza identificadores para evitar colisões com ofertas de hotéis. */
export function airbnbOfferId(providerListingId: string): string {
  return `airbnb:${providerListingId}`;
}

/**
 * Requisitos do adaptador real:
 * - autenticação e requests executados apenas no servidor;
 * - mapear preço total, moeda, impostos, taxas e política de cancelamento;
 * - converter valores para BRL antes de apresentar preços;
 * - preencher Hotel.provider='airbnb' e providerListingId;
 * - preservar o identificador único e a origem na proposta;
 * - respeitar termos de uso e disponibilidade do fornecedor.
 */
