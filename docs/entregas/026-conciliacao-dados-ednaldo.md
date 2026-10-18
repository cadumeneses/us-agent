# 026 — Conciliação conservadora dos dados de Ednaldo

18/10/2026 — B02h, continuidade B15/B16/B18 e RF13/RF14. Estado: vínculos observados e fila de revisão entregues; campos/relações sem fonte e execução científica permanecem pendentes.

## Resultado

O módulo `testrec-data-reconciliation.ts` relaciona perfis, associações candidatas B02g e vínculos de critérios recentes, mantendo os papéis separados e todas as linhas. Materializa evidência para 339 chaves na união dos três papéis; 215 das 249 identidades presentes nas associações têm perfil observado. As outras 34 continuam sem perfil confirmado.

A [revisão de dados](../conciliacao-dados-ednaldo.md) identifica por que completar campos automaticamente não é sustentado: dos 76 registros sem ID padronizado, 18 encontram título igual com ID em outro contexto, mas nenhum no mesmo projeto; sete grupos de títulos iguais têm IDs distintos. Os critérios usam outro namespace e precisam de ponte documentada para testes. Os flags de mapeamento distinguem `Sim`, `Nao` e ausência, conservando a coocorrência por linha. Relações não observadas não viram listas sabidamente vazias.

O [CSV de revisão](../evidencias/b02h/review.csv) contém 119 entradas: 34 perfis ausentes, 76 IDs ausentes, sete grupos com IDs distintos para título igual e duas identidades de critérios sem perfil. São questões de revisão, não 119 erros comprovados ou correções aplicadas. Não houve criação de perfis, preenchimento de IDs, resolução de aliases, descarte ou importação operacional.

## Verificação

- 144 testes API passaram; build API passou. Seis novos testes verificam relações, faltantes, separação de namespaces, flags, sufixos, preservação de dados e rejeição de fontes ambíguas.
- `reconcile:testrec-data` exporta pacote/CSV e oferece replay exato; `check:testrec-reconciliation` verifica repetibilidade, corrupção, recusa de sobrescrita e substituição de papéis de origem.
- A referência RNF e os pacotes B02g/B14a/B18a permanecem preservados. Não houve mudança de método, interface, banco ou dados científicos congelados.
- O índice Git conferiu 120 hashes preparados com preservação de bytes; a checagem de whitespace passou, respeitando os CSVs de fonte/derivação já preservados. As alterações desta etapa estão em staged; os três PDFs locais continuam fora do Git.

Hash determinístico do relatório: `2952ffa07b0fdebd1b3f29ba6afd5f9477945ae9925da22c584aeee2d665b076`.

## Continuidade

A conciliação literal local está disponível; os reparos restantes exigem fontes adicionais. Priorizar ponte de IDs, domínio/perfis/catálogo, recorte/folds e Q01/Q03. Manter a divergência residual CT05 sem alterar a fonte. Avançar de forma independente no protocolo/instrumentação de configuração e na confirmação de materiais de Ademar/Felipe. Não ampliar ferramentas de auditoria sem evidência ou pergunta que possa mudar a prontidão científica. Esta entrega não conclui reprodução, avaliação empírica, terceiro caso sem US ou aceite da orientação.
