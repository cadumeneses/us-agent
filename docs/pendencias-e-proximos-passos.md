# Pendências e próximos passos

Atualizado em 18/10/2026 após B15c/B16b, seguindo a [revisão de escopo](revisao-de-escopo.md) e a [conferência de aderência](aderencia-demandas-professor.md). Este documento distingue entregas técnicas de critérios completos da plataforma; os IDs e dependências estão no [workflow](workflow-evolucao-us-agent.md).

Integração posterior: a [entrega 016](entregas/016-rebase-idioma-e-preservacao.md) incorpora o idioma e os fluxos de projetos remotos, reverifica as adições e preserva os pacotes científicos. A [entrega 017](entregas/017-testes-no-executor-comum.md) liga catálogo/base/execução por API com identidade de demonstração; o próximo desenvolvimento passa a ser a interface B17.

## O que já tem evidência técnica

- B01/B03: referência RNF congelada, contratos arquiteturais e estratégia de preservação.
- B04–B06: classificação web com todos os pares, métricas calculadas, proveniência automática preservada e revisão com histórico.
- B07: definição/atributos configuráveis e simulação RNF em memória, reproduzindo os oito resultados congelados.
- B08: publicação de listas/árvores independentes por API, versões imutáveis e validação de vínculos por ID, versão e hash. Dependências de contexto são preservadas na evidência RNF.
- B09: publicação persistida de definições com método validado, pacote completo e vínculos imutáveis; recuperação, concorrência e rollback verificados.
- B10: importação CSV/JSON por API, arquivo original preservado, relatório por registro/campo, exclusões explícitas e bases publicadas imutáveis.
- B11: execução persistida com base explicitamente escolhida, política RNF separada, mapeamento de IDs e explicação/replay com snapshots preservados.
- B12a: interface de seleção das versões publicadas, formulário gerado pelos atributos, execução, entrada/explicação preservadas, histórico, replay e download da evidência; 26 testes web. [Entrega 008](entregas/008-execucao-configuravel-web.md).
- B12b: editores de definições/atributos e taxonomias, publicação do rascunho revisado por hash e importação CSV/JSON com prévia, exclusões e publicação pela web; [entrega 009](entregas/009-configuracao-importacao-web.md).
- B12c: destino explícito, aceitação/rejeição por item, observações, deduplicação e evidência imutável. Vertical RNF percorrido no Edge com desktop/mobile, histórico e replay; [entrega 010](entregas/010-avaliacoes-e-vertical-rnf.md). Migration 021 local preservou as 39 tabelas anteriores.
- B13a: proteção central de todo `/api`, restrição de origens e da exceção local, credencial nas consultas Python e correção dos alertas JavaScript. A consulta npm passou de 15 pacotes sinalizados a zero; [entrega 011](entregas/011-perimetro-e-dependencias.md). Não conclui autenticação pessoal nem isolamento organizacional.
- B14a: [avaliação RNF local](avaliacao-rnf.md) com protocolo, 13 cenários sintéticos, repetição, contagens, métricas, vazios/falhas e pacote/CSV/replay; [entrega 012](entregas/012-avaliacao-rnf-reproduzivel.md). Oito saídas congeladas preservadas; não é avaliação empírica ou estudo de configuração humana.
- B15a: [contrato de dados E21](testrec-contrato-dados.md), catálogo local com conteúdo preservado e quatro vetores da tabela 4.6 conferidos; [entrega 013](entregas/013-contrato-ednaldo-e-aderencia.md). Reutiliza atributos/taxonomias; não é recomendação TestRec executável.
- B16a: [demonstração local das equações E21](testrec-equacoes-demonstracao.md), KNN compartilhado, ranking/heurística, contribuições por teste e replay com associações sintéticas; [entrega 014](entregas/014-equacoes-ednaldo.md). CT04 confirmado aritmeticamente; divergência CT01 e transformação Euclidiana continuam abertas. Sem publicação na API/interface ou avaliação empírica.
- B15b: [catálogos de testes publicados](catalogos-casos-teste.md), com arquivo original, declaração de uso, versões imutáveis, retirada e referência exata por hash; [entrega 015](entregas/015-catalogos-testes-publicados.md). HTTP/PostgreSQL verificados; migration 022 local preservou as 42 tabelas anteriores. Não publica nem persiste execuções TestRec.
- B15c/B16b: [execuções publicadas E21](testrec-execucoes-publicadas.md), catálogo/base/execução nos endpoints comuns, artefatos preservados e replay após retirada; [entrega 017](entregas/017-testes-no-executor-comum.md). Interface de testes e revisão específica pendentes. Não conclui Q01/Q02, reprodução original ou avaliação empírica.

O vertical RNF está tecnicamente verificado pela interface. Isso não conclui acesso por pessoa/organização, os outros métodos, estudos com usuários ou reprodução experimental dos três trabalhos.

## Desenvolvimento em ordem de continuidade

| Prioridade / item | O que falta | Evidência necessária para fechar |
| --- | --- | --- |
| Próximo: B17 | B15c/B16b entregam catálogo/base/execução no backend comum, restritos à demonstração sintética das equações. Implementar seleção de catálogo, importação, formulário e resultado de testes na interface; avaliação/cópia com origem preservada. | Percurso do segundo recomendador na interface, com artefatos/contribuições/histórico e tratamento próprio de decisões. Não usar os vínculos RNF para testes nem alegar reprodução Euclidiana. |
| Continuidade científica B15/B16 | Confirmar transformação Euclidiana (Q01), conciliar CT01 (Q02) e obter fontes/código/dados autorizados. | Política confirmada por fonte, associações completas e testes de referência; manter distinta a demonstração publicada. |
| Continuidade: B14, sem bases restritas | B14a entregou protocolo/executor sintético e exportação. Faltam dados reais/autorizados, referências de relevância, protocolo empírico de Felipe, tempo/erros de configuração com participantes e volumes/ambientes representativos. | Ensaio com partições/relevância justificadas, falhas/vazios contabilizados e medições apropriadas; metas fundamentadas. O piloto sintético não conclui o requisito. |
| B18, após B17 e protocolo | Avaliar o segundo recomendador com referência confirmada e medir o esforço de configuração. | Dados/relevância justificados, protocolo e resultados; não inferir qualidade dos testes de integração sintéticos. |
| B19–B21 | Confirmar referência/dados de Ademar e executar um caso de riscos/tecnologias sem US artificial. | Terceiro exemplo com definição, dados autorizados, entrada, execução e fidelidade documentada. |
| B22–B23 | Avaliação integrada e pacotes reproduzíveis, tutorial, arquitetura e evidências para artigo/dissertação. | Reexecução dos ensaios, comparação com referência, efeito dos rótulos/revisões e medição de configurabilidade. |
| B13b/B13c, antes de bases restritas ou uso multiusuário protegido | Login por pessoa, sessões revogáveis, permissões, autoria, isolamento organizacional e auditoria de todo o caminho. B13a concluiu o perímetro e a correção npm desta etapa. | Sessões/papéis inválidos e acessos cruzados negados, alterações autorizadas/auditadas. A chave interna não conclui o requisito; a interface protegida depende de B13b. Antecipar este item se esse cenário de uso for solicitado. |

No recorte RNF, taxonomias, definições, bases, execuções e [avaliações por item](avaliacoes-configuraveis.md) têm fluxo por API e [interface](recomendadores-web.md), com seleção explícita e evidência preservada. Adaptação de sentenças permanece não implementada. A área respeita a autorização existente; acesso por pessoa/organização depende de B13. A [ADR 003](decisoes/003-publicacao-definicao-e-base.md) separa definição e base; a [ADR 004](decisoes/004-destinos-e-avaliacoes.md) impede inferir destinos operacionais a partir de IDs importados. Outros métodos precisam de políticas próprias; o terceiro recomendador executável ainda não existe.

## Pesquisa e decisões que precisam de fonte ou orientação

| Item | Pendência |
| --- | --- |
| B02 — Felipe | Comparar integralmente as versões identificadas da tese/artigo e confirmar acesso/autorização aos dados/código originais. Oito casos reconstruídos demonstram compatibilidade do software, sem comprovar desempenho na base original. |
| B02 — Ednaldo / Q01 | Confirmar a conversão de distância Euclidiana em similaridade e a normalização efetivamente usada. |
| B02 — Ednaldo / Q02 | CT03/CT04 coincidem com a equação após recálculo. Conciliar CT01: texto informa 0,42, associações textuais e equação produzem 0,25. Conferir figuras/artigo/código. |
| B02 — Ednaldo / Q03 | Verificar resultados por alvo/fold e convenções para esclarecer a diferença entre métricas reportadas e recálculo. |
| Q04–Q05 / B19 | Confirmar artigos exatos pretendidos pelo professor, datasets completos e autorização de uso; obter o material do exemplo JSS/Ademar. |
| Revisões do professor | Apresentar cada vertical, confirmar decisões metodológicas e registrar ajustes. Os testes executados não equivalem a aprovação da orientação. |

A [matriz de fidelidade](referencias-e-fidelidade.md) contém fontes, seções e limites já identificados. Nesta entrega não foram obtidos novos artigos nem encerradas essas questões. Elas continuam sendo acompanhadas e não são substituídas por resultados sintéticos.

## Diferença entre verificação e avaliação

Testes e checks atuais verificam os cenários técnicos cobertos: validação, cálculos de referência, revisão, imutabilidade, transações e compatibilidade. Ainda faltam experimentos com referências de relevância, particionamento sem vazamento, métricas por alvo/fold, cobertura, análise do efeito da classificação e tempo/erros ao configurar os três exemplos. Similaridade do vizinho, aceitação humana e acurácia científica são medidas distintas.
