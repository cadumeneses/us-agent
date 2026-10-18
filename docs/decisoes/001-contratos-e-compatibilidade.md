# ADR 001 — Contratos e compatibilidade da evolução

Data: 17/10/2026. Estado: decisão de engenharia adotada para guiar a implementação incremental. Não representa validação metodológica pelo professor.

Atende B03, RF01–RF10 e RQ01–RQ03 do [workflow](../workflow-evolucao-us-agent.md). B07–B11 implementaram contratos, dependências publicadas, importação, execução persistida e replay. B12a–B12c integraram o vertical RNF na web, incluindo decisões e destinos explícitos, conforme [ADR 004](004-destinos-e-avaliacoes.md). Acesso por pessoa/organização e demais métodos permanecem separados.

## Contexto e decisão

O sistema possui dados e resultados que precisam permanecer interpretáveis enquanto o RNF passa de fluxo específico a uma configuração da plataforma. Manter o backend atual, migrations aditivas e um núcleo com políticas por método. A classificação e a recomendação terão contratos separados; a recomendação aceita dados rotulados sem exigir classificação automática.

Adotar estes limites de responsabilidade:

| Contrato | Campos/responsabilidade mínimos |
| --- | --- |
| `RecommenderDefinitionVersion` | ID lógico, versão, estado, esquema de entrada/saída, atributos, referências publicadas de taxonomias e ID/versão/parâmetros do método. A seleção da base fica na execução, conforme ADR 003. |
| `AttributeDefinition` | ID, nome, tipo, escopo projeto/artefato, cardinalidade, obrigatoriedade e papel no cálculo. O papel pode ser característica, filtro, saída ou contexto; participação em distância exige representação implementada. |
| `TaxonomyVersion` | ID/versão, nós identificáveis, descrição, pai opcional e regra de seleção. O contrato inicial suporta listas e árvores; rejeita IDs duplicados, ciclos e pais inexistentes. |
| `DatasetVersion` | ID/versão, origem, arquivo/hash, autorização, relatório, registros e relações com itens. Rótulos e associações esperadas mantêm sua identidade/proveniência. |
| `RecommendationInput` | Valores de atributos e proveniência; referências a projeto/US são opcionais e só são exigidas pela definição que delas depende. |
| `RecommendationRun` | ID e data, definição e dependências exatas, snapshot do alvo/base, versão do software/método, parâmetros, candidatos/vizinhos, itens, estado e duração. |
| `ItemDecision` | Execução/item, autoria, aceitação/rejeição; adaptação guarda cópia e origem, sem sobrescrever o resultado bruto. |

Nomes de contratos são referências de desenho, não promessas de tabelas ou serviços independentes. Armazenar em PostgreSQL com validação de estrutura e referências na API; não introduzir microserviços nesta etapa.

## Publicação e integridade

- Uma versão nasce em `draft`; pode ser editada e validada. Publicar valida todas as dependências e grava o conteúdo imutável atomicamente.
- `published` identifica conteúdo executável e imutável. Alterar cria uma nova versão em rascunho. Remover da seleção para novas execuções usa `retired`, preservando o conteúdo e o histórico.
- Publicar a definição depende de taxonomias publicadas/compatíveis. A execução requer base publicada/compatível escolhida explicitamente, conforme a [ADR 003](003-publicacao-definicao-e-base.md); IDs não são substituídos silenciosamente por versões “mais recentes”.
- Uma publicação inválida não fica parcialmente visível. Criar execução usa um snapshot consistente das dependências escolhidas.
- Aceitar um item não modifica uma base publicada. Incorporação de feedback produz outra versão de base e não altera avaliações anteriores.
- Reexecução histórica usa as dependências preservadas, inclusive quando retiradas de seleção. Referências legadas sem conteúdo suficiente permanecem identificadas como incompletas.

Para novos contratos JSON, adotar um esquema de hash versionado: UTF-8, chaves de objeto ordenadas por ordem de código, arrays na ordem declarada, sem espaços de formatação e sem valores não JSON ou números não finitos. Aplicar normalizações de domínio antes do snapshot, registrando sua versão. O hash do arquivo original de importação é calculado separadamente sobre seus bytes; ele não se confunde com o hash do conteúdo normalizado.

O formato novo `us-agent-json-v1` foi implementado e testado em B07 para snapshots em memória, com chaves ordenadas por pontos de código Unicode, inclusive chaves numéricas. B08–B10 aplicarão o contrato às novas dependências e importações. A referência inicial RNF tem formato próprio identificado no manifesto: hash de texto UTF-8 com LF. Nenhum formato é anunciado como uma implementação de um padrão externo de canonicalização. Os limites executáveis estão em [recomendadores configuráveis](../recomendadores-configuraveis.md).

## Compatibilidade do RNF

O método legado é `ramos_2019_manhattan_k1_v2`. Sua referência executável está em [research/baselines/rnf-v2](../../research/baselines/rnf-v2/README.md).

A extração preservará, sobre os mesmos snapshots: dimensões do alvo, filtros atuais, comparação exata de nomes entre versões, k=1, Manhattan normalizada, desempate, deduplicação e ausência de troca de vizinho. Estados `blocked`, `no_candidates`, `no_items` e `completed` continuam distintos.

O novo contrato de rótulos usa IDs e versões. O adaptador legado conserva a semântica por nome que já existe; correspondências entre taxonomias recebem um mapeamento explícito. Um novo filtro por versão altera candidatos e exige política própria. Selecionar uma base explícita também pode alterar candidatos: comparar o motor com base idêntica para separar esse efeito de uma regressão de algoritmo.

Os casos de Ednaldo terão política própria. Na tese, módulo/operação participam do vetor e o perfil escolhido usa k=3 com heurística. Não herdar os filtros do RNF por padrão. As questões de distância e agregação permanecem em [referências e fidelidade](../referencias-e-fidelidade.md).

## Migração, ativação e reversão

1. Criar estruturas novas sem remover tabelas/colunas do legado. Não reescrever métricas históricas estimadas.
2. Publicar a configuração RNF e gerar mapeamentos de IDs para os registros existentes. Preservar os vínculos originais para consulta e auditoria.
3. Comparar caminhos antigo e novo em ambiente isolado com os mesmos snapshots, incluindo os oito cenários congelados e os checks HTTP/persistência.
4. Ativar o caminho novo após a verificação dos fluxos de configuração, execução e decisão. Preservar a consulta das execuções antigas.
5. Diante de regressão, reverter o encaminhamento para o caminho legado e preservar os registros novos para inspeção. Migração reversa destrutiva não é a estratégia de retorno.

A definição de autenticação/autorização é responsabilidade de B13 e faz parte do desenho antes de expor dados restritos. Autoria de registro, por si só, não confere permissão.

## Critérios de revisão

Antes de extrair o motor, `npm.cmd run check:nfr-baseline` deve passar. Antes de ativar classificação nova, percorrer API, persistência e revisão com dois pares, empate, falha parcial e `n/a`. Antes de expor publicação/base, verificar rollback e isolamento. Os resultados e limitações de cada verificação entram no registro da entrega.
