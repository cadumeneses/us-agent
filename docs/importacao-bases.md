# Importação e publicação de bases rotuladas

B10 implementa o fluxo por API: arquivo CSV/JSON → prévia preservada → seleção explícita → base publicada imutável. O arquivo original fica no PostgreSQL como bytes, separado dos valores mapeados e dos hashes de conteúdo. Não há reclassificação automática nem inserção das linhas no histórico operacional de US.

## Formato e mapeamento

A requisição multipart contém `file` e um único campo textual `spec` com JSON. A especificação tem:

| Campo | Conteúdo |
| --- | --- |
| `schemaVersion` | `1`. |
| `id`, `version` | Identidade da versão de base que se pretende publicar. |
| `definition` | ID, versão, formato e SHA-256 do **pacote publicado da definição**, retornado por B09. |
| `format` | `json` ou `csv`. |
| `delimiter` | Opcional somente em CSV: vírgula, ponto e vírgula ou tabulação; padrão vírgula. |
| `source` | Descrição da origem e `authorization: { basis, reference }`. O fundamento declarado pode ser `synthetic`, `public-license`, `permission` ou `owned`; a referência registra a declaração de uso. |
| `mapping.recordId` | Caminho até o ID textual do registro na origem. |
| `mapping.attributes` | Por ID de atributo, `{ path, encoding }`, sem atributos inexistentes; todos os obrigatórios precisam de mapeamento. |

Caminhos são arrays de chaves, por exemplo `["values", "platforms"]`. Não há interpretação implícita de pontos, execução de expressões ou travessia de índices de arrays. O valor inteiro de um array pode ser associado a um atributo múltiplo. Em CSV, cada cabeçalho é uma chave literal, por exemplo `["project.platforms"]`.

`encoding: "value"` mantém o valor recebido. Em JSON, arrays, objetos, números e booleanos permanecem nativos. Em CSV, a célula é texto: usar `encoding: "json"` para representar arrays/registros/números/booleanos como JSON explícito. Esse modo exige uma célula textual com JSON válido. Não há coerção automática de `"false"` em booleano ou de um ID numérico em texto.

JSON exige um array de objetos. Cabeçalhos CSV são obrigatórios, não vazios e únicos. Aspas duplicadas, delimitadores dentro de aspas, CR/LF/CRLF e quebras de linha dentro de células são preservados. Linhas vazias intermediárias e contagem incorreta de colunas aparecem no relatório. Aspas malformadas impedem a publicação do arquivo. Chaves JSON duplicadas, inclusive representações escapadas da mesma chave, são rejeitadas antes de `JSON.parse` apagar um valor.

Valores não são aparados ou substituídos por defaults durante a importação. Texto curto, múltiplos pares de rótulos e relações com itens de saída são preservados quando correspondem ao contrato. IDs e atributos inválidos são reportados; não desaparecem por um limite de tamanho de história ou separador textual.

## Prévia e exclusões

A prévia identifica arquivo, hash de bytes, BOM, origem, mapeamento, definição completa usada e papel de cada atributo. O relatório inclui campos de origem, campos superiores não mapeados, quantidade de registros válidos/inválidos/duplicados e uma entrada para cada registro processável. Cada entrada tem ordinal, ID, problemas por campo e entrada normalizada quando válida.

Em CSV, `line` informa a linha física de início, inclusive depois de células multilinha. Em JSON, `line` é nulo e o ordinal identifica a posição no array. Problemas que inviabilizam interpretar o arquivo ficam em `report.fatal`; a prévia é preservada, mas não pode ser publicada.

Duplicatas por ID de registro marcam **todos** os envolvidos. No recorte RNF implementado, identidades de história/classificação também devem ser únicas e preenchidas; não são filtros de distância ou de elegibilidade. A prévia não escolhe qual duplicata manter. Para publicar, enviar `excludedOrdinals` explicitamente: a seleção restante deve ter tipos válidos e identidades únicas. Assim é possível excluir uma das duplicatas e manter a outra conscientemente.

Registros com problemas estruturais devem ser excluídos ou corrigidos em outro arquivo/prévia. Não há descarte automático. A publicação guarda os ordinais incluídos e excluídos, e o relatório completo continua acessível pela importação de origem. Excluir todos os registros é recusado.

Tipos, cardinalidades e IDs de nós taxonômicos são validados conforme a definição congelada. Perfis de protótipo ou classificações ainda não aceitas podem permanecer estruturalmente válidos: a seleção de candidatos e o recorte dos RNFs continuam sendo responsabilidade do método. A importação não muda essas regras para fabricar candidatos ou desempenho.

## Rotas

Prefixo: `/api/internal/recommender-datasets`.

| Método e caminho relativo | Comportamento |
| --- | --- |
| `POST /imports/preview` | Multipart `file`/`spec`; valida e preserva a prévia, retornando 201, inclusive quando o relatório aponta registros inválidos. |
| `GET /imports/:importId` | Consulta relatório, arquivo/hash, mapeamento e definição preservada. |
| `GET /imports/:importId/original` | Recupera os bytes exatos; `X-Content-SHA256` informa o hash original. |
| `POST /:id/versions/:version/publish` | Recebe `{ importId, previewSha256, excludedOrdinals }` e publica a seleção validada atomicamente. |
| `GET /` | Metadados com filtros `id`/`state` e paginação `limit` (1–100, padrão 30)/`offset`. |
| `GET /:id/versions/:version` | Pacote completo, registros, referências e hash da versão exata. |
| `POST /:id/versions/:version/retire` | Corpo ausente ou `{}`; retira a base de novas seleções sem apagar o conteúdo. |

O acesso e a autoria técnica seguem a [política interna já utilizada](taxonomias-independentes.md). A declaração de autorização registra a origem informada; não equivale a verificação automática de licença ou permissão. Controle por pessoa/organização e dados empresariais continuam em B13.

Exemplo de envio, com `base.json` e a especificação completa `import-spec.json` preparados segundo a definição publicada:

```powershell
curl.exe -F "file=@base.json;type=application/json" -F "spec=<import-spec.json" http://localhost:3333/api/internal/recommender-datasets/imports/preview
```

Com chave interna configurada, acrescentar o cabeçalho de autorização. Copiar o `id` e `snapshot.sha256` da resposta para a publicação; revisar primeiro `snapshot.content.report`. Omitir `excludedOrdinals` significa selecionar todos, não autoriza descartar linhas inválidas.

## Versões, integridade e limites

As tabelas `recommender_dataset_imports` e `recommender_dataset_versions` separam evidência de importação e base publicada. Ambas protegem conteúdo contra atualização/exclusão. Retirar uma base altera apenas seu estado/data de retirada. Repetir a mesma publicação com a mesma prévia/hash/seleção é idempotente; conteúdo diferente no mesmo ID/versão retorna 409 e exige outra versão/prévia.

Antes de criar a prévia e novamente ao publicar, o serviço confere a definição e suas taxonomias reais no banco, com locks compartilhados e hashes exatos. Dependência retirada ou hash divergente bloqueia uma nova publicação. Leitura histórica e download continuam disponíveis após a retirada. Datas e autoria ficam fora do hash do pacote.

O arquivo usa SHA-256 dos bytes originais; os snapshots usam `us-agent-json-v1`. A prévia guarda `structured-import-v1`, e a publicação vincula seu ID/hash, o hash do arquivo, mapeamento e seleção. Alterar whitespace ou BOM altera o hash do arquivo; não é uma normalização silenciosa.

Limites explícitos: UTF-8 válido; de 1 a 5.000.000 bytes de arquivo; até 10.000 registros; cabeçalho CSV com até 500 colunas; JSON com até 80 níveis; caminhos de mapeamento com até 20 chaves e campo multipart `spec` com até 200.000 bytes. Valores mapeados têm orçamento agregado de 10 MB. Exceder limites gera erro/reporte fatal, sem publicar um subconjunto automaticamente. Arquivo vazio ou upload acima do limite é recusado antes da persistência.

O importador não recursiona arrays para gerar relações novas, não adivinha delimitador/tipos e não acrescenta rótulos. Campos não mapeados permanecem no arquivo original e os superiores são sinalizados no relatório. B11 implementou o [mapeamento explícito de IDs científicos para nomes legados](execucoes-configuraveis.md) na definição; a origem importada conserva seus IDs.

## Verificação e continuidade

Após o build, executar `npm.cmd run check:recommender-datasets`. O comando usa PostgreSQL local em schema temporário e verifica CSV/JSON, download exato, relatório, exclusões, concorrência, imutabilidade, retirada e rollback. Os oito cenários congelados são importados/publicados separadamente e comparados em simulação, preservando suas saídas.

B10 entrega esse fluxo pela API; B11 acrescentou [execução persistida com base selecionada e política separada](execucoes-configuraveis.md). B12b integra [importação, mapeamento, revisão e publicação pela interface](recomendadores-web.md), inclusive recuperação de prévia e resolução de duplicatas por exclusões explícitas. As bases dos checks são reconstruções sintéticas; não representam os datasets originais nem encerram a avaliação científica de Felipe ou Ednaldo.

## Bases de testes com catálogo

B15c acrescenta [importações/bases schema 2 para a demonstração E21](testrec-execucoes-publicadas.md). O spec fixa a publicação do catálogo; a prévia preserva seu conteúdo e valida associações por ID. Ausência de associação é inválida e exige exclusão explícita; `[]` permanece conhecido e vazio. RNF continua usando schema 1. B17a acrescenta a [interface de importação de testes](testrec-interface.md), com seleção explícita de catálogo, referência preservada, invalidação da prévia após alterações e recuperação por ID.
