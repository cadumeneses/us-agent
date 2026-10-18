# E26 — leitura do artigo de Ednaldo e auditoria dos dados públicos

18/10/2026. Fonte primária fornecida pelo usuário: `3748522.3779891.pdf`, *Recommending Test Cases in Agile Software Development with a Taxonomy-Guided KNN Approach*, SAC 2026, DOI `10.1145/3748522.3779891`. Nove páginas, SHA-256 `cc895b9d7cbc49af9c63f0466f1050b82b432450bf0798307229c5a0cf23f445`. O arquivo foi lido localmente; o acesso ACM pela web continuou retornando 403. O recebimento deste PDF resolve a falta de acesso ao texto E26, sem equivaler à aprovação do professor ou à obtenção de todo o material experimental.

## O que o artigo confirma e o que muda

| Tema / fonte | Achado | Consequência para a implementação |
| --- | --- | --- |
| Perfis e representação — §3, PDF pp.3–4, tabela 2/figura 2 | Módulo, operação, plataforma, domínio, critérios de aceitação e RNFs. RNFs de projeto se associam às histórias do projeto; critérios/RNFs são multivalorados. A representação é orientada às características do alvo. | Mantém a separação entre características e filtros. A demonstração atual não deve receber automaticamente o filtro rígido RNF de módulo/operação. |
| Distância e configuração — equação 2, PDF p.4; §§4–5, PDF pp.5–6 | Equação 2 apresenta Manhattan normalizada. O experimento escolhe Euclidiana, K=3 e heurística. O artigo menciona normalização para [0,1], sem explicitar nesse trecho a transformação Euclidiana usada. | Q01 continua aberta. Mesma ordem sobre vetores binários não prova mesmos pesos nem scores de itens. Manter identidade Manhattan demonstrativa; não alterar silenciosamente o executor preservado. |
| Agregação/desempate — §3, equações 3–4, PDF p.4 | Soma similaridades dos vizinhos associados, dividida por K; empate favorece história com mais testes. O exemplo TC04 usa (0,50+0,87+0,75)/3≈0,71. | Apoia a equação demonstrativa, mas não confirma as associações completas ou o desempate residual local. |
| Identidade dos itens ilustrados — figura 3/equação 4, PDF p.4 | E26 associa 0,71 a TC04 e 0,54 a TC03. B02g confirmou visualmente correspondência com E21 figura 4.9, com heurística; a figura 4.8 da tese usa outro vizinho e inverte os primeiros itens. TC01=0,42 tem apoio em u3 e u6. | O grafo esclarece CT01/TC01; não há troca de IDs entre versões comprovada por essa comparação. A divergência CT05 da figura 4.8 permanece. Não alterar o oráculo histórico textual ou inferir distâncias Euclidianas. |
| Resultados — §5/tabela 3, PDF p.6 | E26 informa precisão 37,8%, recall 67,5% e F2=0,510, em vez do F2=80% da tese. F2 aplicado às duas primeiras proporções é aproximadamente 0,583. | Q03 fica delimitada: artigo atualiza o número, mas ainda faltam saídas por alvo/fold e convenção de agregação. Média de F2 não equivale necessariamente a F2 das médias. Não classificar a diferença como erro comprovado. |
| Protocolo e limitações — §4 e §7, PDF pp.4–5/7–8 | Validação offline 10-fold; texto relata descarte de folds com categorias insuficientes e dependência possível entre folds. O estudo online é descrito em dois projetos. | Registrar população efetiva, exclusões e dependência. A política local que conserva bloqueios nos denominadores é um controle explícito, não reprodução dessa exclusão. Não copiar as métricas online para o avaliador offline. |
| Artefatos — PDF p.8, referência [1] | O texto declara código/dados/scripts/resultados e aponta para Zenodo. A versão consultada lista quatro CSVs. | Dados localizados e licenciados; código, scripts, folds e resultados por alvo não confirmados nesse registro. |

Esta leitura do trecho metodológico de E26 orienta a próxima etapa; não afirma reprodução do software original. B02g completou a inspeção visual das associações da figura 3 e das figuras 4.8/4.9 da tese, com [transcrição e recálculo](dados-ednaldo-derivacao-revisada.md). A fonte F19/F25 e o método RNF preservado continuam separados; não transportar regras de um recomendador ao outro.

## Proveniência dos dados

A referência [1] usa o [DOI conceitual 10.5281/zenodo.16131516](https://doi.org/10.5281/zenodo.16131516). A API retornou a versão [10.5281/zenodo.16133793 — Trainning dataset](https://zenodo.org/records/16133793), com licença CC BY 4.0 e quatro CSVs. O [inventário local](../research/sources/testrec-e26/zenodo-16133793/inventory.json) conserva conceito, versão, título, autoria declarada, URLs, tamanhos, MD5 publicados e SHA-256 locais. Os metadados originais e os quatro arquivos foram preservados sem alteração; crédito/licença estão no [README da fonte](../research/sources/testrec-e26/README.md).

Disponibilidade/licença verificadas para esses arquivos não prova que o registro contém toda a população, o código ou o subconjunto usado em E26. O PDF fornecido permanece fora do Git, assim como as teses locais.

## Auditoria executável

`npm.cmd run audit:testrec-source` lê somente arquivos locais. Valida tamanhos, MD5/SHA-256 e vínculo conceito/versão/licença, reutiliza o parser CSV publicado e registra granularidade, lacunas e chaves de comparação. O [pacote preservado](evidencias/b02c/source-audit.json) pode ser refeito com:

```powershell
npm.cmd run audit:testrec-source -- --replay docs/evidencias/b02c/source-audit.json
```

| Arquivo | Resultado observado |
| --- | --- |
| `acceptance_criteria_data.csv` | 59 registros, IDs distintos e descrições preenchidas. É uma lista, sem hierarquia inventada. |
| `categorized_user_stories.csv` | 568 linhas, 304 chaves projeto/história e 17 projetos; 51 histórias sem algum dos campos módulo/operação/plataforma e 13 com valores conflitantes nesses campos. 253 têm algum valor para cada campo, o que não comprova perfil válido ou resolvido. |
| `test_cases_for_user_stories.csv` | O parser estrito detecta aspas/conteúdo inválidos na linha física 86. Contagens e joins desse arquivo ficam desconhecidos (`null`); não há reparo, truncamento ou exclusão automática. |
| `user_stories_test_cases.csv` | 690 linhas e 130 chaves em dez projetos. 128 chaves coincidem com o categorizado; duas não coincidem pela regra conservadora. 176 histórias categorizadas não aparecem nesse arquivo. |

As chaves de comparação usam projeto e ID da história com espaços aparados e um `#` inicial removido. Não normalizam nomes de projeto, zeros à esquerda ou outros aliases. Os cabeçalhos originais são conservados, inclusive espaços. Contagens por arquivo têm granularidades diferentes e não são a população experimental de E26 (217 histórias, 13 projetos e 1.077 testes).

O categorizado não apresenta coluna de domínio da aplicação e os arquivos não fornecem coluna Gherkin. Há campos faltantes de plataforma/módulo/operação e associações que exigem conciliação. IDs padronizados/títulos de testes não equivalem ao conteúdo completo dos artefatos; não criar passos artificiais para satisfazer o schema atual. O arquivo de associações não deve ser considerado vazio porque o parse falhou.

## Continuidade revisada

1. Revisar o CSV inválido com evidência da linha/célula e propor reparo como transformação nova, mantendo bytes originais e relatório de alterações; não mudar o parser geral para aceitar silenciosamente a fonte.
2. Identificar o recorte experimental, vínculos e catálogo completo; resolver conflitos/faltantes por fonte ou decisão explícita, sem escolher arbitrariamente uma linha. Localizar código/scripts/folds referidos pelo artigo.
3. Confirmar a transformação Euclidiana e as associações/métricas de Q01–Q03. Se necessário, implementar novo método versionado com fontes/testes próprios; o método demonstrativo permanece preservado.
4. Só então preparar importação/avaliação empírica com população, partições e exclusões auditadas. Manter em paralelo o protocolo de configuração com participantes, fonte/dados de Felipe e confirmação de Ademar.

Com a chegada de E26, a prioridade imediata passou da instrumentação de esforço à revisão de fonte/dados que condiciona B15/B16/B18. Os rascunhos locais foram preservados em `tmp/configuration-protocol-draft.md` e `tmp/configuration-effort-draft.ts`. Após B02g/B02h, B18b transformou essa preparação em [instrumento/protocolo proposto](medicao-esforco-configuracao.md), com ensaio artificial; não houve coleta com pessoas. Essa frente independente não encerra os bloqueios científicos de E26.

## Continuação B02d — revisão localizada, sem reparos presumidos

A [preparação rastreável](preparacao-dados-ednaldo.md) detalha os problemas sem alterar a auditoria B02c congelada: 57 unidades de linha física precisam de inspeção com contexto, incluindo continuações como 876–877. Isso não quantifica registros defeituosos. Os 13 perfis sinalizados por múltiplos valores podem refletir multirrótulo ou inconsistência, sem decisão automática; os pares observados permanecem preservados. Um rascunho da lista dos 59 critérios conserva textos exatos e mapeia IDs numericamente escritos para o namespace local `ca_<ID literal>`, sem conversão numérica, hierarquia ou publicação.
