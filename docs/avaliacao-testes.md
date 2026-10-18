# Avaliação técnica do segundo recomendador — B18a

O [protocolo versionado](../research/pilots/testrec-v1/protocol.md) e o avaliador local preparam RF13/RF14 e RQ05. A [entrega 020](entregas/020-avaliador-tecnico-testes.md) registra a verificação. Executam exclusivamente a demonstração sintética Manhattan E21, sem mudar os métodos de Felipe/Ednaldo preservados ou concluir B18 empírica.

```powershell
npm.cmd run evaluate:testrec -- --output tmp/meu-ensaio-testes
npm.cmd run evaluate:testrec -- --replay tmp/meu-ensaio-testes
npm.cmd run check:testrec-evaluation
npm.cmd run evaluate:testrec -- --replay docs/evidencias/b18a
```

O diretório de saída deve ser novo. Contém `bundle.json` com entradas/dependências/partições e julgamentos separados, `report.json` com execução/métricas por cenário e tempos observacionais, `targets.csv` e `manifest.json` com protocolo, ambiente, estado Git e hashes dos arquivos/fontes. Replay confere bytes, dependências, conteúdo determinístico e CSV; tempos não são comparados. Não precisa de banco, `.env`, migração ou provedor.

O piloto tem seis cenários artificiais, repetidos duas vezes: três completos, um vazio, um bloqueado por insuficiência de vizinhos e uma falha técnica esperada. Cinco têm julgamentos artificiais e um fica sem julgamento. Referência vazia é diferente de referência desconhecida. Métricas contam TP/FP/FN pelo ID exato dentro da versão/hash do catálogo, usam todos os itens retornados, conservam falhas nos denominadores aplicáveis e reportam razões indefinidas como `null`. Macro explicita quantos alvos têm cada razão definida; micro soma contagens.

Antes de executar, o avaliador recusa saídas presentes no alvo, sua identidade/história/grupo no histórico, grupos incompletos e referências inválidas de relevância. A partição se baseia em identidade e grupos declarados, sem inferir independência real dos atributos. O alvo pode legitimamente ter os mesmos atributos de outro registro. As variantes são correlacionadas; não se calcula significância ou generalização. Julgamentos não vêm do ranking, de aceitação humana ou de cópias B17b e não entram nos argumentos do recomendador.

O gate técnico verifica repetibilidade e estados esperados. Contagens e métricas artificiais servem para verificar o avaliador e não são estimativas de qualidade do TestRec. E21 continua com Q01 (Euclidiana), Q02 (CT01) e Q03 (convenções/folds) abertas; dados, fontes completas e autorização ainda são necessários. Para fechar B18, faltam protocolo empírico confirmado, relevância/partições auditadas, ensaio real e medição de tempo/erros de configuração com participantes. A confirmação de Ademar e o caso sem US continuam em B19–B21.
