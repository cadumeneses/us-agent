# Migrations de produção — 21/10/2026

Executadas a pedido do usuário: 027–031, pelo executor transacional do release, com conexão direta e advisory lock.

- Produção: `gentle-mountain-27383503`, branch `production` (`br-wandering-mountain-avtit63t`), banco `neondb`, schema `public`.
- Ensaio: cópia atual de produção `br-aged-dream-avpxbcf7`, criada antes da aplicação, com expiração em `2026-10-22T23:59:59Z`. As cinco migrations passaram. A conferência inicial de contagens precisava considerar a inclusão intencional do rascunho WIS pela 029; o verificador foi corrigido. `rehearsal.json` registra a verificação final e a repetição idempotente, portanto sua lista `applied` está vazia.
- `production.json` registra as cinco migrations aplicadas, nenhuma pendente, contagens anteriores e posteriores, validação do rascunho WIS (24 nós) e cinco usuários ativos com acesso administrativo à organização `default`. As contagens das tabelas preexistentes ficaram iguais, exceto pela inclusão prevista do rascunho em `recommender_taxonomy_versions`.
- `016_sheet_source_links.sql`, já registrada fora do manifesto, foi preservada.
- O código compatível já estava publicado: antes da aplicação, a API autenticada retornava 503 solicitando a migration 031. Após a aplicação, saúde, contexto organizacional, projetos e catálogo de taxonomias responderam 200; saúde confirmou banco conectado. Sem autenticação, saúde respondeu 401. Evidências em `http-checks.json`.
- Hashes do release e cinco testes do executor aprovados. Não foi realizado novo deploy nem login pelo navegador nesta execução.
