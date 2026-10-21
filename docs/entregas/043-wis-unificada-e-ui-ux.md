# WIS unificada e revisão da interface

**Execução posterior à preparação:** em 21/10/2026 a 032 foi ensaiada em cópia atual de produção e aplicada no banco real, sem pendências. Dados, hashes e rotas autenticadas foram verificados. [Registro da execução](../evidencias/wis032-production-2026-10-21/README.md). Não houve deploy de código nessa execução; o roteiro abaixo preserva a preparação original.

21/10/2026. Pacote preparado para commit e implantação coordenada. Esta preparação não executa migrations nem publica código em produção.

## Resultado

A WIS passa ao catálogo comum de taxonomias como árvore de dois níveis, módulo → operação. Consulta, rascunho, edição, nova versão e publicação usam os mesmos componentes e endpoints das demais taxonomias. A migration 032 preserva os registros operacionais e conecta a publicação comum aos consumidores de classificação. A interface separa a listagem da edição e melhora navegação, acesso, auditoria e uso em celular.

O release revisado contém 33 arquivos até `032_unified_wis_taxonomy.sql`. A migration avulsa `016_sheet_source_links.sql` não faz parte deste pacote; quando já registrada no banco, deve permanecer preservada. Os [registros anteriores de produção](../evidencias/production-migrations-2026-10-21/README.md) confirmam a aplicação até 031, mas não substituem uma consulta atual.

## Verificações antes de implantar

```powershell
npm.cmd run build
npm.cmd test
npm.cmd run db:release:check
npm.cmd run check:deployment-migrations
npm.cmd run check:wis-catalog
```

Build, 232 testes de aplicação, cinco testes do executor e ensaio local da 032 aprovados. As [evidências da interface](../evidencias/ui-ux-2026-10-21/unified-wis/README.md) registram 44 verificações de layout, sete fluxos e publicação WIS seguida de consulta à classificação. O [guia WIS](../migracao-catalogo-wis.md) detalha invariantes, versionamento e compatibilidade.

## Preparação do ambiente remoto

Usar o projeto Vercel existente e obter as variáveis atuais em arquivo local ignorado pelo Git. Não usar `.env` de desenvolvimento para produção:

```powershell
npx vercel env pull .env.vercel.production --environment=production
node --env-file=.env.vercel.production scripts/check-vercel-config.mjs
node --env-file=.env.vercel.production scripts/migrate-deployment.mjs --status
```

O arquivo precisa fornecer `MIGRATION_DATABASE_URL`, `DATABASE_URL_UNPOOLED` ou `POSTGRES_URL_NON_POOLING`, com conexão direta ao banco correto. Conferir `target`, schema, pendências e migrations fora do manifesto. No estado esperado, somente 032 estará pendente; diferenças exigem reconciliar o roteiro com o estado real. Não copiar credenciais para o repositório.

Criar uma branch/cópia atual de produção com ponto de recuperação, configurar sua conexão direta em `.env.vercel.rehearsal` e executar primeiro nela. Substituir o destino abaixo pelo `target` retornado pelo status do ensaio:

```powershell
node --env-file=.env.vercel.rehearsal scripts/migrate-deployment.mjs --status
node --env-file=.env.vercel.rehearsal scripts/migrate-deployment.mjs --apply --expect-target "HOST_ENSAIO:5432/BANCO"
node --env-file=.env.vercel.rehearsal scripts/migrate-deployment.mjs --status
```

Conferir o catálogo WIS importado, dois níveis, hashes, dados históricos e organizações no ensaio. Executar o novo código contra essa cópia e validar login, catálogo, publicação WIS e classificação. Esse ensaio em cópia atual de produção ainda precisa ser feito; os testes locais não o substituem.

## Janela de implantação

Com o ensaio aprovado e o código deste pacote disponível, suspender o tráfego para evitar escrita do runtime anterior durante a transição. Confirmar o ponto de recuperação. Aplicar no destino exato retornado pelo status de produção:

```powershell
node --env-file=.env.vercel.production scripts/migrate-deployment.mjs --apply --expect-target "HOST_PRODUCAO:5432/BANCO"
node --env-file=.env.vercel.production scripts/migrate-deployment.mjs --status
```

Publicar o mesmo código revisado antes de reabrir o tráfego. Se o push para a branch de produção dispara deploy automático, manter a janela de manutenção durante o push, a migration e a conclusão desse deploy. Não disparar também um segundo deploy manual. Quando a implantação for manual:

```powershell
npx vercel --prod
node --env-file=.env.vercel.production scripts/check-vercel-config.mjs --url https://us-agent-api.vercel.app
```

Concluir com login, listagem de histórias, dashboard, catálogo único, árvore WIS, seleção da WIS nos recomendadores e permissões por organização. Conferir uma publicação de teste no ensaio; não criar versões artificiais na taxonomia real. Reabrir o tráfego quando código e banco forem compatíveis e os probes passarem. Não reaplicar provisionamento de usuários nem redefinir senhas.

O executor usa hashes revisados, advisory lock e transação por arquivo. Se a 032 falhar, ela sofre rollback; interromper a publicação e investigar. Se falhar após a confirmação, manter a manutenção e corrigir adiante ou restaurar o ponto de recuperação com o código correspondente. Não apagar vínculos ou histórico para tentar desfazer a migração.

## Conteúdo do commit

Incluir código, testes, migration 032, manifesto, verificadores e documentação/evidências desta entrega. Excluir arquivos de ambiente, artefatos temporários, skills locais, material acadêmico e SQL avulso não revisado. Sugestão de mensagem: `feat: integra WIS ao catálogo comum e revisa usabilidade`.
