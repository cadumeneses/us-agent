# Entrega 018 — Interface de casos de teste

Data: 18/10/2026. Recorte B17a; RF01–07, RF09–10 e RF14. O segundo método demonstrativo passou a configurar, importar, executar e explicar resultados pela interface comum. Avaliação e cópias adaptadas continuam pendentes em B17b; a reprodução científica de Ednaldo permanece separada.

## Comportamento entregue

- A configuração oferece template de testes com identidade/parâmetros explícitos e o template RNF preservado. Atributos, contexto e taxonomias reutilizam os editores existentes; o mapeamento de nomes científicos do RNF não é aplicado aos testes.
- A aba de catálogos revisa o JSON sintético, os artefatos e o hash do arquivo antes de publicar. Trocar o arquivo exige nova revisão. A API preserva/valida os bytes originais e a declaração de uso; inspeção e download mantêm o conteúdo original.
- Importação e recuperação de prévias aceitam schema 2, com catálogo fixado e exclusões explícitas. Outra escolha de catálogo invalida a prévia. Ausência de associação continua distinta de lista vazia.
- Execução exige base compatível e seleção explícita do catálogo que ela referencia. O formulário não pede classificação WIS nem par RNF, e retém as respostas de teste fora do alvo. Repetir após falha de rede conserva UUID/entrada; alterar a entrada cria outro pedido.
- Resultado apresenta Gherkin, metadados, três vizinhos, vetores, contribuições e scores, sem inferir acurácia. Estados bloqueados/vazios, histórico, replay e exportação usam a apresentação adequada ao método. O RNF mantém sua revisão e seus vínculos existentes.

O [roteiro de uso](../testrec-interface.md) detalha os passos e limitações. O backend e as fórmulas congeladas não foram alterados; nenhuma migration adicional ou alteração do banco público local foi necessária. Os ensaios usaram schemas descartáveis e fixtures sintéticas.

## Verificação

| Verificação | Resultado |
| --- | --- |
| Interface | 58 testes passaram, incluindo catálogo, publicação revisada, importação E21, vínculos exatos, saídas retidas, falhas de rede e histórico sem dependências ativas. |
| Build web | TypeScript e Vite compilaram. Execução fora do sandbox pela restrição de acesso já identificada. |
| Navegador E21 | Edge headless percorreu catálogo → taxonomia independente de critérios → definição → importação/exclusão → base/catálogo → execução → download → histórico/replay após retirar dependências. [Resumo](../evidencias/b17a/summary.json). |
| Integridade do resultado | Banco confirmou os três vizinhos, scores e artefatos esperados; catálogo com BOM/CRLF manteve os bytes originais. O JSON exportado conservou o pacote persistido. Nenhum destino ou decisão RNF foi criado para testes. |
| Regressão RNF | Percurso completo no Edge passou, incluindo configurações/taxonomia, importação, múltiplos rótulos, destino explícito, aceitar/rejeitar, persistência, replay e fluxo de projetos. [Resumo](../evidencias/b17a/rnf-regression.json). |
| Visual | Capturas desktop 1440×1100 e mobile 390×1000 inspecionadas, incluindo Gherkin/contribuições expandidas. Sem transbordamento horizontal ou controles visíveis sem rótulo nos pontos ensaiados. [Desktop](../evidencias/b17a/desktop-artifact.png), [mobile](../evidencias/b17a/mobile-artifact.png). |
| Replay científico | B14a permaneceu `d26d28d5ee2da92f6449fe8fb18ed2bfdfd55192bb3a96fdb0a3e8b58a89a3dd`; B16b permaneceu `82f6f03b09c61ad3d061bde03890c51645d476c3431cbc660f6bfbfde0b2923a`. Fontes e snapshots não foram atualizados para aceitar divergências. |
| Stage científico | `check:scientific-index` manteve os 56 hashes: 53 fontes e três artefatos, com finais de linha preservados. |

Os testes web usam também o executor real e a evidência publicada de B16b para conferir a fronteira entre formulário e resultado. O ensaio de navegador usa a API e PostgreSQL reais locais, sem LLMs externos. Compatibilidade técnica e verificação visual não são estudo de usabilidade nem avaliação empírica de relevância.

## Escopo e próximo incremento

O avanço atende à demanda de demonstrar outro conjunto de atributos, taxonomias e saídas sobre o mesmo núcleo KNN. A taxonomia de critérios ensaiada é sintética, sem reconstruir o catálogo completo da tese. Módulo/operação continuam características; as regras RNF não foram herdadas por conveniência. Conteúdo original importado continua no seu idioma, enquanto controles novos usam inglês.

B17b permanece necessário: registrar avaliação por teste e produzir uma cópia adaptada com origem, versões e alterações preservadas, sem modificar o artefato recuperado. A interface informa essa limitação; os endpoints de decisão/destino RNF continuam recusando execuções de teste.

Q01/Q02, dados/código/artigos completos, avaliação empírica de Felipe/Ednaldo, esforço de configuração com participantes e exemplo sem US continuam pendentes. Não foram obtidas novas fontes nesta entrega nem alegadas reprodução Euclidiana, acurácia ou aprovação do professor. [Workflow](../workflow-evolucao-us-agent.md), [aderência](../aderencia-demandas-professor.md) e [pendências](../pendencias-e-proximos-passos.md) refletem esse estado.

Os 37 arquivos deste incremento foram preparados no stage. Ao fechar, o trabalho anterior já constava no HEAD `1ee923f` (`feat: add test case`); esse commit não foi criado nesta execução. Não foram feitos commit ou push deste incremento. PDFs e arquivos temporários permanecem fora do stage.
