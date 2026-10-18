# Avaliações e cópias versionadas de testes

Data: 18/10/2026. B17b, [entrega 019](entregas/019-revisao-plano-e-avaliacoes-testes.md) e [ADR 006](decisoes/006-avaliacoes-e-copias-testes.md).

Após executar a demonstração E21, abrir **Assess tests and preserve adapted copies** e confirmar a entrada preservada como destino. Cada item permite observações e **Accept test** ou **Reject test**. O julgamento é imutável e independente do score. Reavaliar exige outra execução.

Um teste aceito oferece **Copy or adapt accepted test**. Título/Gherkin começam com o conteúdo original ou da última cópia; informar um motivo e salvar uma revisão imutável. Os demais campos e a identidade de origem permanecem preservados. **New copy revision** inicia outra revisão a partir da última versão carregada. O original recuperado e sua contribuição no ranking continuam iguais.

Falha de rede conserva valores e UUID para repetir o pedido. Alterar conteúdo cria outro UUID. Conflito de revisão conserva o rascunho; atualizar o histórico e iniciar a edição da última revisão evita sobrescrever outra alteração. **Cancel copy edit** descarta somente a edição local não salva.

Cada revisão mostra motivo, ator técnico, data, hash, referência anterior e alterações. Histórico é paginado em cinco revisões na interface. **Download this assessment page** exporta execução, destino e a página de decisões/cópias exibida, com total/offset; não afirma exportar páginas ainda não carregadas. Histórico e replay continuam acessíveis após retirar definição, base ou catálogo.

## Contrato de API

Base: `/api/internal/test-case-reviews`, sob o perímetro global já existente. Aplicar a migration 024 antes de usar este fluxo em outro ambiente. As rotas RNF permanecem separadas e recusam execuções de teste.

| Operação | Endpoint e corpo |
| --- | --- |
| Consultar destino | `GET /:runId` → execução/hash e destino confirmado ou `null`. |
| Confirmar entrada | `POST /:runId/target` com `runSha256` e `target: {kind:"input"}`. |
| Decidir | `POST /:runId/decisions` com `id` UUID, `runSha256`, `targetSha256`, `itemKey`, `decision` (`accepted`/`rejected`) e `notes`. |
| Criar revisão | `POST /:runId/copies` com `id` UUID, hashes da execução/destino, `decisionId`, `itemKey`, `previousCopy` (`null` ou `{id,sha256}`), `title`, `gherkin` e `reason`. |
| Consultar item/histórico | `GET /:runId/items/:itemKey?limit=5&offset=0`; limite de 1 a 20, máximo de offset 100000, decisão original e revisões em ordem decrescente. |

Não são aceitos campos de substituição de origem/metadados, IDs de classificação operacional ou cópias de testes rejeitados. Chaves/hashes errados falham antes da gravação. Uma decisão conflitante ou uma cópia baseada em versão anterior à última retorna 409. Requisições semanticamente inválidas retornam 422. Os UUIDs são idempotentes; uma repetição equivalente não gera nova decisão/revisão.

A migration cria `test_case_run_targets`, `test_case_item_decisions` e `test_case_adapted_copies`, com referências, unicidade e triggers de imutabilidade. Não altera as tabelas RNF, a base rotulada, os catálogos ou o conteúdo das execuções anteriores. Cópias não são materializadas em histórias operacionais; seu destino nesta etapa é a entrada exata já preservada.

## Verificação

```powershell
npm.cmd run build
npm.cmd run check:test-case-reviews
npm.cmd run check:test-case-reviews -- --replay docs/evidencias/b17b/assessment-integration.json
npm.cmd run check:testrec-browser
```

O primeiro check HTTP usa apenas PostgreSQL local explícito e schema aleatório descartável. Verifica concorrência, repetição, conflito, revisão linear, isolamento de referências, rollback, histórico, retirada e ausência de materialização RNF. O pacote pode ser reconstruído offline pelos construtores de evidência, sem banco. Exportar um pacote novo exige `--output caminho-novo.json` e não sobrescreve arquivos existentes.

O check de navegador percorre configuração/importação/execução, confirma o destino, aceita/rejeita, cria duas revisões e exporta a avaliação. As [capturas desktop](evidencias/b17b/desktop-assessment.png) e [mobile](evidencias/b17b/mobile-assessment.png) foram inspecionadas. O [pacote HTTP](evidencias/b17b/assessment-integration.json), o [resumo do navegador](evidencias/b17b/browser-summary.json) e o [inventário da migration local](evidencias/b17b/local-migration.json) registram as evidências.

São verificações técnicas com dados sintéticos. Aprovação humana de um teste não é precisão/recall experimental, e a adaptação não muda as equações E21. Q01/Q02 e avaliação empírica de Felipe/Ednaldo continuam pendentes.
