# Entrega 004 — Taxonomias independentes e revisão das pendências

Data: 17/10/2026. Escopo: reverificar B07 e concluir B08 no recorte de API/contratos. O que ainda falta está consolidado em [pendências e próximos passos](../pendencias-e-proximos-passos.md); o formato e as rotas estão em [taxonomias independentes](../taxonomias-independentes.md).

## Conferência do plano

B07 voltou a passar nos 51 testes anteriores e nos oito cenários RNF pelo caminho configurável antes de B08. A implementação continua separando definição, validação e política científica, com configuração em memória e motor preservado. A comparação dos sete hashes de origem do manifesto confirmou a preservação dos arquivos inventariados, incluindo o motor RNF e o orquestrador Python.

O avanço está coerente com a sequência B07 → B08 → B09. B02 e B19 não foram encerrados: os textos/dados e questões metodológicas pendentes continuam na matriz de fidelidade. Os contratos executáveis não foram tratados como uma plataforma completa pela interface.

## Implementação B08

Foram acrescentados catálogos versionados independentes de WIS, com nós, descrições e relações em lista/árvore. Há validação de IDs, pais, ciclos e seleção de folhas ou qualquer nível, sem impor uma hierarquia fixa de três níveis. JSON é o formato de intercâmbio implementado.

A API interna salva rascunhos completos, publica atomicamente, lista/consulta versões e retira publicações de novas seleções. O conteúdo/hash publicado fica protegido contra edição/exclusão; uma mudança usa outra versão. Publicações repetidas ou concorrentes retornam a mesma versão, e a retirada não apaga conteúdo. A política existente de acesso interno foi extraída sem mudança de comportamento e reutilizada nas novas rotas.

O tipo de atributo `taxonomy_node` fixa ID, versão, formato e hash da taxonomia. Entradas e registros validam IDs de nós e cardinalidade, inclusive em campos de registro. A simulação RNF conserva as dependências exatas nos snapshots. Os atributos científicos legados ainda usam nomes; o novo tipo é utilizável nos contextos adicionais, e a migração do cálculo para IDs fica condicionada ao mapeamento explícito em B11.

A versão do adaptador é agora `rnf-v2-profile-adapter-v2`, identificando o acréscimo das dependências à evidência; a identificação e a implementação do motor científico não mudaram.

## Verificações e resultados

| Verificação | Evidência |
| --- | --- |
| API | 57 testes passaram: 51 anteriores e seis novos de taxonomias/vínculos/evidência. |
| Interface | Sete testes passaram; não houve alteração de interface nesta entrega. |
| Build | API e web compilaram; a API voltou a compilar após os ajustes finais. |
| Compatibilidade em memória | `check:configured-nfr` preservou os oito resultados inteiros. |
| HTTP/PostgreSQL B08 | `check:recommender-taxonomies` passou: lista de linguagens, árvore sintética de critérios, publicação concorrente/idempotente, conteúdo/hash protegido, retirada, chave interna, erros localizados e rollback. |
| Vínculos publicados | O check publicou os dois exemplos por HTTP, associou ambos ao mesmo artefato e repetiu os oito cenários RNF sem divergência de resultado. |
| Regressão HTTP | Checks de classificação/revisão, seleção de taxonomia WIS e recomendação RNF passaram com a migration nova nos schemas isolados. |
| Migration local | A migration 017 foi aplicada em `127.0.0.1`; contagens e SHA-256 dos conteúdos das 33 tabelas anteriores foram iguais antes/depois. Foi criada a tabela nova, sem seed de dados científicos. |

Os testes incluem pais após os filhos, múltiplas raízes, árvore de 1.500 níveis, ciclo desconectado, autorreferência, ID desconhecido, nome exibido em lugar de ID, nó não selecionável, hash adulterado, dependência ausente/retirada e tentativa de substituir a versão exigida por outra publicada. Uma dependência opcional continua precisando ser válida na definição.

O check HTTP também inseriu um rascunho inválido diretamente no schema de teste e confirmou que a publicação o revalida: o estado permaneceu `draft`, sem hash ou data de publicação. A primeira execução do script detectou um alias SQL que colidia com o nome de coluna; o alias do verificador foi corrigido e a repetição passou. Não foi uma falha na publicação da aplicação.

Build/testes web e a consulta do Docker exigiram execução fora do sandbox por restrições locais conhecidas. Não houve acesso a produção nem chamadas a modelos externos. Os checks HTTP removeram somente seus schemas temporários; o banco local recebeu apenas a migration aditiva autorizada pelo desenvolvimento.

## Revisão de fidelidade e limitações

As taxonomias de exemplo são sintéticas. A árvore de critérios demonstra o formato e não afirma uma hierarquia dos 59 critérios do trabalho de Ednaldo. A recomendação continua obedecendo ao recorte RNF declarado de Felipe, com as adaptações do US-Agent previamente registradas. Testes com a referência reconstruída demonstram compatibilidade técnica, sem alegar reprodução empírica dos artigos.

B08 conclui publicação e vínculos no backend. Ainda não entrega editor/importador por tela, definição publicada com vínculos persistidos, novos atributos científicos no cálculo ou histórico genérico web. A autoria atual é técnica e a proteção usa a chave interna existente; autenticação pessoal e isolamento entre organizações continuam em B13. Não houve nova obtenção de fontes nem aprovação do professor nesta entrega.

Próximo incremento: B09, publicação persistida de definições com dependências imutáveis. A lista completa de desenvolvimento, fontes e revisões pendentes foi atualizada para permitir acompanhar os requisitos sem confundir infraestrutura concluída com fluxo integral entregue.
