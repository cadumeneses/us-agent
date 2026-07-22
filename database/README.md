# Banco de dados

O PostgreSQL é a fonte de dados da API. O schema é relacional e não depende de colunas JSON para os dados operacionais.

## Modelo

- `projects`, `stories` e `classification_runs`: origem e rastreabilidade.
- `classifications` e `classification_labels`: decisão final multi-label.
- `provider_votes`, `provider_vote_labels`, `provider_vote_evidence`, `provider_vote_issues` e `provider_vote_questions`: respostas dos modelos.
- `classification_attempts`: reruns e métricas de incerteza.
- `review_decisions` e `taxonomy_feedback`: human-in-the-loop.
- `taxonomy_versions`, `taxonomy_modules` e `taxonomy_operations`: taxonomia versionada.
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
