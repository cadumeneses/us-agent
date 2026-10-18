# B18b — preparação da medição de configuração

Versão `configuration-effort-v1`, 18/10/2026. Rascunho metodológico do US-Agent para revisão da orientação antes da coleta com participantes. O instrumento e o ensaio artificial estão implementados; este documento não registra aprovação, recrutamento ou estudo realizado. Atende à preparação de RQ05/B14/B18, mantendo B18 empírica em andamento.

## Pergunta e limites

Quanto tempo observado, erros, ajuda e alterações de código são necessários para configurar e executar os dois exemplos disponíveis pelo fluxo comum? Registrar também desistências e tarefas incompletas. Não converter tempo do script ou percurso automatizado em tempo de pessoas. Qualidade de recomendação, aceitação/utilidade percebida e esforço de configuração são medidas distintas. As referências de Felipe e Ednaldo orientam o significado dos atributos e métodos; este protocolo de configuração é uma proposta do US-Agent e não reprodução de um estudo desses autores.

O RNF executa `ramos_2019_manhattan_k1_v2`. Testes executam `us_agent_e21_equations_demo_v1`, somente sintético, Manhattan e K=3. Não pedir aos participantes para resolver Q01–Q03 ou alterar regras científicas. O exemplo Ademar não entra como tarefa existente; deverá ser incorporado em nova versão após B19–B21. Dois exemplos não demonstram por si a generalidade da plataforma.

## Materiais e tarefas

Preparar uma instalação local com as migrations aplicadas e um namespace novo por tentativa. Fornecer os mesmos manuais, taxonomias e arquivos sintéticos versionados a todas as pessoas; fixar hashes, commit e estado local da aplicação. Começar depois de treinamento equivalente e confirmação de que os materiais estão acessíveis. Registrar experiência declarada e idioma real da interface (atualmente inglês nos fluxos integrados); não traduzir a interface durante a mesma comparação. Material preparado por desenvolvedores e experiência prévia são ameaças à validade a registrar.

| Tarefa observada | RNF / Felipe | Demonstração de testes / Ednaldo |
| --- | --- | --- |
| Definição | Revisar/publicar template RNF; atributos e bindings compatíveis. | Revisar/publicar template demonstrativo; atributos e bindings compatíveis. |
| Taxonomia | Publicar/vincular catálogo independente a contexto configurável, mantendo os valores científicos e regras do RNF. | Publicar/vincular catálogo sintético de critérios, com IDs compatíveis com a base. |
| Catálogo de saída | Não é etapa do RNF. | Revisar/publicar catálogo sintético, com declaração de uso e arquivo preservado. |
| Base | Mapear/importar base rotulada, revisar prévia/exclusões e publicar versão explícita. | Mesma tarefa, com publicação exata do catálogo vinculada. |
| Execução | Selecionar versões, preencher alvo sem respostas e executar. | Selecionar versões, preencher alvo sem respostas e executar. |
| Replay | Abrir histórico, conferir replay e exportar pacote. | Mesma tarefa, incluindo artefatos originais do catálogo. |

Cada checkpoint conserva ID, versão e hash de conteúdo declarado pelo observador, além de tempo decorrido/ativo observado até aquele ponto. Eles identificam evidências a conferir posteriormente, não provam conclusão científica ou correção do artefato. O instrumento não busca arquivos, API ou banco a partir dessas referências. A revisão manual deve conferir pacotes reais e registrar divergências separadamente. Não usar fixture pré-configurada como prova de que uma pessoa configurou todos os passos. Os checkpoints registram os artefatos finais uma vez por tentativa, sem impor ordem de navegação; seus tempos não são duração exclusiva de cada etapa.

O pacote de materiais `configuration-materials-v1` identifica arquivos sintéticos locais com hashes dos bytes e seu alcance. O CLI verifica esse pacote e o hash dos bytes deste protocolo; observações devem referenciá-los exatamente. Os materiais são sementes para revisão do instrumento, não um roteiro pronto de recrutamento nem prova de configuração humana. A revisão do protocolo e dos materiais antes do estudo pode exigir nova versão. Um commit não identifica sozinho uma aplicação com mudanças locais: registrar também estado da árvore e hash declarado de um snapshot do software efetivamente observado. O analisador conserva esses dados, mas não os verifica remotamente. O ensaio usa fingerprint explicitamente artificial, sem execução/observação humana.

## Desenho proposto para revisão

Cada pessoa tenta os dois exemplos, com ordem alternada entre pessoas para reduzir efeito de aprendizado. Registrar ordem e tentativa; não tratar sessões da mesma pessoa como observações independentes. Antes de recrutar, fechar critérios de seleção, treinamento, tamanho/justificativa da amostra, limite de tempo, regra de ajuda, critério de interrupção e procedimento de revisão dos checkpoints com a orientação. Não há tamanho de amostra, meta de tempo ou significância inferida do ensaio artificial. Alterações após piloto exigem nova versão do protocolo e não devem ser ajustadas pelos resultados finais.

Usar somente arquivos sintéticos no piloto local. Sessões observadas são uma categoria separada e exigem os procedimentos aplicáveis de informação/autorização da pesquisa. Registrar apenas códigos pseudônimos; manter eventual vínculo com identidades fora do repositório. O schema rejeita campos extras, mas não certifica anonimização de códigos livres. Não gravar nomes, credenciais, áudio ou conteúdo de projetos no log.

## Coleta e cálculo

O observador registra um relógio relativo único em milissegundos por sessão, começando em zero. Eventos: início, pausa/retomada, erro, pedido de ajuda, alteração de configuração/código, checkpoint e fim. Os tempos são observações declaradas, não verificação automática de relógio. Eventos devem ser monotônicos; pausas não se sobrepõem, atividades não ocorrem pausadas e o fim é único. Erros usam códigos previamente definidos no roteiro, sem texto pessoal. Pedidos de ajuda distinguem procedimento, conceito e problema técnico. Definir antes da coleta quando um mesmo erro persistente é contado novamente; o analisador conta os eventos registrados, não os deduplica.

Tempo decorrido vai do início ao fim, incluindo espera da aplicação. Tempo ativo observado subtrai apenas pausas explicitamente registradas por interrupção ou ambiente; não é tempo de CPU nem tempo exclusivo de esforço cognitivo. Registrar separadamente alterações de valores/configuração e alterações do código da aplicação. Uma tarefa concluída com ajuda ou alteração de código não pode ser apresentada como configuração autônoma sem código.

Finalizar toda observação como `completed`, `incomplete` ou `abandoned`. A conclusão declarada exige todos os checkpoints; completar pausado é inválido. Para interrupção definitiva durante pausa, `incomplete`/`abandoned` fecha a pausa no horário final, preservando o tempo observado. Sessões sem fim explícito são rejeitadas, devendo ser corrigidas pelo observador sem inventar horário. O analisador reporta completude declarada e falta de checkpoints; não aprova os artefatos.

Exportar linhas individuais, contagens de erros por código, ajuda por tipo e resultados por método. Medianas de tempo são calculadas somente sobre conclusões declaradas e exibem esse denominador; incompletas/desistências continuam nas linhas e nas taxas por método. Não substituir desistência por tempo zero, nem comparar medianas condicionais sem informar as perdas. Os denominadores cobrem somente sessões efetivamente declaradas no arquivo: manter no protocolo do estudo um registro das tarefas/pessoas planejadas e das não iniciadas; o instrumento não detecta omissões de sessões. O instrumento mantém `empiricalClaim: false`, mesmo quando recebe observações: interpretar validade exige revisão do desenho, materiais e coleta. Não aplica teste de significância ou escore de qualidade.

## Saída e encerramento

`npm run measure:configuration -- --input arquivo.json --output diretorio-novo` valida e exporta entrada, relatório, CSV e manifesto; `--replay diretorio` verifica hashes/fontes, recalcula relatório e CSV. Sem `--input`, usa somente um ensaio artificial com três sessões, sem pessoas reais, para conferir o instrumento. O manifesto identifica esse escopo.

B18b conclui a preparação técnica, não o estudo. Para encerrar B14/B18 são necessários protocolo revisado, materiais fixados, coleta observada, auditoria dos checkpoints e análise com limitações, além da avaliação de relevância empírica dos recomendadores. Questões de método/dados de Felipe/Ednaldo e confirmação de Ademar continuam no plano.
