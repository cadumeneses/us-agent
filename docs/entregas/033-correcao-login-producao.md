# Entrega 033 — correção do login em produção

19/10/2026. Pedido: corrigir o erro de acesso privado exibido no US-Agent. A prioridade foi confirmada pelo usuário; a rota de dashboard de outro serviço não foi alterada.

## Causa e correção

A rota pública `/api/auth/session`, sem cookie, respondia 503 antes de consultar o banco. `WEB_APP_ORIGIN`, `API_ALLOWED_ORIGINS` e `API_ACCESS_MODE` estavam ausentes em Production. Foram configuradas a origem exata `https://us-agent-api.vercel.app` e a política `protected`.

O banco de produção também estava sem as 11 migrations de `016_classification_provenance.sql` até `026_private_web_users.sql`. Após autenticação da Neon pelo usuário, foi criada a branch temporária `login-fix-20261019`, a partir da branch `production` do projeto `us-agent`. As migrations e o provisionamento foram testados primeiro nessa cópia, incluindo acesso HTTP da aplicação local apontada para a branch. As contagens das 34 tabelas existentes permaneceram iguais.

O mesmo release foi aplicado em produção, com destino direto explicitamente conferido. Foram criados `mirko`, `danyllo`, `emanuel`, `carlos` e `ademar`, usando os hashes individuais já preparados. A reexecução do provisionamento preservou as credenciais. As contagens das 34 tabelas anteriores também permaneceram iguais em produção; isso não é uma comparação byte a byte de todo o conteúdo. O registro preexistente `016_sheet_source_links.sql`, fora do release, foi preservado.

A verificação após o primeiro redeploy identificou ainda que `INGEST_API_KEY`, embora cadastrada, não tinha valor efetivo no runtime. Foi configurada uma chave aleatória de 256 bits como Secret e feito outro redeploy. A variável existente tinha escopo conjunto Preview/Production: a atualização da chave alcançou ambos; somente Production foi republicado e verificado. Integrações técnicas devem usar a credencial atual. O valor está somente no ambiente Vercel e em arquivo local ignorado, sem inclusão nas evidências ou no stage.

## Resultado verificado

- Deploy final: `https://us-agent-gyy1t7wxh-cadumeneses-projects.vercel.app`, publicado no alias `https://us-agent-api.vercel.app`.
- Os cinco usuários tiveram login HTTP 200, identidade de sessão correta, contexto e recomendadores HTTP 200 e revogação confirmada ao sair.
- Sessão anônima: HTTP 200, `authenticated: false`; API sem credencial: HTTP 401; health com credencial técnica: HTTP 200, PostgreSQL conectado.
- Nenhuma migration do release permaneceu pendente. A branch temporária `br-falling-sky-avdylb5a` foi removida após o teste e a verificação de produção.
- As sessões criadas pela verificação foram encerradas. Não foram exportados tokens, hashes de senha, credenciais de banco ou conteúdo de projetos.

As evidências sanitizadas estão em [production-login-2026-10-19](../evidencias/production-login-2026-10-19/manifest.json): migrations/contagens e login na branch e em produção, além de conectividade. O manifesto identifica os hashes dos relatórios. Os resultados de login foram obtidos por HTTP, sem alegação de inspeção visual do navegador.

Não foi necessário alterar o código da aplicação: a correção foi de configuração e aplicação do release já publicado. Os redeploys reutilizaram o código existente na Vercel, sem enviar os arquivos locais não relacionados. As credenciais de produção, o arquivo de hashes dos usuários e os helpers operacionais ficaram fora do stage. Não houve commit ou push.
