# Conciliação de dados de Ednaldo — B02h

18/10/2026. Continuidade da [derivação candidata B02g](dados-ednaldo-derivacao-revisada.md), focada nos dados necessários a B15/B16/B18. O novo [relatório reproduzível](evidencias/b02h/report.json) localiza relações observadas, faltantes e conflitos; a [fila de revisão CSV](evidencias/b02h/review.csv) reúne 119 entradas. Nenhum campo foi preenchido, perfil criado, alias aplicado ou registro excluído.

## Resultados e decisões

| Questão | Evidência encontrada | Decisão desta etapa |
| --- | --- | --- |
| Perfis das histórias com testes | Das 249 chaves projeto/história nas associações, 215 possuem linhas de perfil correspondente e 34 não possuem. | Registrar os 215 vínculos observados. Correspondência não confirma completude, correção ou elegibilidade científica. As outras 34 continuam pendentes. |
| Histórias sem sufixo | Por exemplo, `#253` possui candidatos `#253-1` a `#253-4` no mesmo projeto, com operações diferentes. | Não remover sufixos nem escolher arbitrariamente um perfil; conservar candidatos e suas linhas para revisão. |
| ID padronizado ausente | 76 registros; 18 têm título exatamente igual em outra associação com ID preenchido, mas nenhum desses apoios está no mesmo projeto. | Não completar IDs por transferência entre projetos ou por número do registro. Os 76 continuam pendentes. |
| Título como chave | Sete grupos de títulos idênticos apresentam IDs padronizados distintos. Um deles ocorre até dentro da mesma história de SmartClassroom, com IDs `4` e `43`. | Título não identifica o teste padronizado. Não deduplicar, escolher maioria ou presumir erro de origem. |
| Critérios sem perfil | Duas identidades, `ARTools/11971` e `SGCond/SGC-US30`, permanecem sem correspondência de perfil. | Não unir `ARTools` a `AR Tools Web` apenas pelo ID. |
| Campos de identidade | `associations.ID`, `associations.ID_STD_TC`, `criteriaLinks.ID_STD_AC` e `criteriaLinks.ID_TC` têm papéis distintos. | Preservar os namespaces. A ponte entre a referência de teste do arquivo de critérios e a representação nas associações não está documentada. |

O comparador somente apara espaços e remove um `#` inicial da história. Preserva caixa, zeros, nomes de projeto e sufixos. O conjunto observado reúne 339 chaves na união dos três papéis, não 339 exemplos prontos para avaliação e não a amostra de 217 histórias do artigo.

## Flags de mapeamento e associações

No arquivo de perfis, `Mapeado? (SIM ou NAO)` contém 111 linhas com `Sim`, 247 com `Nao` e 210 sem valor. Nas 228 linhas de perfil vinculadas às histórias presentes nas associações, são 46, seis e 176, respectivamente. Campo ausente não equivale a `Nao`; o flag está associado à linha de origem e não determina sozinho a elegibilidade da história inteira.

Pares módulo/operação e seus flags permanecem juntos. Não escolher um valor vencedor ou criar pares cruzando linhas. `SPGEC/16759`, por exemplo, conserva suas três linhas observadas, incluindo duas `Cadastro/Atualizar_dados` e uma `X/X`, com contexto e plataforma ausente preservados.

Ausência de linhas em um papel é `not_observed`, não uma associação sabidamente vazia. Mesmo onde há linhas, a completude das relações não foi confirmada. Isso evita transformar dado não obtido em ausência científica de testes ou critérios.

## Ponte entre testes e critérios

A comparação exata por história/projeto e texto literal entre `criteriaLinks.ID_TC` e `associations.ID_TC` não encontrou correspondência. Isso é um diagnóstico do formato escrito, **não prova de inexistência de vínculo**. Por exemplo, em `RCP/2379`, a referência de critério escreve `#2523`, enquanto os cinco testes observados usam títulos com códigos `HWLL-...`. É necessária uma fonte que documente essa ligação.

`ID_STD_AC` não foi usado para preencher `ID_STD_TC`. A referência `RNFs`, inclusive o valor `1.2`, continua uma string original; não foi dividida em IDs, convertida em decimal ou propagada para outros registros. Domínio, catálogo completo e Gherkin também não foram criados.

## Reprodução

```powershell
npm.cmd run reconcile:testrec-data -- --replay docs/evidencias/b02h
npm.cmd run check:testrec-reconciliation
```

O [protocolo](../research/preparations/testrec-e26-reconciliation-v1/protocol.md) define os limites. O CLI verifica os hashes da cadeia B02g e os papéis de entrada; refaz o relatório e CSV, recusa sobrescrita e rejeita conteúdo adulterado mesmo com checksum atualizado. Editar o CSV não aplica alterações nem aprova decisões.

Crédito dos dados conforme os registros: **Anonymous, Anonymous**; licença declarada [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/). [Origem, versões, atribuição e inventários preservados](../research/sources/testrec-e26/README.md). A revisão técnica local não é atribuída aos depositantes, aos autores dos artigos ou à orientação.

## Próximo aceite

A conciliação exata das fontes já disponíveis está materializada. Novas correções dos itens acima exigem evidência adicional; não há decisão automática pendente que permita tornar esses dados completos. Solicitar/localizar a ponte de IDs, perfis/campos ausentes, catálogo e manifesto da amostra/folds, além de confirmar a transformação Euclidiana Q01. A divergência residual Q02/CT05 e a agregação Q03 continuam documentadas.

Enquanto esses materiais não forem obtidos, avançar nas frentes independentes previstas: protocolo/instrumentação do esforço de configuração, confirmação do material de Ademar e material experimental de Felipe. Evitar prolongar a preparação com novas ferramentas de auditoria sem uma pergunta ou fonte que possa mudar o estado de prontidão. O terceiro exemplo e os experimentos completos continuam necessários para a versão pretendida pelo professor.
