# Entrega 030 — protocolo e lotes de configuração vinculados

19/10/2026. B18e, continuidade de B14/B18/RQ05. A revisão encontrou B18d concluído tecnicamente e escolheu o próximo incremento explicitamente registrado no plano: vincular materiais ao instrumento sem substituir os pacotes anteriores.

## Resultado

O [protocolo v2](../../research/configuration-effort-v2/protocol.md) vincula cada sessão ao namespace e ao hash dos bytes de `materials.json` do lote efetivamente declarado. O novo CLI verifica protocolo/materiais, regenera os arquivos pelo verificador B18c e conserva os lotes completos dentro da exportação. JSON e CSV identificam o lote por sessão. Cada tentativa exige namespace distinto; lotes extras, ausentes, repetidos ou divergentes são rejeitados.

O analisador v2 reutiliza as regras de eventos e cálculos v1, mantendo identificação e hash da entrada v2 no relatório. Os arquivos do instrumento B18b e gerador B18c permanecem intactos. Logs anteriores continuam usando o CLI v1. Não houve alteração de motor, banco, aplicação web ou deploy.

## Evidência e verificações

O [pacote B18e](../evidencias/b18e/manifest.json) preserva duas sessões artificiais, derivadas das fixtures RNF/testes de B18b e explicitamente identificadas como `synthetic_rehearsal`. Os tempos, códigos e checkpoints são artificiais; não representam novas observações. Os dois lotes foram gerados em namespaces separados e copiados para `tasks/` no pacote. O replay dispensa os diretórios temporários originais e exige as fontes de software inventariadas.

- `npm.cmd run check:configuration-binding`: 16 verificações passaram, incluindo dois métodos, igualdade integral dos resultados de observação com v1, repetibilidade, replay com cópias próprias, não sobrescrita, versões/protocolo/materiais divergentes, namespace repetido, lote ausente, relógio/proveniência inválidos e recusa de adulteração mesmo após recalcular checksums.
- `npm.cmd run measure:configuration-v2 -- --replay docs/evidencias/b18e`: relatório SHA-256 `96dc7ad41eb239f947438f203be6ca92592d421a0bb65030678b1bc9c1d00396` conferido.
- API: 154 testes passaram; build TypeScript passou.
- Replays B18b/B18c passaram; oito cenários congelados RNF preservados. Os arquivos antigos não foram regravados.
- `git diff --check` passou. Não foi necessário novo percurso de navegador: o incremento altera somente instrumento offline e documentação.

O inventário científico agora inclui B18e e aceita `--worktree` para conferir bytes locais sem preparar stage. Essa conferência global encontrou uma divergência preexistente em `apps/api/src/services/research-inputs.ts`: 41 quebras CRLF locais versus LF no índice Git (2.023 versus 1.982 bytes), com conteúdo igual após normalizar quebras. O arquivo foi preservado; a checagem não normaliza hashes silenciosamente. Após o pedido de preparação no stage, a nova checagem sobre o índice passou com 198 hashes (130 fontes e 68 artefatos). Os CSVs exportados preservam CRLF por contrato, reconhecido na verificação de whitespace via `.gitattributes`, sem alteração dos bytes inventariados. Os replays B18b/B18c/B18e e as verificações específicas passaram.

## Continuidade

O vínculo técnico está entregue; B14/B18 continuam em andamento. A próxima passagem é revisar o protocolo e fixar decisões metodológicas, conferir a instalação escolhida e realizar coleta observada com auditoria dos checkpoints. O CLI verifica arquivos de tarefa, mas não autentica observações ou busca as publicações declaradas nos checkpoints.

Fontes/avaliações empíricas de Felipe e Ednaldo, Q01/Q03/CT05 e confirmação/material do terceiro exemplo de Ademar continuam pendentes. Nenhum desses critérios foi substituído pelo ensaio artificial. Os 51 arquivos desta entrega foram preparados no stage a pedido do usuário; os arquivos preexistentes não rastreados ficaram fora. Não houve commit ou push.
