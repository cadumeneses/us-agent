# Avaliação RNF — protocolo, resultados por alvo e replay

B14a implementa um piloto técnico local do processo de avaliação, atendendo ao início de RF13 e preparando RQ05. O método RNF e seus sete arquivos congelados permanecem preservados. O [protocolo versionado](../research/pilots/rnf-v1/protocol.md) define unidades, partição, métricas, falhas, medições e limites antes da execução registrada.

## Executar e conferir

Na raiz do repositório, com as dependências do lockfile instaladas:

```powershell
npm.cmd run evaluate:rnf -- --output tmp/meu-piloto-rnf
npm.cmd run evaluate:rnf -- --replay tmp/meu-piloto-rnf
npm.cmd run check:rnf-evaluation
```

O destino de exportação precisa ser novo; o comando recusa diretório existente. Sem `--output`, cria um diretório com identificação temporal sob `tmp`. Sem `--input`, constrói o piloto sintético versionado. Para usar o pacote exportado explicitamente:

```powershell
npm.cmd run evaluate:rnf -- --input tmp/meu-piloto-rnf/bundle.json --output tmp/repeticao-rnf
```

O comando atual aceita somente o contrato `synthetic_technical_pilot`. Não é um importador de estudos reais. Não lê `.env`, não acessa banco, navegador, rede ou provedores. A avaliação usa o mesmo executor puro que executa os envelopes publicados na plataforma; os envelopes do piloto são artefatos locais, sem publicação fictícia no banco.

## O que o pacote contém

| Arquivo | Conteúdo |
| --- | --- |
| `bundle.json` | Protocolo, anotações separadas, requisições, definições e bases exatas por cenário. |
| `report.json` | Snapshots integrais, resultados, diagnósticos, contagens, métricas, cobertura e hashes; tempos em seção separada. |
| `targets.csv` | Uma linha por cenário/alvo: estado, compatibilidade, itens retornados, TP/FP/FN, precisão/recall/F1/F2 e hashes. Campo vazio representa valor indefinido/ausente. |
| `manifest.json` | Ambiente, commit/árvore alterada, hashes das fontes/artefatos e aprovação/reprovação técnica. |

O replay confere hashes dos arquivos, fontes locais, conteúdo determinístico e correspondência do CSV. Não compara duração nem sobrescreve o ensaio original. Para compartilhar o pacote com outra pessoa, preservar também o código e as dependências correspondentes: o commit com árvore alterada, sozinho, não reconstitui os arquivos identificados pelos hashes.

## Interpretação correta

Oito cenários de **compatibilidade** usam o oráculo congelado do software anterior. Não entram nas métricas de relevância. O cenário que inclui o próprio alvo na base é intencionalmente um teste da exclusão do legado, identificado como compatibilidade.

Cinco cenários de **relevância sintética** exercitam acerto, retorno vazio, referência vazia, desacordo e falha de tipo. As anotações são fixtures declaradas para verificar as métricas. Não são julgamentos de pesquisadores sobre projetos reais. Alterar uma anotação muda as métricas sem mudar a recomendação; os testes verificam essa separação.

Relevância exige saída do alvo vazia e sua ausência da base por IDs de registro, história/classificação e texto duplicado normalizado. Partição inválida invalida o ensaio inteiro. Não há detecção de clones semânticos, divisão por projetos ou reprodução do leave-2-out de Felipe.

As métricas operam sobre conjuntos de RNFs normalizados pela função existente, com TP/FP/FN explícitos. Denominador zero gera `null`; macro informa quantos casos contribuíram em cada medida. Falha técnica tem estado/diagnóstico próprio e contribui com predição vazia no cálculo de ponta a ponta. Repetições não multiplicam os alvos. `targets` conta pares cenário/alvo, sem independência estatística entre eles.

A aprovação técnica exige repetição idêntica, compatibilidade preservada e correspondência entre falhas técnicas declaradas/ocorridas. Não há limiar de acurácia, SLA ou seleção de parâmetros introduzidos por este comando. Uma reprovação técnica ainda exporta relatório e retorna código de saída 1; vazamento ou pacote estruturalmente inválido impedem o ensaio antes de criar a exportação.

## O que ainda falta

B14 permanece em andamento. Faltam dados reais autorizados e referência de relevância apropriada, protocolo empírico alinhado ao estudo de Felipe, medições de configuração com participantes, volumes/ambientes representativos e metas fundamentadas nessas medições. A duração exportada mede somente execução em memória com validação/snapshots; não inclui publicação, interface, banco ou esforço de configuração.

F2 foi incluído para conferir contagens e a fórmula de avaliação. Isso não implementa o método de Ednaldo nem resolve Q01–Q03. A [matriz de fidelidade](referencias-e-fidelidade.md) continua sendo a referência para avançar ao segundo exemplo. A autenticação pessoal e o isolamento continuam pendentes antes de bases restritas ou uso multiusuário protegido, conforme a [revisão de escopo](revisao-de-escopo.md).
