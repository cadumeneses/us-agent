# 038 — Perfil configurável e recomendação de riscos

Em 19/10/2026, B20/B21 acrescentam o terceiro exemplo técnico: **perfil de projeto → riscos**, sem história ou classificação. O aceite RF02/RF07 é exercitado com um atributo adicional que altera formulário, validação, representação, distância e explicação sem campo correspondente no motor.

## Mudanças

- Método de projeto orientado a atributos com papéis `feature`, `context` e `output`, usando o núcleo KNN existente. Quantidade de vizinhos e pesos são configuráveis; opções não implementadas são recusadas na publicação.
- Extensão da publicação e execução compartilhadas, sem modificar as políticas e fontes científicas congeladas. Definição/base/importação/taxonomias/histórico permanecem nos contratos existentes; resultados de esquema 3 preservam entrada, representação, itens, vizinhos e política.
- Perfil adicional persistido por projeto/configuração, preenchimento inicial por fontes compatíveis e revisão otimista. Nenhuma identidade de história/classificação é inventada.
- Aba **Recommenders** com **Project risks**, seleção de projeto/configuração/base, campos gerados, resultado, contribuições, exportação e replay. A execução manual também aceita o novo método.
- Editor com template de riscos, download de base sintética, atributos ordenáveis, pesos e `k`. Novos templates de RNF/testes têm nomes e títulos em inglês; publicações anteriores permanecem intactas.
- Textos de ajuda, exemplos de requisitos/tarefas e avisos de demonstração foram revisados para remover citações pessoais e códigos de acompanhamento sem utilidade no fluxo. Atribuição científica permanece na documentação e na evidência histórica, sem reescrever dados de usuário ou identidades de sessão.

O [contrato e roteiro](../recomendador-projeto-configuravel.md) detalha os tipos, limites, fórmulas e decisões locais.

## Conferência

Branch temporária `br-jolly-tree-avvhg4tp`, derivada da branch de produção: migrations 027/028 aplicadas preservando as contagens das 51 tabelas existentes. Os dados sintéticos e as execuções da revisão pertencem somente a essa branch. Após preservar as evidências, a branch foi removida e a prévia local encerrada. Produção e deployment não foram alterados.

Publicação de configuração/base, perfil sem histórias e execução conferidos contra a API local. O navegador percorreu criação de configuração com atributo adicional, importação pela área compartilhada e recomendação de riscos no projeto. A referência inicial tem três perfis sintéticos; outra referência criada pela interface usa dois.

O atributo configurado `team_distribution`, com peso 5, muda o primeiro vizinho entre `reference-a` e `reference-b` ao mudar apenas sua categoria, mantendo configuração, base e `k=1`. Não há esse ID nos módulos do motor. A referência inicial sem esse atributo usa `k=2`; ela serve para conferir a parametrização e os dois vizinhos, não para atribuir exclusivamente ao atributo uma mudança que também envolve `k`.

Requisições repetidas preservam o hash; reutilização do ID com outra entrada e revisão de perfil desatualizada recebem 409. Atributo obrigatório ausente e hash de publicação divergente recebem 422. Replay dos três registros de engenharia confirmou resultado, explicação e representação.

Build, suítes existentes de 154 testes da API e 65 da interface e verificação dos hashes científicos no index. Nenhum caso ou arquivo de teste novo. Foram alinhadas somente expectativas existentes de texto, rótulo e identificação dos templates à interface revisada; os cenários e suas verificações funcionais permanecem.

Artefatos em [project-risks-2026-10-19](../evidencias/project-risks-2026-10-19/review.json), com registros de execução e capturas da interface. São evidências técnicas, sem participantes, métricas de acurácia ou estudo de esforço humano.

## Estado do plano

B20/B21 atendidos no recorte técnico demonstrativo local. RF02/RF07 agora têm prova de atributo adicional efetivamente usado no cálculo; RF08 tem exemplo sem dependência artificial de história. Isso não declara todos os tipos/representações/filtros implementados nem a plataforma inteira concluída.

Continuam B22/B23 (consolidação, tutorial e avaliação integrada), avaliação empírica/coleta humana, extensões de adaptação e o restante de autoria/papéis/organizações. Reprodução empírica da referência não é condição desse terceiro exemplo.

Para disponibilizar: aplicar migrations 027/028 antes do deploy e publicar uma configuração/base apropriada no ambiente. Os exemplos sintéticos não são incluídos automaticamente no banco de produção.
