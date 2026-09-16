# US-Agent: escopo atual

O US-Agent mantém a pesquisa de classificação de US e evolução da taxonomia e passa
a oferecer recomendação de requisitos não funcionais pelo método descrito por Felipe
Ramos (2019). Não há criação de novos recomendadores nesta etapa.

## Preservado

- Classificação multi-label, comitê, votos, incerteza e arbitragem.
- Revisão humana, histórico e rastreabilidade das classificações.
- Taxonomias, domínios, versões, identificação de lacunas e evolução supervisionada.
- Projetos, sprints, US, tarefas e requisitos associados.

## Implementado

- Perfil de projeto: plataforma, domínio de aplicação, objetivo, arquitetura e tecnologias.
- Tarefas com categoria e tecnologias; as tecnologias das tarefas complementam o perfil usado pelo motor.
- RNFs apresentados como tipo, atributo e sentença; valores legados permanecem preservados.
- Motor de RNFs com Manhattan, k=1, histórico, explicação do vizinho, aceitação e rejeição.
- Snapshots da execução e validação da classificação antes de aceitar o RNF.

Foram removidos a tela, os endpoints, os templates e os helpers Python de plano de
qualidade e geração de casos de teste. As migrations e tabelas antigas permanecem
como histórico, sem consumidores na aplicação.

O objetivo atual é RNF, conforme definido pelo usuário. O trabalho de Ednaldo sobre
casos de teste permanece apenas como referência bibliográfica fora deste escopo.

## Fidelidade e dados científicos

O algoritmo foi reimplementado a partir da tese local, incluindo o exemplo da tabela
5.7. Não foi comparado ao código original da NFRec, que não foi localizado. A base
original também não foi obtida; a aplicação usa o histórico cadastrado no banco.

[Contrato metodológico, adaptações e validação](motor-rnf.md).

A busca realizada em 16/09/2026 encontrou:

- [Tese no repositório da UFCG](https://dspace.sti.ufcg.edu.br/handle/riufcg/10743): PDF disponível, sem dataset listado. A seção 6.1.3 descreve dados de 13 projetos.
- [Artigo dos autores sobre a NFRec, SEKE 2019](https://ksiresearch.org/seke/seke19paper/seke19paper_107.pdf): descrição da ferramenta, sem pacote de código ou dados identificado.
- [Artigo dos autores, IEEE Access 2025](https://doi.org/10.1109/ACCESS.2025.3548631): a versão dos autores consultada não forneceu link identificado para download da base ou código.
- [Estudo de Pereira e colegas, SBES 2025](https://www.researchgate.net/publication/396393464_Evaluating_the_Capability_of_Prompted_LLMs_to_Recommend_NFR_from_User_Stories_A_Preliminary_Study): o resumo relata reutilização da base original de 246 US. Isso indica sua preservação, mas não confirma disponibilidade pública para download.

Para comparar a implementação, ainda precisamos do snapshot e dicionário da base,
versão do código, taxonomia de tarefas e regras de casos não especificados na tese.
Nenhuma base sintética foi importada como se fosse a original e nenhuma mensagem
foi enviada aos autores.
