# Avaliação integrada: escopo técnico e pendências empíricas

Atualização 042: as 23 condições foram repetidas novamente com gate técnico aprovado e hash determinístico `40ec09df722e799c02afc27f03a36d8f586f805b5b2edc1b853f2ae991b60871`. O [estudo v3](estudo-tres-casos-v3.md) fecha a preparação técnica do instrumento/tarefas para os três casos; o [artigo](academico/artigo-us-agent.md) e o [capítulo](academico/capitulo-implementacao-avaliacao.md) relatam o estado sustentado. O registro observado continua vazio; relevância, previsão/revisão pareadas e esforço humano seguem não medidos.

Consolidação B22a/B23a em 039. O ensaio executa novamente **23 condições já preservadas**, sem criar testes, alvos, previsões, julgamentos ou observações de participantes. Cada condição é repetida duas vezes. Exemplos e variantes compartilham dados; as 23 condições não são amostras independentes.

| Exemplo | Condições | Origem | Comparação |
| --- | --- | --- | --- |
| RNF | 13 | Bundle B14a | Oito resultados de compatibilidade e cinco condições com anotações sintéticas separadas. |
| Casos de teste | 6 | Bundle B18a | Estados, partição declarada, catálogo e anotações sintéticas do avaliador existente. |
| Riscos | 4 | Registros 038 | Resultado, explicação e representação das execuções preservadas; sem julgamento de relevância. |

Os executores reais continuam responsáveis pelo cálculo. O comando reutiliza os dois avaliadores existentes e o método configurável de projeto; não acessa API, banco, `.env` ou provedor de classificação. A [arquitetura](arquitetura-executada.md) e o [tutorial](tutorial-three-recommenders.md) descrevem o restante do fluxo funcional, cuja verificação em navegador foi preservada nas entregas anteriores. Repetir offline não equivale a verificar novamente a instalação web ou produção.

## Repetir

No checkout correspondente, com dependências do lockfile instaladas:

```powershell
npm.cmd run evaluate:integrated -- --output tmp/integrated-demo-new
npm.cmd run evaluate:integrated -- --replay tmp/integrated-demo-new
```

Escolha um diretório novo. O comando recusa sobrescrita; os pacotes antigos permanecem intactos. O [pacote preservado](evidencias/integrated-demonstration-v1/summary.md) pode ser conferido com:

```powershell
npm.cmd run evaluate:integrated -- --replay docs/evidencias/integrated-demonstration-v1
```

O replay exige as fontes registradas e o mesmo Node/ICU/locale do manifesto, porque os snapshots dos executores históricos incluem metadados de runtime. O formato de inventário deste pacote registra bytes exatos para auditoria e conteúdo UTF-8/LF para portabilidade de checkout; somente CRLF/LF pode diferir nas fontes textuais. Os manifestos científicos anteriores mantêm seus hashes de bytes originais. Entradas e artefatos exportados são conferidos por bytes exatos, incluindo CSV.

O pacote contém:

- `inputs/`: cópias exatas dos dois bundles, quatro registros de risco e protocolo.
- `report.json`: snapshot determinístico, execuções, métricas sintéticas separadas por exemplo e limites explícitos.
- `scenarios.csv`: todas as condições, inclusive bloqueios, vazios e falhas esperadas, sem descarte de linhas.
- `observations.json`: durações locais em processo, fora do hash determinístico; não é benchmark nem tempo humano.
- `summary.md` e `manifest.json`: leitura resumida, hashes, fontes, runtime e proveniência.

## O que o resultado demonstra

O gate técnico exige repetibilidade, compatibilidade RNF, estados previstos de testes e igualdade de resultado/explicação/representação dos quatro riscos. As duas falhas técnicas deliberadas dos bundles continuam presentes; não são tratadas como execuções bem-sucedidas nem retiradas dos denominadores originais.

As duas condições de risco da versão 2 mantêm definição, base, identidade e origem da entrada. Mudar somente `team_distribution` altera distância/vizinho. A comparação com versão 1 também muda k/vocabulário e não é apresentada como estimativa isolada do efeito do atributo.

As anotações de RNF/testes são artificiais e permanecem nos respectivos avaliadores, com regras próprias de correspondência, julgamentos ausentes/vazios e razões indefinidas. Não se calcula uma “acurácia da plataforma” combinando as três populações. A saída dos riscos não se torna sua própria referência de relevância.

## O que falta para B22/B23 completos

| Frente | Estado | Evidência necessária |
| --- | --- | --- |
| Repetição técnica integrada | Entregue neste recorte offline. | Preservar pacote e fontes; conferir a instalação específica se o protocolo incluir API/banco/interface. |
| Qualidade empírica da recomendação | Não medida por este ensaio. | Dados autorizados, relevância independente, unidade/grupos/folds justificados e protocolo fixado antes da avaliação. |
| Qualidade de classificação e propagação de erros | Não medida; os bundles não contêm previsões e revisões observadas pareadas. | Referência, saída real do classificador e revisão real dos mesmos alvos, com versões/proveniência; mesma definição/base e mesma referência de itens para comparar as condições. Não simular previsões trocando rótulos manualmente. |
| Métodos sem rótulo funcional | Não se aplica classificação ao perfil de risco. | Registrar essa independência, sem interpretar como acurácia perfeita. |
| Esforço de configuração dos três casos | Sem coleta humana. O instrumento v2 conserva dois exercícios históricos. | Versão de tarefas/vínculo para os três casos, decisões metodológicas, instalação conferida e observações reais de passos, tempo, erros e intervenções. O tutorial não é o novo instrumento. |
| Artigo/dissertação | Arquitetura, tutorial e matriz de alegações preparados; textos finais e revisão acadêmica pendentes. | Relatar somente capacidades/resultados sustentados e incorporar avaliação/aprovação efetivamente obtidas. |

O [protocolo versionado](../research/integrated-demonstration-v1/protocol.md) especifica a futura comparação entre rótulos de referência, previstos e revisados, sem declarar essas condições já executadas. A [medição de esforço](medicao-esforco-configuracao.md) continua independente dos tempos deste comando.
