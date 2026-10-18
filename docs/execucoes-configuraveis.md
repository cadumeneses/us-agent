# Execuções com definição e base explícitas

B11 implementa execução persistida pelo backend: uma definição publicada, uma versão de base escolhida e uma entrada validada. O serviço não consulta o histórico operacional para completar candidatos. O resultado conserva os estados `blocked`, `no_candidates`, `no_items` e `completed`.

## Contrato e rotas

Prefixo: `/api/internal/recommendation-runs`, com a mesma política de chave interna das etapas anteriores. Autoria pessoal, permissões e isolamento entre organizações continuam em B13.

| Método e caminho relativo | Resultado |
| --- | --- |
| `POST /` | Executa e persiste; recebe o corpo descrito abaixo e retorna 201. |
| `GET /` | Metadados paginados, com filtros opcionais `definitionId`/`datasetId`, `limit` (1–100, padrão 30) e `offset`. |
| `GET /:id` | Recupera evidência completa e verifica hashes. |
| `POST /:id/replay` | Recalcula a partir dos snapshots preservados, sem criar ou alterar a execução original. Corpo ausente ou `{}`. |

O corpo da execução tem:

```json
{
  "id": "<UUID gerado pelo cliente>",
  "definition": { "id": "rnf-ramos", "version": "2-draft.1", "format": "us-agent-json-v1", "sha256": "<hash do pacote da definição>" },
  "dataset": { "id": "base-escolhida", "version": "1", "format": "us-agent-json-v1", "sha256": "<hash da base publicada>" },
  "input": { "id": "<ID da entrada>", "values": {}, "provenance": { "source": "manual" } },
  "selection": { "labelIndex": 0 }
}
```

Os placeholders devem ser substituídos e `values` deve conter os atributos exigidos pela definição, inclusive os específicos do RNF. O cliente não envia conteúdo de base substituto, fórmulas, filtros ou opções não declaradas. A base precisa apontar para o mesmo ID, versão e hash de definição; não há busca automática por “última versão” nem compatibilidade inferida por semelhança de campos.

O UUID permite repetição idempotente: a mesma requisição retorna a mesma execução; reutilizá-lo com outro conteúdo retorna 409. Duas solicitações concorrentes com o mesmo UUID não criam duas execuções. Uma repetição de execução já registrada continua retornando o original após retirada das dependências; uma execução nova é recusada nessas condições.

Definição/base/taxonomias precisam estar publicadas e disponíveis para novas execuções. A transação bloqueia as dependências durante validação e gravação. Hash errado, versão ausente, base de outra definição, tipos/IDs inválidos e implementação não suportada retornam 422 sem execução parcial. Falta estrutural de chave obrigatória é erro de validação; perfil RNF estruturalmente válido mas incompleto gera `blocked` preservado no histórico.

## Evidência e replay

`recommender_runs` preserva a requisição, definição completa, base escolhida, projeção efetivamente comparada, seleção do par, resultado e explicação. Cada snapshot tem formato/hash próprio e o pacote completo também tem hash. A evidência é protegida contra atualização/exclusão. Datas, autoria técnica e duração ficam no envelope.

A duração mede carregamento/validação das dependências, projeção, cálculo e construção dos snapshots; não inclui a gravação/commit finais nem todo o tempo de rede. O registro identifica adaptador efetivo, adaptador declarado na publicação, política, núcleo KNN, Node, ICU e locale. Isso ajuda a interpretar o desempate textual herdado do legado; similaridade continua sendo uma medida de correspondência, não probabilidade de correção.

A explicação informa candidatos da base selecionada, ID do registro nessa base, vetor, distância, similaridade, posição ou motivos de exclusão. IDs de história/classificação do resultado são identidades declaradas na origem, não chaves estrangeiras obrigatórias da aplicação. Não devem ser tratados automaticamente como links para classificações operacionais.

Replay usa exclusivamente os snapshots registrados e pode verificar uma execução após retirada da definição, base ou taxonomia. Confere a implementação disponível e os hashes de resultado, explicação e projeção; informa `verified` e cada comparação. Não substitui snapshots diante de divergência. Uma versão de implementação não disponível gera 409. Histórico legível e reexecução de implementação antiga são capacidades distintas.

## Núcleo KNN e política RNF

O módulo `knn.ts` recebe do chamador representação, elegibilidade, distância/similaridade e desempate. Não contém filtro de módulo/operação nem objetivo de projeto. A agregação de itens também fica fora dele. Um teste usa outro critério de ranking e k=2 para verificar essa separação; isso não publica nem valida o método de Ednaldo.

O primeiro método executável permanece `ramos_2019_manhattan_k1_v2`: dimensões binárias do alvo, Manhattan normalizada, k=1, filtros atuais, desempate por identificador, coocorrência binária e ausência de troca de vizinho sem RNFs. A política extraída tem ID `ramos-v2-policy-v1`; o núcleo tem ID `policy-knn-v1`. O arquivo legado `nfr-engine.ts` foi preservado como referência de comparação.

O novo caminho compara os oito snapshots congelados e casos adicionais com o legado. Publicações anteriores do adaptador v2 continuam aceitas sem mapeamento científico de IDs. A execução efetiva usa `rnf-v2-profile-adapter-v3`, registrando a compatibilidade. Métodos desconhecidos, k diferente do implementado ou parâmetros extras continuam recusados.

Há duas guardas de entrada adicionais para dados genéricos: vetor totalmente vazio não produz NaN e fica bloqueado; IDs que colidem no desempate numérico/textual, como `4` e `04` na mesma base, são rejeitados como ambíguos. O serviço não escolhe um vencedor arbitrário nem renomeia IDs. Os IDs de história devem usar o mesmo espaço de identidade entre alvo e base quando identificarem o mesmo artefato; não há inferência de equivalência entre fontes.

## Mapeamento explícito de taxonomias científicas

Atributos científicos antes representados por `category` podem usar `taxonomy_node`, mantendo o restante do contrato do vínculo RNF. A definição deve declarar `method.parameters.legacy_names`, por exemplo:

```json
{
  "k": 1,
  "legacy_names": {
    "platforms": { "browser": "Web" },
    "tasks.category": { "task-six": "t6", "task-seven": "t7" }
  }
}
```

As chaves usam o ID configurado do atributo e, em registros, o campo escalar. O exemplo pressupõe atributos `platforms` e `tasks.category` ligados às respectivas taxonomias publicadas. É obrigatório cobrir exatamente os nós selecionáveis, usar nomes não vazios sem espaços externos e não repetir nomes no mesmo mapeamento. Chaves sem campo científico correspondente, nós extras e coberturas incompletas impedem publicação/execução.

O nome de apresentação do nó não é usado como correspondência implícita. A entrada/base conserva os IDs e a projeção guarda os nomes legados efetivamente comparados. Namespaces de linguagem/framework/plataforma continuam separados. Contextos adicionais não precisam desses mapeamentos porque não entram no cálculo. Objetivo continua com enumeração explícita e não vira dimensão por essa opção.

O mapeamento não cria equivalência automática entre versões de bases/definições: mudar uma referência exige nova publicação e uma base correspondente. As normalizações e o recorte dos itens RNF permanecem os do método, inclusive a normalização de atributos de qualidade e deduplicação de itens.

## Verificação e limites

Após o build, `npm.cmd run check:recommendation-runs` percorre definição → importação → publicação da base → execução → consulta → replay em schema temporário do PostgreSQL local. Inclui oito comparações completas, troca entre bases, mapeamento de IDs, concorrência, rollback e retirada de dependências durante a validação.

O executor tem limite explícito de 2.000.000 posições de vetor estimadas por dimensões do alvo × registros da base. Exceder retorna 422; não trunca candidatos ou dimensões. Metas de duração e volume ainda serão fundamentadas no piloto B14.

B11 entrega execução/consulta/replay por API. B12a/B12b integram execução, configuração/publicação e importação pela [web](recomendadores-web.md). B12c acrescenta [avaliações e destinos explícitos](avaliacoes-configuraveis.md), verificando o vertical em navegador. Esses registros ficam separados dos snapshots brutos e não alteram o replay. Avaliação empírica e questões científicas dos outros métodos permanecem na [matriz de fidelidade](referencias-e-fidelidade.md).

## Segundo método no backend comum

B15c/B16b acrescentam [execuções schema 2 da demonstração E21](testrec-execucoes-publicadas.md), com catálogo explícito e artefatos de teste completos. O dispatcher delega o RNF ao executor original e compara seus oito envelopes/saídas sem alterações. Revisão/destino RNF recusam execuções de teste com 422 até existir o contrato específico. A migration 023 admite ambas as versões JSON, preservando os dados existentes.
