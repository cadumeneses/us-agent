# Protocolo RNF — piloto técnico sintético v1

ID: `rnf-synthetic-pilot-v1`. Avaliador: `rnf-evaluation-v1`. Escopo: B14a, RF13 e preparação de RQ05. Data: 17/10/2026. Fontes metodológicas: [matriz de fidelidade](../../../docs/referencias-e-fidelidade.md). A execução usa a política RNF atual, `ramos_2019_manhattan_k1_v2`, sem alterar representação, distância, k, desempate ou itens.

## Pergunta e limite

O processo consegue executar o mesmo pacote, preservar evidência por alvo, recalcular métricas e contabilizar vazios/falhas sem alterar o RNF? Este ensaio responde a essa pergunta técnica. Não mede utilidade real, não reproduz a avaliação experimental de Felipe e não confirma as fórmulas/valores de Ednaldo.

Dados: oito cenários reconstruídos de `research/baselines/rnf-v2`, cujo manifesto congela o resultado do software, e cinco cenários com anotações sintéticas declaradas em `annotations.json`. Sentenças, identificadores e julgamentos são artificiais. Autorização: dados sintéticos do projeto. As anotações foram declaradas como fixtures de teste de software; não foram obtidas de participantes nem geradas a partir da saída do executor.

## Unidades e separação

- **Compatibilidade, oito cenários:** comparar o hash do resultado integral com o oráculo congelado, sem atribuir precisão/recall a ele. O cenário de exclusões inclui o próprio alvo intencionalmente para testar a guarda do método. Não é uma partição de avaliação de relevância.
- **Relevância sintética, cinco cenários:** um acerto; vizinho sem itens; referência explicitamente vazia; item retornado diferente da referência; entrada com tipo inválido. A anotação fica separada dos argumentos enviados ao executor. A saída RNF da entrada deve estar vazia.
- Na relevância, recusar o experimento se a base contiver o ID de registro, história ou classificação do alvo, incluindo aliases numéricos, ou texto igual após normalizar espaços e caixa. A comparação textual é uma guarda de duplicatas exatas, sem demonstrar ausência de clones semânticos.
- Não há divisão aleatória, busca de hiperparâmetros, folds ou ajuste sobre alvos. As bases são escolhidas explicitamente por cenário. Há somente uma família de alvos sintéticos e não há independência estatística entre cenários. Este ensaio não equivale ao leave-2-out por projeto de Felipe.
- Rótulos fornecidos, sem chamadas LLM. Não medir classificação nem propagar alegações sobre comitê/modelos a partir deste resultado.

Nos relatórios, `targets` conta pares cenário/alvo, não pessoas ou projetos independentes (`unit=case_target_pair`, `independentTargets=false`). Não interpretar os 13 cenários como 13 observações independentes.

## Execução

Usar o executor puro de publicações da plataforma, com definição e bases em envelopes do mesmo contrato validado. O construtor passa os registros pelo importador estruturado existente, com prévia válida e hashes; produz envelopes locais sem gravá-los como publicações no banco. IDs UUID derivados deterministicamente identificam somente esses artefatos locais.

Executar cada cenário duas vezes na mesma ordem. Registrar hashes das requisições, definição, base, resultado e desfecho completo. Comparar os desfechos das repetições; não comparar durações. Um pacote exportado deve produzir o mesmo conteúdo determinístico ao ser reexecutado no software/ambiente registrados. Ordenação inversa da base já é coberta pela referência congelada, não é um novo fator experimental neste piloto.

## Correspondência e métricas

Cada RNF é identificado pela função existente `nfrKey`: tipo com trim, atributo com trim/caixa baixa/espaços convertidos a `_` e sentença com trim. Tipo e conteúdo textual não recebem equivalência semântica. Conjuntos removem duplicatas sem multiplicar acertos. Considerar todos os itens retornados pelo método; não aplicar corte por score ou remover `alreadyLinked` depois da execução.

Para cada cenário anotado: `TP = |retornados ∩ relevantes|`, `FP = |retornados − relevantes|`, `FN = |relevantes − retornados|`.

| Medida | Fórmula |
| --- | --- |
| Precisão | `TP / (TP + FP)` |
| Revocação | `TP / (TP + FN)` |
| F1 | `2TP / (2TP + FP + FN)` |
| F2 | `5TP / (5TP + FP + 4FN)` |
| Cobertura de retorno | `alvos com ao menos um item / todos os alvos do grupo` |

Denominador zero resulta em `null` no JSON e campo vazio no CSV. F1/F2 são calculados pelas contagens, portanto podem ser zero mesmo quando precisão ou revocação individual é indefinida. Sem retornos e sem relevantes, todas as quatro razões são indefinidas. Anotação ausente não equivale a anotação vazia: casos de compatibilidade não entram nas métricas de relevância.

Micro soma TP/FP/FN antes de calcular as razões. Macro faz a média das razões definidas, informando quantos alvos definidos/indefinidos contribuíram para cada medida. Não descartar alvos silenciosamente. Repetições verificam determinismo, sem duplicar o peso dos alvos.

F2 serve para conferir a implementação da fórmula e seus denominadores. Não valida a inconsistência Q03 identificada na fonte de Ednaldo, não reproduz o TestRec e não é meta de desempenho.

## Vazios e falhas

Preservar `blocked`, `no_candidates`, `no_items`, `completed` e `technical_failure`. Uma falha técnica conserva diagnóstico e é contabilizada separadamente; no cálculo de relevância de ponta a ponta, usar predição vazia e manter FN. A falha de tipo intencional é declarada no pacote. Falhas não declaradas, falha declarada que não ocorre, regressão de compatibilidade ou repetição divergente reprovam a verificação técnica do pacote.

Uma partição inválida ou pacote estruturalmente inválido invalida o ensaio inteiro, antes das execuções. Não transformar vazamento de referência em falha do recomendador.

## Medições e exportação

Registrar duração monotônica de cada execução em memória, incluindo validação, projeção e snapshots. Registrar ambiente, versão do Node/ICU/locale, CPU, commit, árvore alterada e hashes dos arquivos relevantes. Sem aquecimento controlado e sem amostragem para inferência; os tempos são observações desta máquina. Não cobrem interface, rede, PostgreSQL, importação, trabalho de configuração ou custo de provedores. Não fixar SLA a partir deles.

Exportar pacote (`bundle.json`), relatório completo (`report.json`), tabela por alvo (`targets.csv`), manifesto (`manifest.json`) e hashes dos três primeiros. O relatório separa conteúdo determinístico de tempos. Destino de exportação novo; não sobrescrever ensaios anteriores. Replay lê e verifica os arquivos exportados e não altera a evidência.

O manifesto identifica commit e hashes da árvore efetivamente usada, que contém alterações locais. Os hashes não substituem arquivar o código dessa árvore. O replay desta etapa depende do checkout e das dependências registrados; um pacote de distribuição completo para terceiros permanece no trabalho de consolidação B22–B23.

## Continuidade de B14

Permanecem: dados e referências de relevância reais/autorizados; protocolo empírico compatível com a referência de Felipe; medidas de configuração com participantes e registro de passos/erros; medição de volumes/ambientes relevantes e metas fundamentadas. Login/isolamento continuam necessários antes de bases restritas. O próximo caso científico permanece Ednaldo, condicionado às fontes e decisões registradas na matriz.
