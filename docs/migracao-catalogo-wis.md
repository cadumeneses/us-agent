# WIS no catálogo comum de taxonomias

21/10/2026. A WIS é uma taxonomia versionada do mesmo catálogo usado pelas demais, com identidade `wis` e árvore de **dois níveis: módulo → operação**. Não existe uma área separada de WIS nem um fluxo de preparação de cópias para recomendadores.

## Uso

1. Abrir **Taxonomies** e selecionar a versão WIS na listagem comum.
2. Consultar os módulos e suas operações no editor comum.
3. Para ampliar uma publicação, escolher **Create a new taxonomy version**, informar a versão e adicionar módulos/operações.
4. Salvar o rascunho e publicar depois de revisar. Essa mesma publicação passa a atender à classificação e aos atributos de recomendadores.

Módulos são nós raiz organizadores; operações são seus filhos selecionáveis. A WIS não tem um nó intermediário de domínio. Outras taxonomias mantêm seus próprios formatos de lista/árvore e regras de seleção.

Rascunhos podem estar vazios enquanto são preparados. Publicações exigem conteúdo. Versões publicadas preservam conteúdo e hash; o crescimento acontece em novas versões. Versões retiradas ficam disponíveis pela opção **Include retired versions**.

## Migration 032

[032_unified_wis_taxonomy.sql](../database/migrations/032_unified_wis_taxonomy.sql) integra as versões WIS ao armazenamento comum `recommender_taxonomy_versions`, cujo nome técnico anterior foi mantido. A API comum de taxonomias lista, carrega, salva, publica e retira versões WIS. Os nomes dos endpoints e tabelas existentes não determinam uma separação funcional entre classificação e recomendadores.

A migration:

- Importa módulos e operações como nós de dois níveis, preservando IDs estáveis, nomes, descrições, ordem e operações inativas. Domínios antigos permanecem como metadados de compatibilidade, fora da árvore WIS.
- Mantém versões ativas publicadas, versões inativas retiradas e versões vazias em rascunho. Rótulos antigos que não cabem na sintaxe comum de versão recebem uma identidade válida com vínculo explícito ao original.
- Preserva as tabelas, IDs e vínculos de projetos, histórias, classificações e catálogos anteriores. Não reclassifica histórias nem muda seus pares de rótulos.
- Publica uma projeção relacional de cada nova versão WIS para os consumidores de classificação existentes, dentro da mesma transação. Trata-se de compatibilidade de armazenamento, não de um segundo catálogo editável na interface.
- Registra alterações feitas por rotas antigas de revisão/importação como novas versões WIS no catálogo comum. Vários eventos de uma transação produzem uma única versão final; versões já publicadas não são sobrescritas.
- Retira as cópias de preparação `wis-legacy` criadas pela 029 que continuam intocadas. Conteúdo, hashes e evidências permanecem consultáveis; rascunhos alterados por usuários não são arquivados automaticamente.
- Identifica as gravações de migração por `migration:032` na auditoria. Uma implantação fora de uma requisição de usuário usa o escopo `offline`, no próprio schema migrado.

Os vínculos `wis_taxonomy_bindings` e `wis_taxonomy_node_bindings` relacionam a publicação comum aos identificadores de compatibilidade. A retirada de uma versão antiga não desativa a projeção de uma versão mais recente. As rotas existentes aceitam a identidade comum por meio desses vínculos.

## Validação local

```powershell
npm.cmd run build
npm.cmd test
npm.cmd run check:deployment-migrations
npm.cmd run check:wis-catalog
npm.cmd run check:recommender-taxonomies
npm.cmd run check:classification-workflow
npm.cmd run check:organization-access
npm.cmd run check:private-web-access
npm.cmd run check:workspace-ux
npm.cmd run check:recommender-browser
```

Os verificadores de integração criam schemas descartáveis no PostgreSQL local. Incluem publicação pelo endpoint comum, atualização da classificação, consulta por identidade compartilhada, hashes JavaScript/SQL, Unicode, preservação histórica, operações inativas, rascunho vazio que ganha conteúdo, rejeição de terceiro nível, revisão antiga, retirada e repetição idempotente.

[Evidências de interface e execução](evidencias/ui-ux-2026-10-21/unified-wis/README.md). São ensaios técnicos sintéticos, não dados de avaliação com participantes.

## Implantação

**Atualização de execução — 21/10/2026:** a 032 já foi ensaiada em cópia atual e aplicada em produção, sem pendências. Os dados operacionais foram preservados e a API retornou a WIS publicada no catálogo comum. [Evidências](evidencias/wis032-production-2026-10-21/README.md). Não houve deploy de código nesta execução. As observações de preparação abaixo descrevem o estado anterior à aplicação.

Seguir o [roteiro 043](entregas/043-wis-unificada-e-ui-ux.md) para os comandos e a ordem completa de ensaio e implantação.

O release agora contém **33 arquivos**, até 032. A 032 exige ensaio em uma cópia atual de produção e implantação coordenada com o código desta revisão. Usar o executor transacional e conexão direta, conferir o destino e manter o tráfego em manutenção durante a transição:

```powershell
npm.cmd run db:release:check
node --env-file=.env.vercel.production scripts/migrate-deployment.mjs --status
node --env-file=.env.vercel.production scripts/migrate-deployment.mjs --apply --expect-target "HOST_DIRETO:5432/BANCO"
```

Depois de publicar o código, verificar login, catálogo único, árvore WIS, criação/publicação de uma nova versão, classificação, seleção da taxonomia nos recomendadores e permissões. Esta revisão aplicou a 032 somente em schemas locais de ensaio; **produção ainda não recebeu a 032 nem o código novo**.

O verificador histórico de 029 permanece específico à preparação anterior e não é um gate deste novo fluxo. Os registros anteriores continuam na [entrega 041](entregas/041-preparacao-migracao-catalogo-wis.md) e nos documentos da época; as evidências de [027–031 em produção](evidencias/production-migrations-2026-10-21/README.md) não equivalem à aplicação da 032.
