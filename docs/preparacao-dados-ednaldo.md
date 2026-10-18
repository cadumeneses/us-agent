# Preparação rastreável dos dados de Ednaldo — B02d

18/10/2026. A [auditoria B02c](revisao-artigo-ednaldo-e26.md) identificou problemas de formato e lacunas nos arquivos públicos. Esta continuação localiza evidências para revisão e gera um rascunho da lista de critérios; não entrega base limpa nem reprodução científica. Regras e limites estão no [protocolo versionado](../research/preparations/testrec-e26-v1/protocol.md).

```powershell
npm.cmd run prepare:testrec-source -- --output tmp/minha-preparacao-e26
npm.cmd run prepare:testrec-source -- --replay tmp/minha-preparacao-e26
npm.cmd run check:testrec-preparation
npm.cmd run prepare:testrec-source -- --replay docs/evidencias/b02d
```

O diretório deve ser novo. Não é necessário banco, `.env`, rede ou provedor. O script exige os mesmos bytes do inventário/auditoria preservados, exporta relatório, rascunho taxonômico e manifesto, e recusa sobrescrita. Replay confere fontes, hashes e o conteúdo recalculado, inclusive o texto exato dos critérios. Alterar uma descrição e atualizar apenas o checksum não faz a verificação passar.

## O que pode ser inspecionado

| Parte | Evidência entregue | O que ainda não foi decidido |
| --- | --- | --- |
| Arquivo de associações | Cobertura completa em faixas de bytes e hashes, 1.363 unidades de linha física, 57 unidades para revisão com texto e contexto adjacente. | Quantos registros lógicos essas unidades representam e como corrigir o formato. |
| Perfis incompletos | 51 histórias com algum campo módulo/operação/plataforma sem valor, com linhas/ordinais e conteúdo observado. | Valores ausentes e fonte para eventual complementação. |
| Múltiplos valores | 13 histórias com mais de um valor em algum desses campos; pares módulo/operação observados e suas linhas preservados. | Se refletem multirrótulo, variação ou inconsistência, e qual política científica aplicar. |
| Vínculos não correspondidos | Duas identidades projeto/história não encontradas no categorizado, com valores brutos e localização das ocorrências. | Equivalências, erros ou aliases; nenhuma fusão automática. |
| Critérios de aceitação | Rascunho validado da lista de 59 critérios, descrições exatas e mapeamento reversível dos IDs. | Publicação/vínculo e população experimental que efetivamente utiliza cada critério. |

O [relatório](evidencias/b02d/report.json) contém `associations.review`, `profiles.review` e `links.unmatchedRows`. Cada trecho de associações inclui número da linha física, início/fim em bytes, hash, texto bruto e contexto anterior/posterior. A união do cabeçalho com todas as unidades cobre os bytes originais sem alterações ou exclusões.

Há trechos continuados em linhas adjacentes, como 876–877. Uma linha isolada pode falhar por integrar um registro multilinha; outra pode ser analisável isoladamente e ainda assim fazer parte de uma estrutura danificada. Portanto, as 57 unidades não são 57 registros defeituosos, e as 1.306 analisáveis em isolamento não são registros recuperados ou aprovados. O parse integral continua bloqueado e o número de registros recuperados/aceitos permanece `null`. Não foi produzido CSV “corrigido”.

As histórias com múltiplos valores são questões de interpretação, não erros comprovados. O relatório conserva os pares realmente observados; não combina um módulo de uma linha com uma operação de outra para gerar classificações novas. Os campos faltantes permanecem faltantes. Mesma identidade de comparação não implica resolução de todos os aliases ou confirmação da amostra de E26.

## Critérios sem conteúdo inventado

O [rascunho taxonômico](evidencias/b02d/acceptance-taxonomy.draft.json) segue o contrato comum já implementado. É uma lista com `parentId: null` em todos os nós. O texto original da coluna `Descrição` é copiado para nome/descrição, sem tradução, truncamento ou reformulação.

O schema da plataforma exige IDs iniciados por letra. A adaptação local `ca_<ID literal da fonte>` mantém o ID original no mapeamento do relatório, com ordinal/linha e descrição. Exemplo: `1` → `ca_1`; isso é uma regra de namespace da plataforma, não uma alteração dos conceitos do artigo. A regra não converte IDs em números nem remove zeros à esquerda. Arquivo, DOI, licença e hash constam da origem. Geração não publica o catálogo, não substitui taxonomias existentes e não altera definições/bases.

## Fluxo de revisão e implementação

1. Inspecionar unidades problemáticas junto ao contexto e confirmar os limites dos registros. Preservar a linha física e os bytes como evidência, sem escolher uma reparação pelo texto aparentemente desejado.
2. Para cada reparo comprovado, registrar antes/depois, fonte/justificativa e identificação da revisão em uma transformação versionada. Manter pendentes os casos sem evidência, com contagem explícita, sem exclusão silenciosa.
3. Conciliar perfis e vínculos por fonte ou decisão metodológica identificada. Resolver multirrótulos preservando coocorrência, sem herdar filtros RNF indevidamente.
4. Confirmar recorte experimental, catálogo completo, domínio e código/folds; fechar Q01–Q03 ou manter limites explícitos. Só então definir entrada da avaliação empírica.

O rascunho de critérios e a fila de revisão não suprem domínio, Gherkin, associações completas ou folds. Os métodos/evidências de Felipe e Ednaldo permanecem preservados. A avaliação com dados reais, o esforço de configuração com participantes e o exemplo Ademar continuam pendentes no [workflow](workflow-evolucao-us-agent.md).

## Continuação B02e — seis codificações literais reversíveis

A [entrega 023](entregas/023-normalizacao-reversivel-transporte.md) aplica uma convenção local de transporte às linhas físicas 292, 308, 312, 324, 332 e 338. O [plano explícito](../research/transformations/testrec-e26-v1/encoding-plan.json) conserva fonte/contexto e as cinco células literais. Nessas unidades isoladas, o título sem delimitador inicial é envolvido em aspas e cada aspa interna é escapada. O parser estrito precisa devolver exatamente as cinco strings anteriores, incluindo espaços, aspas repetidas e textos estranhos. Essa preservação é relativa à convenção de células literais; não confirma intenção/redação dos autores.

Não se corrigem os títulos, IDs ou nomes de projetos. A sequência de IDs e os trechos adjacentes analisáveis limitam o alcance da operação; não confirmam todos os limites lógicos do arquivo. Linhas multilinha ou com IDs ambíguos permanecem pendentes. O derivado continua bloqueado no parse integral, com 51 unidades físicas ainda a inspecionar; nenhuma foi excluída e nenhuma base científica foi declarada pronta.

```powershell
npm.cmd run transform:testrec-source -- --output tmp/meu-transporte-e26
npm.cmd run transform:testrec-source -- --replay docs/evidencias/b02e
npm.cmd run check:testrec-transport
```

O pacote inclui `test-cases.transport-view.csv`, relatório com faixas/bytes antes/depois e manifesto. Cada execução verifica a inversão até recuperar o arquivo inteiro, com tamanho e SHA-256 originais; o original não é sobrescrito. O [protocolo](../research/transformations/testrec-e26-v1/protocol.md) documenta a convenção e suas limitações. Uma transformação futura deve usar plano/versão próprios, mantendo B02c/B02d/B02e reexecutáveis.

A revisão dos vínculos encontrou `AR Tools Web/#11971` na linha 395 do categorizado como candidato a `ARTools/#11971`, que aparece nos vínculos. Igualdade do ID em projetos com nomes diferentes não comprova equivalência: nenhuma união foi aplicada. `SGCond/SGC-US30` continua sem perfil correspondente confirmado. Os dois casos permanecem abertos.

## Continuação B02g — derivação candidata integralmente legível

A [entrega 025](entregas/025-associacoes-ednaldo-revisadas.md) registra decisões sobre todas as posições físicas antes sinalizadas em uma nova derivação identificada, sem alterar B02d/B02e ou os originais. Ela conserva seis convenções literais recentes e adota explicitamente 42 registros anteriores com evidência de identidade, nove deles multilinha. O CSV candidato contém 1.354 registros, mantém faltantes e permite recuperar exatamente o arquivo recente. A leitura agora revela 76 registros sem ID padronizado e 34 identidades sem perfil. O [guia atualizado](dados-ednaldo-derivacao-revisada.md) distingue sintaxe resolvida nessa saída de relações, campos, método e avaliação ainda pendentes.
