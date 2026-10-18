# Entrega 005 — Publicação persistida de definições

Data: 17/10/2026. Escopo: B09 concluído no backend. Referências: [contrato de publicação](../publicacao-definicoes.md), [ADR 003](../decisoes/003-publicacao-definicao-e-base.md) e [pendências](../pendencias-e-proximos-passos.md).

## Resultado

O backend salva, publica, lista, consulta e retira definições versionadas. Cada publicação preserva atributos de entrada/saída, método e parâmetros, taxonomias exatas, versão da implementação e hash do pacote completo. Alterar conteúdo exige outra versão em rascunho. Vínculos publicados e pacotes são protegidos contra edição/exclusão.

Publicar valida o método RNF implementado e as dependências reais do banco, na mesma transação que grava vínculos e pacote. Dependência ausente, retirada ou com hash diferente impede toda a publicação. A consulta histórica permanece íntegra mesmo quando uma taxonomia é retirada depois. A autoria técnica e o acesso pela chave interna seguem a política já existente; controle por pessoa e organização continua em B13.

Foi resolvida uma ambiguidade da ADR inicial: B09 antecede a importação de bases em B10, e a base precisa ser selecionável por execução. A ADR 003 fixa esquema/método/taxonomias na definição e reserva a base publicada exata como dependência obrigatória da execução. Publicar uma definição não habilita uso implícito do histórico nem executa recomendações em produção.

## Verificação técnica

| Verificação | Resultado |
| --- | --- |
| Referência inicial | Antes da implementação, 57 testes e os checks configurável/taxonomias passaram novamente. |
| API após B09 | 60 testes passaram, incluindo três novos de integridade do pacote e independência da leitura histórica da versão instalada do adaptador. |
| Interface/build | Sete testes da interface e build completo API/web passaram. Não houve alteração da interface nesta entrega. |
| HTTP/PostgreSQL B09 | `check:recommender-definitions` passou em schema temporário local: operações de versão, imutabilidade, chave interna, publicação concorrente, corrida com retirada e rollback completo. |
| Compatibilidade RNF | Os oito resultados congelados permaneceram iguais na simulação com uma cópia da definição recuperada da publicação e suas taxonomias preservadas. |
| Regressão | Checks anteriores de taxonomias independentes, classificação/revisão, seleção WIS e recomendação RNF passaram com a migration nova. |
| Preservação do código | Os sete hashes de origem do manifesto RNF permaneceram iguais, incluindo o motor e o orquestrador Python. |
| Migration local | A migration 018 foi aplicada somente em `127.0.0.1`. Contagens e SHA-256 do conteúdo das 34 tabelas anteriores foram iguais antes/depois; foram acrescentadas duas tabelas. |

Os testes HTTP rejeitam k incompatível, método não implementado, vínculos ambíguos, hash errado, taxonomia/versão ausente e dependência retirada. Confirmam que rascunhos permanecem sem pacote/vínculos parciais. Uma restrição forçada na gravação final comprova que os vínculos já inseridos também são desfeitos. A corrida de retirada é sincronizada por locks e observação do bloqueio no PostgreSQL, sem depender de um atraso arbitrário para decidir o resultado.

Também foram verificadas definições sem taxonomias adicionais, paginação, criação de nova versão sem alteração da anterior e proteção dos vínculos publicados. A retirada preserva o hash do pacote. O formato do pacote inclui a identificação de implementação usada na publicação, mas a leitura histórica não tenta reexecutar o método.

Build/testes web exigiram execução fora do sandbox pela restrição conhecida do Vite. Não foram acessados produção ou provedores externos. Os checks usaram schemas descartáveis e a aplicação local da migration foi conferida separadamente por contagens/hashes.

## Revisão de fidelidade e continuidade

O motor RNF e as regras de Felipe não mudaram. As taxonomias de demonstração continuam sintéticas; a publicação não transforma exemplos reconstruídos em dados originais. O método de Ednaldo não foi habilitado por aproximação: método desconhecido é rejeitado e Q01–Q03 permanecem abertas. Não houve obtenção de novas fontes ou aprovação metodológica do professor nesta entrega.

B09 conclui a infraestrutura de publicação, sem concluir o fluxo configurável pela interface ou os três exemplos científicos. Não foram implementadas execução persistida com definição publicada, importação de bases ou avaliação empírica. Próximo incremento: B10 — bases rotuladas CSV/JSON com prévia, mapeamento, relatório e publicação versionada.
