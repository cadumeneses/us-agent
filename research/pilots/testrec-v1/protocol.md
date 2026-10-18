# B18a — verificação técnica do avaliador de testes

Versão `testrec-evaluation-v1`, 18/10/2026. Este protocolo verifica o software de avaliação com seis cenários artificiais. Não constitui avaliação empírica, reprodução do TestRec original, aprovação do professor ou estudo com participantes.

O método executado é exclusivamente `us_agent_e21_equations_demo_v1`: representação binária do alvo, Manhattan normalizada da equação 4.2, K=3, agregação da equação 4.3 e desempates já publicados. A configuração Euclidiana original de E21 (§5.6) continua dependendo de Q01; CT01 depende de Q02 e convenções de métricas/folds de Q03. Os protocolos e bases empíricas de Felipe também permanecem pendentes. Não comparar estes números artificiais aos artigos.

## Unidade, dados e partição

Cada unidade é um par cenário/alvo; as variantes compartilham uma base sintética e não são amostras independentes. A publicação preservada de B16b fornece definição, catálogo e registros sintéticos; o builder importa novamente os registros pelo contrato publicado e mantém hashes das dependências. Não usa resultados/ranking como referência de relevância. `annotations.json` declara julgamentos artificiais separados, com casos propositalmente diferentes para verificar TP/FP/FN; não são juízos de especialistas ou decisões de aceitação da interface.

A saída do alvo fica ausente ou `[]` antes da execução. Nenhum registro com o mesmo ID, história (após trim) ou grupo declarado do alvo pode integrar o histórico. A declaração de grupos precisa cobrir exatamente os registros da base. Vazamento ou referência inválida invalida o pacote inteiro antes das execuções, sem virar falha do modelo. A igualdade de atributos pode representar vizinhos legítimos e não é tratada como identidade. Grupos são declarações do autor do ensaio: o avaliador não prova independência entre projetos nem detecta aliases desconhecidos. Um estudo real exigirá identidade/grupos auditados, separação por projeto ou unidade justificada e regras de ajuste fixadas antes do teste.

## Referência e métricas

Relevância é um conjunto de IDs únicos existente na publicação exata do catálogo (ID, versão, formato e hash). `null` significa alvo sem julgamento, excluído das métricas mas contado na cobertura geral; `[]` significa julgamento conhecido vazio, incluído nas contagens e denominadores definidos. Julgamentos e declarações da partição nunca entram no executor.

Compara-se o conjunto completo de itens retornados, sem limiar, top-N ou ajuste do recomendador. TP é a interseção; FP são os retornados fora da referência; FN são os relevantes não retornados. Reutiliza-se o cálculo RNF de precision, recall, F1 e F2, com razões de denominador zero como `null`. Micro soma contagens; macro informa média dos valores definidos e quantidade de alvos definidos/indefinidos por métrica. Bloqueios, vazios e falhas técnicas recebem predição vazia e continuam nas métricas quando julgados; falhas e estados inesperados ficam explícitos. Uma falha esperada apenas verifica esse tratamento: não é resultado de qualidade do modelo.

## Cenários e reprodução

Seis cenários: referência de um teste, referência de ambos, associações conhecidas vazias, apenas dois vizinhos, entrada inválida e alvo não julgado. Duas repetições verificam o conteúdo determinístico. Tempos observacionais ficam fora do hash determinístico, medem execução local em processo incluindo validação/snapshots e não sustentam conclusões de desempenho. O gate técnico exige repetibilidade e estados esperados; não exige um valor artificial de relevância.

`npm run evaluate:testrec -- --output diretorio-novo` exporta bundle, relatório, CSV e manifesto com hashes dos arquivos/fontes. Recusa sobrescrever um diretório existente. `npm run evaluate:testrec -- --replay diretorio` confere integridade, fontes, relatório e CSV por nova execução. Não acessa banco, `.env`, provedores externos ou dados de autores. A reprodução usa a versão/runtime indicados no pacote; divergências de fontes ou ambiente determinístico devem ser investigadas.

## Para encerrar B18

Ainda são necessários fontes/protocolo confirmados, dados e autorização, referências de relevância independentes e justificadas, partições/folds sem vazamento, resultados por alvo e análise de falhas/cobertura. Medir tempo, erros e intervenções de configuração com participantes requer protocolo próprio; esta etapa apenas prepara a infraestrutura. As avaliações/copias de B17b não se convertem automaticamente em ground truth ou treino. O terceiro exemplo sem US (Ademar) permanece em B19–B21, condicionado à referência e aos dados.
