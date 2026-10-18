# Execuções publicadas da demonstração E21

Data: 18/10/2026. B15c/B16b, [entrega 017](entregas/017-testes-no-executor-comum.md). Este incremento liga o catálogo, a importação e a execução pelos endpoints comuns. A definição é uma demonstração das equações Manhattan de E21, restrita a dados sintéticos. Q01/Q02 continuam abertas; a configuração Euclidiana selecionada na tese não foi reproduzida.

## Identidade e configuração

O rascunho [testrec-equations.draft.json](../config/recommenders/testrec-equations.draft.json) declara o método `us_agent_e21_equations_demo_v1`, versão `1`, adaptador `e21-equations-adapter-v1` e política `e21-equations-policy-v1`. Pode ser salvo e publicado em `/api/internal/recommender-definitions/:id/versions/:version`, usando os mesmos contratos e validações de dependências do RNF. A publicação aceita `expectedDraftSha256` para fixar a revisão.

Os parâmetros explicitam a origem E21, representação binária orientada ao alvo, k=3, equações 4.2/4.3, heurística pelo número de testes, desempates residuais e tratamento de casos insuficientes/desconhecidos. Alterar esses parâmetros não publica outra política implicitamente. Módulo e operação são características, sem os filtros do RNF. A entrada não exige `classification_id` nem `selection.labelIndex`.

Os bindings permitem renomear os oito atributos sem alterar seu significado, vincular taxonomias independentes aos campos categóricos compatíveis e acrescentar contexto. O catálogo de testes é uma dependência da base e da execução, não uma taxonomia nem uma base embutida na definição. O rascunho anterior `testrec_e21_data_contract_v1` permanece apenas um contrato e não é publicável como recomendador. Uma projeção interna explícita permite reutilizar os módulos congelados de representação/equações; ela fica registrada na execução e não substitui a identidade publicada.

## Importar e publicar a base

Enviar `spec` e `file` como multipart para `POST /api/internal/recommender-datasets/imports/preview`. O spec mantém formato, mapeamento, origem e referência da definição, com duas diferenças em relação ao RNF:

```json
{
  "schemaVersion": 2,
  "catalog": {
    "id": "ID do catálogo publicado",
    "version": "versão exata",
    "format": "us-agent-json-v1",
    "sha256": "SHA-256 da publicação completa do catálogo"
  }
}
```

Esse trecho complementa o spec; não é um upload completo. A origem da base deve declarar `source.authorization.basis="synthetic"`, coerente com o catálogo sintético. Os campos obrigatórios e limites do [importador estruturado](importacao-bases.md) continuam válidos. Cada registro da base deve informar a lista de IDs de testes: ausência significa desconhecido e invalida a linha; `[]` significa associação conhecida e vazia. IDs inexistentes ou repetidos, plataformas vazias e valores com espaços externos geram erros localizados. O índice de IDs do catálogo é construído uma vez por importação.

A prévia preserva o catálogo completo, a definição e o arquivo original. Publicar a base continua exigindo `importId`, `previewSha256` e `excludedOrdinals` explícitos em `POST /recommender-datasets/:id/versions/:version/publish`. Linhas inválidas não são descartadas automaticamente. A publicação schema 2 registra a referência exata do catálogo e as associações selecionadas. Um catálogo retirado impede nova prévia ou publicação dependente; versões já publicadas permanecem imutáveis.

## Executar, consultar e repetir

`POST /api/internal/recommendation-runs` recebe:

```text
{
  id: UUID novo,
  definition: { id, version, format, sha256 },
  dataset: { id, version, format, sha256 },
  catalog: { id, version, format, sha256 },
  input: { id, values: atributos configurados, provenance: origem da entrada }
}
```

As três referências precisam corresponder entre si e aos conteúdos publicados. A requisição não aceita uma seleção de rótulo RNF. O alvo pode omitir associações de saída ou informar `[]`; respostas não vazias no alvo bloqueiam a demonstração, evitando vazamento. São excluídos o próprio registro e a mesma história. Menos de três candidatos bloqueiam; três vizinhos sem testes produzem `no_items`, sem inventar um substituto. Similaridade zero não é removida silenciosamente.

O envelope schema 2 preserva requisição, definição, base, catálogo completo, representação, ranking, exclusões, contribuições por teste e versões do software. Os itens incluem o artefato original, título, Gherkin e metadados. A chave do item inclui a referência da publicação do catálogo. Publicar texto diferente em outra versão não altera artefatos históricos nem seus hashes.

`GET /recommendation-runs`, `GET /recommendation-runs/:id` e `POST /recommendation-runs/:id/replay` continuam os endpoints comuns. UUID repetido com o mesmo corpo recupera a execução; corpo diferente retorna 409. Replay usa os snapshots preservados, inclusive depois da retirada da definição, base ou catálogo. Novas execuções exigem dependências disponíveis, com locks mantidos até o fim da transação. O executor recusa mais de 10.000 registros ou mais de 2.000.000 de comparações dimensão × registro antes de construir os vetores; são guardas técnicas, não metas de desempenho experimental.

A migration [023](../database/migrations/023_test_case_dataset_runs.sql) amplia somente as restrições de versão JSON nas tabelas de prévias, bases e execuções. Não reescreve dados nem cria novas tabelas. Formato e executor RNF schema 1 permanecem preservados.

## Verificação e limites

```powershell
npm.cmd run build -w @us-agent/api
npm.cmd run check:testrec-runs
npm.cmd run check:testrec-runs -- --output tmp/execucoes-testes-novas.json
npm.cmd run check:testrec-runs -- --replay docs/evidencias/b16b/published-runs.json
```

O check HTTP usa apenas `127.0.0.1:5432/us_agent`, cria e remove um schema aleatório validado e não lê `.env`. Verifica referências, erros/exclusões, versões de catálogo, scores sintéticos, concorrência, rollback, imutabilidade, retirada e replay. O pacote preserva cinco execuções representativas e hashes das fontes. O modo `--replay` verifica os arquivos e recalcula resultados offline, sem banco ou provedores. Exportar exige arquivo novo. Recompilar a API após alterar fontes é necessário antes de executar o check.

A [interface B17a](testrec-interface.md) configura/importa/executa a demonstração e recupera seu histórico, com apresentação específica de artefatos e contribuições. O leitor comum distingue os envelopes; o leitor RNF específico continua protegido. B17b acrescenta [avaliação humana persistida e cópias versionadas](avaliacoes-testes.md) em namespace próprio, com destino na entrada preservada. Os endpoints de destino/decisão RNF recusam execuções schema 2 com 422, evitando criar vínculos RNF a partir de testes. A [ADR 006](decisoes/006-avaliacoes-e-copias-testes.md) define o contrato de cópias, mantendo origem e versões.

O pacote é evidência técnica sintética. Não fornece dados originais, métricas de qualidade empírica, reprodução Euclidiana ou aprovação do professor. Permanecem as [pendências científicas e de desenvolvimento](pendencias-e-proximos-passos.md).
