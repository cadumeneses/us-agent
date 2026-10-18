# 020 — Revisão do plano e avaliador técnico do segundo exemplo

18/10/2026 — B18a, RF13/RF14 e preparação de RQ05. Estado: preparação técnica entregue; B18 empírica em andamento.

## Aderência e decisão

O documento de requisitos fornecido pelo usuário foi relido como evidência dos pedidos, distinguindo solicitações dos áudios e propostas de aceite. Plano, workflow e pendências continuam alinhados ao recorte KNN, recomendadores configuráveis e três exemplos. B17 já entrega o recorte técnico da demonstração de testes; a próxima lacuna relevante é avaliar o segundo exemplo e medir configurabilidade, conforme A2/A5. Esta entrega prepara o avaliador, sem apresentar os ensaios artificiais como qualidade empírica ou aprovação do professor.

O plano corrente foi atualizado para B18a: permanecem fontes/dados/protocolo empírico de Felipe/Ednaldo e confirmação de Ademar. Q01 (transformação Euclidiana), Q02 (CT01), Q03 (convenções/folds) e demais questões de fontes continuam abertas. A demonstração Manhattan mantém identidade própria e os snapshots científicos anteriores.

## Implementação

- Avaliador separado em `apps/api/src/evaluation/testrec-evaluation.ts`, composto sobre o executor publicado preservado. Reutiliza os cálculos de contagens RNF sem converter testes em RNFs ou usar scores como relevância.
- Julgamentos artificiais separados em `research/pilots/testrec-v1/annotations.json`, vinculados à publicação exata do catálogo. IDs desconhecidos/duplicados ou hash divergente invalidam a referência. Julgamentos não são extraídos de ranking, aceitação/cópias B17b ou enviados ao executor.
- Holdout por identidade/história/grupo declarado, cobertura exata dos registros e saída do alvo retirada antes da execução. Vazamento invalida o ensaio antes da execução; igualdade de atributos entre histórias distintas é permitida. Grupos declarados não comprovam independência real.
- Seis cenários sintéticos, duas repetições: três completos, um sem itens, um bloqueado e uma falha técnica esperada. Cinco julgados e um sem referência. Bloqueios/falhas têm predição vazia e conservam FN quando julgados; referência vazia conhecida difere de `null`.
- TP/FP/FN, precision/recall/F1/F2, micro/macro com denominadores definidos e cobertura. Sem limiar/top-N adicional. Contagens artificiais agregadas TP=3, FP=1, FN=2 servem somente como verificação aritmética.
- CLI exporta bundle, relatório, CSV e manifesto de fontes/ambiente/estado Git. Recusa sobrescrever evidências. Replay valida bytes, conteúdo determinístico, protocolo, gate e CSV. Tempos observacionais ficam separados e não fundamentam desempenho.

O [protocolo](../../research/pilots/testrec-v1/protocol.md) e o [guia](../avaliacao-testes.md) detalham convenções e limites. O pacote está em [manifest.json](../evidencias/b18a/manifest.json); hash determinístico do relatório: `3055cfd093d8fdb772fb29cea4da81cef8a448bf1e282a0b9721dfe30d43534f`.

## Verificação

- 116 testes API passaram, incluindo sete testes novos sobre contagens, repetibilidade, isolamento dos julgamentos, vazamento, catálogo e cenários inválidos.
- Build API passou. Este incremento é local/offline; os fluxos web e banco preservam a verificação registrada em 019.
- `check:testrec-evaluation` passou: exportação, replay exato, repetibilidade entre exportações, não sobrescrita, CSV/relatório corrompidos, vazamento na entrada e fontes divergentes.
- Replay do pacote B18a passou. Os replays B14a RNF, B16a equações, B16b execuções E21 e B17b decisões/cópias mantiveram seus hashes anteriores.
- `check:scientific-index` verificou 71 hashes do staged (65 fontes e seis artefatos) com finais de linha preservados. A conferência de whitespace do staged passou, considerando CRLF nos arquivos científicos preservados.

## O que falta

B18 não está concluída: faltam protocolo empírico confirmado, dados/autorização, referências de relevância independentes e auditadas, partições justificadas e resultados por alvo/fold. Também faltam protocolo e estudo de tempo/erros/intervenções de configuração com participantes. Os dados e protocolo empírico de Felipe continuam pendentes; os ensaios sintéticos dos dois recomendadores não resolvem essas lacunas. Confirmar referência/dados de Ademar e entregar o terceiro exemplo sem US em B19–B21; consolidar avaliação integrada em B22–B23.

Login pessoal e isolamento organizacional permanecem condicionantes antes de uso protegido de bases restritas/multiusuário. Nenhum novo algoritmo, provedor, destino operacional ou migração faz parte deste incremento. As adições anteriores e o idioma integrado permanecem preservados.
