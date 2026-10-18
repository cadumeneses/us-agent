# Entrega 017 — Casos de teste no executor comum

Data: 18/10/2026. Recorte B15c/B16b; RF01–07, RF09–10 e RF14. A entrega avança o segundo recomendador no núcleo configurável, conforme A3/A4/A5, preservando o vertical RNF e a distinção entre demonstração técnica e reprodução científica.

## Resultado

A demonstração das equações E21 agora pode publicar uma definição, importar/publicar uma base associada a um catálogo e persistir execuções nos mesmos endpoints usados pelo RNF. A [documentação do contrato](../testrec-execucoes-publicadas.md) contém identidade, requisições, limites e comandos de verificação.

A implementação compõe os contratos e módulos congelados existentes. Mantém KNN compartilhado, três vizinhos, módulo/operação como características, equações Manhattan 4.2/4.3 e contribuições por teste. A nova identidade publica apenas dados sintéticos, com todas as escolhas explícitas; o contrato antigo permanece não executável. Não exige classificação WIS nem seleção de rótulo fictícia.

Importações schema 2 fixam o catálogo por ID, versão e hash. Ausência de associação não vira lista vazia; linhas inválidas precisam de exclusão explícita. Execuções schema 2 preservam o catálogo e seus artefatos completos, as três referências, a representação, o ranking e as versões do software. Reutilizar UUID é idempotente, novas versões ficam isoladas e o replay permanece disponível após retiradas. Os endpoints de revisão RNF recusam testes até existir o contrato específico.

A interface de testes permanece pendente em B17. A interface RNF identifica métodos disponíveis apenas pela API e bloqueia sua seleção; prévias/resultados de testes recebem erro explícito ao tentar recuperá-los nesses componentes. Textos novos da interface estão em inglês, acompanhando a integração anterior.

## Evidência e revisão

| Verificação | Resultado |
| --- | --- |
| Suíte API | 106 testes passaram; incluem identidade/parâmetros, importação, associações, execução e paridade integral do dispatcher nos oito casos RNF. |
| Suíte web | 47 testes passaram, incluindo métodos API-only e proteção de recuperação de importações/resultados. |
| Builds | API e web compilaram. Vite executado fora do sandbox após a restrição de acesso já identificada. |
| HTTP/PostgreSQL E21 | Publicação/importação/execução comum, cinco resultados representativos, histórico, referências exatas, versões, concorrência, rollback, imutabilidade, retirada com disputa de lock e replay passaram. [Pacote](../evidencias/b16b/published-runs.json). |
| Regressão HTTP RNF | Definições, importações/bases, oito saídas congeladas, destinos/decisões e replay passaram. |
| Replay anterior | B14a manteve `d26d28d5ee2da92f6449fe8fb18ed2bfdfd55192bb3a96fdb0a3e8b58a89a3dd`; B16a manteve `76e1f0b0e8ef3febbf4851800825743a0f5f00ec31383fe845f8f9e6a6a07f5e`. Os oito cenários da referência RNF passaram sem atualizar snapshots. |
| Pacote e stage | O replay offline das cinco execuções verificou `82f6f03b09c61ad3d061bde03890c51645d476c3431cbc660f6bfbfde0b2923a`. `check:scientific-index` conferiu 53 fontes e três artefatos no índice, com os 56 hashes iguais e finais de linha preservados. |
| Migration local | 023 ampliou três restrições de versão JSON; contagens e hashes das 43 tabelas de dados existentes foram preservados. [Inventário](../evidencias/b16b/local-migration.json). |

Os ensaios HTTP usam schemas locais descartáveis. A aplicação da migration foi limitada ao banco local explícito, sem dados de produção. O inventário exclui somente o registro de migrations, que recebe o nome da migration aplicada. Não foi realizado novo percurso visual no navegador nesta entrega; os checks web são de interação e compatibilidade de componentes.

A revisão do escopo manteve o foco na generalização: outro conjunto de atributos/saídas usa definição, importação, base, KNN, persistência e replay comuns, sem geração por LLM ou ampliação de algoritmos. O documento fornecido pelo usuário foi usado como evidência dos pedidos; seus aceites derivados não foram tratados como aprovação do professor.

## Limites e continuidade

Q01 (transformação Euclidiana) e Q02 (CT01) continuam abertas. CT03/CT04 permanecem compatíveis com a equação conferida; não foram completadas associações ausentes das figuras. Não foram obtidos novos artigos, código ou dados originais de Felipe/Ednaldo. As escolhas já documentadas da tese E21 permanecem a fonte desta demonstração.

Próximo incremento: B17, interface do segundo recomendador com seleção explícita de catálogo/base, apresentação dos testes/contribuições e avaliação/cópia com origem preservada. B15/B16 científicos continuam incompletos até confirmar fontes/dados/política; B18 depende de protocolo empírico. Também faltam avaliação empírica RNF, esforço de configuração com participantes e terceiro exemplo sem US. [Pendências](../pendencias-e-proximos-passos.md) e [matriz de aderência](../aderencia-demandas-professor.md) foram atualizadas.

Código, configuração, migration, testes, documentação e evidências deste incremento foram preparados no stage junto das adições anteriores. PDFs, backups e arquivos temporários permanecem fora dele. Não foram feitos commit ou push.
