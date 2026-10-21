# Migration 032 em produção — 21/10/2026

Executada a pedido explícito do usuário. Foi aplicada somente `032_unified_wis_taxonomy.sql`, usando o manifesto revisado, conexão direta, advisory lock e transação. Não foi realizado deploy de código nesta execução.

- Projeto Neon: `gentle-mountain-27383503`; produção: `br-wandering-mountain-avtit63t`; banco `neondb`, schema `public`.
- Ensaio em cópia atual de produção: `br-proud-glade-avxslzsi`, criada em 21/10/2026 antes da aplicação. Expira em 23/10/2026 às 23:59:59 UTC.
- Cópia de recuperação anterior à 032: `br-fragrant-meadow-avzkxos7`, sem compute, ponto `0/3579998`. Expira em 28/10/2026 às 23:59:59 UTC.
- A [verificação do ensaio](rehearsal.json) e a [verificação de produção](production.json) confirmam ausência de pendências, idempotência e preservação por contagem e digest do conteúdo das tabelas operacionais e das publicações anteriores. A migration histórica `016_sheet_source_links.sql`, fora do manifesto, foi preservada.
- A WIS `1.0.0` foi importada no catálogo comum como árvore publicada de dois níveis: quatro módulos e 19 operações. O hash foi conferido pelo serializador JavaScript da aplicação.
- O [código atual no ensaio](rehearsal-runtime.json) salvou/publicou uma versão sintética apenas na cópia, confirmou sua projeção para classificação, carregou as 196 histórias e preservou o hash da versão original. Nenhuma versão sintética foi criada em produção.
- Os [probes após a aplicação](http-checks.json) confirmaram 401 sem autenticação e 200 autenticado em saúde, contexto organizacional, projetos, histórias, dashboard, taxonomia operacional e catálogo comum. O catálogo retornou a WIS publicada com 23 nós.

As credenciais permanecem apenas em arquivos locais ignorados pelo Git. O novo código já presente no workspace não foi publicado por esta execução; os probes verificam o deploy que estava ativo. Não houve teste de login pelo navegador nem alteração de usuários/senhas.
