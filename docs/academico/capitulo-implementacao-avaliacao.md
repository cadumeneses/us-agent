# Implementação e verificação da plataforma US-Agent

## Objetivo e delimitação

O US-Agent foi organizado para configurar recomendadores de Engenharia de Software por meio de definições, atributos, taxonomias e bases de referência versionadas. O primeiro recorte utiliza KNN e demonstra três saídas: requisitos não funcionais, casos de teste e riscos de projeto. A avaliação apresentada neste capítulo é técnica. Não foram coletados tempos de participantes, julgamentos independentes de relevância ou previsões e revisões humanas pareadas para uma avaliação empírica de propagação de erros.

Essa delimitação distingue a capacidade de configurar e repetir uma execução da qualidade das recomendações em uma população real. Os dados demonstrativos não são apresentados como bases experimentais originais dos trabalhos de referência. As diferenças metodológicas e as lacunas das fontes estão registradas na [matriz de fidelidade](../referencias-e-fidelidade.md).

## Modelo de configuração

Uma definição publicada identifica a entrada, a saída, os atributos e a política de execução. Cada atributo possui tipo, cardinalidade, obrigatoriedade, escopo e papel. Características podem participar do cálculo quando uma representação compatível está implementada; campos de contexto não são incluídos automaticamente no vetor. Filtros e texto livre exigem uma política explícita. O sistema rejeita parâmetros não suportados pelo método em vez de disponibilizar opções sem implementação.

As taxonomias representam listas e árvores independentes da classificação funcional de histórias. O vínculo de um atributo contém ID, versão e hash da publicação. Os nós têm IDs estáveis, descrições e pais opcionais. Um nó organizador ou preservado como desativado pode permanecer na árvore sem ser selecionável. Nome de apresentação e identidade não são equivalentes.

A importação CSV/JSON mantém o arquivo de origem, o mapeamento e o relatório por campo e registro. Erros não são descartados silenciosamente. A publicação conserva a base rotulada escolhida, que é distinta do histórico operacional. Taxonomias, definições, bases e catálogos de teste publicados não são editados; uma alteração exige outra versão. Retirada de publicação preserva consulta e replay de execuções anteriores.

## Execução e continuidade dos métodos

O núcleo KNN é compartilhado, enquanto políticas nomeadas determinam representação, elegibilidade, desempate e agregação. O método RNF conserva as dimensões do alvo, Manhattan normalizada, k=1, o filtro de módulo/operação e o comportamento diante de candidatos sem itens. O exemplo de testes usa catálogo próprio, critérios de aceitação, atributos e equações identificadas como demonstração. As questões ainda abertas sobre distância Euclidiana, associações e recorte experimental impedem anunciar uma reprodução completa de TestRec.

O terceiro exemplo recebe um perfil de projeto sem exigir história ou classificação. Características categóricas, pesos e número de vizinhos são configurados. Nas duas condições preservadas da versão 2, modificar apenas `team_distribution` altera distância e vizinho sob a mesma definição/base. A comparação entre versões 1 e 2 não isola esse efeito, pois também altera k e vocabulário. A evidência sustenta participação de um atributo configurado no cálculo, sem generalizar para tipos ou políticas ainda não implementados.

Cada execução conserva a entrada, as publicações e seus hashes, os candidatos e motivos de exclusão, vetores/distâncias, vizinhos e itens. A explicação identifica a política e a versão efetivamente executadas. O replay compara resultado, explicação e projeção preservados; não reconstrói uma execução histórica usando o catálogo atual.

## Revisão, adaptação e governança

A classificação e a recomendação são etapas distintas. Pares funcionais múltiplos e a proveniência da classificação permanecem na história. A avaliação de uma sugestão exige destino confirmado e produz um registro separado do resultado bruto. A adaptação de RNF acrescenta uma cópia com sentença, motivo, autor, revisão e referência à cópia anterior. Não substitui a sentença original, o resultado, a base publicada ou o conteúdo da história operacional. O mesmo princípio de preservar origem é aplicado às cópias de testes.

A identidade autenticada é usada na autoria das operações novas; registros históricos não recebem autoria pessoal retroativa. Papéis de leitor, revisor, mantenedor e administrador restringem as operações. O administrador gerencia vínculos e consulta auditoria; não pode remover o último administrador ativo. A revogação do vínculo é verificada na próxima requisição.

Organizações utilizam schemas de domínio distintos e contexto transacional por requisição. A resolução de identidade/vínculo ocorre no registro central. O contexto não usa outro schema de domínio como fallback; conexões reutilizadas não mantêm a organização de uma transação anterior. A auditoria registra ator, operação, identidade e hashes antes/depois em registros imutáveis. Isso é isolamento da aplicação e não elimina a necessidade de proteger as credenciais administrativas do banco.

A migração WIS é aditiva: cria rascunhos no modelo comum e conserva o retrato original e o mapa de IDs. Ordem, hierarquia, descrições e atividade são preservadas. A classificação continua usando a estrutura anterior até uma troca explícita de leitura. Preparar rascunhos não equivale a publicar taxonomias ou alterar classificações históricas.

## Método e resultados da verificação técnica

A unidade do ensaio integrado é uma condição de cenário preservada, repetida duas vezes. Há 13 condições RNF, seis de testes e quatro de riscos. Entre as condições RNF, oito concluem, uma é bloqueada, uma fica sem candidatos, duas ficam sem itens e uma representa falha técnica deliberada. Nos testes, três concluem, uma é bloqueada, uma fica sem itens e uma representa falha deliberada. As quatro condições de risco concluem. Esses estados não são excluídos do relatório.

Os oito resultados RNF de compatibilidade permaneceram iguais. Os quatro percursos de riscos preservaram resultado, explicação e projeção. O gate técnico das 23 condições passou; o relatório determinístico desta execução tem SHA-256 `40ec09df722e799c02afc27f03a36d8f586f805b5b2edc1b853f2ae991b60871`. As condições compartilham alvos e bases e não formam 23 observações humanas ou amostras experimentais independentes.

Também passaram 154 testes da API e 65 da interface, além dos checks locais HTTP/PostgreSQL de isolamento concorrente entre organizações, revogação, proteção do último administrador, autoria, auditoria imutável e cadeia de adaptação RNF. O ensaio da migration WIS verificou fonte intacta, operações desativadas não selecionáveis, rollback de colisão/fonte inválida, repetição pelo ledger e detecção de alterações posteriores na origem.

Esses resultados verificam propriedades dos caminhos exercitados. Não medem precisão, revocação, F2, utilidade percebida, esforço humano ou disponibilidade da instalação de produção. As métricas com anotações artificiais permanecem separadas nos avaliadores dos exemplos, sem agregação em uma suposta acurácia da plataforma.

## Avaliação empírica preparada

O [protocolo v3](../../research/configuration-effort-v3/protocol.md) e o [guia de execução](../estudo-tres-casos-v3.md) acrescentam tarefas dos três métodos, treinamento separado, namespaces novos, ordem proposta, pausas, ajuda, erros e alterações de configuração/código. O registro diferencia tentativas planejadas, não iniciadas e sessões realmente iniciadas. Conclusão exige checkpoints específicos, incluindo publicações, execução, replay e exportação. A ferramenta verifica bytes, snapshots e vínculos dos artefatos; o pesquisador ainda precisa auditar autenticidade, autoria da tentativa e contexto da observação.

O registro inicial contém zero sessões observadas e nenhuma duração inventada. Medianas e razões sem denominador permanecem nulas. A proposta metodológica precisa de revisão humana antes da coleta, inclusive população, amostra, participação, ambiente e custódia. A coleta exige atuação de participantes e não pode ser substituída pela execução dos scripts.

Para avaliar relevância, faltam alvos autorizados, referência independente e protocolo de partição/ajuste fixado. Para propagação de erros, faltam rótulos de referência, saídas reais do classificador e revisões reais dos mesmos alvos sob as mesmas publicações. O exemplo sem história não recebe artificialmente uma medida perfeita de classificação.

## Síntese dos limites

A implementação e a verificação sustentam configurabilidade no recorte executado, preservação dos métodos identificados e rastreabilidade das decisões. O estudo com pessoas e a avaliação empírica da relevância permanecem condições de investigação, não resultados positivos presumidos. A implantação das migrations/código deve ser conferida no ambiente real. Este texto fornece um capítulo técnico utilizável, mas não substitui revisão da orientação, adequação ao formato institucional ou resultados empíricos ainda não produzidos.
