# Avaliação das sugestões e destinos explícitos

B12c registra aceitação/rejeição sem alterar a execução original. Referência de desenho: [ADR 004](decisoes/004-destinos-e-avaliacoes.md). Interface: [roteiro web](recomendadores-web.md).

## Contrato HTTP

Rotas sob `/api/internal/recommendation-runs`, com a autorização interna já existente. A identidade pessoal e o isolamento por organização continuam em B13.

| Método e caminho | Função |
| --- | --- |
| `GET /:id/review` | Pacote consistente com referência da execução, destino confirmado e decisões preservadas. |
| `GET /:id/destinations/:classificationId` | Prévia da classificação operacional explicitamente escolhida, com snapshot/hash. |
| `POST /:id/target` | Confirma um destino imutável para todos os itens da execução. |
| `POST /:id/decisions` | Registra uma avaliação imutável por item; aceitação e vínculo são transacionais. |

Confirmação para entrada genérica:

```json
{"runSha256":"<hash da execução>","target":{"kind":"input"}}
```

Confirmação para história operacional:

```json
{
  "runSha256": "<hash da execução>",
  "target": {
    "kind": "classification",
    "classificationId": "<ID escolhido na aplicação>",
    "expectedSha256": "<hash da prévia do destino>",
    "justification": "Correspondência conferida manualmente."
  }
}
```

Decisão:

```json
{
  "id": "<UUID da decisão>",
  "runSha256": "<hash da execução>",
  "targetSha256": "<hash do destino confirmado>",
  "itemKey": "<chave da sugestão original>",
  "decision": "accepted",
  "notes": "Observação da avaliação."
}
```

`decision` aceita `accepted` ou `rejected`. `notes` tem até 2.000 caracteres e assume texto vazio se ausente. Não há substituição de sentença, tipo, atributo ou pontuação. Item inexistente, conteúdo inválido ou IDs operacionais não canônicos retornam 422. Classificação ausente retorna 404. Hash divergente, destino já confirmado diferente, avaliação conflitante ou contexto operacional alterado retornam 409.

## Destino e identidade

O destino começa sem confirmação. A escolha `input` identifica o snapshot da entrada e a definição publicada exata; aceitar cria um vínculo genérico nessa versão da entrada. Não escreve nas histórias operacionais, mesmo quando um ID importado coincide com um ID numérico local.

Na escolha `classification`, a pessoa seleciona uma história da aplicação, confere texto/projeto/rótulos e justifica a correspondência. A lista exibe classificações aceitas/revisadas/reclassificadas com o par da execução, dentre as histórias retornadas pela API atual (até 10.000). Não há seleção automática pelo ID ou texto importado. A API confere novamente o estado, o par e se a classificação é a mais recente.

O destino operacional preserva identidade, texto, projeto, rótulos, estado, taxonomia, perfil do projeto e tarefas. A confirmação exige o hash da prévia; aceitar exige o mesmo contexto confirmado. Os RNFs já vinculados são consultados para deduplicação, mas não integram esse hash: aceitar outro item não invalida as demais avaliações. Alterar o destino confirmado exige outra execução; rejeitar continua possível quando o contexto operacional mudou, pois não cria vínculo.

## Persistência e concorrência

A migration 021 acrescenta `recommender_run_targets`, `recommender_item_decisions` e `recommender_item_links`. Triggers impedem alterar/excluir esses registros. A execução e os snapshots publicados não são regravados.

Há uma decisão por execução/item. O mesmo UUID e conteúdo retorna o registro original. Outro UUID com conteúdo equivalente também retorna a avaliação já existente; decisão, destino ou observação diferentes são recusados. O cliente deve usar o ID retornado pela API. A interface conserva UUID e observação após falha de rede e só apresenta sucesso depois da resposta.

Os locks ordenam confirmação/avaliação por execução, repetição por UUID e criação do vínculo. Para história operacional, o lock da classificação é o mesmo usado pela edição manual e pelo fluxo RNF anterior. Duas execuções aceitando o mesmo item para a mesma classificação resultam em um único RNF operacional. Equivalências de escrita seguem `normalizeNfr`/`nfrKey` do método preservado.

Vínculos genéricos são únicos por definição publicada, snapshot completo da entrada, método e chave do item. Vínculos operacionais são únicos por classificação escolhida, método e chave. A decisão preserva a sugestão original, observação, referências da execução/destino e efeito naquele momento (`input_only`, `created` ou `already_present`). Autoria técnica e data ficam no envelope imutável.

Rejeitar não cria vínculo. Uma falha na gravação final desfaz tanto o vínculo genérico quanto a inserção operacional. Se um RNF for posteriormente removido pela edição manual da história, a decisão histórica permanece como evidência do que ocorreu naquele momento; não se afirma que o vínculo continua ativo.

## Histórico e evidências

As avaliações podem ser consultadas após retirada de definição/base, pois dependem da execução preservada. Replay continua comparando apenas o resultado bruto, explicação e projeção. **Baixar evidência com avaliações** exporta execução, destino e decisões separadamente; **Baixar evidência JSON** continua exportando somente a execução original.

Após o build, `npm.cmd run check:recommendation-runs` executa também os cenários de avaliação de `scripts/check-recommendation-review.mjs`, dentro do mesmo schema local descartável. Cobre colisão de ID importado/local, repetição concorrente, dois vínculos concorrentes para a mesma história, rollback forçado, contexto alterado, imutabilidade e replay.

`npm.cmd run check:recommender-browser` abre Edge headless no Windows e percorre o vertical real com frontend compilado, API e PostgreSQL local em outro schema descartável. Não carrega `.env` nem chama modelos externos. Exige API/web compiladas, Docker/PostgreSQL local e Edge instalado no caminho padrão. Produz resumo e capturas em `tmp/browser_check_<UUID>/`; o banco de teste é removido ao terminar. O perfil isolado do navegador fica nesse diretório de artefatos.

Aceitação humana, similaridade e relevância experimental são medidas diferentes. Não foi implementada adaptação de sentenças nesta etapa. As avaliações não retroalimentam a base publicada; o piloto e as fontes de Felipe/Ednaldo continuam nas [pendências](pendencias-e-proximos-passos.md).
