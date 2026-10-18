# ADR 006 — Avaliações e cópias de testes separadas do resultado

Data: 18/10/2026. Estado: implementada em B17b. Complementa a ADR 004 e o contrato E21, sem alterar o método de recomendação.

A avaliação é um julgamento humano sobre um item recuperado. Aceitar/rejeitar não recalcula o ranking, não modifica o catálogo e não equivale a relevância de referência para um experimento. A autoria disponível continua técnica (`local-development`/`internal-api`); identificação pessoal e isolamento organizacional permanecem em B13b/B13c.

O destino suportado nesta etapa é a **entrada preservada da execução**, confirmada explicitamente. Seus atributos e sua identidade ficam em snapshot, com escopo derivado da definição e da entrada. IDs importados não identificam histórias operacionais automaticamente. Não foram criados vínculos RNF ou um cadastro de destinos externos; esse refinamento limita o trabalho ao requisito de avaliação/cópia rastreável, sem ampliar a plataforma operacional.

Cada teste recebe uma decisão imutável por execução, com observações, hashes do resultado/destino e item original completo. Repetir uma requisição equivalente é idempotente; uma decisão diferente exige outra execução. Decisões de execuções distintas permanecem independentes.

Somente um teste aceito pode originar uma cópia. O usuário pode copiar sem editar ou adaptar **título e Gherkin**, sempre com motivo. ID de origem, propósito, modo de execução e metadados não são substituídos pelo cliente. A cópia mantém item original, catálogo, execução, decisão, destino, ator técnico, data, versão e alterações antes/depois. Ela não altera a base publicada nem passa a ser um teste do catálogo automaticamente.

Uma nova revisão referencia ID/hash da última cópia. Locks por decisão e restrição de unicidade mantêm uma cadeia linear: duas gravações sobre a mesma versão têm um único vencedor. A outra recebe conflito; o rascunho permanece na interface. Repetir o mesmo UUID/corpo recupera o registro original, inclusive depois de novas revisões. Conteúdos, decisões e revisões não podem ser atualizados ou excluídos.

Histórico e exportação preservam as versões; o histórico é paginado. A exportação da interface inclui execução, destino e a página de avaliação/cópias exibida, com contagem/offset explícitos. Retirar dependências impede novas recomendações, mas não apaga a avaliação ou o replay históricos.

Essa decisão atende à adaptação humana rastreável de RF11. Não introduz geração automática de testes, novos algoritmos, conversão Euclidiana presumida, destinos fictícios ou avaliação empírica. Q01–Q05 e dados/protocolos dos artigos permanecem separados.
