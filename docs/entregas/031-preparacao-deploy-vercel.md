# Entrega 031 — preparação do deploy e acesso privado

Continuação: a [entrega 032](032-usuarios-privados-e-provisionamento.md) substitui a senha compartilhada por usuários no banco e acrescenta migration 026 e provisionamento separado. O texto abaixo preserva o recorte inicial da entrega 031.

19/10/2026. Pedido: preparar atualização e migrations na Vercel a partir do erro exibido na interface. O usuário escolheu acesso privado por senha com sessão no servidor.

## Diagnóstico e implementação

A consulta pública ao endpoint `https://us-agent-api.vercel.app/api/health` confirmou HTTP 503. O texto da captura corresponde ao bloqueio de acesso quando falta a credencial técnica em produção, antes da consulta ao banco. O estado das migrations de produção não foi consultado, pois não há conexão direta ou autenticação Vercel disponível neste ambiente. A chave no servidor, isoladamente, não habilitava a interface anterior sem autenticação de navegador.

O novo fluxo adiciona formulário de senha, verificação scrypt no servidor, sessão opaca persistida por hash no PostgreSQL, expiração de oito horas, logout com revogação, invalidação por troca do hash de senha e limite compartilhado de dez tentativas por minuto. O cookie de produção é Secure/HttpOnly/SameSite=Strict com prefixo `__Host-`. Escritas com sessão exigem origem exata; Bearer inválido não é substituído por cookie válido. A senha privada é independente da chave de integração e não vai para armazenamento do navegador.

A migration 025 acrescenta somente tabelas de sessão e limite de login e um índice de expiração. O executor de deploy usa conexão direta e alvo explicitamente conferido, status somente leitura, advisory lock e transação por arquivo. O manifesto inclui 26 migrations versionadas/revisadas até 025; a migration local não versionada `016_sheet_source_links.sql` permanece fora do release e do stage. O runner anterior e os SQLs históricos foram preservados.

## Verificações

- API: 154 testes passaram; build TypeScript passou.
- Interface: 65 testes passaram, incluindo entrada recusada/aceita, expiração, saída e configuração indisponível; build Vite passou.
- Runner de deploy: cinco testes passaram, cobrindo manifesto, exclusão de SQL não versionado, conexão direta sem fallback local, rollback, lock concorrente e migração já aplicada.
- PostgreSQL local: 26 migrations aplicadas em schema vazio descartável e segunda aplicação sem reaplicar arquivos; login, cookies, hashes no banco, rotas antigas/internas, recusa de CSRF/Bearer inválido, saída, expiração, troca de senha e limite de tentativas passaram. O schema foi removido ao encerrar, sem alteração dos registros operacionais.
- Conferência do índice científico anterior: 198 hashes preservados. Não houve alteração de políticas, fórmulas ou dados científicos congelados.

A instalação local de dependências estava fora de sincronia com o lockfile (Vitest antigo e jsdom ausente). Foi sincronizada por `npm ci --ignore-scripts`, sem alterar versões ou lockfile. Build/testes web exigiram execução fora do sandbox por restrição de leitura do esbuild. O PostgreSQL local foi iniciado para o check descartável.

## Aplicação em produção

O [roteiro de deploy](../deploy-vercel.md) identifica variáveis, geração privada do hash de senha, exportação do ambiente Production, conferência das pendências/destino, teste em branch/cópia do banco e aplicação explícita antes do novo deploy. Configurar `WEB_ACCESS_PASSWORD_HASH`, `WEB_APP_ORIGIN`, chave técnica, origem HTTPS, URL com pool da aplicação e URL direta do runner. A implantação e a aplicação das migrations dependem de acesso ao projeto/banco; não foram executadas nesta preparação.

O acesso é compartilhado ao espaço privado. Não introduz contas individuais, papéis ou isolamento por organização, e não encerra esses critérios B13 nem avaliações científicas pendentes. Não houve commit ou push.
