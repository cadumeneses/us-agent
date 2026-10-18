# 025 — Associações públicas legíveis e revisão visual dos exemplos

18/10/2026 — B02g, continuidade B15/B16/B18, RF13/RF14. Estado: derivação candidata integralmente analisável e revisão visual/aritmética entregues; execução científica e avaliação empírica continuam pendentes.

## Resultado

O registro 16133793 indicado pelo usuário permanece principal. O CSV original inválido não foi alterado: a [derivação nomeada](../dados-ednaldo-derivacao-revisada.md) conserva a escolha explícita de 42 registros da versão anterior, nove deles multilinha, e seis codificações de títulos literais recentes. Plano, células adotadas, bytes anteriores, hashes e justificativas ficam no ledger. São 48 patches cobrindo as 57 posições físicas; nenhum registro é descartado. A inversão recupera exatamente o original recente.

A saída passa no parser CSV estrito inteiro: 1.354 registros, 249 chaves história/projeto e 17 projetos. Permanecem 76 registros sem ID padronizado e 34 chaves sem perfil correspondente; a população experimental e os artefatos completos ainda não foram identificados. Sintaxe resolvida na derivação não equivale a semântica ou base científica pronta.

A conferência visual de E21 figuras 4.8/4.9 e E26 figura 3 esclarece CT01/TC01=0,42 por duas contribuições. Também corrige a interpretação anterior de IDs trocados entre tese/artigo: a diferença considerada era entre versões do exemplo com/sem heurística. As figuras com heurística concordam. A figura 4.8 mantém uma divergência CT05=0,25 impresso versus 0,29 calculado com a aresta/peso ilustrativos. PDFs originais e pacotes históricos permaneceram preservados.

## Implementação e verificação

- `testrec-reviewed-associations.ts`: aplicação do plano, vínculos a duas fontes, preservação de texto e checagem integral/inversa.
- `testrec-figure-review.ts`: transcrição versionada, seleção com núcleo KNN existente e agregação existente; pesos ilustrativos, sem presumir a transformação Euclidiana.
- `prepare:testrec-reviewed`: exportação em diretório novo e replay offline; `check:testrec-reviewed` verifica repetibilidade, recusa de sobrescrita e corrupção de relatório/CSV, incluindo checksum atualizado para conteúdo adulterado.
- 138 testes API passaram; build API passou. Oito resultados RNF e replays dos pilotos RNF/testes permaneceram iguais; o novo pacote teve replay exato e PDFs E21/E26 conferidos por hash.
- Replays B16a/B16b/B02f permaneceram iguais. A verificação do índice Git conferiu 114 hashes preparados, com preservação de bytes; nenhum arquivo rastreado ficou fora de staged. Os três PDFs locais continuam fora do Git.

Hash determinístico do relatório: `ea1057d7202f5751ff263a792eab9a01f91a8eddb4aa2a8ecc7b66194d8227bb`.

## Continuidade

Conciliar campos/relações agora legíveis e confirmar Q01, catálogo, recorte/folds/código e Q03 antes de qualquer alegação de reprodução. Q02 tem o recorte ilustrativo de CT01 e heurística esclarecido; CT05 da figura 4.8 segue divergente. Fonte/dados de Felipe, método/material de Ademar, estudo de configuração e avaliação integrada continuam abertos. Não houve mudança de interface, método publicado, fórmulas, banco operacional ou fontes congeladas. A revisão é técnica; não constitui aprovação científica da orientação.
