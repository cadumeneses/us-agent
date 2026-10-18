# Recomendadores configuráveis — primeiro contrato executável

B07 implementou contratos de definição, atributos, entrada e base em memória. A [configuração RNF de demonstração](../config/recommenders/rnf-v2.draft.json) usa 18 atributos. B08 acrescentou dependências de taxonomia e B11 passou o adaptador a `rnf-v2-profile-adapter-v3`, com mapeamento explícito de IDs científicos. O motor legado permanece em `nfr-engine.ts` como referência; a [execução publicada](execucoes-configuraveis.md) usa a política extraída compatível com `ramos_2019_manhattan_k1_v2`.

## Executar e verificar

Na raiz do repositório:

```powershell
npm.cmd run check:configured-nfr
```

O comando lê a configuração JSON, confere a integridade da referência congelada e executa seus oito casos pelo adaptador. Compara o resultado inteiro com a saída esperada e imprime os hashes dos resultados e da definição. Usa dados reconstruídos de demonstração; não acessa PostgreSQL ou provedores e não atualiza snapshots.

O serviço `simulateConfiguredNfr(definition, input, dataset, labelIndex)` também aceita entradas construídas diretamente pelos atributos. `legacyNfrInput` é uma ponte para os perfis existentes; o serviço de simulação não a exige. O fluxo web atual continua no caminho anterior até as etapas de publicação, importação e integração.

## Contratos e validação

| Contrato | Regras executáveis neste incremento |
| --- | --- |
| Definição | ID, versão explícita, nome, estado, atributos e método com versão, parâmetros e vínculos sem referências inexistentes. IDs duplicados e campos desconhecidos são rejeitados. |
| Atributo | Nome, tipo, escopo `project`/`artifact`, cardinalidade `single`/`many`, obrigatoriedade, papel e representação. |
| Tipo | Texto livre, categoria por nome exato, nó taxonômico por referência publicada, enumeração, número finito, booleano ou registro com campos escalares declarados. Sem coerção de strings para números/booleanos. Registros não admitem campos extras. |
| Representação | `presence` para características categóricas; `none` para filtro, saída e contexto. Texto livre e número não se tornam dimensões sem uma codificação implementada. |
| Entrada | ID de registro, valores por ID de atributo e origem. O contrato genérico não impõe história, classificação automática ou projeto cadastrado. |
| Base em memória | ID, versão explícita, origem e registros validados contra a mesma definição. IDs de registro duplicados são rejeitados. Não equivale a um dataset publicado. |

`required` obriga a existência da chave. Uma lista vazia ou texto vazio ainda pode representar informação não preenchida: a completude de domínio é verificada pelo método. Isso preserva o estado `blocked` e suas explicações para o perfil RNF incompleto. Ausência de um atributo obrigatório é erro estrutural, antes do cálculo. Atributos opcionais ausentes não recebem valores inventados.

O contrato separa categorias de texto livre. Categorias podem originar dimensões de presença; texto é conteúdo/contexto ou parte de um item de saída. B08 acrescentou [taxonomias independentes](taxonomias-independentes.md), referências por ID de nó e validação de árvores. Em B11, campos científicos passaram a aceitar `taxonomy_node` com mapeamento explícito para os nomes legados; contextos continuam validados sem entrar no cálculo. A comparação científica preserva nomes, inclusive entre versões distintas.

## Limites do adaptador RNF

`method.bindings` associa cada campo semântico do RNF a um ID de atributo configurado. Renomear `platforms` para `execution_environments` e atualizar o vínculo mantém o resultado, como verificado em teste. Cada vínculo exige tipo, escopo, cardinalidade, papel e representação compatíveis; dois campos semânticos não podem usar o mesmo atributo.

Os filtros incluem pares módulo/operação, revisão aceita e objetivo de produto nos candidatos. As características são plataformas, domínios, arquiteturas, linguagens, frameworks, APIs, persistência e categorias de tarefas. O objetivo não se torna dimensão; os rótulos não viram uma união entre pares. As regras de distância, desempate e recuperação continuam no motor original.

Um novo campo de contexto pode ser declarado sem código específico, por exemplo:

```json
{
  "id": "budget",
  "name": "Orçamento informado",
  "valueType": { "type": "number" },
  "scope": "project",
  "cardinality": "single",
  "required": false,
  "role": "context",
  "representation": "none"
}
```

Acrescentar esse objeto a `attributes` permite `values.budget: 5000`; `"5000"` é rejeitado. O campo fica no snapshot e não altera distância ou ranking. Se passar a obrigatório, todos os registros da base e o alvo devem informá-lo. Os testes verificam essas três situações. B12a/B12b implementam a [interface para preencher/criar campos](recomendadores-web.md).

O adaptador aceita somente o método RNF v2, versão `2`, com `k: 1`. Não ignora parâmetros extras, novos filtros, novas características ou saídas adicionais. Mudanças de cálculo exigem implementação e versão próprias. A base deve conter uma classificação por história e IDs de classificação distintos, equivalente à seleção prévia de um perfil por US no carregador legado; bases ambíguas falham na validação. O adaptador não escolhe silenciosamente qual registro manter.

Os IDs de história/classificação são atributos exigidos especificamente por esse adaptador, para exclusão do alvo e desempate. Outros métodos podem declarar entradas sem eles; um teste do contrato valida um perfil independente. Ainda não há implementação executável de outro método.

## Evidência e hashes

A simulação retorna ID, data, duração de validação/cálculo/construção dos snapshots, versão do adaptador/motor e snapshots independentes de definição, entrada, base, seleção do par, dependências taxonômicas e resultado completo. Os snapshots são cópias congeladas em profundidade: modificar o objeto de entrada posteriormente não altera a evidência. Não há persistência desse resultado nesta etapa.

O formato `us-agent-json-v1` calcula SHA-256 sobre JSON UTF-8 sem espaços, com chaves ordenadas por pontos de código Unicode e arrays em sua ordem declarada. A ordenação inclui chaves numéricas, sem depender da ordem de inserção dos objetos JavaScript. Strings não recebem normalização Unicode; números usam a serialização JSON de JavaScript, incluindo `-0` como `0`.

Valores não JSON, números não finitos, objetos especiais, ciclos, getters, propriedades ocultas/Symbol, arrays esparsos ou com propriedades extras e estruturas acima de 100 níveis são rejeitados. As entradas não recebem normalização de domínio no adaptador (`preserve-values-v1`); trim/deduplicação de características e normalização de RNFs continuam sendo as regras versionadas do motor v2.

O formato não é anunciado como RFC 8785. Também não substitui o hash de bytes de um arquivo importado nem o hash histórico UTF-8/LF da referência RNF. Cada hash informa seu formato. O hash do snapshot de base identifica o conteúdo selecionado e sua ordem, e não uma publicação existente.

## Continuidade científica e de produto

Somente rascunhos podem ser simulados neste serviço. Um JSON local com `published` ou `retired` não equivale a publicação validada e é recusado aqui. B09 implementou [publicação de definições](publicacao-definicoes.md), B10 acrescentou [bases importadas](importacao-bases.md) e B11 disponibilizou [execução persistida com base explícita](execucoes-configuraveis.md). Essas etapas de backend não concluem os aceites integrais de RF01/RF02/RF10 pela interface.

O recorte RNF preserva a direção metodológica de Felipe registrada na [matriz de fidelidade](referencias-e-fidelidade.md). A comparação é uma evidência de compatibilidade do software, sem nova alegação de reprodução empírica. O método de Ednaldo terá sua própria política: suas questões de distância, agregação e avaliação permanecem abertas e seus campos não herdarão automaticamente os filtros do RNF.
