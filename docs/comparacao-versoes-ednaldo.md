# Versões publicadas dos dados de Ednaldo — B02f

18/10/2026. A revisão de B02e procurou novas fontes antes de ampliar a normalização local. A [API de versões do Zenodo](https://zenodo.org/api/records/16133793/versions), do conceito citado em E26, retornou três registros: 16131517, 16133229 e 16133793. A resposta foi preservada; a [versão anterior 16133229](https://zenodo.org/records/16133229) foi baixada separadamente, com seus quatro CSVs, licença declarada CC BY 4.0, MD5 publicados e SHA-256 locais conferidos.

O [inventário anterior](../research/sources/testrec-e26/zenodo-16133229/inventory.json) mantém DOI, atribuição, licença e arquivos. A versão mais recente, a derivação B02e e o método científico não foram substituídos. Os registros consultados listam CSVs; código/scripts/folds não foram localizados nessa listagem, sem concluir que inexistem em outras fontes.

## O que as fontes permitem afirmar

| Papel comparado | Registro 16133229 | Registro 16133793 | Resultado verificável |
| --- | --- | --- | --- |
| Perfis | `uss.csv` | `categorized_user_stories.csv` | O anterior bloqueia no parser estrito na linha 48; o mais recente é analisável, com 568 linhas. Não são cópias idênticas. |
| Vínculos | `usscas.csv` | `user_stories_test_cases.csv` | O anterior bloqueia na linha 100; o mais recente é analisável, com 690 linhas. Não substituir o conjunto inteiro por anterior. |
| Critérios | `cas2.csv` | `acceptance_criteria_data.csv` | Os arquivos são idênticos byte a byte, com os mesmos 59 critérios. Isso reforça a origem do rascunho B02d. |
| Associações de testes | `tcs.csv` | `test_cases_for_user_stories.csv` | Ambos bloqueiam na linha 86, mas os bytes/textos diferem. Trechos anteriores ajudam a investigar ambiguidades da versão recente. |

Correspondência de papéis/headers não prova identidade das bases. A versão mais antiga, 16131517, declara três CSVs com os mesmos MD5 publicados dos arquivos correspondentes de 16133229; seus bytes não foram baixados. O relatório identifica essa diferença de verificação.

## Comparação das posições pendentes

O [plano explícito](../research/comparisons/testrec-e26-v1/comparison-plan.json) conserva as 57 posições físicas de B02d, as seis com derivação B02e e nove pares multilinha. O [relatório](evidencias/b02f/report.json) guarda faixas de bytes, hashes, valores/segmentos e contextos das duas versões.

- 28 posições têm cinco segmentos literais e o mesmo trio escrito projeto/ID da história/ID do registro; incluem as seis já codificadas localmente.
- 11 têm diferenças nesses segmentos de identidade, inclusive aspas em nomes de projeto. Não são unidas ou normalizadas automaticamente.
- 18 posições integram nove pares multilinha, exigindo inspeção dos bytes conjuntos.
- Entre as posições ainda pendentes, vinte têm ID final numérico simples na versão anterior onde a recente apresenta aspas. Por exemplo, na linha 86 o segmento anterior é `16`, enquanto o recente começa por `16"`. Isso oferece um candidato com fonte, sem provar qual versão deve prevalecer.
- Os nove pares da versão anterior são decodificáveis pelo parser existente como registros locais, com sequência de IDs no contexto anterior/posterior. Nas mesmas posições a fonte mais recente continua sem decodificação válida. O texto decodificado anterior conserva a quebra de linha dentro do título; ela não é removida.

Esses grupos são trechos decodificados da versão anterior, não nove registros recuperados da mais recente. As contagens de linhas físicas não viram população/folds. Nenhuma substituição, alias ou exclusão foi aplicada; as 51 posições da fila anterior permanecem pendentes de decisão, agora com evidência adicional.

## Executar e continuar

```powershell
npm.cmd run compare:testrec-sources -- --output tmp/minha-comparacao-e26
npm.cmd run compare:testrec-sources -- --replay docs/evidencias/b02f
npm.cmd run check:testrec-source-versions
```

A execução é offline e exige diretório novo. Verifica os bytes/metadados preservados, recusa sobrescrita e exporta relatório/manifesto com fontes e hashes. Replay refaz a comparação; adulterar decisões no relatório e atualizar apenas seu checksum não passa. O [protocolo](../research/comparisons/testrec-e26-v1/protocol.md) distingue segmentos literais, valores efetivamente decodificados e contagens desconhecidas por falha de parse.

O próximo passo é revisar os candidatos e definir explicitamente se será adotada uma versão específica ou uma derivação com nome, plano antes/depois e proveniência. Não combinar o que parece melhor de cada arquivo para obter números esperados. Continuam pendentes o restante dos dados, catálogo completo, recorte/código/folds e Q01–Q03; avaliação RNF de Felipe, configurabilidade com participantes e exemplo Ademar permanecem no workflow.
