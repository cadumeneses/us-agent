# 024 — Revisão e comparação de versões publicadas dos dados E26

18/10/2026 — B02f, preparação de B15/B16/B18 e RF13/RF14. Estado: fontes adicionais e comparação reproduzível entregues; decisões de adoção/reparação e avaliação científica pendentes.

## Fonte adicional que mudou a continuidade

A revisão de B02e confirmou que a regra literal anterior não cobre IDs com aspas, identidades ambíguas e fragmentos multilinha. Antes de ampliar transformações locais, foi consultada a [API de versões do Zenodo](https://zenodo.org/api/records/16133793/versions). Ela retornou os registros 16131517, 16133229 e 16133793, ligados ao conceito citado em E26.

Os quatro CSVs do [registro 16133229](https://zenodo.org/records/16133229) foram baixados, com licença declarada CC BY 4.0, e verificados por tamanho, MD5 publicado e SHA-256 local. Atribuição: **Anonymous, Anonymous**, conforme metadados. Arquivos e inventário ficam separados da versão mais recente; a resposta bruta da consulta também foi preservada. Os três arquivos anunciados por 16131517 tiveram apenas seus checksums publicados comparados; não foi afirmado download/verificação local de seus bytes.

## Achados e decisão

- `cas2.csv` anterior e `acceptance_criteria_data.csv` recente são idênticos byte a byte, com os 59 critérios. A procedência do rascunho B02d fica corroborada por ambas as versões.
- `uss.csv` e `usscas.csv` anteriores têm bloqueios de parse nas linhas 48 e 100; suas correspondentes recentes são analisáveis. Trocar o conjunto inteiro pela versão mais antiga não resolve a preparação.
- Entre as 51 posições pendentes, vinte têm ID final numérico simples na fonte anterior onde a recente apresenta aspas. O relatório conserva valores/segmentos e localizações nas duas versões; são candidatos com fonte, não substituições aprovadas.
- Nove pares multilinha da versão anterior são decodificáveis pelo parser existente, com IDs consecutivos no contexto. Valores exatos, inclusive a quebra de linha do título, ficam preservados. Isso decodifica aqueles trechos da versão anterior, sem recuperar automaticamente registros da mais recente.
- Das 57 posições comparadas, 28 têm segmentos de identidade alinhados (incluindo seis de B02e), 11 apresentam diferenças nesses segmentos e 18 integram os nove pares multilinha. Diferenças de identidade não são fundidas.

As versões consultadas listam CSVs, sem código/scripts/folds nessa listagem; isso não demonstra inexistência em outro local. Q01–Q03, recorte, catálogo completo e demais dados continuam pendentes. Nenhuma versão recebe precedência automática, nenhum campo é completado e nenhuma base híbrida é criada silenciosamente.

## Desenvolvimento

O módulo `testrec-source-versions.ts` compara arquivos/fontes e conserva diagnósticos e referências de bytes, distinguindo segmentos literais de células efetivamente decodificadas. O [plano](../../research/comparisons/testrec-e26-v1/comparison-plan.json) fixa as posições/grupos revisados; o [protocolo](../../research/comparisons/testrec-e26-v1/protocol.md) identifica limites de fonte, comparação e futura adoção.

`npm.cmd run compare:testrec-sources -- --replay docs/evidencias/b02f` refaz o [pacote](../evidencias/b02f/manifest.json); `check:testrec-source-versions` verifica arquivos, repetibilidade e adulteração. Execução é offline, com fontes locais verificadas, diretório novo e recusa de sobrescrita. A comparação não modifica originais, derivados, banco, interface ou métodos científicos.

Hash determinístico do relatório: `a471c42d63bfbd3e5c8d68cbc63d58b12412d16206045f0a1726fa7a7337e4ab`. O [guia](../comparacao-versoes-ednaldo.md) organiza resultados e próxima revisão.

## Verificação

- 132 testes API passaram, incluindo quatro novos sobre igualdade real de bytes, limites das versões, candidatos sem adoção automática, grupos/contexto e seleções incompatíveis. Build API passou.
- `check:testrec-source-versions` passou: replay exato, exportações repetidas, não sobrescrita, relatório corrompido, decisões fabricadas com checksum atualizado e fonte anterior divergente.
- A primeira execução do teste de adulteração expôs um diagnóstico excessivo ao comparar buffers grandes. A CLI passou a verificar igualdade exata por booleano, com erro curto; o pacote foi regenerado e o check completo passou. A exportação/CLI iniciais foram preservadas em `tmp`; o hash determinístico da comparação permaneceu igual.
- Replay B02f passou; B02e, B14a RNF e B18a testes conservaram hashes anteriores.
- `check:scientific-index` conferiu 105 hashes do staged (96 fontes/dependências e nove artefatos), com bytes/finais de linha preservados. Whitespace de código/documentação passou; os CSVs das duas versões e o derivado B02e são preservados/conferidos por hash, sem formatação de seus espaços.

## Próximo passo e critérios ainda abertos

Revisar os vinte candidatos e os nove grupos com a fonte anterior. Declarar explicitamente versão adotada ou derivação local nomeada, com plano antes/depois e justificativas, sem selecionar dados para forçar contagens/métricas do artigo. As 51 posições pendentes não foram alteradas por esta comparação.

Continuam necessários os demais campos/identidades, recorte/código/folds e decisões científicas de Q01–Q03 antes do ensaio empírico. Dados/protocolo de Felipe, estudo de configuração com participantes e exemplo Ademar sem US permanecem no plano. O atendimento global às demandas do professor continua parcial; comparação de fontes e aprovação dos testes não equivalem a aprovação científica da orientação.
