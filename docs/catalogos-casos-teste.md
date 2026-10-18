# Catálogos de casos de teste publicados

Data: 18/10/2026. Escopo **B15b**, dependência da integração do segundo recomendador. Complementa o [contrato E21](testrec-contrato-dados.md) e a [demonstração das equações](testrec-equacoes-demonstracao.md). O catálogo é uma coleção de artefatos de saída, distinta de taxonomias e das associações entre histórias e testes. Publicá-lo não inventa associações nem publica o método TestRec.

## Conteúdo e publicação

O JSON utiliza o contrato já existente, com `schemaVersion`, `id`, `version`, `source` e `items`. Cada item preserva ID, título, Gherkin e os campos opcionais de propósito, modo de execução e metadados. Títulos iguais são permitidos; IDs duplicados são recusados. Os passos são preservados como texto, sem execução ou validação de sintaxe Gherkin.

A publicação recebe um arquivo JSON UTF-8 de até 5.000.000 bytes e 10.000 itens, junto de uma declaração `spec`:

```json
{
  "expectedFileSha256": "<SHA-256 hexadecimal dos bytes exatos do arquivo revisado>",
  "authorization": {
    "basis": "synthetic",
    "reference": "Descrição da origem e da base declarada para uso"
  }
}
```

`basis` aceita os valores já utilizados na importação de bases: `synthetic`, `public-license`, `permission` ou `owned`. Origem `source.kind=synthetic` exige `basis=synthetic`, e a combinação inversa também é recusada. A declaração registra o fundamento informado; não comprova licença ou autorização dos autores. O formato atual admite `synthetic` e `source_example`, sem importar bases empresariais/restritas nesta entrega.

O servidor rejeita UTF-8 inválido, JSON malformado, chaves repetidas, campos desconhecidos, IDs repetidos, hash divergente e ID/versão diferentes do caminho. Não publica subconjuntos silenciosamente. O arquivo original é guardado como bytes, incluindo BOM, espaços e finais de linha. O pacote imutável fixa o catálogo completo, nome/tamanho/hash/BOM do arquivo, declaração de uso e versão do importador `test-case-json-v1`.

Há três hashes com funções diferentes: bytes originais, conteúdo normalizado do catálogo e pacote de publicação. Uma futura execução deve referenciar o **pacote de publicação** por ID, versão, formato e hash. Mesmo catálogo semântico com outro arquivo/nome/declaração altera esse pacote; a mesma versão não pode ser sobrescrita. Mudanças exigem nova versão.

## API e persistência

Base: `/api/internal/test-case-catalogs`, sob o mesmo perímetro de autorização da API existente. Autoria continua técnica (`local-development` ou `internal-api`), sem identidade pessoal ou isolamento organizacional novo.

| Operação | Caminho relativo e comportamento |
| --- | --- |
| Publicar | `POST /:id/versions/:version/publish`, multipart com um arquivo `file` e campo textual JSON `spec`; retorna a publicação (HTTP 200). Repetição idêntica é idempotente; alteração na mesma versão retorna 409. |
| Listar | `GET /`, com `id`, `state`, `limit` e `offset` opcionais; retorna resumos sem carregar os arquivos originais. |
| Consultar | `GET /:id/versions/:version`; reconstrói e verifica o pacote contra os bytes originais, conteúdo e hashes persistidos. |
| Recuperar origem | `GET /:id/versions/:version/original`; retorna bytes exatos, `application/octet-stream` e `X-Content-SHA256`. |
| Retirar | `POST /:id/versions/:version/retire`, corpo vazio; preserva conteúdo e arquivo históricos, recusando republicação daquela versão. |

A [migration 022](../database/migrations/022_test_case_catalogs.sql) cria uma tabela independente. Trigger impede alterar conteúdo, arquivo, hashes e autoria, além de excluir versões ou reativar uma retirada. A publicação usa transação e lock por ID/versão, inclusive quando a linha ainda não existe. O helper `lockPublishedTestCaseCatalog` exige referência exata e estado disponível, mantendo `FOR SHARE` até o fim da transação; a retirada aguarda esse uso. B15c/B16b usam esse helper na prévia, publicação da base e execução integrada, conforme o [contrato de execução E21](testrec-execucoes-publicadas.md).

O catálogo não depende de definição RNF, classificação, sprint ou US operacional. Histórias da base mantêm referências aos IDs dos testes; B15c/B16b fixam essa relação ao catálogo selecionado por ID, versão e hash. Publicação de catálogos não acrescenta itens ao histórico operacional nem à base de avaliação.

## Verificação e limites

Após compilar a API:

```powershell
npm.cmd run build -w @us-agent/api
npm.cmd run check:test-case-catalogs
npm.cmd run check:test-case-catalogs -- --output tmp/catalogo-check-novo.json
```

O check fixa a conexão em `127.0.0.1:5432/us_agent`, cria um schema de nome aleatório validado e o descarta após os ensaios. Não lê `.env` nem usa a conexão de produção. Verifica upload/download, bytes com BOM/CRLF, validação, referências exatas, concorrência, rollback forçado, trigger, retirada com lock, histórico e autorização. Dois catálogos recuperados do banco alimentam explicitamente a demonstração local, mostrando textos diferentes sem mudar os scores.

A [entrega 015](entregas/015-catalogos-testes-publicados.md) e a [evidência HTTP/PostgreSQL](evidencias/b15b/catalog-integration.json) registram o resultado. O check não persiste uma execução TestRec. B15c/B16b entregam identidade demonstrativa publicável, vínculos catálogo/base/execução e importação integrada das associações. B17a acrescenta [revisão/publicação/inspeção na interface](testrec-interface.md), restritas à demonstração sintética. B17b entrega avaliação/cópias humanas com origem preservada. Permanecem confirmação da política original e avaliação empírica. Q01/Q02 permanecem abertas; este schema é uma escolha de engenharia do US-Agent, sem afirmar equivalência ao banco original dos autores.
