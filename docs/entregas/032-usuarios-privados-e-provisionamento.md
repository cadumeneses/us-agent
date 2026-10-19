# Entrega 032 — usuários privados e provisionamento

Continuação: a [entrega 033](033-correcao-login-producao.md) aplica o release e o provisionamento em produção e confirma os cinco logins. O texto abaixo preserva o estado da preparação anterior à implantação.

19/10/2026. Continuidade da preparação de deploy 031. O usuário solicitou cinco logins: `mirko`, `danyllo`, `emanuel`, `carlos` e `ademar`, com a senha inicial informada na conversa. A senha não é registrada neste documento, no código, em fixtures ou em migrations.

## Implementação

A migration aditiva 026 cria `web_users` e vincula sessões ao usuário. A interface solicita usuário/senha e exibe o login autenticado. As credenciais são verificadas no servidor com scrypt e salt independente por conta; a sessão usa token aleatório persistido somente por hash. Alteração de senha ou desativação invalida as sessões da conta. Sessões antigas sem usuário são recusadas. O segredo compartilhado de ambiente `WEB_ACCESS_PASSWORD_HASH` deixa de ser necessário.

`config/deployment/web-users.json` versiona somente os nomes. `auth:prepare-users` recebe a senha sem eco e gera arquivo local ignorado contendo exclusivamente hashes. O arquivo desta preparação foi criado em `tmp/production-web-users.json`; não foi adicionado ao stage. O provisionador valida a lista exata, oferece dry-run somente leitura e exige destino confirmado para aplicar. Inserts são transacionais e idempotentes; senhas/estado de usuários existentes não são sobrescritos. Não há seed automático em migration, build ou runtime.

O release passa a conter 27 migrations, até 026. Os logins acessam o mesmo espaço privado; papéis, isolamento organizacional e autoria de registros de domínio permanecem fora desta entrega. Não houve conexão, provisionamento ou migração em produção. O [roteiro](../deploy-vercel.md) contém os comandos para aplicação posterior com a conexão direta correta.

## Verificações

- API: 154 testes e build passaram; interface: 65 testes e build passaram.
- Runner: cinco testes passaram; o check PostgreSQL aplicou as 27 migrations em schema local descartável e verificou os cinco logins, identidade da sessão, salts distintos, dry-run sem escrita, reexecução sem alterar senhas existentes, expiração, desativação e troca de senha, além das proteções de sessão anteriores.
- O arquivo real preparado foi validado contra os cinco nomes revisados, com cinco hashes distintos; somente nomes/contagem foram exibidos. O Git confirma que o arquivo está ignorado.
- O stage contém código, migrations, nomes e documentação. Nenhuma senha ou arquivo de credenciais foi incluído. Não houve commit ou push.
