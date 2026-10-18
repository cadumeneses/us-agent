# ADR 003 — Publicação da definição e seleção da base

Data: 17/10/2026. Estado: decisão de engenharia para B09–B11. Complementa a [ADR 001](001-contratos-e-compatibilidade.md).

O backlog coloca publicação de definições em B09, importação/publicação de bases em B10 e seleção da base em B11. A redação anterior que condicionava qualquer publicação à existência de uma base criava uma dependência circular. O pedido de escolher a base também exige distinguir configuração do método e dados de cada execução.

Uma definição publicada fixa esquema de entrada/saída, atributos, método/versão/parâmetros e as versões/conteúdos das taxonomias utilizadas. Sua publicação não escolhe nem consulta uma base de referência. Publicar só é permitido para um método implementado e compatível; inicialmente, o adaptador RNF v2.

A base será uma dependência explícita da execução: versão publicada escolhida, compatibilidade com a definição e snapshot/hash exatos. B10–B11 implementarão esse contrato. Sem a base validada e selecionada, a publicação da definição não habilita execução em produção, nem autoriza usar o histórico operacional implicitamente.

Publicar uma definição bloqueia a linha de rascunho e as taxonomias referenciadas na mesma transação. Uma taxonomia retirada ou com hash divergente impede a publicação inteira. Os vínculos têm referências persistidas e os conteúdos completos são congelados no pacote publicado. Uma retirada posterior preserva consulta, hashes e conteúdo histórico; não torna a dependência elegível para uma nova execução.

A edição de uma publicação exige nova versão em rascunho. O estado de retirada fica no envelope; o pacote publicado mantém a definição no estado `published` e o conteúdo que existia na publicação. Leitura histórica verifica integridade sem reinterpretar o pacote com a versão atual do adaptador. Execuções futuras deverão verificar a implementação e a disponibilidade atual das dependências, além de sua integridade.

Esta decisão não altera nenhuma fórmula de Felipe ou Ednaldo e não aprova bases/dados ainda indisponíveis. B09 verifica publicação, recuperação, integridade e concorrência. Execução persistida e avaliação empírica continuam nos incrementos seguintes.

Em B10, bases rotuladas passaram a ser importadas e publicadas com referência exata à definição, arquivo original, relatório, mapeamento e seleção explícita. B11 ainda deverá ligar essa versão de base à execução; a publicação da base não ativa consulta implícita ao histórico.

Em B11, a execução persistida passou a receber definição e base por ID/versão/hash. O pacote registra essas dependências e consulta exclusivamente a base selecionada. Retirada bloqueia novos usos; consulta/replay usa snapshots preservados. A interface integrada e as decisões genéricas permanecem em B12.

Em B12, o vertical RNF foi integrado e verificado na interface, incluindo avaliações separadas do resultado bruto. A [ADR 004](004-destinos-e-avaliacoes.md) fixa destinos explícitos e impede usar IDs importados como chaves operacionais por inferência. Aceitar não modifica a base publicada.
