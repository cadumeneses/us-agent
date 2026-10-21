# Banco de dados

O PostgreSQL é a fonte de dados da API. Dados operacionais usam tabelas relacionais; versões de taxonomias e configurações também preservam conteúdo JSONB e hashes para reprodução.

## Modelo

- `projects`, `stories` e `classification_runs`: origem e rastreabilidade.
- `classifications` e `classification_labels`: decisão final multi-label.
- `provider_votes`, `provider_vote_labels`, `provider_vote_evidence`, `provider_vote_issues` e `provider_vote_questions`: respostas dos modelos.
- `classification_attempts`: reruns e métricas de incerteza.
- `review_decisions` e `taxonomy_feedback`: human-in-the-loop.
- `recommender_taxonomy_versions`: catálogo compartilhado de taxonomias versionadas, incluindo a WIS de módulo → operação.
- `taxonomy_versions`, `taxonomy_modules` e `taxonomy_operations`: projeção de compatibilidade da WIS para classificação/histórico; os vínculos comuns ficam em `wis_taxonomy_bindings` e `wis_taxonomy_node_bindings` (migration 032).
- `app_users`, `execution_modes` e `application_settings`: contexto exibido pela WEB.

## Fluxo de mudanças

1. Adicione uma migration numerada em `database/migrations`.
2. Execute `npm run db:migrate`.
3. Nunca altere uma migration já aplicada; crie a próxima.

`schema_migrations` registra os arquivos aplicados. As migrations usam lock consultivo, rodam em transação e não são executadas automaticamente pela API ou durante o deploy.

## Migração dos JSONL

`npm run db:import` importa `runs/results.jsonl`. Para outro arquivo:

```powershell
npm.cmd run db:import -w @us-agent/api -- caminho\resultados.jsonl
```

A importação é idempotente para a combinação história/execução e serve apenas para retirar a dependência da base histórica em arquivos.
