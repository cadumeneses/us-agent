# Dados de Ednaldo: derivação candidata revisada — B02g

18/10/2026. O [registro Zenodo 16133793](https://zenodo.org/records/16133793), indicado novamente pelo usuário, continua sendo a referência principal. Os arquivos originais permanecem preservados. A [derivação candidata](evidencias/b02g/test-cases.reviewed-candidate.csv) permite ler integralmente as associações; ela adota explicitamente trechos de duas versões publicadas e **não é uma base original limpa ou reprodução do experimento**.

Crédito das duas fontes de dados conforme os registros: **Anonymous, Anonymous**; licença declarada [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/). Versão complementar: [Zenodo 16133229](https://zenodo.org/records/16133229). As modificações descritas aqui são locais ao US-Agent e não são atribuídas aos depositantes. [Inventários, metadados e atribuição preservados](../research/sources/testrec-e26/README.md).

## Decisões implementadas

O [plano antes/depois](../research/transformations/testrec-e26-reviewed-v1/association-plan.json) e o [protocolo](../research/transformations/testrec-e26-reviewed-v1/protocol.md) identificam 48 patches que cobrem as 57 unidades físicas antes sinalizadas:

- Seis patches preservam as cinco células literais recentes sob a convenção de transporte B02e.
- 42 adotam registros específicos de 16133229, dos quais nove são multilinha. Cada adoção exige identidade de registro/história e diferença de aspas de projeto explicitamente revisada. As células adotadas, inclusive títulos diferentes dos recentes, são identificadas no ledger.
- Nenhuma linha é excluída, nenhum campo ausente é completado e nenhuma equivalência entre projetos é aplicada.
- Todos os bytes recentes fora dos patches são preservados; a inversão recupera exatamente o arquivo recente original, incluindo defeitos de sintaxe e espaços.

A validação distingue a decodificação CSV estrita de uma convenção local para títulos não delimitados com aspas internas. Essa convenção não confirma a intenção dos autores. Textos estranhos e quebras de linha dentro dos títulos continuam presentes.

## O que a leitura completa revelou

| Observação | Resultado e limite |
| --- | --- |
| Associações lidas | 1.354 registros lógicos, 249 chaves de história/projeto, 17 projetos; IDs de registro consecutivos e únicos. Essas quantidades não identificam a amostra E26. |
| ID padronizado de teste | 76 registros permanecem sem esse campo; 64 IDs distintos não vazios. Não inferir que esses IDs são o catálogo de artefatos completos ou equivalem aos IDs dos critérios. |
| Correspondência com perfis recentes | 215 das 249 identidades têm correspondência; 34 não têm. Há 89 identidades do arquivo de perfis sem associação nesse arquivo. A comparação apenas apara espaços e remove um `#` inicial da história, sem aliases de projetos. |
| Outros vínculos recentes | O arquivo `user_stories_test_cases.csv` mantém duas identidades sem perfil correspondente; não foram resolvidas pela derivação das associações. |
| Prontidão | Sintaxe completa nesta derivação; campos, relações, domínio, artefatos completos, recorte/folds e método Euclidiano ainda precisam de fechamento. |

A auditoria dos quatro papéis usando o CSV candidato é identificada como **combinação derivada** no [relatório](evidencias/b02g/report.json). A auditoria original B02c e os pacotes B02d–B02f continuam válidos como registros históricos de suas próprias entradas; suas pendências não são apagadas ou reescritas.

Triagem das 34 identidades sem perfil: 12 em `Event Driven System for Business Services Integration`, 16 em `Game Marketing Manager`, duas em `Gestão da Capacitação`, duas em `RCP`, uma em `SGCond` e uma em `SSPI`. Dos 76 registros sem ID padronizado, 63 pertencem a `SPGEC`. Essas localizações orientam a revisão de fonte; não autorizam remover sufixos de histórias, completar rótulos ou excluir esses projetos.

## Revisão visual das figuras e Q02

Foram conferidos visualmente os PDFs locais E21 (pp.71–72 e 74; impressas 57–58 e 60) e E26 (p.4), com hashes verificados. A [transcrição versionada](../research/examples/testrec-figures-v1/associations.json) conserva referências, arestas, pesos e números impressos separados por fonte.

- E21 figura 4.8 usa `e1`, `e5`, `e6`, sem a heurística; CT01 recebe contribuições de `e1` e `e6`: `(0,50 + 0,75)/3 ≈ 0,42`. O texto da p.58 omite a primeira associação ao dizer que somente `e6` o contém. O cálculo 0,25 da auditoria antiga era correto para aquela associação textual incompleta, não para o grafo completo.
- E21 figura 4.9 e E26 figura 3 aplicam a heurística e selecionam a terceira história empatada, que possui mais testes. As duas figuras concordam estruturalmente, mantendo namespaces distintos `CT`/`TC`. TC01 recebe contribuições de `u3` e `u6` e também resulta em aproximadamente 0,42.
- A inversão dos primeiros itens entre a figura 4.8 e as figuras com heurística decorre da troca do vizinho selecionado. A interpretação anterior de troca de IDs entre tese/artigo não era sustentada por essa comparação; fica corrigida nesta revisão.
- Todos os cinco scores exibidos em E26 figura 3 e E21 figura 4.9 coincidem com os pesos ilustrativos exibidos, na precisão publicada. Na figura 4.8, CT05 é impresso como 0,25, mas sua associação a `e5`, peso 0,87 e a equação produzem 0,29. Essa divergência permanece registrada, sem alterar a fonte.

O replay reutiliza o núcleo KNN e a agregação existentes, com os pesos ilustrativos transcritos. Não recalcula distâncias nem resolve Q01. **Q02 fica esclarecida quanto a CT01/TC01 e à comparação com/sem heurística; a divergência CT05 da figura 4.8 permanece.** Não houve obtenção do código original ou validação da orientação.

## Reprodução e próximo aceite

```powershell
npm.cmd run prepare:testrec-reviewed -- --replay docs/evidencias/b02g
npm.cmd run check:testrec-reviewed
```

O manifesto verifica originais, módulos, plano/protocolo e dois artefatos; o replay recalcula os conteúdos e a inversão. Não publica dados no banco ou no método demonstrativo sintético.

Próximo aceite: conciliar as 34 identidades sem perfil e os 76 IDs ausentes com fontes/decisões explícitas; confirmar domínio, catálogo, subconjunto/folds e transformação Euclidiana. Permanecem a avaliação empírica de Felipe/Ednaldo, a medição de configuração e a obtenção do material para o caso de Ademar sem US. Não há autorização para inventar passos Gherkin, rótulos, fórmulas ou resultados para fechar essas lacunas.

Continuação B02h: a [conciliação das relações](conciliacao-dados-ednaldo.md) materializa os vínculos observados e uma fila de 119 questões, sem preenchimento presumido ou criação de perfis. Os itens restantes dependem de fonte; título idêntico não basta para deduzir identidade. Este pacote B02g permanece intacto.
