# Estudo de configuração dos três casos — versão 3

A versão 3 tem tarefas, gerador, instrumento, verificação de artefatos, CSV e replay para RNFs, testes e riscos sem histórias. Não altera os pacotes v1/v2. O [protocolo](../research/configuration-effort-v3/protocol.md) é uma proposta metodológica concreta, ainda sem aprovação ou coleta atribuída a pessoas. O [registro inicial](../research/configuration-effort-v3/observations.empty.json) contém zero observações.

## Preparar um lote por tentativa

Na raiz do repositório, após `npm.cmd run build -w @us-agent/api`:

```powershell
npm.cmd run prepare:configuration-v3 -- --namespace p01-rnf-a1 --output tmp/tasks-p01-rnf-a1
npm.cmd run prepare:configuration-v3 -- --replay tmp/tasks-p01-rnf-a1
```

Cada lote contém instruções e dados dos três métodos, settings com IDs novos, gabarito separado e manifesto de arquivos/fontes. Compartilhar somente `participant/` com a pessoa. Escolher a tarefa prevista para aquela tentativa; gerar outro namespace para a próxima. O gabarito verifica importação/cálculo offline e não contém evidência de execução humana. O pacote identifica sua origem sintética/reconstruída.

O percurso de riscos não exige taxonomia, catálogo de testes, história ou classificação. RNF exige sua taxonomia; testes exigem taxonomia e catálogo. Os três exigem definição, base, execução, replay e exportação reais. A seleção de organização é feita em **Access and audit**; usar uma instalação de estudo e permissões compatíveis com configuração/publicação.

## Fechar decisões antes da coleta

| Decisão | Proposta técnica v3 para revisão |
| --- | --- |
| Pergunta | Configuração orientada por manual dos três métodos, com participação de atributos novos; relevância é estudo separado. |
| População/amostra | Adultos com familiaridade com desenvolvimento; piloto exploratório proposto de seis pessoas para cobrir as seis ordens uma vez. Não é cálculo amostral nem autorização de recrutamento. |
| Ordem/repetição | Desenho intraparticipante, três tarefas, seis permutações pré-atribuídas; registrar repetição/aprendizado. |
| Treinamento | Instrução comum e namespace de treino independente antes do relógio da tarefa. |
| Ambiente | UI inglesa, instalação de estudo, organização autorizada, commit e hash do código/arquivos registrados. Conferir instalação real antes da coleta. |
| Tempo | Proposta de limite de 30 minutos por tarefa; espera da aplicação incluída, somente pausas observadas descontadas. |
| Ajuda/erros | Ajuda registrada por tipo; erro persistente uma ocorrência, nova tentativa explícita outra ocorrência. Separar edição de configuração de código. |
| Conclusão | Checkpoints e arquivos reais conferidos pelo instrumento e pelo pesquisador; não usar UUIDs/hashes do gabarito como publicação efetiva. |
| Perdas | Registro de tentativas planejadas, não iniciadas e realizadas; não criar sessão/tempo zero para não iniciadas. |
| Custódia | Pseudônimos no instrumento; vínculos pessoais, consentimentos e gravações fora do Git, em armazenamento controlado. Responsável define procedimentos aplicáveis, acesso e retenção. |
| Análise | Denominadores por método e desfecho, medianas condicionadas às conclusões, identificação de medidas repetidas e auxílio/alterações de código. |
| Versão | Registrar responsável, data e referência da revisão antes de sessões observadas; alterar protocolo/material em nova versão quando necessário. |

As propostas estão preenchidas para revisão, não aprovadas pelo desenvolvimento. `methodology.status` fica `pending` no registro inicial. Uma coleta observada não vazia é recusada até existir registro explícito de revisão; o programa não certifica a autenticidade da aprovação.

## Registro e análise

Copiar o formato de `observations.empty.json` para um arquivo novo. Preencher `plannedAttempts` antes das observações. Uma sessão precisa corresponder exatamente a uma tentativa `recorded` e conter pseudônimo, método, tentativa, ordem, identidade do software/organização, namespace/hash do manifesto e eventos observados. Manter tempos relativos a zero, pausas/resumos e desfecho explícito. `not_started` fica apenas no registro de tentativas, com motivo.

Cada evento `checkpoint` declara `reference: { id, sha256 }` e `artifact: { file, sha256 }`. O primeiro hash é o snapshot da publicação/execução; o segundo é o hash dos bytes do arquivo exportado. Para replay, o hash da referência é o snapshot canônico do objeto de replay, que precisa identificar a execução e declarar resultado/explicação/projeção iguais. Guardar os arquivos no diretório informado por `--artifacts`, usando caminhos relativos sem `..`.

```powershell
npm.cmd run measure:configuration-v3 -- --input research/configuration-effort-v3/observations.empty.json --output tmp/effort-v3-empty
npm.cmd run measure:configuration-v3 -- --replay tmp/effort-v3-empty

# Após revisão e observações reais, usando arquivos novos:
npm.cmd run measure:configuration-v3 -- --input tmp/observations-real.json --tasks tmp/tasks-p01-rnf-a1 --tasks tmp/tasks-p01-tests-a1 --tasks tmp/tasks-p01-risks-a1 --artifacts tmp/observed-exports --output tmp/effort-v3-observed
```

Acrescentar um `--tasks` para cada namespace de sessão. A ferramenta recusa lotes sem sessão correspondente, hashes divergentes, snapshots inválidos, replay que aponta para outra execução, exportação de outra execução e publicações que não coincidem com as usadas no run. A saída preserva entrada, protocolo, tarefas, artefatos, relatório, CSV, resumo e manifesto. Recusa sobrescrita. Replay verifica esses bytes e recalcula o relatório.

O pesquisador ainda precisa conferir pessoa/tentativa/cronologia e integridade metodológica. O instrumento mantém `empiricalClaim: false` e não certifica validade/autenticidade só porque os arquivos são consistentes. Uma observação real pode ser analisada descritivamente sem que o software a promova automaticamente a conclusão científica.

## Verificação disponível

`npm.cmd run check:configuration-v3` verifica os três métodos, o registro vazio, rejeição de conclusão sem checkpoints, recusa de coleta sem revisão, replay de tarefas, cadeia de artefatos e detecção de adulteração. Seus eventos são declarados `synthetic_rehearsal`, nunca pessoas reais. O ensaio integrado da recomendação continua separado, em `evaluate:integrated`.
