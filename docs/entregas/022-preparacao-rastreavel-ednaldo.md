# 022 — Revisão do plano e preparação rastreável dos dados de Ednaldo

18/10/2026 — B02d, preparação de B15/B16/B18, RF03/RF04/RF13/RF14. Estado: preparação para revisão entregue; reparação/seleção dos dados e avaliação empírica pendentes.

## Plano revisado e decisões

A prioridade de 021 foi mantida: avançar os arquivos públicos E26 com rastreabilidade, preservando o método, os textos e a evidência existente. A inspeção mostrou aspas inválidas e trechos continuados em várias linhas; não há fundamento para um reparo global de aspas ou para usar linhas isoladas como base limpa. Também não há fundamento para tratar automaticamente as 13 histórias com múltiplos valores como erros: podem refletir classificação multirrótulo ou inconsistências, ainda a revisar.

A continuação entrega uma fila de revisão verificável e o rascunho da lista de critérios confirmados no CSV público. O [guia](../preparacao-dados-ednaldo.md) e o [protocolo](../../research/preparations/testrec-e26-v1/protocol.md) explicam a revisão e a próxima implementação. O atendimento às demandas do professor continua parcial, mantendo separados correção de software, preparação dos dados e validação científica.

## Implementação

- Módulo separado `apps/api/src/evaluation/testrec-source-preparation.ts`, sem modificar o parser geral, a auditoria B02c ou os executores científicos.
- Cobertura de todos os bytes do arquivo de associações por cabeçalho e unidades de linha física com faixas e hashes. As 57 unidades a revisar preservam texto bruto e contexto adjacente, inclusive continuações como 876–877.
- São 1.363 unidades físicas: 1.306 analisáveis em isolamento e 57 que exigem inspeção. Isso não representa quantos registros lógicos foram recuperados ou aprovados; essas contagens permanecem `null`. Nenhuma célula foi reparada e nenhum registro foi excluído.
- Perfis com 51 histórias incompletas e 13 com múltiplos valores, 53 identidades na união das duas condições. Linhas/ordinais e pares módulo/operação observados são preservados, sem fabricar combinações ou escolher vencedores. Duas identidades não correspondidas, em dez linhas de vínculos, ficam localizadas para revisão.
- Rascunho da taxonomia comum com os 59 critérios, como lista sem hierarquia. Descrições da fonte são copiadas exatamente, sem tradução/truncamento. O namespace local `ca_<ID literal>` atende ao schema existente; mapeamento original/local, ordinal e linha estão no relatório. IDs não são convertidos para números. O rascunho não é publicado nem vinculado automaticamente a uma definição.
- CLI `prepare:testrec-source` exporta diretório novo com relatório, rascunho e manifesto. Valida originais contra B02c e recusa sobrescrita. Replay confere fontes, bytes e conteúdo recalculado; mesmo uma descrição alterada com checksum recalculado não passa.

O [pacote preservado](../evidencias/b02d/manifest.json) tem relatório determinístico `e4a3c8211cc473354311c11cd413883339c0b8f0386ec55f75432b7611d0f669`. Usa arquivos locais, sem banco, rede, `.env` ou provedor.

## Verificações

- 124 testes API passaram, incluindo cinco novos sobre preservação de bytes/textos/IDs, cobertura física, CSV multilinha, pares observados e entradas inválidas. Build API passou.
- `check:testrec-preparation` passou: exportação, replay, repetibilidade entre exportações, não sobrescrita, corrupção do rascunho, descrição fabricada com checksum atualizado e divergência de fontes.
- Replay B02d passou; B02c, B18a e B14a preservaram os hashes anteriores.
- `check:scientific-index` conferiu 85 hashes do staged (77 fontes/dependências e oito artefatos), com bytes/finais de linha preservados. Whitespace de código/documentação passou; os CSVs originais continuam conferidos por hash e excluídos da formatação.

## O que falta e como continuar

Revisar os trechos junto ao contexto e confirmar limites dos registros; para reparos comprovados, registrar antes/depois e justificativa em transformação versionada. Manter sem decisão os casos sem evidência, em vez de preencher texto ou excluir silenciosamente. Resolver identidades/faltantes e classificação multirrótulo por fonte ou regra metodológica identificada.

Recorte experimental, domínio, catálogo completo de testes, código/folds e Q01–Q03 permanecem pendentes. Os 59 critérios não completam esses dados. Ainda faltam dados/protocolo empírico de Felipe, medição de configuração com participantes e o terceiro exemplo de Ademar sem US. B18 e as demandas globais do professor não estão concluídos por esta preparação.
