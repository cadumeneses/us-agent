# Taxonomias independentes e versionadas

B08 implementa catálogos separados da taxonomia WIS. Cada catálogo tem ID, versão, origem, nome e nós identificados com nome, descrição e pai opcional. O intercâmbio inicial é JSON; listas e hierarquias não dependem dos termos domínio, módulo e operação.

## Demonstração e API

Após o build, `npm.cmd run check:recommender-taxonomies` cria um schema temporário no PostgreSQL **local**, aplica as migrations nele e percorre publicação, consulta, validação, retirada e vínculos com atributos. O schema é removido ao terminar. O comando não lê `.env` nem chama provedores. Também executa os oito casos RNF com duas dependências publicadas e compara as saídas inteiras.

Os exemplos usados pelo check estão em [lista de linguagens](../config/taxonomies/languages-demo.v1.json) e [árvore sintética de critérios](../config/taxonomies/acceptance-demo.v1.json). A hierarquia de critérios demonstra capacidade estrutural e não é atribuída ao método de Ednaldo.

Rotas disponíveis em `/api/internal/recommender-taxonomies`:

| Método e caminho relativo | Comportamento |
| --- | --- |
| `GET /` | Lista metadados, com filtros opcionais `id`/`state` e paginação `limit` (1–100; padrão 30) e `offset`. Não retorna os nós nessa listagem. |
| `GET /:id/versions/:version` | Consulta conteúdo e snapshot exatos, inclusive após retirada. |
| `PUT /:id/versions/:version` | Cria ou substitui um rascunho completo validado; corpo e caminho devem ter ID/versão iguais. |
| `POST /:id/versions/:version/publish` | Valida novamente o conteúdo salvo e publica atomicamente. Repetir retorna a mesma publicação. |
| `POST /:id/versions/:version/retire` | Retira uma publicação de novas seleções, preservando conteúdo/hash e consulta. Repetir é idempotente. |

Retirar aceita corpo ausente ou `{}`. Publicar também aceita `{ "expectedDraftSha256": "<SHA-256>" }`; a interface B12b sempre envia o hash do snapshot revisado. O serviço confere o hash depois de bloquear a linha e retorna 409 se o rascunho mudou. Corpo vazio permanece aceito para clientes anteriores. Não são aceitas substituições de conteúdo nessas operações.

Uma edição publicada retorna 409 e exige nova versão no `PUT`; versões retiradas não podem voltar a ser rascunho ou ser republicadas. Erros estruturais/de grafo retornam 422 com `issues` e caminhos dos nós; ausência retorna 404 e divergência entre caminho/corpo retorna 400. A [interface](recomendadores-web.md) permite editar, revisar e publicar listas/árvores; publicações ficam somente para consulta ou cópia para nova versão.

As rotas reutilizam a política existente da API interna: quando `INGEST_API_KEY` está configurada, exigem `Authorization: Bearer ...`; em Vercel, a ausência da chave bloqueia o acesso. Em desenvolvimento fora de Vercel, a política legada admite acesso sem chave. A autoria registrada é técnica (`internal-api` ou `local-development`), sem atribuição de identidade pessoal. Autenticação por pessoa, isolamento entre organizações e permissões completas pertencem a B13.

Exemplo em PowerShell para a API local, com a configuração de acesso correspondente ao ambiente:

```powershell
$catalogJson = Get-Content -Raw -Encoding utf8 config/taxonomies/languages-demo.v1.json
$catalogUri = 'http://localhost:3333/api/internal/recommender-taxonomies/technology-demo/versions/1'
Invoke-RestMethod -Uri $catalogUri -Method Put -ContentType 'application/json; charset=utf-8' -Body $catalogJson
Invoke-RestMethod -Uri "$catalogUri/publish" -Method Post -ContentType 'application/json' -Body '{}'
```

O exemplo pressupõe o desenvolvimento local sem chave; com chave configurada, acrescentar o cabeçalho de autorização. A migration 017 deve estar aplicada no ambiente usado. O limite global do corpo JSON da API continua em 1 MB.

## Estrutura, seleção e integridade

Listas exigem todos os `parentId` nulos. Árvores aceitam múltiplas raízes e profundidades distintas, sem impor três níveis; cada nó tem no máximo um pai. IDs duplicados, pais inexistentes, ciclos e autorreferências são rejeitados. Um catálogo deve ter de 1 a 5.000 nós. O percurso iterativo também foi testado com 1.500 níveis, sem depender da pilha de recursão.

`selection: "leaf"` permite somente nós sem filhos. `"any"` permite qualquer nível. Seleção simples ou múltipla é determinada por `cardinality` do atributo. Não há expansão implícita para ancestrais/descendentes, equivalência entre nomes nem propagação de relações ao KNN.

A tabela `recommender_taxonomy_versions` é independente das tabelas WIS. A publicação bloqueia a linha, revalida o grafo e grava estado, hash `us-agent-json-v1`, data e autoria técnica na mesma transação. Duas publicações concorrentes convergem para a mesma versão. Triggers impedem modificar identidade, conteúdo e hash publicados, excluir publicação e reativar versão retirada. O serviço confere o conteúdo com o hash armazenado ao consultá-lo.

Rascunhos salvos devem estar estruturalmente completos e válidos. B12b mantém a edição parcial no formulário, sem deixar grafo inválido salvo pela API. A publicação revalida o conteúdo. Conteúdo retirado mantém o mesmo hash: o hash identifica o conteúdo, enquanto o estado fica no envelope.

## Vínculo com atributos

Um atributo ou campo escalar de registro pode declarar:

```json
{
  "type": "taxonomy_node",
  "taxonomy": {
    "id": "technology-demo",
    "version": "1",
    "format": "us-agent-json-v1",
    "sha256": "<hash retornado na publicação>"
  }
}
```

O placeholder acima deve ser substituído pelo hash real de 64 caracteres. O valor do atributo é um ID de nó, por exemplo `"typescript"` ou `["typescript"]` conforme a cardinalidade. O nome `"TypeScript"` não é substituído silenciosamente pelo ID. A validação exige conteúdo publicado com ID, versão e hash exatos, mesmo quando o atributo opcional está ausente na entrada. Também confere nós e regra de folhas.

`validateRecommendationInput(definition, input, dependencies)` recebe dependências no formato `{ state, snapshot }`, extraído das respostas de consulta/publicação. Ele valida múltiplos catálogos no mesmo artefato sem exigir US. `simulateConfiguredNfr(definition, input, dataset, labelIndex, dependencies)` faz a mesma validação em alvo e base, e congela as dependências selecionadas na evidência. Versão faltante, retirada ou hash divergente não é substituída por outra versão disponível.

No RNF v2, contextos usam `taxonomy_node` sem entrar no cálculo. B11 acrescentou [mapeamento explícito de IDs científicos para nomes legados](execucoes-configuraveis.md): a troca de representação exige `legacy_names` completo e não ambíguo, em outra publicação. O adaptador passou de v2 para `rnf-v2-profile-adapter-v3`; o recorte metodológico continua igual e a projeção efetiva fica na evidência.

## Limites desta entrega

B09 acrescentou [definições publicadas](publicacao-definicoes.md), B10 implementou [importação de bases](importacao-bases.md) e B11 acrescentou [execução, mapeamentos e replay](execucoes-configuraveis.md). Ainda faltam edição/importação/formulários/histórico pela interface (B12) e controle por pessoa/organização (B13). Novos usos exigem dependências publicadas; o replay preserva os snapshots mesmo após retirada.
