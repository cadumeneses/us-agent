# 023 — Codificação CSV reversível com conteúdo literal preservado

18/10/2026 — B02e, continuidade de B02d e preparação de B15/B16/B18. Estado: derivação de transporte verificada; dados e validação científica continuam pendentes.

## Revisão e limite da decisão

Foram inspecionados os trechos da fila B02d e os vínculos sem correspondência. Seis unidades isoladas — linhas físicas 292, 308, 312, 324, 332 e 338 — permitem uma convenção local explícita de cinco células literais. A operação normaliza o encoding CSV do título; não confirma a intenção dos autores nem corrige semanticamente seu texto.

O [plano versionado](../../research/transformations/testrec-e26-v1/encoding-plan.json) fixa fonte/tamanho, hashes das unidades/contextos e as cinco strings antes da transformação. A revisão é técnica do Codex, identificada como convenção local, sem atribuir aprovação aos autores/professor. O [protocolo](../../research/transformations/testrec-e26-v1/protocol.md) documenta condições e limites.

Não foi possível confirmar os demais trechos por essa regra. A linha 86 tem aspa no último campo e não é alterada; fragmentos multilinha também ficam pendentes. O original e B02c/B02d permanecem preservados. As 51 unidades restantes não são contadas como 51 registros defeituosos.

## Implementação

- Módulo independente `testrec-source-transport.ts`, sem mudar parser geral, preparação anterior ou recomendadores.
- Aplicação somente das seis decisões explícitas, exigindo hash/conteúdo exatos, identidade sem aspas, ID numérico, saída numérica com padding e título sem delimitador inicial. Unidades adjacentes precisam ser analisáveis e ancorar a sequência de IDs.
- O título é envolvido em aspas e suas aspas internas são escapadas. O parser precisa devolver as cinco strings literais exatamente. Espaços, duplicações de aspas e repetições estranhas do nome de projeto ficam mantidos, sem redação nova ou “melhoria” editorial.
- Relatório registra faixas/bytes antes/depois, hashes e células. Trechos fora dos patches são copiados byte a byte. A inversão recupera o arquivo completo e exige o tamanho/SHA-256 original.
- CLI `transform:testrec-source` exporta relatório, `test-cases.transport-view.csv` e manifesto em diretório novo, com replay e recusa de sobrescrita. Não usa banco, `.env`, rede ou provedores.

O [pacote](../evidencias/b02e/manifest.json) tem relatório determinístico `2f35ea418e8a31b157d76bd5d572f88b93bb9c49490281367f77473a94fb2351`. A saída passa de 57 para 51 unidades que exigem inspeção isolada, mas continua bloqueada no parse integral, na linha 86. Registros recuperados/aceitos e limites lógicos permanecem desconhecidos. Nenhum registro foi excluído; a saída não é base pronta para importação ou avaliação.

## Vínculos e fontes ainda pendentes

`ARTools/#11971` tem candidato em `AR Tools Web/#11971`, linha 395 do categorizado. Projetos com nomes diferentes e mesmo ID não bastam para provar equivalência; os oito vínculos não foram unidos. `SGCond/SGC-US30`, em duas ocorrências, continua sem perfil confirmado. Nenhum valor/alias foi aplicado para fazer as contagens coincidirem com E26.

Buscas complementares por TestRec, Ednaldo/Dilorenzo e identificadores dos materiais não localizaram código original confirmado. Isso não demonstra inexistência ou esgotamento das fontes. Q01–Q03, recorte/folds, catálogo completo e domínio continuam pendentes, assim como dados/protocolo de Felipe, configuração com participantes e o terceiro exemplo Ademar.

## Verificação

- 128 testes API passaram, incluindo quatro novos sobre preservação/inversão, contexto obsoleto, títulos/IDs ambíguos, fragmentos multilinha, sequência de IDs e corrupção/forja do ledger. Build API passou.
- `check:testrec-transport` passou: replay/inversão, repetibilidade entre exportações, não sobrescrita, corrupção do CSV, CSV alterado com checksum atualizado e divergência do plano/fontes.
- Replay B02e passou. B02d, B14a RNF e B18a testes mantiveram seus hashes anteriores.
- `check:scientific-index` conferiu 92 hashes do staged (83 fontes/dependências e nove artefatos). Whitespace de código/documentação passou; CSVs originais e derivado são preservados/conferidos por hash, sem formatação dos seus espaços.

O plano continua priorizando revisão e confirmação dos dados/método. Uma operação distinta deve receber plano/versão próprios; não ampliar esta convenção automaticamente para trechos que ela não cobre. Não alterar os executores para contornar as lacunas ou confundir codificação reversível com reprodução experimental.
