# 021 — Artigo de Ednaldo, revisão do plano e auditoria dos dados públicos

18/10/2026 — B02c, preparação de B15/B16/B18 e RF13/RF14. Estado: leitura/revisão e auditoria técnica entregues; reprodução científica e avaliação empírica em andamento.

## Mudança de prioridade e fonte

Durante a revisão do plano, o usuário forneceu `3748522.3779891.pdf` e o identificou como artigo de Ednaldo. O PDF de nove páginas foi lido localmente e seu DOI confirmado: `10.1145/3748522.3779891`; SHA-256 `cc895b9d7cbc49af9c63f0466f1050b82b432450bf0798307229c5a0cf23f445`. A entrega resolve a falta de acesso ao texto E26. O arquivo permanece fora do Git.

Antes do recebimento, a consulta à versão dos autores de [F25](https://www.researchgate.net/publication/389646847_A_Data-Driven_Recommendation_System_for_Enhancing_Non-Functional_Requirements_Elicitation_in_Scrum-Based_Projects) reconferiu a distinção entre avaliação com referência e aceitação de usuários e o leave-2-out por projeto; não constitui comparação integral com a versão IEEE final. E26 passou a ser a prioridade por condicionar diretamente método e dados do segundo exemplo. O rascunho de medição de configuração foi preservado em `tmp`, fora das entregas/estudos concluídos.

## Achados que afetam o plano

- E26 confirma Euclidiana/K=3/heurística, mas conserva a equação Manhattan no exemplo e não explicita a transformação Euclidiana necessária: Q01 continua aberta.
- O artigo associa TC04 a 0,71 e TC03 a 0,54, diferentemente dos IDs correspondentes na tese; TC01=0,42 continua no exemplo. Q02 exige conciliação de versões/associações, sem alterar os oráculos históricos.
- E26 informa F2=0,510 em lugar de 80% da tese. F2 das médias de precisão/recall é ~0,583, o que não comprova erro sem conhecer agregação por alvo/fold. Q03 permanece delimitada.
- A seção de artefatos aponta para o conceito Zenodo 16131516. Sua versão consultada, 16133793, lista quatro CSVs sob CC BY 4.0. Código, scripts de configuração, folds e resultados individuais não foram localizados nesse registro.

Detalhes, páginas e limites estão na [revisão E26](../revisao-artigo-ednaldo-e26.md). Fontes/dados de Felipe e confirmação de Ademar permanecem pendentes; não se transportam regras de um artigo para outro.

## Desenvolvimento entregue

Os [arquivos originais e metadados](../../research/sources/testrec-e26/README.md) foram preservados com atribuição/licença e inventário de tamanho, MD5 publicado e SHA-256 local. A auditoria nova em `apps/api/src/evaluation/testrec-source-audit.ts` reutiliza o parser existente, separa formatos inválidos de valores ausentes e compara chaves conservadoras projeto/história sem alterar os dados.

`npm.cmd run audit:testrec-source` verifica arquivos/licença/versão e calcula diagnósticos. `--output arquivo-novo.json` exporta evidência sem sobrescrita; `--replay docs/evidencias/b02c/source-audit.json` valida integridade e refaz o conteúdo. Não usa banco, `.env` ou provedor. Não publica dados reais no método demonstrativo, cuja restrição sintética permanece preservada.

Resultados: 59 critérios; categorizado com 568 linhas/304 histórias/17 projetos, 51 perfis incompletos e 13 conflitantes; arquivo de critérios/associações com 690 linhas/130 histórias/dez projetos. O outro arquivo de associações tem erro de aspas na linha 86, conservando contagens/joins como `null`. Estes arquivos não identificam automaticamente o recorte experimental de 217 histórias/13 projetos/1.077 testes. Faltam domínio e artefatos completos em Gherkin, além de conciliações de campos/identidades. Não são fabricados valores ou passos para passar no schema.

Pacote: [manifesto](../evidencias/b02c/manifest.json), [auditoria](../evidencias/b02c/source-audit.json). Hash determinístico: `0053c0e5ab71acbee438ac3bc9eeeb76d530b13274aac02b25a2c8fdfe17baa2`.

## Verificação

- 119 testes API passaram; os três novos cobrem campos ausentes, CSV multilinha/malformado, conflitos/chaves e contagens desconhecidas após falha sintática.
- Build API passou; os testes novos foram reverificados após a melhoria de preservação dos cabeçalhos em arquivos inválidos.
- Replay da auditoria passou; tentativa de sobrescrever a evidência foi recusada e o arquivo original permaneceu idêntico. Replay de evidência corrompida foi recusado.
- Replays RNF B14a e avaliador de testes B18a preservaram os hashes anteriores. Nenhum executor, fórmula publicada, interface ou migration foi alterado neste incremento.
- `check:scientific-index` conferiu 80 hashes no staged (73 fontes e sete artefatos). Código/documentação passaram na conferência de whitespace; os quatro CSVs externos são excluídos dessa formatação e conferidos por hash para preservar seus espaços e bytes originais.

## Próxima implementação e critérios ainda abertos

Preparar transformação auditada do CSV inválido e conciliação de valores/identidades, mantendo originais, rastreabilidade por linha/célula, alterações/exclusões explícitas e população declarada. Confirmar recorte, catálogo completo, código/folds e Q01–Q03 antes de publicar um método científico novo ou executar avaliação empírica. Não misturar esta base real com as fixtures demonstrativas.

B18 mantém pendentes o estudo de configuração com participantes e o protocolo/ensaio empírico. B19–B21 mantêm a confirmação de Ademar e o terceiro exemplo sem US. O atendimento ao professor permanece parcial, com progresso em evidências científicas e dados; leitura de artigo e testes de software não equivalem à aprovação da orientação.
