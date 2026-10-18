# Entrega 012 — Piloto técnico de avaliação RNF

Data: 17/10/2026. Escopo: **B14a**, início de RF13 e preparação de RQ05. Mantém a prioridade definida na [revisão de escopo](../revisao-de-escopo.md): avaliação e exemplos científicos. B14 permanece em andamento.

## Resultado

O projeto tinha comparações com saídas congeladas e replay de execuções, mas faltava um processo que exportasse unidades de avaliação, contagens, convenções e falhas. Agora `evaluate:rnf` executa um [protocolo versionado](../../research/pilots/rnf-v1/protocol.md), exporta pacote/relatório/CSV/manifesto e verifica sua reexecução exata. A [documentação operacional](../avaliacao-rnf.md) descreve o uso.

Oito cenários preservam a compatibilidade do software. Outros cinco, com anotações sintéticas declaradas separadamente, verificam precisão, revocação, F1, F2, micro/macro e cobertura. Não há referência de relevância empírica: os números desses cinco cenários verificam o cálculo, sem medir a qualidade em projetos reais. As anotações não são passadas ao executor, e sua alteração não modifica a recomendação.

Os cenários de relevância recusam alvo presente na base por IDs ou texto duplicado normalizado e exigem seus RNFs de saída vazios na entrada. A referência de compatibilidade conserva o cenário que inclui o próprio alvo para verificar a exclusão do legado; ele não entra nas métricas de relevância. Não houve mudança na política RNF.

## Evidências

| Verificação | Resultado |
| --- | --- |
| Suíte API | 86 testes passaram, incluindo sete novos sobre contagens, divisões por zero, médias, falhas, vazamento e separação entre anotação/resultado. |
| Build API | Compilação TypeScript passou, incluindo os módulos de avaliação. |
| Piloto | 13 pares cenário/alvo, duas repetições por cenário, 26 execuções em memória. Os cenários compartilham perfis sintéticos; não são 13 observações estatisticamente independentes. |
| Compatibilidade | Oito de oito resultados integrais conservaram os hashes do oráculo congelado. |
| Estados contabilizados | Oito `completed`, um `blocked`, um `no_candidates`, dois `no_items` e uma `technical_failure` intencional por tipo inválido. Zero falhas técnicas inesperadas. |
| Métricas sintéticas | Contagens agregadas dos cinco cenários anotados: TP=1, FP=2, FN=3. Valores micro/macro e seus denominadores constam do relatório. Não são estimativas de desempenho do RNF em dados reais. |
| Determinismo | Duas repetições por cenário iguais; nova avaliação do mesmo pacote preservou o hash determinístico. Tempos permanecem separados. |
| Exportação/replay | `check:rnf-evaluation` verificou exportação, entrada por pacote explícito, replay, recusa de sobrescrita, CSV corrompido, regressão do oráculo e vazamento da saída do alvo. |
| Artefatos preservados | Replay de `docs/evidencias/b14a` passou após copiar os arquivos finais; SHA-256 determinístico `d26d28d5ee2da92f6449fe8fb18ed2bfdfd55192bb3a96fdb0a3e8b58a89a3dd`. |
| Legado | Sete hashes dos arquivos congelados permanecem iguais. Sem alteração de fórmulas, resultados esperados, interface, rotas, migrations ou dados operacionais. |

Artefatos: [pacote](../evidencias/b14a/bundle.json), [relatório](../evidencias/b14a/report.json), [tabela por alvo](../evidencias/b14a/targets.csv) e [manifesto](../evidencias/b14a/manifest.json). Os envelopes de definição/base são locais, construídos com validação do importador/executor existente, sem inserir publicações no banco.

Os tempos registrados são observações de execução em memória, incluindo validação e snapshots. Não medem configuração humana, publicação, rede, banco ou usabilidade. O manifesto identifica o checkout com alterações locais e os hashes das fontes; não contém uma distribuição completa dessas fontes. Reexecutar exige essa árvore e suas dependências. O arquivamento distribuível do software permanece em B22–B23.

Esta etapa não acessou `.env`, produção, banco ou provedores; não instalou dependências nem fez deploy. A interface não foi modificada, portanto não houve novo ensaio de navegador nesta entrega. Os resultados de navegador da entrega anterior não são apresentados como verificações novas.

## Continuidade com foco científico

B14a conclui a ferramenta/protocolo do piloto técnico sintético. **B14 não está concluída:** faltam dados reais/autorizados, referências de relevância, protocolo empírico alinhado ao estudo de Felipe, medidas de configuração com participantes e ensaios de volume/ambiente que fundamentem metas.

As decisões sobre os trabalhos de Felipe e Ednaldo continuam na [matriz de fidelidade](../referencias-e-fidelidade.md). F2 no avaliador não implementa o recomendador de Ednaldo nem resolve Q01–Q03. Não foram obtidas novas fontes científicas nesta entrega. A próxima frente é fechar dados/protocolo empírico do RNF e as fontes/atributos necessários ao segundo exemplo, avançando o que for independente de materiais ainda indisponíveis. Login e organizações continuam pendentes antes de bases restritas, sem bloquear esses trabalhos locais permitidos.
