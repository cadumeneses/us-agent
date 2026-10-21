# Atualização da Vercel e migrations

## Procedimento atual

O pacote atual inclui a migration 032 e a WIS no mesmo catálogo das demais taxonomias. Usar o [roteiro 043](entregas/043-wis-unificada-e-ui-ux.md) para preflight, ensaio em cópia atual de produção, janela de manutenção, migration e deploy coordenados. O manifesto tem 33 arquivos. A 032 está aplicada no desenvolvimento local; ainda não foi aplicada em produção.

## Histórico dos procedimentos anteriores

As seções abaixo preservam instruções e estados anteriores. Contagens e ordens de implantação antigas não substituem o roteiro 043.

**Atualização da WIS — 21/10/2026:** o release atual tem **33 arquivos, até 032**. A WIS passa ao catálogo comum de taxonomias com dois níveis (módulo → operação). Seguir o [guia vigente](migracao-catalogo-wis.md): ensaio em cópia atual de produção, aplicação da 032 e publicação coordenada do código. A 032 foi ensaiada localmente; não foi aplicada em produção nesta revisão. As instruções 042 abaixo são o registro do conjunto anterior.

**Ordem vigente 042:** o release agora contém **32 arquivos**, até 031 (adaptação RNF e organizações/auditoria). Para instalar este conjunto completo, usar o [roteiro 042](entregas/042-fechamento-tecnico-e-preparacao-empirica.md): ensaio numa cópia/branch atual de produção, janela de manutenção, aplicar 029–031 e publicar o código compatível antes de reabrir o tráfego. O novo runtime exige 030/031; a ordem 041 de publicar o código com somente 028 deixa de ser suficiente para este conjunto. Produção não foi alterada nesta entrega.

Atualização 041: release com **30 arquivos**, incluindo a preparação do catálogo WIS em 029. Seguir o [roteiro de migração do catálogo](migracao-catalogo-wis.md): aplicar até **028** com `--through`, publicar o código compatível com `selectable` e somente depois aplicar **029** e verificar os rascunhos. Esta preparação não foi aplicada em produção.

Pré-condição para o código das entregas 037/038: aplicar **027 e 028 antes do deploy**. Isso acrescenta histórias preparadas e perfis/execuções configuráveis de projeto; não publica automaticamente definições ou bases demonstrativas. A consolidação 039 não consulta nem altera produção. O estado de produção descrito abaixo é a última verificação registrada em 033, não uma nova consulta ao ambiente.

Estado em 19/10/2026 após a [entrega 033](entregas/033-correcao-login-producao.md): variáveis corrigidas, migrations até 026 aplicadas e cinco usuários provisionados em produção. Login, acesso e saída dos cinco usuários foram verificados no endereço público. O roteiro abaixo permanece como procedimento para próximas atualizações; as etapas iniciais não devem ser repetidas para redefinir contas ou credenciais já configuradas.

## Diagnóstico do deploy atual

Em 19/10/2026, `https://us-agent-api.vercel.app/api/health` respondeu HTTP 503 sem credencial. A mensagem da captura corresponde ao bloqueio da API quando `INGEST_API_KEY` não está configurada em produção. Esse bloqueio ocorre antes de consultar o banco: a captura não demonstra erro de migration.

Configurar somente a chave interna não habilitava a interface anterior, pois o navegador não tinha sessão. Esta atualização acrescenta acesso por usuário e senha, conforme solicitado, com cookie HttpOnly/Secure/SameSite=Strict e sessões persistidas em PostgreSQL. As senhas são independentes de `INGEST_API_KEY`. Os usuários `mirko`, `danyllo`, `emanuel`, `carlos` e `ademar` acessam o mesmo espaço privado; não há papéis ou isolamento por organização.

## Variáveis do ambiente Production

| Variável | Configuração |
| --- | --- |
| `DATABASE_URL` | URL PostgreSQL da aplicação, com pool e TLS conforme o provedor. |
| `MIGRATION_DATABASE_URL` | URL direta do mesmo banco, sem pooler, para o executor externo de migrations. Também aceita `DATABASE_URL_UNPOOLED` ou `POSTGRES_URL_NON_POOLING`. |
| `INGEST_API_KEY` | Segredo aleatório com pelo menos 32 caracteres, exclusivo das integrações no servidor. |
| `API_ACCESS_MODE` | `protected`. |
| `WEB_APP_ORIGIN` | `https://us-agent-api.vercel.app`, sem barra final, ou o domínio definitivo da interface. |
| `API_ALLOWED_ORIGINS` | Incluir exatamente o mesmo endereço HTTPS. |

Os hashes individuais ficam na tabela `web_users`, criada pela migration 026; `WEB_ACCESS_PASSWORD_HASH` não é mais necessária. A lista revisada de logins fica em `config/deployment/web-users.json`, sem credenciais. Para gerar um novo arquivo de provisionamento, digitar a senha inicial sem eco:

```powershell
npm.cmd run auth:prepare-users -- --output tmp/production-web-users.json
```

O arquivo `tmp/production-web-users.json` desta preparação já foi gerado com a senha informada pelo usuário; não é necessário regenerá-lo. Ele contém somente hashes scrypt com salt aleatório independente por conta, não a senha em texto puro. É local e ignorado pelo Git, e o gerador recusa sobrescrita. Não adicionar esse arquivo, hashes ou senhas em `VITE_*`, código React, commits ou capturas. Uma nova geração aceita senhas de 8–1024 caracteres. Cada ambiente de preview deve usar sua própria origem e banco/branch separado. Variáveis novas só passam a valer após um novo deploy.

## Conferir e aplicar fora da Function

Os comandos são executados na raiz do repositório. As migrations não rodam no build, em um endpoint HTTP ou na inicialização da Function. Usar conexão direta para manter o lock de sessão PostgreSQL, conforme a [documentação de pooling do Neon](https://neon.com/docs/connect/connection-pooling).

1. Vincular a CLI ao projeto existente e exportar as variáveis Production para um arquivo local ignorado pelo Git, sem substituir `.env` de desenvolvimento:

```powershell
npx vercel link --project us-agent-api
npx vercel env pull .env.vercel.production --environment=production
```

Se a URL direta não estiver disponível na exportação, adicioná-la somente a esse arquivo local a partir da configuração do banco. Não inferir ou trocar o destino a partir da URL com pool. Os comandos de ambiente seguem a [documentação da Vercel CLI](https://vercel.com/docs/cli/env).

2. Conferir configuração e release de SQL:

```powershell
node --env-file=.env.vercel.production scripts/check-vercel-config.mjs
npm.cmd run db:release:check
node --env-file=.env.vercel.production scripts/migrate-deployment.mjs --status
```

`--status` usa transação somente leitura e não cria sequer `schema_migrations`. Mostra destino sem usuário/senha, migrations pendentes e nomes já aplicados fora do release. O release atual contém 30 arquivos, de 001 até 029, incluindo os dois arquivos 005 históricos. A migration local não versionada `016_sheet_source_links.sql` fica fora. Novas migrations exigem revisão e atualização explícita de `database/migrations.release.json`; `npm.cmd run db:release` usa somente SQL já rastreado pelo Git. Antes de aplicar 029, seguir a ordem especial descrita acima.

3. Primeiro testar em branch/cópia do banco de produção, usando arquivo de ambiente separado e conferindo o destino. Para aplicar, copiar exatamente `target` exibido pelo status:

```powershell
node --env-file=.env.vercel.production scripts/migrate-deployment.mjs --apply --expect-target "HOST_DIRETO:5432/NOME_DO_BANCO"
node --env-file=.env.vercel.production scripts/migrate-deployment.mjs --status
```

O runner verifica hashes UTF-8 com quebras normalizadas explicitamente para LF, recusa poolers, adquire o mesmo advisory lock do runner anterior e aplica cada arquivo pendente em transação. Uma falha faz rollback do arquivo atual; arquivos anteriores já confirmados permanecem aplicados. Não renomeia nem reaplica migrations registradas. O registro histórico guarda nomes, portanto os hashes conferem os arquivos deste release, sem comprovar retrospectivamente o SQL aplicado no passado.

4. Depois da migration 026, conferir e provisionar os cinco usuários no mesmo destino:

```powershell
node --env-file=.env.vercel.production scripts/provision-web-users.mjs --dry-run --input tmp/production-web-users.json
node --env-file=.env.vercel.production scripts/provision-web-users.mjs --apply --input tmp/production-web-users.json --expect-target "HOST_DIRETO:5432/NOME_DO_BANCO"
```

O dry-run é somente leitura. A aplicação ocorre em uma transação com lock; nomes existentes aparecem como `existing_unchanged`, sem alterar senha ou reativar usuário. Assim, repetir o provisionamento não desfaz alterações posteriores de credenciais. Não há seed automático no build, no runtime ou em SQL de migration. O script não imprime senha nem hashes.

5. Depois de aplicar e conferir, publicar a atualização e verificar o endpoint:

```powershell
npx vercel --prod
node --env-file=.env.vercel.production scripts/check-vercel-config.mjs --url https://us-agent-api.vercel.app
```

O probe exige 401 sem credencial e 200 com banco conectado usando a credencial técnica. Ele não imprime credenciais nem dados de negócio. A verificação humana final é abrir a interface, entrar com um dos usuários e sua senha, conferir o login exibido, carregar um projeto e usar **Sair**. Depois de sair, recarregar deve voltar à entrada. A aplicação e a verificação HTTP em produção foram concluídas posteriormente na entrega 033; isso não registra uma inspeção visual ou avaliação com participantes.

## Migrations 025/026 e sessão

`025_private_web_sessions.sql` cria `web_sessions`, seu índice de expiração e `web_login_limits`. `026_private_web_users.sql` acrescenta `web_users` e a referência ao usuário nas sessões, sem conter senhas ou hashes iniciais. O banco guarda SHA-256 do token aleatório de sessão e fingerprint do hash de senha do usuário, sem senha ou token utilizável. A sessão dura oito horas; sair revoga o token no banco. Alterar o hash de senha ou desativar o usuário invalida suas sessões; as de outros usuários continuam independentes. Sessões anteriores sem usuário passam a ser recusadas. O bucket de dez tentativas por minuto é compartilhado pelo espaço entre instâncias; pode limitar também tentativas legítimas quando estiver esgotado.

Pedidos com cookie exigem o Host configurado, origem exata nas operações de escrita e ausência de indicação cross-site. Em produção o cookie usa prefixo `__Host-`, `Secure`, `HttpOnly`, `SameSite=Strict` e caminho `/`. Bearer inválido continua inválido mesmo quando acompanhado de sessão. Requisições de integração continuam usando a chave técnica. Os logins identificam as sessões; a autoria dos registros de domínio, papéis e isolamento organizacional ainda não foram migrados.

## Verificações locais

```powershell
npm.cmd run build
npm.cmd test
npm.cmd run check:deployment-migrations
# Requer PostgreSQL local iniciado. Cria/remove somente um schema aleatório próprio.
npm.cmd run check:private-web-access
```

O check de acesso percorre migrations do release em schema vazio, idempotência, login, leitura protegida, hashes de sessão, recusa de CSRF/Bearer incorreto, saída, expiração, troca de senha, limite de tentativas e flags de produção. Não altera registros operacionais nem acessa o banco de produção.
