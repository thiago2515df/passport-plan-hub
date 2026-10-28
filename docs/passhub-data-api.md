# PassHub — nova API de dados (somente leitura)

Esta integração é **separada** da API de pesquisa de hotéis/voos já utilizada em
`src/lib/passhub.server.ts`. Não altere `PASSHUB_API_KEY`,
`PASSHUB_API_EMAIL` ou `PASSHUB_API_PASSWORD` para conectar o novo serviço.

## 1. Segredo no Lovable

Em **Secrets**, cadastre o segredo:

- `PASSHUB_DATA_API_KEY` — chave gerada em **PassHub > API de dados**

Não coloque o valor no GitHub, código-fonte, arquivos .env versionados,
navegador, prints ou conversa. Caso a chave vaze, revogue-a na PassHub.

## 2. Guia técnico necessário

A tela que exibe **Abrir o guia** demonstra as categorias (reservas, emissões,
links de pagamento e usuários), mas **não informa a URL base, caminhos de
consulta, formato de autenticação, paginação ou modelos de resposta**. Não
existe mapeamento confiável dessas rotas no material atualmente recebido.

Ao receber o guia oficial, complete no ambiente do servidor:

| Variável | Descrição |
| --- | --- |
| `PASSHUB_DATA_API_BASE_URL` | URL HTTPS oficial da API de dados em domínio passhub.com.br |
| `PASSHUB_DATA_API_AUTH_HEADER` | `Authorization` ou `X-Api-Key` **conforme guia** |
| `PASSHUB_DATA_API_AUTH_PREFIX` | Prefixo previsto no guia: `Bearer ` ou vazio |
| `PASSHUB_DATA_RESERVATIONS_PATH` | Caminho da consulta de reservas |
| `PASSHUB_DATA_ISSUANCES_PATH` | Caminho da consulta de emissões |
| `PASSHUB_DATA_PAYMENT_LINKS_PATH` | Caminho da consulta de links de pagamento |
| `PASSHUB_DATA_USERS_PATH` | Caminho da consulta de usuários |

Os caminhos acima são **configurações pendentes**, não endpoints que
afirmamos existir. A API recusa consultas enquanto estes dados não forem
configurados. O cliente usa GET e bloqueia redirects para evitar vazamentos
de credenciais.

## 3. Painel de configuração

Em **Configurações > API PassHub**, somente administradores podem conferir
se a chave e os endpoints estão presentes e testar a autenticação.

O teste retorna somente status genérico, não documentos ou dados de clientes.

## 4. Antes de habilitar sincronização real

Depois do guia:
1. Confirmar nome e versão das rotas, cabeçalhos, paginação e limites.
2. Implementar validadores tipados para reservas, emissões, links e usuários.
3. Restringir acesso aos dados a funções administrativas com paginação.
4. Definir mapeamento de IDs, reconciliação e política de retenção LGPD.
5. Testar conta e endpoints reais **apenas depois que a chave for cadastrada**.

Nenhuma emissão, reserva ou cobrança será criada ou modificada por esta API
de **leitura**. A integração de busca atual permanece intacta.
