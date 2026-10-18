# Roteiros e materiais de configuração — B18c

18/10/2026. Preparação RQ05/B14/B18. O [lote preservado](evidencias/b18c/materials.json) contém dois exercícios com arquivos importáveis, instruções de uso e gabarito do observador. É uma proposta revisável; não houve estudo com pessoas ou aprovação da orientação.

## Exercícios entregues

| Exercício | Trabalho proposto | Materiais |
| --- | --- | --- |
| RNF | Publicar lista de contexto, acrescentar atributo obrigatório de contexto ao template, importar base, preencher alvo, executar e conferir histórico/replay/exportação. | [Roteiro](evidencias/b18c/participant/rnf.md), [configuração pedida](evidencias/b18c/participant/rnf/settings.json), [base](evidencias/b18c/participant/rnf/dataset.json), [alvo](evidencias/b18c/participant/rnf/target.json). |
| Testes | Publicar catálogo sintético e lista de critérios, vincular ao template, importar quatro candidatos, preencher alvo sem respostas, executar e conferir histórico/replay/exportação. | [Roteiro](evidencias/b18c/participant/tests.md), [configuração pedida](evidencias/b18c/participant/tests/settings.json), [catálogo](evidencias/b18c/participant/tests/catalog.json), [base](evidencias/b18c/participant/tests/dataset.json), [alvo](evidencias/b18c/participant/tests/target.json). |

O RNF usa perfis reconstruídos de compatibilidade preservados, com contexto adicional e respostas do alvo retidas. Não representa a base empírica de Felipe. Testes usam somente a demonstração sintética Manhattan/K=3 já identificada; nenhum dado público incompleto foi introduzido nesse método. A base fornecida é um array, sem exigir que a pessoa extraia registros de um envelope interno de pesquisa. Não há exclusão a adivinhar para concluir esses dois exercícios.

Os roteiros são em português e citam controles/fluxos existentes. O idioma da interface deve ser fixado e registrado no estudo; o lote não altera a aplicação nem traduz os artefatos. Por fornecer passos explícitos, a proposta mede configuração orientada por manual, não descoberta autônoma.

## Material do observador

Entregar somente `participant/` à pessoa que executará a tarefa. O observador conserva [guia](evidencias/b18c/facilitator/guide.md), [gabarito técnico](evidencias/b18c/facilitator/answer-key.json), [ficha de checkpoints](evidencias/b18c/facilitator/checkpoints.csv) e [registro das tentativas planejadas](evidencias/b18c/facilitator/attempt-register.csv).

Os checkpoints iniciam como `pending` e o registro de tentativas começa vazio. Não há códigos de pessoas, tempos ou conclusões fictícias nesses arquivos. Registrar também tarefas não iniciadas e preservar ajuda/pausas/alterações de código. O guia propõe códigos de erro e regra para contar nova ocorrência, treinamento em namespace separado e ordem alternada; regras e parâmetros do estudo continuam sujeitos à revisão metodológica.

O gabarito não contém uma execução de participante. A fábrica monta publicações somente em memória para usar os importadores/executores reais. UUIDs internos de importação são marcadores técnicos; não são publicações no banco e não devem ser copiados para o log. Bases e execuções reais precisam das referências efetivamente produzidas, inclusive quando seus hashes diferem por IDs reais da importação.

## Geração e verificação

```powershell
npm.cmd run prepare:configuration-tasks -- --namespace tentativa-001 --output tmp/tarefas-tentativa-001
npm.cmd run prepare:configuration-tasks -- --replay docs/evidencias/b18c
npm.cmd run check:configuration-tasks
```

Cada namespace usa 1–24 caracteres de identificador em minúsculas e gera IDs de definição/base/catálogo/taxonomia próprios. Usar um lote novo por tentativa, confirmar que os IDs ainda não existem na instalação e conservar seus hashes. A ferramenta não publica os objetos nem cria/limpa ambientes. Ela recusa sobrescrita, preserva os arquivos de origem e verifica a repetibilidade de todos os artefatos.

A [verificação offline](evidencias/b18c/verification.json) passa os arquivos pelos contratos reais de publicação, prévia, seleção e execução: um registro RNF e quatro registros de testes são válidos; o novo contexto não muda o resultado RNF; os vizinhos/scores de testes coincidem com a demonstração preservada. Não gera tempos humanos nem avalia pertinência científica. Os roteiros foram conferidos contra os componentes/guias existentes; este novo lote não foi percorrido no navegador nesta entrega.

## Relação com o instrumento de medição

B18b continua congelado e vinculado ao seu pacote inicial de sementes. Este lote B18c amplia a proposta de tarefas e **ainda precisa ser vinculado a uma nova versão do protocolo/material de coleta e ao analisador**. Não substituir silenciosamente `configuration-effort-v1/materials.json` nem trocar apenas hashes em logs antigos. Os pacotes B18b e B18c continuam reproduzíveis separadamente.

Antes da coleta formal, fechar com a orientação amostra/recrutamento, treinamento, tempo/interrupção, ajuda, auditoria de checkpoints e tratamento de não iniciadas/perdas; vincular a versão final de arquivos ao instrumento e percorrer o lote na instalação real. Esses itens não receberam números ou aprovação presumidos. O terceiro exemplo sem US continua dependente do material de Ademar. A qualidade empírica de classificação/recomendação de Felipe/Ednaldo permanece uma avaliação distinta.
