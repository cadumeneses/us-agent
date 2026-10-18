# Roteiro do observador — study-review-001

Versão `configuration-task-pack-v1`, 18/10/2026. Proposta local para revisão da orientação. Não registra aprovação, recrutamento, coleta ou utilidade empírica. O gabarito é um oráculo técnico calculado offline com os importadores/executores existentes; não foi produzido por uma pessoa nem publicado no banco.

## Preparação revisável

Preparar a instalação local com migrations até 024, mesmo software/idioma e arquivos por tentativa. Manter a aplicação e o navegador no acesso local permitido pelo contrato de segurança; não distribuir a chave interna da API. Definir antes da coleta a revisão/fingerprint do software efetivamente usado, seleção/justificativa da amostra, treinamento, limite de tempo e procedimento de interrupção. Esses parâmetros não são inferidos do ensaio automático e precisam de fechamento metodológico.

Gerar namespace exclusivo por tentativa e entregar **somente `participant/`** a quem fará o exercício. Conservar `facilitator/` e o manifesto no arquivo da pesquisa. Confirmar ausência das definições/bases/catálogos desse namespace na instalação. Não pré-publicar a resposta ou importar o gabarito como trabalho da pessoa. Treinar navegação e leitura das mensagens em namespace separado antes do relógio da tarefa; registrar o treinamento efetivamente dado. Não alterar o manual para uma pessoa isoladamente.

Registrar cada tarefa planejada em `attempt-register.csv`, inclusive `not_started`. Proposta de estados: `not_started`, `started`, `completed`, `incomplete`, `abandoned`. Usar códigos pseudônimos sem nomes/credenciais e manter o vínculo pessoal fora do repositório. Alternar a ordem dos dois exercícios entre pessoas, conservando a ordem real e as tentativas. Não tratar tentativas da mesma pessoa como amostras independentes.

## Observação

Começar o relógio relativo único em zero quando a pessoa recebe a tarefa após o treinamento. Não usar a duração de scripts como tempo humano. Espera pela aplicação continua incluída; pausas explícitas são somente para interrupção/ambiente. Registrar início, eventos e fim conforme o instrumento B18b.

Proposta de ajuda: fornecer o mesmo roteiro a todos; responder quando houver pedido explícito ou impedimento técnico do ambiente. Registrar ajuda adicional como `procedural`, `conceptual` ou `technical`, sem usar o gabarito para conduzir silenciosamente a tarefa. Se o procedimento precisar mudar, registrar desvio e revisar o protocolo antes de comparar sessões.

| Código de erro proposto | Observação |
| --- | --- |
| `definition_binding` | Dificuldade com atributos/bindings/publicação da definição. |
| `taxonomy_reference` | Dificuldade com lista/nós/vínculo da versão taxonômica. |
| `catalog_import` | Dificuldade com revisão/publicação/seleção do catálogo de testes. |
| `dataset_mapping` | Dificuldade com caminhos ou valores no mapeamento. |
| `dataset_preview` | Prévia/importação/publicação da base não concluída. |
| `target_entry` | Dificuldade com preenchimento/listas/seleção de entrada. |
| `execution` | Execução recusada ou resultado inesperado a investigar. |
| `replay` | Dificuldade ao consultar/verificar/exportar a execução. |
| `environment` | Impedimento de ambiente ou acesso. |

Esses códigos descrevem observações, não erros comprovados da pessoa ou defeitos da aplicação. Proposta de contagem: um problema persistente é uma ocorrência; contar novamente quando houver nova tentativa explícita após intervenção/correção. Registrar separadamente alterações em configuração e código. Não converter ausência de ajuda registrada em prova de autonomia.

## Checkpoints e gabarito

Preencher `checkpoints.csv` com IDs/versões/hashes e arquivos realmente produzidos. Conferir conteúdo, origem, definição/base/catálogo selecionados e vínculos. Marcar revisão como `verified`, `divergent` ou `not_obtained`, conservando o original. Uma conclusão declarada no log não substitui essa conferência.

O RNF deve preservar o resultado do caso de compatibilidade mesmo após acrescentar o contexto. O exercício de testes deve manter quatro registros conhecidos e três vizinhos, com os scores e artefatos do gabarito. Esses números conferem correção técnica, não qualidade/pertinência empírica. O gabarito identifica os resultados calculados e a definição esperada; UUIDs internos de sua verificação offline não são IDs de publicação na aplicação. Registrar hashes de base/execução reais, que podem incluir identidades de importação diferentes.

O resultado `run` exige entrada sem respostas, método e dependências corretos e inspeção da evidência; `replay` exige o resultado de replay e o arquivo exportado. Diferença de hash decorrente de UUID real não prova divergência científica: conferir o conteúdo e os vínculos. Não substituir a sugestão original por uma cópia editada para aparentar coincidência.

## Integração da medição e revisão do estudo

O instrumento B18b e seu protocolo/material inicial permanecem congelados. Este lote é uma proposta adicional de tarefas, não uma substituição silenciosa de `configuration-effort-v1/materials.json`. Antes de coleta formal, consolidar uma nova versão de protocolo/material que vincule este pacote e seus arquivos ao log e ao analisador. Não trocar apenas o hash no registro nem rotular os artefatos técnicos como observações humanas. Esta revisão de tarefas não habilita coleta por si só.

Pontos para decisão da orientação: amostra e recrutamento, treinamento, duração/interrupção, limites de ajuda, auditoria dos checkpoints, tratamento de não iniciadas/perdas e vínculo da versão final de materiais ao instrumento. Falta também incorporar o terceiro exemplo sem US após obter sua referência/material. Nenhuma dessas decisões é preenchida com números ou aprovação presumida.
