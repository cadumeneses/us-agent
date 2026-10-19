# B18e — vínculo do instrumento aos roteiros

Versão `configuration-effort-v2`, 19/10/2026. Proposta para revisão metodológica; não registra aprovação ou coleta. Mantém as regras de observação, cálculo e limites do protocolo v1, preservado em `research/configuration-effort-v1/protocol.md`.

As tarefas agora são os roteiros RNF e testes de B18c, verificados tecnicamente em B18d. Medem configuração orientada por manual. RNF usa reconstrução de compatibilidade; testes usam demonstração sintética Manhattan/K=3. O terceiro exemplo permanece pendente.

Gerar um lote com namespace novo por tentativa pelo comando `prepare:configuration-tasks`. Cada sessão informa `taskBatch.namespace` e o SHA-256 dos bytes de `materials.json` desse lote. O CLI v2 exige os diretórios correspondentes por `--tasks`, regenera cada lote pelo verificador B18c e recusa divergências, namespaces repetidos e lotes extras/ausentes. Preserva todos os arquivos dos lotes dentro do pacote de análise para replay. O hash do lote identifica exatamente roteiros, arquivos, gabarito e fichas; não identifica publicações reais.

O observador entrega somente `participant/` à pessoa e conserva `facilitator/`. Usa as fichas e o registro de tentativas planejadas do lote; registra não iniciadas separadamente. Checkpoints exigem as referências reais produzidas na instalação, não UUIDs internos do gabarito. O analisador verifica os arquivos de tarefa, mas não busca nem aprova os artefatos declarados dos checkpoints, o software observado ou a autenticidade das observações.

O formato usa schemaVersion 2, protocolo v2 por hash e materiais de vinculação v2 por hash; cada sessão acrescenta taskBatch. Eventos, relógio relativo, pausas, ajuda, erros, alterações de código, critérios de conclusão e denominadores seguem v1. A saída inclui o lote por sessão no JSON e no CSV. O replay usa os lotes copiados no pacote e recalcula os resultados. Não converter logs v1 trocando hashes: conservar os pacotes anteriores e registrar nova entrada com proveniência apropriada.

Antes da coleta, revisar com a orientação seleção/amostra, treinamento, limite de tempo, ajuda/interrupções, auditoria de checkpoints e perdas; conferir a instalação efetivamente usada. O vínculo técnico não fixa essas decisões. `empiricalClaim` continua false; o ensaio de verificação usa apenas sessões artificiais, sem medir pessoas. A avaliação empírica da recomendação e as fontes de Felipe, Ednaldo e Ademar continuam pendentes.
