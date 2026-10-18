# Preparação da medição de esforço de configuração — B18b

18/10/2026. Preparação técnica de RQ05/B14/B18. O instrumento analisa registros declarados pelo observador e exporta entrada, relatório, CSV e manifesto reproduzíveis. O [protocolo versionado](../research/configuration-effort-v1/protocol.md) é uma proposta metodológica do US-Agent para revisão da orientação; não houve recrutamento, coleta com pessoas ou aprovação científica registrada.

## O que está implementado

- Registro por sessão/tentativa: código pseudônimo, ordem, método, experiência declarada, idioma, revisão do software, estado da árvore local e fingerprint declarado do software observado.
- Eventos de início, pausa/retomada, erro por código, ajuda por tipo, alteração de configuração/código, checkpoint e fim.
- Tempo decorrido e tempo ativo observado, subtraindo somente pausas registradas. Tempo de espera pela aplicação continua incluído; não é tempo de CPU ou medida exclusiva de esforço cognitivo.
- Resultados `completed`, `incomplete` e `abandoned`. A conclusão declarada exige referências para todos os checkpoints do método; referências não são buscadas nem verificadas contra API/banco.
- Contagens de erros/ajuda e alterações, taxas por método e medianas condicionadas às conclusões declaradas, com denominadores explícitos. Incompletas e desistências permanecem nas linhas e nas taxas.
- Preservação da entrada recebida, protocolo/materiais por hash, exportação e replay determinístico. JSON com chaves duplicadas, relógio regressivo, atividades durante pausa e eventos após o fim são rejeitados.

Sessões da mesma pessoa não são tratadas como independentes. Conclusão com ajuda ou alteração de código fica identificada; isso não demonstra configuração autônoma. Ausência de ajuda registrada também não certifica autonomia ou completude da observação. O instrumento conserva `empiricalClaim: false`, inclusive para entradas marcadas como observadas.

## Ensaio técnico e materiais

O [ensaio preservado](evidencias/b18b/input.json) contém três sessões **escritas artificialmente para verificar o instrumento**: uma RNF concluída com pausa/ajuda, uma demonstração de testes concluída com alteração de código declarada e uma desistência. Tempos, códigos de participante, checkpoints e fingerprint foram autorados como fixture; não representam atividade ou desempenho de pessoas. Os testes adicionais cobrem encerramento incompleto e estados inválidos.

O [pacote de materiais](../research/configuration-effort-v1/materials.json) identifica cinco sementes locais por hash: definições dos dois métodos, referência de compatibilidade RNF, demonstração sintética de testes e catálogo sintético. São materiais para revisar o instrumento; manuais, treinamento, arquivos finais de tarefa e estudo com participantes ainda precisam de fechamento. Referências artificiais dos checkpoints do ensaio não são publicações reais.

Escopo atual: `ramos_2019_manhattan_k1_v2` e `us_agent_e21_equations_demo_v1`. O segundo preserva sua identidade sintética Manhattan; não há reprodução Euclidiana presumida. O caso Ademar ainda não existe como tarefa executável e deverá entrar em nova versão após confirmação de método/material. O instrumento não faz chamada a LLM, provedor externo, API operacional ou banco.

## Como executar

```powershell
# Somente o ensaio artificial versionado; exige diretório novo.
npm.cmd run measure:configuration -- --output tmp/meu-ensaio-configuracao

# Conferir o pacote preservado e as verificações de integridade.
npm.cmd run measure:configuration -- --replay docs/evidencias/b18b
npm.cmd run check:configuration-effort

# Analisar um arquivo de observações preparado conforme o protocolo.
npm.cmd run measure:configuration -- --input caminho/observacoes.json --output tmp/minhas-observacoes
```

O formato da entrada segue o [ensaio](../research/configuration-effort-v1/rehearsal.json), com eventos e estado explícitos. Para registros observados, `kind` deve ser `observed_sessions` e `provenance.capture` deve ser `observer_relative_clock`. Apenas esses rótulos não comprovam autenticidade, consentimento ou desenho válido. Cada sessão precisa de início zero e encerramento explícito; o instrumento não cria horários ausentes.

`materials.sha256` e `protocol.sha256` são hashes dos bytes dos arquivos versionados verificados pelo CLI. As referências de checkpoints apontam a hashes de conteúdo declarados dos artefatos usados. Commit e fingerprint do software precisam descrever a versão realmente observada, inclusive mudanças locais; o analisador conserva essas declarações, sem verificação remota. O pacote é recusado se o protocolo ou materiais divergem.

Saídas: `input.json`, `report.json`, `sessions.csv` e `manifest.json`. Replay verifica fontes e recalcula relatório/CSV; não aceita transformar um resultado em evidência empírica apenas alterando o checksum. Não sobrescreve diretórios existentes.

## O que falta para a medição com participantes

1. Revisar o protocolo, os materiais e os critérios de conclusão com a orientação; fixar seleção, tamanho/justificativa da amostra, treinamento, limite de tempo, ajuda e interrupções.
2. Preparar instalação/namespace, roteiro e arquivos iguais por tentativa. Registrar tarefas e pessoas planejadas, incluindo tarefas não iniciadas; o analisador só conhece as sessões declaradas no arquivo.
3. Conduzir a coleta observada conforme os procedimentos aplicáveis da pesquisa, conservar logs pseudônimos e conferir os artefatos reais de cada checkpoint.
4. Analisar perdas, ajuda, intervenções no código, ordem/aprendizado e limitações. Somente então relatar resultados de esforço de configuração, separados da qualidade das recomendações.
5. Incorporar o exemplo sem US quando suas fontes e implementação estiverem disponíveis. A preparação para dois métodos não encerra a demonstração dos três exemplos.

Os materiais completos de Felipe/Ednaldo, Q01/Q03 e os bloqueios de dados continuam no [plano](pendencias-e-proximos-passos.md). A medição de configuração não substitui avaliação empírica da recomendação ou classificação.

Continuação B18c: os [roteiros e arquivos de tarefa](roteiros-configuracao.md) agora estão preparados e verificados offline em lote separado. Não substituem o material de sementes deste protocolo. Consolidar o vínculo da versão final de estudo/material ao analisador antes de coleta formal; nenhum resultado humano ou aprovação foi acrescentado ao pacote B18b.
