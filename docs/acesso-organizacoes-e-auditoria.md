# Organizações, permissões e auditoria

A migration 031 e o código desta entrega acrescentam controle de acesso e autoria por pessoa sem atribuir autores retroativos aos registros anteriores. A implementação foi verificada em PostgreSQL/HTTP locais; não foi implantada em produção nesta entrega.

## Comportamento

| Papel | Operações |
| --- | --- |
| `viewer` | Consultas autorizadas da organização. |
| `reviewer` | Consultas, revisão funcional e decisões/destinos/cópias dos recomendadores. Não publica configurações/taxonomias. |
| `maintainer` | Consultas, configuração, importação, publicação e execução, além da revisão. |
| `admin` | Operações do mantenedor, gestão de vínculos e consulta de auditoria. |

Os papéis são conferidos na API em cada requisição. A UI exibe a organização/papel e oferece **Access and audit** para seleção da organização e administração. Revogar o vínculo ou mudar seu papel afeta a próxima requisição, sem depender do vencimento do cookie. O último administrador ativo não pode ser removido/rebaixado por essa API. Novos usuários não recebem automaticamente vínculo com uma organização.

Em produção/Vercel o controle é obrigatório e falha fechado se faltar registry ou vínculo. No desenvolvimento local é possível usar o modo legado sem configuração de organização; definir `ORGANIZATION_ACCESS_MODE=enforced` para reproduzir o controle. O check de integração usa esse modo. A chave técnica de integração continua sendo uma credencial administrativa do servidor e não deve ser entregue a navegadores ou participantes.

## Isolamento e autoria

O schema original é registrado como organização `default`, preservando seus dados e IDs. Usuários ativos existentes recebem `admin` nessa organização para preservar o acesso anteriormente irrestrito; revisar esses vínculos antes de distribuir acesso por papéis. Isso não cria novas contas/senhas e não compartilha a organização com usuários novos automaticamente.

Organizações adicionais recebem schemas próprios, com migrations aplicadas e dados iniciais técnicos próprios. Identidades, sessões e vínculos usados pelo login permanecem no registro central. As tabelas equivalentes criadas pelas migrations no schema de domínio não são usadas como autoridade de autenticação. O provisionador registra o schema no registry central somente depois da aplicação bem-sucedida do release.

A organização solicitada pelo cabeçalho `X-Organization-Id` é validada contra o vínculo autenticado; o nome do schema nunca vem diretamente do navegador. Sem seleção, usa-se a primeira organização permitida, priorizando `default` quando acessível. Consultas/mutações de domínio usam `SET LOCAL search_path` sem fallback para outro domínio; o contexto é transacional e separado por requisição. O pool não conserva a organização após commit/rollback. O RNF legado também usa esse caminho.

Publicações, importações, execuções, decisões e cópias novas registram o ator obtido da sessão autenticada. A auditoria PostgreSQL registra INSERT/UPDATE/DELETE das tabelas de domínio com ator, organização, identidade, transação e hashes antes/depois, sem copiar conteúdo completo ou credenciais. Mudanças de vínculo recebem auditoria central específica. Eventos são imutáveis; uma transação revertida não deixa uma alteração de domínio ou evento confirmado. Operações offline/migrations sem pessoa autenticada continuam identificadas como técnicas.

O isolamento protege os caminhos da aplicação contra acessos cruzados. Não protege contra administradores do banco ou uso indevido da chave técnica/credencial do servidor. Aplicar futuras migrations também aos schemas das organizações, antes de habilitar o código que dependa delas; o runner usa a conexão/schema selecionado e não percorre automaticamente todas as organizações.

## Provisionar outra organização

Depois de aplicar 031 no registro central, usar conexão direta e um administrador que já exista e esteja ativo em `web_users`:

```powershell
node --env-file=.env.vercel.production scripts/provision-organization.mjs --apply --expect-target "HOST_DIRETO:5432/BANCO" --id estudo --name "Study workspace" --admin USUARIO_EXISTENTE
```

O script gera o nome do schema, aplica o release e registra o administrador. Recusa IDs já existentes e usuários inexistentes/inativos; não copia projetos ou dados da organização original e não altera senhas. Em falha, remove somente o schema novo que ele próprio gerou. Não executar o comando para produção antes do ensaio numa cópia/branch apropriada.

A API permite `GET /api/access/context`, `GET /api/access/members`, `PUT /api/access/members/:username` e `GET /api/access/audit?offset=0`. As três últimas exigem administrador e operam na organização selecionada. O corpo de atualização é `{ "role": "viewer", "active": true }`, por exemplo. O nome de um usuário não permite consultar/gravar dados de outra organização.

## Verificação

`npm.cmd run check:organization-access` cria registro local, usuários artificiais, sessões reais de teste e dois schemas isolados. Confere papéis, acesso cruzado, seleção inválida, 12 leituras intercaladas com conexões reutilizadas, revogação imediata, último administrador, ator da auditoria e imutabilidade. Os schemas de ensaio são removidos ao terminar. O check não lê `.env` nem aceita banco remoto.
