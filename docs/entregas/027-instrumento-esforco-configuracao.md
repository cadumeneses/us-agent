# 027 — Instrumento de análise do esforço de configuração

18/10/2026 — B18b, preparação B14/B18/RQ05. Estado: instrumento, protocolo proposto e ensaio artificial entregues; estudo com participantes e avaliação empírica não realizados.

## Resultado

O rascunho temporário foi revisado e transformado em implementação executável para analisar logs declarados por observador. O [guia](../medicao-esforco-configuracao.md) apresenta formato, uso, limites e critérios ainda abertos. O analisador não gera telemetria automática nem verifica referências de artefatos na API/banco.

O instrumento distingue tempo decorrido/pausado/ativo observado, ajuda por tipo, erros por código, mudanças em configuração e mudanças no código da aplicação. Exige início/fim e checkpoints por método, mantém desistências/incompletas e explicita os denominadores de conclusão/medianas. Sessões da mesma pessoa não são consideradas independentes. O relatório conserva `empiricalClaim: false`.

O protocolo e o conjunto de materiais são vinculados por hash. A revisão do software é acompanhada de estado da árvore e fingerprint declarado, pois o commit sozinho não descreve mudanças locais. Os checkpoints preservam referência e instantes decorrido/ativo observados; esses dados não certificam que o artefato existe ou está correto.

O [pacote preservado](../evidencias/b18b/manifest.json) tem três sessões artificiais, com referências/fingerprint explicitamente autorados para verificar cálculo e integridade. Nenhum tempo de pessoa real ou resultado de usabilidade é alegado. O escopo inclui RNF e a demonstração sintética de testes; Ademar permanece pendente e exige nova versão futura.

## Verificação

- 150 testes API passaram, incluindo seis novos testes de esforço; build API passou.
- Exportação/replay, repetibilidade, recusa de sobrescrita, corrupção de relatório/CSV, hash de protocolo, JSON duplicado e combinações inválidas de argumentos passaram.
- A implementação não altera métodos, dados originais, interface ou banco operacional. Os ensaios de referência continuam sendo verificação técnica, separados da aprovação científica.
- Oito cenários RNF e os replays B14a/B18a/B02h permaneceram iguais. O índice Git conferiu 129 hashes preparados e a checagem de whitespace passou, preservando os CSVs inventariados. Alterações em staged; os três PDFs locais continuam fora do Git.

Hash determinístico do relatório: `c03ed6d03a118549809466cedbe67ea6133a5f92f1030a92dd727216552c52f4`.

## Continuidade

Revisar protocolo e materiais, fixar roteiro/amostra/treinamento/regras de ajuda, realizar observações e verificar checkpoints reais antes de relatar esforço empírico. Confirmar material/método de Ademar para o terceiro exemplo. Os bloqueios de dados/método de Felipe/Ednaldo e o protocolo de avaliação integrada permanecem no workflow; B18b não os encerra.
