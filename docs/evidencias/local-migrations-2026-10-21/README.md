# Correção do banco de desenvolvimento

21/10/2026. A API local apresentava erro PostgreSQL `42P01`, pois a tabela `classification_provenance` não existia. A aplicação usava `localhost:5432/us_agent`, schema `public`, que tinha apenas as migrations 001–004.

Foi aplicado o manifesto revisado de 33 migrations com `applyMigrationRelease`, incluindo a 016 que cria a tabela ausente e a 032 que integra a WIS ao catálogo comum. Nenhum arquivo fora do manifesto foi aplicado. Nenhuma alteração foi feita em produção.

O [registro da atualização](result.json) confirma que não restam migrations pendentes e que foram preservados os totais anteriores: dois projetos, 24 histórias, 24 classificações, três módulos e 18 operações.

As cinco [consultas à API em execução](api-checks.json) retornaram HTTP 200: saúde, histórias, dashboard, taxonomia operacional e catálogo comum de taxonomias.
