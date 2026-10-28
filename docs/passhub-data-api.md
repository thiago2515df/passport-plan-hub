# Nova API de dados PassHub — integrada em modo leitura

Integração oficial da API de dados, diferente da API de pesquisa de passagens
e hospedagem que já existe em `src/lib/passhub.server.ts`.

## Segredo no Lovable

Cadastre **somente**:

```text
PASSHUB_DATA_API_KEY
```

Use como valor a chave gerada no painel da agência em **API de dados**.
**Nunca** cole a chave no GitHub, no chat, em código, APK ou navegador.

Não configure `PASSHUB_API_EMAIL`, `PASSHUB_API_PASSWORD` ou
`Authorization: Bearer` para esta integração. O servidor envia somente:

```http
X-Api-Key: <chave cadastrada como segredo>
```

Endereço fixo no código (não precisa configurar URL):
`https://partner-api.passhub.com.br`

## Endpoints de leitura ativos

| Módulo na interface | Listagem | Detalhe |
| --- | --- | --- |
| Aéreo | GET /v1/orders | GET /v1/orders/{orderId} |
| Ônibus | GET /v1/bus/orders | GET /v1/bus/orders/{orderId} |
| Locação | GET /v1/car/orders | GET /v1/car/orders/{orderId} |
| Hospedagem | GET /v1/hotel/orders | GET /v1/hotel/orders/{orderId} |
| Seguro | GET /v1/insurance/orders | GET /v1/insurance/orders/{orderId} |
| Links de pagamento | GET /v1/payment-links | GET /v1/payment-links/{linkId} |
| Usuários | GET /v1/users | Somente lista |

Tentativas de pagamento: `GET /v1/payment-links/{linkId}/payments`.

## Como usar

1. Publique o commit atualizado no Lovable.
2. Cadastre o segredo `PASSHUB_DATA_API_KEY`.
3. Abra **Configurações > API PassHub** como administrador.
4. Clique em **Atualizar status** e depois **Testar conexão**.
5. Escolha o módulo e navegue pelas listagens (20 registros por página).
6. Abra os detalhes e, para links, as tentativas de pagamento.

As consultas são **sob demanda**, não automáticas ou em segundo plano.

## Limites e segurança

- 60 requisições por minuto por chave (limite PassHub).
- Defesa preventiva por instância de servidor: 55 por minuto. Se outras
  instâncias/clientes utilizarem a mesma chave, ainda é possível receber 429
  da PassHub; o sistema informa o `Retry-After`.
- A API aceita `pageSize` entre 1 e 100 e `page` começando em 1.
- A listagem de produtos tem janela de criação de 24 meses; detalhes por ID
  ainda podem estar disponíveis; links de pagamento não têm essa janela.
- A API de dados mascara CPF; IDs de bilhetes, documentos, checkout/PDF e
  certos links são omitidos pela PassHub. O painel não tenta reconstruí-los.
- Acesso restrito ao **administrador autenticado** via Supabase. Vendedores
  e clientes não recebem os registros.
- Consultas apenas GET; nenhuma reserva, emissão ou cobrança é criada,
  alterada ou cancelada por esse módulo.
- A interface não mostra a chave; o servidor não registra corpos com PII.
- A nova conexão não altera `PASSHUB_API_KEY` nem a busca de hotéis/voos.

**Formato de dados:** o guia informa que as respostas seguem os formatos
dos recursos pagos da PassHub. A lista exibe campos comuns de identificação,
status e nome; a página de detalhes mostra o objeto JSON completo somente
ao administrador, porque não foram fornecidos exemplos completos dos schemas
de cada produto. Não há criação de vínculo automático com propostas existentes.
