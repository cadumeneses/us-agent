# Publicação de definições de recomendadores

B09 implementa persistência, publicação e consulta das definições pelo backend. A [ADR 003](decisoes/003-publicacao-definicao-e-base.md) separa a definição publicada da base escolhida em cada execução. B11 acrescentou execução persistida; B12a/B12b integraram seleção, execução e editores/publicação na [interface](recomendadores-web.md).

## Contrato publicado

Uma publicação contém a definição completa — atributos de entrada/saída, tipos, cardinalidades, papéis, vínculos e método/versão/parâmetros —, as taxonomias exatas e a identificação da implementação. O pacote inteiro tem hash `us-agent-json-v1`, calculado sobre seu conteúdo; datas e autoria ficam no envelope do registro.

O primeiro método publicável é `ramos_2019_manhattan_k1_v2`, versão `2`, com `k: 1` e adaptador atual `rnf-v2-profile-adapter-v3`. Publicações v2 sem mapeamento científico de IDs continuam suportadas na execução; a leitura histórica preserva sua identificação original. Um método ainda não implementado ou atributo incompatível não é publicado. Isso inclui a tentativa de usar uma aproximação de Ednaldo sem política confirmada.

Salvar rascunho valida a estrutura genérica e não publica conteúdo. A validação da implementação e das taxonomias ocorre ao publicar. O corpo do `PUT` deve ter `state: "draft"`; não se publica declarando um estado no JSON recebido.

As referências taxonômicas são carregadas do PostgreSQL pelo ID/versão declarados, verificadas contra o hash publicado e congeladas no pacote. O cliente não fornece snapshots substitutos na operação de publicação. Não há busca por “última versão”. Dependências obrigatórias e opcionais precisam estar publicadas e íntegras.

## Rotas

Prefixo: `/api/internal/recommender-definitions`.

| Método e caminho relativo | Resultado |
| --- | --- |
| `GET /` | Metadados com filtros opcionais `id`/`state` e paginação `limit` (1–100; padrão 30) e `offset`. |
| `GET /:id/versions/:version` | Recupera a definição e, se publicada, o pacote completo e seu hash. |
| `PUT /:id/versions/:version` | Cria ou substitui rascunho; ID/versão do corpo devem coincidir com o caminho. |
| `POST /:id/versions/:version/publish` | Publica o rascunho salvo na mesma transação que fixa as dependências. |
| `POST /:id/versions/:version/retire` | Retira uma publicação, preservando seu pacote e hash. |

Retirar aceita corpo ausente ou `{}`. Publicar também aceita `{ "expectedDraftSha256": "<SHA-256>" }`, sem substituições de conteúdo. Esse parâmetro opcional é sempre enviado pela interface B12b. O registro retorna `draftSha256`, calculado sobre a definição com `state: "draft"`; o serviço confere esse hash depois de bloquear a linha. Divergência retorna 409 antes de publicar. Repetir a publicação com o hash correto retorna o mesmo registro, inclusive após perda da resposta anterior.

Uma edição de versão publicada ou retirada retorna 409. Para alterar, copie a definição para outra versão, defina `state: "draft"`, salve e publique. Não há incremento automático nem substituição silenciosa. O hash do rascunho é distinto do hash do pacote publicado e não o substitui.

Ausência de versão retorna 404. Erros estruturais e incompatibilidade/dependência inválida retornam 422; erros estruturais incluem os caminhos dos campos. Divergência de identidade entre caminho/corpo e tentativa de substituir conteúdo na operação de publicação retornam 400.

O acesso reutiliza a política da API interna descrita em [taxonomias independentes](taxonomias-independentes.md): chave quando configurada e bloqueio em Vercel sem chave. A autoria é técnica (`local-development`/`internal-api`). Identidade pessoal, permissões e isolamento entre organizações continuam em B13.

Exemplo para a API de desenvolvimento local sem chave configurada:

```powershell
$definitionJson = Get-Content -Raw -Encoding utf8 config/recommenders/rnf-v2.draft.json
$definitionUri = 'http://localhost:3333/api/internal/recommender-definitions/rnf-ramos/versions/2-draft.1'
Invoke-RestMethod -Uri $definitionUri -Method Put -ContentType 'application/json; charset=utf-8' -Body $definitionJson
Invoke-RestMethod -Uri "$definitionUri/publish" -Method Post -ContentType 'application/json' -Body '{}'
Invoke-RestMethod -Uri $definitionUri -Method Get
```

O exemplo RNF padrão não declara novas taxonomias de contexto, por isso seu pacote tem lista de dependências vazia. Para usar `taxonomy_node`, publicar primeiro os catálogos de B08 e inserir as referências exatas nos atributos. Com chave configurada, acrescentar o cabeçalho de autorização. A migration 018 deve estar aplicada no ambiente usado.

## Integridade e concorrência

`recommender_definition_versions` mantém rascunhos, pacotes publicados e estado de retirada. `recommender_definition_taxonomies` fixa as referências por chave estrangeira e hash. A transação bloqueia a definição e adquire locks compartilhados nas taxonomias em ordem determinística; uma retirada/edição concorrente não pode atravessar a validação e o commit da publicação.

Triggers protegem o pacote, o hash, a identidade e os vínculos após publicação. A transição de publicação exige correspondência com os vínculos persistidos. Falha em qualquer etapa desfaz pacote, vínculos e estado. O check inclui uma falha forçada depois da inserção dos vínculos e confirma rollback completo, além de duas publicações concorrentes e uma corrida com retirada de taxonomia.

Uma taxonomia retirada posteriormente continua no pacote com seu estado/conteúdo no momento da publicação. O estado atual não reescreve a evidência anterior. Da mesma forma, uma definição retirada tem envelope `state: "retired"`, mas mantém `definition.state: "published"` dentro do pacote histórico. Não há reativação de versões retiradas.

A leitura confere conteúdo e hash sem exigir que a implementação instalada continue sendo a mesma. Isso permite consultar evidência histórica; não autoriza executá-la com uma implementação diferente. A elegibilidade para novas execuções precisará verificar a implementação e os estados atuais das dependências.

## Verificação e limites

Após o build, executar `npm.cmd run check:recommender-definitions`. O script usa somente PostgreSQL local, aplica migrations em um schema temporário e o remove ao terminar. Verifica API, estados, integridade, concorrência, rejeições e rollback. Também recupera uma publicação e compara uma cópia temporária em modo de simulação com os oito resultados RNF congelados, sem alterar o pacote publicado.

Essa comparação do check de publicação continua sendo uma simulação controlada. B10 disponibilizou [bases versionadas](importacao-bases.md), B11 acrescentou [execução persistida](execucoes-configuraveis.md) e B12 integrou a interface e [avaliações por item](avaliacoes-configuraveis.md). Publicar não consulta histórico operacional nem escolhe uma base automaticamente. As fontes e avaliações empíricas de Felipe/Ednaldo permanecem na [matriz de fidelidade](referencias-e-fidelidade.md).
