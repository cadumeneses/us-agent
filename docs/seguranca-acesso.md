# Proteção de acesso — B13a

Atualização de deploy em 19/10/2026: o [acesso por usuário e senha](deploy-vercel.md) acrescenta sessão persistida no servidor e cookie HttpOnly/Secure para a interface. As senhas são independentes da chave técnica; requer migrations 025/026, provisionamento de usuários e `WEB_APP_ORIGIN`. Os logins identificam as sessões no mesmo espaço privado, sem papéis ou isolamento de organizações. A autoria histórica dos registros de domínio não foi migrada. As regras históricas B13a abaixo continuam aplicáveis às integrações Bearer; as rotas operacionais também aceitam uma sessão válida com verificação de origem. O endpoint `/api/auth/session` permite consulta de estado, entrada e saída sob suas próprias verificações de origem, limite de corpo e tentativas.

Implementação em 17/10/2026. B13a protege o perímetro HTTP e corrige as dependências identificadas. **B13 continua em andamento:** esta credencial técnica não identifica pessoas, não concede papéis e não separa organizações. A autoria anterior dos registros permanece intacta.

## Política efetiva

A mesma verificação cobre **todo `/api`**, inclusive contexto, histórias, taxonomia, revisão, RNF legado, importação, ingestão, publicações, histórico, replay e health. Ela executa antes dos parsers JSON/multipart e dos handlers. Não há exceção pública de leitura ou de health que consulte o banco.

| Condição | Resultado |
| --- | --- |
| `INGEST_API_KEY` configurada | Exige `Authorization: Bearer <credencial>` em toda requisição funcional, inclusive local. |
| Chave ausente, acesso local de desenvolvimento válido | Acesso técnico local, com as mesmas limitações anteriores de autoria e ausência de isolamento. |
| Chave ausente fora desse cenário | HTTP 503; não executa o endpoint. |
| Chave presente, credencial ausente/incorreta ou esquema diferente de Bearer | HTTP 401; não executa o endpoint. |
| Origem inválida/não permitida | HTTP 403; não executa o endpoint. |
| `API_ACCESS_MODE` diferente de vazio, `local` ou `protected` | HTTP 503. |

O acesso local sem chave exige simultaneamente:

- `NODE_ENV` vazio, `development` ou `test`, sem `VERCEL`;
- `API_ACCESS_MODE` vazio ou `local`;
- conexão real do socket em `127.0.0.1`, `::1` ou `::ffff:127.0.0.1`;
- Host exatamente `localhost`, `127.0.0.1` ou `[::1]`, com porta opcional;
- ausência de `Forwarded`, `X-Forwarded-For`, `X-Forwarded-Host`, `X-Forwarded-Proto` e `X-Real-IP`;
- ausência de tentativa de autenticação e de requisição de navegador marcada como `cross-site`.

`API_ACCESS_MODE=local` **não libera produção**. `protected` elimina a exceção local. O servidor de desenvolvimento escuta em `127.0.0.1`; `HOST` permite um bind explícito, sem liberar acessos remotos sem chave. Em produção, o bind padrão é `0.0.0.0`. O proxy Vite usa `127.0.0.1:3333`, evitando depender da preferência IPv4/IPv6 de `localhost`.

## Origens, proxies e cache

Foi removido o CORS universal. A API permite origem com o mesmo Host/protocolo da requisição e, no desenvolvimento local válido, as origens HTTP de localhost/127.0.0.1/[::1] na porta 5173. Origens adicionais precisam constar **exatamente**, separadas por vírgula, em `API_ALLOWED_ORIGINS`; essa extensão exige chave configurada. Não há curingas, credencial em query string ou correspondência por sufixo. Uma origem permitida não autentica a requisição.

Uma requisição `cross-site` somente pode prosseguir com origem explicitamente permitida pela política e chave configurada; ainda precisa apresentar o Bearer correto. O preflight OPTIONS com origem permitida retorna os cabeçalhos CORS, sem executar endpoints e sem exigir Bearer; não concede acesso ao pedido real. OPTIONS sem origem é recusado.

`trust proxy` permanece desativado. Cabeçalhos encaminhados não comprovam IP local, Host ou protocolo. Quando HTTPS termina no proxy de produção, configure a origem HTTPS exata em `API_ALLOWED_ORIGINS`. Não habilite confiança genérica em cabeçalhos encaminhados para recuperar a exceção local. A [documentação do Express](https://expressjs.com/en/guide/behind-proxies/) explica a relação entre a topologia e a confiança nesses cabeçalhos.

Respostas sob `/api` declaram `Cache-Control: no-store`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: no-referrer` e variam por Origin. O cabeçalho `X-Powered-By` foi desativado.

## Compatibilidade e operação

O worker Python passa a enviar sua credencial também ao ler a taxonomia. A exportação CSV envia a mesma credencial ao consultar histórias; o arquivo exportado não inclui o segredo. Sem chave, continuam operando apenas no desenvolvimento local válido.

**A interface web protegida usa agora usuário/senha e sessão do servidor**, conforme a atualização de deploy acima; papéis, autoria integrada dos registros e isolamento organizacional de B13 continuam pendentes. Não colocar `INGEST_API_KEY` em código React, `VITE_*`, armazenamento do navegador ou no formulário de login. A chave continua sendo exclusivamente uma credencial de integração técnica. O formulário recebe usuário e senha separados da chave e não persiste o segredo no navegador. A implementação B13a histórica não realizou deploy ou alteração de credenciais.

Esta mudança não transforma um processo local em ambiente multiusuário confiável. Também não introduz rate limiting distribuído, gestão de segredos ou auditoria por pessoa. Bases restritas dependem dos critérios restantes da B13.

## Verificação

`npm.cmd test` executa os testes do perímetro: 25 rotas representativas antigas/novas negadas sem credencial, dados JSON inválidos recusados antes do parser, Bearer estrito, produção/Vercel sem chave, modo inválido, Host hostil enviado por HTTP real, cabeçalhos de proxy, pares/origens locais e externas, preflight e envio multipart autorizado. Os testes não consultam banco nem provedores.

`npm.cmd run check:python-api` verifica propagação da credencial em leitura, escrita e exportação com HTTP simulado. `npm.cmd run check:dependencies` consulta o registro npm e falha se houver alertas. Os checks existentes com PostgreSQL e navegador continuam verificando o fluxo funcional no ambiente local isolado; não representam testes entre organizações.

Veja [ADR 005](decisoes/005-perimetro-e-identidade.md) e [entrega 011](entregas/011-perimetro-e-dependencias.md) para evidências, limites e sequência.
