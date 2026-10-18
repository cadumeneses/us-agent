# Entrega 013 — Contrato E21 e revisão de aderência

Data: 18/10/2026. Escopo: **B15a**, RF02/RF04 e início de RF14 para o segundo exemplo. A [revisão de aderência](../aderencia-demandas-professor.md) confronta explicitamente os pedidos relatados com o que foi demonstrado e o que falta.

## Resultado

Foi implementado um [contrato de dados de Ednaldo](../testrec-contrato-dados.md) usando as definições/atributos/entradas/taxonomias existentes. O rascunho muda os papéis: módulo/operação participam da representação, critérios de aceitação e RNFs são características e testes associados são saída. Não exige classificação operacional, objetivo de produto ou tarefas do RNF.

Quatro vetores de oito dimensões reproduzem a tabela 4.6 da tese local. Não foi aplicado o filtro RNF para descartar o perfil de módulo/operação diferente. Catálogos locais preservam Gherkin e metadados em snapshots, e referências inexistentes/duplicadas são recusadas. Associações não fornecidas permanecem desconhecidas, sem inventar que os perfis originais não tenham testes.

**Este é um contrato/representação, não o recomendador TestRec executável.** O resultado informa `canRecommend=false`; Q01/Q02 continuam abertas. O texto integral do artigo SAC e os dados originais não foram obtidos nesta consulta. A base de método é explicitamente E21, sem atribuir à publicação posterior conclusões ainda não conferidas.

## Evidências

| Verificação | Resultado |
| --- | --- |
| API | 91 testes passaram: cinco novos verificam tabela 4.6, imutabilidade/origem, identidade por ID, ausência versus lista vazia, referências, renomeação de atributos, contexto adicional e taxonomia independente por ID/hash. |
| Build API | Compilação TypeScript passou. |
| Contrato | `check:testrec-contract` confirmou quatro vetores, oito dimensões, hash do PDF local e dois itens sintéticos de catálogo. |
| Evidência exportada | [data-contract.json](../evidencias/b15a/data-contract.json), SHA-256 `d1047f0559375b6a0d0489e51ccc34d7e73c62b68ab8250505d2d9af57ba3088`, com fonte conferida e recomendação desabilitada. |
| Regressão RNF | Replay integral do pacote B14a passou com o mesmo SHA-256 determinístico. Sete arquivos congelados mantiveram seus hashes. |
| Escopo de alterações | Contratos locais, exemplo de configuração e verificações; sem mudança em UI, rotas, migrations, dados operacionais ou fórmulas RNF. Sem novo ensaio de navegador ou banco nesta entrega. |

A reconstrução usa valores ilustrativos da tabela 4.5, não o dataset experimental do autor. O catálogo e as associações usados nos testes de software são identificados como sintéticos. Campos do catálogo, bindings e ausência explícita são decisões do US-Agent, com fonte/adaptação distinguidas no contrato.

## Avaliação do caminho e continuidade

Estamos na direção das demandas centrais: configurabilidade, exemplos completos e avaliação. O avanço E21 testa outra configuração sem ampliar infraestrutura de contas/organizações. Entretanto, B15a não conclui B15, RF14 ou a generalidade entre recomendadores executáveis. Ainda faltam o ranking confirmado e sua integração, o exemplo sem US e os experimentos reais.

Próximo: confirmar regras de similaridade/agregação e dados/catálogos necessários, implementar a política do segundo exemplo com decisões identificadas e integrá-la ao fluxo comum. A avaliação empírica RNF segue como frente científica; as dúvidas metodológicas não autorizam preencher dados ausentes nem anunciar reprodução do artigo.
