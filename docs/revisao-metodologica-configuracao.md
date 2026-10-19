# Pauta de revisão metodológica da configuração

19/10/2026. Preparação B14/B18/RQ05. Esta ficha reúne escolhas que precisam de fechamento com a orientação; não registra aprovação, recrutamento ou coleta. Não altera os protocolos/materiais congelados nem fabrica decisões, participantes ou tempos.

## Material concreto para a revisão

- [Protocolo v2](../research/configuration-effort-v2/protocol.md), com vínculo por sessão ao namespace/hash do lote.
- [Roteiros RNF/testes](roteiros-configuracao.md), com arquivos da pessoa separados do gabarito do observador.
- [Instrumento e limitações](medicao-esforco-configuracao.md), incluindo pausas, ajuda, erros, perdas e denominadores.
- [Verificação automatizada dos roteiros](entregas/029-verificacao-roteiros-no-navegador.md) e [vínculo do instrumento](entregas/030-vinculo-protocolo-materiais-analisador.md).
- [Acesso de produção verificado](entregas/033-correcao-login-producao.md). Isso confirma login/rotas por HTTP; não confirma que uma pessoa configurou os exercícios no ambiente de coleta.
- [ARISE confirmado como terceiro exemplo](arise-contrato-e-auditoria.md), com texto/suplemento auditados; ainda sem tarefa executável e com lacunas científicas localizadas.

## Decisões a fechar

Os encaminhamentos seguintes são propostas para discussão, não valores já aprovados. Campo vazio significa pendente.

| ID | Decisão necessária | Encaminhamento para discutir | Registro da decisão/evidência |
| --- | --- | --- | --- |
| D01 | Pergunta e alcance | Medir configuração orientada por manual nos dois exercícios disponíveis. Não chamar isso de descoberta autônoma ou avaliação da qualidade da recomendação. Decidir se o estudo começa com dois casos ou aguarda ARISE. | Pendente. |
| D02 | População, seleção e amostra | Definir perfil/experiência, recrutamento, quantidade e justificativa compatível com a pergunta. As cinco contas de acesso não são cinco participantes recrutados. | Pendente. |
| D03 | Ordem e repetição | Discutir tarefas pareadas por pessoa e ordem alternada; registrar tentativas e aprendizado. Não tratar sessões da mesma pessoa como independentes. | Pendente. |
| D04 | Treinamento e início do relógio | Fixar instrução e treinamento iguais, em namespace separado; definir se autenticação/preparação ficam fora da tarefa e como serão registradas. | Pendente. |
| D05 | Ambiente | Escolher instalação/idioma, versão do software e condições de rede. Preferir ambiente de estudo separado, com dados sintéticos e namespace novo por tentativa, pois os logins atuais compartilham o mesmo espaço. | Pendente. |
| D06 | Tempo e interrupção | Fixar limite e regra de encerramento. Manter espera da aplicação incluída no tempo decorrido e descontar somente pausas observadas, conforme o instrumento. Não inferir metas do tempo dos scripts. | Pendente. |
| D07 | Ajuda e ocorrência de erro | Revisar os códigos e a regra do guia: problema persistente conta uma vez; nova tentativa explícita pode gerar nova ocorrência. Fixar quando/como o observador intervém e registra ajuda. | Pendente. |
| D08 | Conclusão e auditoria | Conferir todos os checkpoints exigidos com IDs/versões/hashes reais e arquivos exportados. Definir quem audita, como registra divergências e como trata conclusão declarada sem evidência suficiente. | Pendente. |
| D09 | Não iniciadas, perdas e desistências | Manter registro das tentativas planejadas e de `not_started`, separado dos logs de sessões. Não criar sessão/tempo zero para tarefa não iniciada; informar denominadores reais. | Pendente. |
| D10 | Identificação e custódia | Definir códigos pseudônimos, acesso/guarda dos logs e procedimentos aplicáveis da pesquisa. Vínculos pessoais ficam fora do repositório; login de aplicação não substitui código de participante. | Pendente. |
| D11 | Análise e interpretação | Reportar linhas, desfechos, ajuda/erros/intervenções e medianas condicionadas às conclusões, com perdas/denominadores. Definir comparações e limites antes de observar resultados. | Pendente. |
| D12 | Fechamento de versão | Após as decisões, congelar versão final do protocolo/materiais e registrar quem revisou, data e evidência. Se as decisões alterarem v2, criar nova versão; não mudar hashes de logs anteriores. | Pendente. |

Para cada decisão, registrar a escolha, justificativa, responsável pela revisão, data e referência de evidência. Uma proposta preenchida pelo desenvolvimento não é aprovação da orientação. Não é necessário decidir parâmetros de um algoritmo científico por conveniência deste estudo.

## Passagem para piloto observado

1. Fechar D01–D12 e preservar a evidência da revisão. Definir procedimentos de participação aplicáveis antes de iniciar a coleta.
2. Preparar o ambiente escolhido e o lote por tentativa. Confirmar ausência dos IDs desse namespace; conservar manifesto, arquivos e referência da versão observada do software.
3. Percorrer os dois roteiros nessa instalação, inclusive login, publicação, importação, execução, histórico, replay e exportação. A verificação HTTP de produção não substitui esse percurso.
4. Realizar piloto observado e documentar dúvidas/desvios. Se mudar material/procedimento, versionar antes do conjunto final; não reclassificar o piloto automaticamente como estudo definitivo.
5. Coletar e auditar os checkpoints. Só então analisar esforço com os limites declarados; o analisador não certifica autenticidade das observações nem validade do desenho.

O terceiro exemplo entra em nova tarefa/protocolo quando suas fontes e implementação estiverem prontas. Essa etapa não encerra a avaliação empírica RNF/TestRec, a comparação de rótulos previstos/referência ou a consolidação dos três exemplos.
