# Comissões de vendedores

O administrador configura e confirma as três regras de cada conta em **Configurações → Vendedores → Gerenciar → Comissões**. Contas novas já recebem as regras preenchidas no formulário de criação. Vendedores consultam as regras, mas não podem alterá-las, mesmo por uma chamada direta à API.

| Tipo da proposta | Regra aplicada |
| --- | --- |
| Sem transporte | Somente hotel |
| Hotel + aéreo ou apenas aéreo | Pacote com aéreo |
| Hotel + ônibus | Pacote terrestre |

Apenas uma regra é aplicada por alternativa. O custo reúne hospedagem, transporte e adicionais daquela alternativa. O percentual é acrescentado a esse custo; o valor fixo é acrescentado uma única vez. Exemplo: R$ 1.000 + 20% = R$ 200 de comissão e R$ 1.200 de preço final. **R$ 20 fixos não significa 20%.** Zero confirmado pelo administrador é válido; ausência de configuração não é zero.

As pesquisas de hotéis, Airbnb, Trivago, voos e destinos verificam a confirmação no servidor antes de consultar fornecedores. O RAV enviado ao fornecedor é zero: a comissão da agência é aplicada pelo cálculo compartilhado. A gravação de propostas também valida a conta responsável e a versão da comissão revisada. Um gatilho no banco protege gravações diretas e alterações concorrentes de comissão.

Aplicativo e web consultam o mesmo cadastro, com atualização ao recuperar o foco/conexão e a cada dez segundos enquanto a tela está aberta. Antes de gerar a proposta, o sistema consulta novamente a regra. Se ela mudou, mostra os valores novos e pede que o vendedor revise o resumo antes de gerar novamente. O quadro de propostas também atualiza as comissões e informa o valor por alternativa.

Os links públicos calculam propostas em aberto com as regras atuais e mostram apenas o preço final e os serviços do cliente. Comissão e custos internos ficam na área autenticada. A confirmação do cliente grava uma fotografia dos serviços, custos, regra e valor da comissão; pacotes aceitos permanecem com esses valores, inclusive se a configuração for alterada ou removida depois.

## Publicação

Aplicar `drizzle/migrations/0008_admin_confirmed_seller_commissions.sql` no banco Lovable Cloud deste projeto e publicar a aplicação correspondente. A migração está registrada no journal do Drizzle. Não usar outro projeto Supabase: o identificador deste repositório é `tpjihnmjdapzprwyefot`.

As comissões antigas mantêm seus tipos e valores. Como a versão anterior permitia alterações pelo próprio vendedor e não registrava o responsável, elas ficam pendentes até o administrador revisá-las e clicar em **Salvar e confirmar comissões**. Isso também vale para a conta do administrador. As propostas já aceitas mantêm suas fotografias de preço. Propostas abertas sem confirmação não publicam preços sem comissão.

O aplicativo Android utiliza a mesma aplicação hospedada; esta mudança não exige um novo APK.

Se o código for sincronizado antes da migração, o painel continua consultando os vendedores e o quadro continua exibindo as propostas, inclusive os detalhes de pacotes já aceitos. Registros antigos sem `hotel_kind`, `hotel_value` ou `configured_at` são reconhecidos como atualização pendente, preservando os valores existentes de aéreo e terrestre. Nenhum desses registros autoriza pesquisas ou geração de propostas. A tela informa a pendência do banco e impede salvar comissões ou criar contas que dependam desses campos até a atualização estar concluída. Falhas ao consultar vendedores são exibidas como falhas de consulta, nunca como zero vendedores cadastrados.

## Verificação local

Executar `npm test`, `npx tsc --noEmit` e `npm run build`.

O teste de PostgreSQL usa um banco isolado em memória, com papéis reais, RLS, gatilhos e as migrações 0005–0008. Instalar temporariamente `@electric-sql/pglite` com `npm install --no-save --package-lock=false @electric-sql/pglite` e executar `node scripts/test-commission-database.mjs`. Também é possível definir `PGLITE_MODULE` com a entrada ESM de uma instalação externa. O teste não usa credenciais, banco de produção ou APIs de fornecedores.
