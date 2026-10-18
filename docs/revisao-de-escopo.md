# Revisão de escopo e prioridade

Data: 17/10/2026. Motivação: pedido do usuário para verificar se o desenvolvimento estava se afastando do escopo. Conferidos o documento de requisitos recebido, o plano, o workflow, a matriz de fidelidade e as entregas registradas.

A situação posterior, após B14a/B15a, está na [conferência de aderência de 18/10/2026](aderencia-demandas-professor.md). As prioridades e a distinção entre demandas relatadas e requisitos derivados abaixo permanecem preservadas.

## Conclusão

A evolução até B12 segue o objetivo de tornar o RNF uma configuração de uma plataforma de recomendadores. B13a corrigiu uma exposição concreta e dependências sinalizadas. Porém, continuar imediatamente para um sistema completo de contas, sessões, papéis e organizações faria a infraestrutura consumir a prioridade dos próximos incrementos científicos. Esse risco foi identificado antes de implementar B13b: nesta revisão não foram criadas tabelas, contas, sessões ou fluxos de login.

RQ04 é um requisito **proposto/derivado** do documento recebido; não é tratado como pedido expresso nos áudios nem como decisão aprovada pelo professor. O texto exige fechar autenticação/permissões antes de receber bases empresariais. O workflow já condiciona B14 à B13 **se houver dados restritos**. Assim, o piloto local com dados sintéticos pode avançar preservando a proteção entregue e registrando seus limites.

## Aderência aos pedidos centrais

| Pedido relatado | Situação comprovada | Lacuna prioritária |
| --- | --- | --- |
| Configurar recomendadores, atributos, taxonomias e escolher a base — A2/A3/A4, RF01–RF07 | Publicação, importação, formulários, execução e revisão RNF disponíveis. Referências, hashes e método preservados. | Demonstrar outra política e outro tipo de saída usando o mesmo núcleo. A implementação atual ainda não conclui a generalidade entre métodos. |
| Avaliar e explicar a qualidade — A2/A5, RF13 | Testes de referência, proveniência, explicação e replay disponíveis. | Protocolo, executor de avaliação e resultados por alvo; dados de relevância e experimentos científicos continuam pendentes. Testes do software não substituem esses resultados. |
| Recomendar casos de teste de Ednaldo — A3/A5, RF14 | Tese consultada e diferenças metodológicas registradas. | Confirmar fontes/dados e questões Q01–Q03; implementar o segundo vertical sem herdar filtros RNF indevidamente. |
| Recomendar sem US no caso de Ademar — A4/A5, RF08/RF14 | Contratos admitem entrada independente; referência candidata registrada. | Confirmar artigo/dados e implementar um exemplo completo sem US artificial. |
| Evidências para dissertação/artigo — A5 | Arquitetura, entregas, capturas e limites documentados. | Consolidar três exemplos e avaliação reproduzível, sem alegações além dos dados obtidos. |

## Ordem corrigida

1. **B14:** protocolo e avaliação RNF com dados locais sintéticos ou públicos cuja autorização tenha sido verificada, sem receber bases restritas. Preservar saídas por alvo, falhas/vazios, versões, exportação e medições técnicas. Não chamar esse piloto sintético de reprodução empírica de Felipe nem usar automação para alegar tempo/esforço de participantes.
2. **B02 em acompanhamento e B15–B18:** conferir artigos/dados de Felipe e Ednaldo; fechar explicitamente as decisões científicas necessárias ao segundo vertical e implementá-lo progressivamente.
3. **B19–B21:** confirmar o caso de Ademar e demonstrar recomendação independente de US.
4. **B22–B23:** consolidar avaliação, comparações, tutorial e evidências acadêmicas.

B13b/B13c permanecem no backlog, obrigatórios **antes de bases empresariais/restritas ou da abertura para uso multiusuário protegido**. Sua prioridade será antecipada se esse cenário passar a fazer parte do trabalho. A interface em ambiente protegido continua dependendo de autenticação pessoal; não distribuir a chave de integração ao navegador e não reabrir o perímetro para contornar essa limitação.

## Controle para os próximos incrementos

Cada implementação deve identificar o pedido/RF que atende e a demonstração que produz. Infraestrutura adicional deve resolver uma necessidade observada do próximo vertical ou do ambiente de uso definido. Expansões de método exigem fonte, adaptação identificada e verificação da referência RNF. Login completo, administração de organizações, algoritmos adicionais e automações não devem bloquear os ensaios locais permitidos e os exemplos científicos.

Esta é uma correção de prioridade técnica motivada pelo pedido do usuário. Não constitui nova aprovação do professor, não encerra RQ04 e não altera o método científico já implementado.
