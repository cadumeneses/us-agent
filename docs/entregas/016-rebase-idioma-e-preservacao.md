# Entrega 016 — Rebase, idioma e preservação das adições

Data: 18/10/2026. Escopo solicitado pelo usuário: integrar a `dev`, preservar suas alterações de idioma/fluxo, preparar as adições no stage e continuar mantendo a qualidade.

## Integração

O fetch confirmou `origin/dev` em `18d3cc1`, já ancestral da branch `development`. O commit novo com as mudanças de idioma e fluxos estava em `origin/development`: `ab06cbcdf7c54a8e478f05eeaaf224d437f27cc0`. O rebase sobre `origin/dev` não exigiu reaplicação de commits; o rebase sobre `origin/development` avançou a branch de `9ddbcb3` para esse commit, sem reescrever commits remotos.

Antes da operação foram preservados os 209 arquivos locais em backup ignorado dentro de `tmp/`, com inventário de hashes e cópia dos diffs. Um stash com arquivos não rastreados também foi criado e mantido. Após a atualização, os conflitos foram resolvidos combinando os fluxos remotos com as entregas anteriores; nenhum arquivo local do inventário ficou ausente. O teste de IA que passou a existir no remoto foi combinado com a suíte local, preservando ambos os conjuntos de verificações.

Foram mantidos: inglês na navegação e nos fluxos novos, entrada inicial por projetos, dashboard em `/dashboard`, criação de projetos sem histórias, manutenção de tarefas, visualização de RNFs vinculados e atualização do contexto após aceitação. As rotas de configuração/base publicada, múltiplos rótulos, métricas reais, proveniência e revisão detalhada continuam presentes. A proteção central da API cobre também os endpoints de projetos.

O helper de requisição aos provedores mantém o comportamento trazido pelo remoto: sem override de temperatura no OpenAI e com valor zero nos provedores compatíveis configurados. O prompt continua exigindo todos os pares, JSON e rótulos exatos da taxonomia; a mudança de idioma recebe a versão explícita `web_wis_multilabel_v3_en`. Não foram consultados provedores externos nem alteradas execuções antigas.

## Continuidade e fidelidade

Os controles e textos das adições configuráveis foram ajustados ao inglês usado no remoto. Dados importados, nomes definidos na configuração, sentenças e evidências históricas preservam seu conteúdo original. Mensagens conhecidas do motor científico recebem tradução apenas na apresentação, pelo helper `scientific-messages.ts`; os resultados e hashes armazenados continuam originais. Isso não é um sistema geral de tradução de mensagens arbitrárias da API ou dos dados dos usuários.

A restauração pelo stash normalizou finais de linha em arquivos inventariados, inicialmente causando divergência nos hashes dos pacotes. Os bytes originais foram recuperados do backup. O novo `.gitattributes` desativa a conversão de finais de linha nos artefatos e fontes com hashes registrados, permitindo guardá-los no índice e recuperá-los sem invalidar a evidência científica. Não houve atualização dos snapshots para aceitar resultados divergentes.

`npm.cmd run check:scientific-index` verifica, em modo somente leitura, os blobs efetivamente preparados para commit: 37 fontes dos inventários RNF/E21 e três artefatos B14a, além das regras de finais de linha presentes no índice. Assim a conferência cobre o stage, além dos arquivos da pasta de trabalho.

## Verificações

| Verificação | Resultado |
| --- | --- |
| API | 101 testes passaram, incluindo os testes remotos de temperatura e os testes locais de múltiplos rótulos/proveniência. |
| Interface | 45 testes passaram; seletores e expectativas foram atualizados ao idioma, preservando checks de comportamento, persistência e integridade. |
| Builds | API e interface compilaram. O Vite exigiu a execução autorizada fora do sandbox. |
| Classificação HTTP/PostgreSQL | Comitê simulado, múltiplos rótulos, métricas, modelos, revisão, rollback e compatibilidade passaram. |
| Recomendações HTTP/PostgreSQL | Oito comparações RNF, base explícita, dependências, concorrência, decisões, rollback e replay passaram. |
| Catálogos HTTP/PostgreSQL | Publicação, origem, versões, referência exata, concorrência, rollback, retirada e histórico passaram. |
| Replay científico | B14a manteve `d26d28d5ee2da92f6449fe8fb18ed2bfdfd55192bb3a96fdb0a3e8b58a89a3dd`; B16a manteve `76e1f0b0e8ef3febbf4851800825743a0f5f00ec31383fe845f8f9e6a6a07f5e`. Sete arquivos RNF congelados mantiveram os bytes originais. |
| Navegador | Edge headless percorreu configuração → importação → execução → destino → aceitar/rejeitar → histórico → replay; verificou também redirecionamento para projetos, criação de projeto vazio, idioma do documento e apresentação científica em inglês. |
| Visual | Capturas desktop/mobile inspecionadas, sem transbordamento horizontal ou controles visíveis sem rótulo no percurso verificado. [Resumo](../evidencias/rebase-dev/summary.json), [desktop](../evidencias/rebase-dev/desktop.png), [mobile](../evidencias/rebase-dev/mobile.png), [RNF em inglês](../evidencias/rebase-dev/legacy-nfr-english.png). |

Os ensaios usaram schemas locais descartáveis e dados sintéticos. Nenhuma migration adicional foi necessária nesta integração, e nenhum dado de produção foi acessado. O stage reúne código, testes, configurações, migrations, documentação e evidências necessárias; PDFs locais e backups temporários ficam fora dele. Não foram feitos commit ou push.

## Próxima frente preservada

Esta integração não conclui B15/B16 nem a reprodução científica de Ednaldo. Continua prioritário ligar catálogo, importação da base e execução comum do segundo recomendador com regras/identidade explícitas, seguido da interface. Q01/Q02, dados autorizados, avaliação empírica RNF e o terceiro caso sem US permanecem na [lista de pendências](../pendencias-e-proximos-passos.md). A integração de idioma não amplia o escopo metodológico nem equivale a aprovação do professor.
