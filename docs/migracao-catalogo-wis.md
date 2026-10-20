# Preparação do catálogo WIS para o modelo versionado

**Atualização 042:** para publicar o código completo de adaptação/acesso, seguir a [ordem operacional 042](entregas/042-fechamento-tecnico-e-preparacao-empirica.md), com 030/031 antes de reabrir o runtime novo e janela de manutenção. O procedimento 041 abaixo descreve o incremento anterior isolado; não basta para o release completo atual de 32 arquivos.

20/10/2026. Migration [029_legacy_taxonomy_staging.sql](../database/migrations/029_legacy_taxonomy_staging.sql), incluída por hash no release de produção, agora com 30 arquivos. Preparada e ensaiada localmente; não aplicada em produção ou em uma branch de produção nesta entrega.

## Resultado e características preservadas

Cada versão WIS não vazia gera um **rascunho** de `wis-legacy`, versão `wis-v-<ID original>`. O nome `WIS: <versão original>` conserva o rótulo de origem, inclusive espaços e caracteres incompatíveis com IDs novos. A árvore mantém domínio → módulo → operação, nomes, descrições integrais e ordem por posição original, com desempate por ID. Nós recebem IDs estáveis `wis-domain-<ID>`, `wis-module-<ID>` e `wis-operation-<ID>`, sem equivalência inferida por nome.

Domínios/módulos são organizadores, mesmo quando vazios; não viram opções selecionáveis. Operações ativas recebem `selectable: true`; operações desativadas permanecem na árvore com `selectable: false`. O editor permite consultar/editar essa propriedade; formulário e validação da API a respeitam. O novo campo é opcional: publicações anteriores sem ele conservam o conteúdo, hashes e comportamento. O nome do nó aceita até 180 caracteres, como as operações WIS; descrições não são truncadas pelo limite antigo de 2.000 caracteres. O limite HTTP de 1 MB permanece.

`legacy_taxonomy_imports` guarda o retrato original completo: IDs, versões, datas, flags de atividade, posições, descrições e relações. Essa evidência é imutável; `legacy_taxonomy_node_map` expõe a correspondência de IDs. Versões vazias permanecem nessa evidência, com destino nulo, sem fabricar nós. Versões WIS inativas são copiadas como rascunhos, com o estado original registrado, e não são reativadas.

Nenhuma tabela WIS, projeto, história, classificação, par de rótulos, execução ou snapshot existente é alterado. O classificador e a revisão continuam usando WIS. **Aplicar 029 não publica os rascunhos nem troca a leitura da classificação.** A troca exige outro incremento de compatibilidade e uma decisão explícita sobre a versão publicada por projeto/classificação.

## Procedimento de produção

Usar a conexão direta existente, em arquivo local ignorado pelo Git; não usar URL com pooler. Conferir o destino pelo status. Antes de executar em produção, ensaiar a sequência numa branch/cópia atual de produção com seu próprio arquivo de ambiente e destino. O ensaio local não substitui essa verificação dos dados reais.

1. Conferir os arquivos e o estado do ambiente:

```powershell
npm.cmd run db:release:check
node --env-file=.env.vercel.production scripts/migrate-deployment.mjs --status
```

2. Se houver pendências anteriores, aplicar **somente até 028** antes do código. O parâmetro `--through` limita a aplicação ao prefixo revisado do release; o status final ainda mostra a 029 pendente. Substituir o destino pelo `target` exato do status:

```powershell
node --env-file=.env.vercel.production scripts/migrate-deployment.mjs --apply --expect-target "HOST_DIRETO:5432/BANCO" --through 028_configurable_project_recommendations.sql
```

3. Publicar a API e a interface desta entrega, incluindo o suporte a `selectable`. Conferir login, leitura dos projetos e a tela de taxonomias. **Não aplicar 029 enquanto houver instâncias antigas atendendo consultas dos recomendadores**: o parser anterior rejeita o campo novo. A API nova funciona com as migrations até 028, sem depender da tabela de importações no runtime.

4. Aplicar o restante do release e verificar a cópia, sem publicar os rascunhos:

```powershell
node --env-file=.env.vercel.production scripts/migrate-deployment.mjs --apply --expect-target "HOST_DIRETO:5432/BANCO"
node --env-file=.env.vercel.production scripts/verify-legacy-taxonomy-migration.mjs --expect-target "HOST_DIRETO:5432/BANCO"
node --env-file=.env.vercel.production scripts/migrate-deployment.mjs --status
```

O verificador usa uma transação somente leitura e confere nomes, descrições, relações, ordem, flags, quantidade, identidade e validade dos rascunhos. Recusa divergências entre a fonte atual e o retrato importado. Se WIS mudar depois da cópia, preparar outra versão/importação antes da troca; não editar a evidência original nem assumir sincronização automática. O verificador é destinado ao estágio anterior à publicação e exige destinos ainda em rascunho.

5. Conferir visualmente os rascunhos `WIS: …` em **Taxonomies**, inclusive operações desativadas e seções vazias; conferir que projetos/classificação/revisão mantêm seu funcionamento. Registrar as saídas do status e do verificador no registro da implantação, sem credenciais. Não publicar/retirar catálogos nesta etapa de preparação.

## Falhas e reversão operacional

A 029 bloqueia escrita concorrente nas quatro tabelas-fonte durante a cópia; o runner usa timeout de lock de 10 segundos, timeout de execução de 120 segundos e uma transação por arquivo. Colisão de destino, relações inconsistentes entre versões, mais de 5.000 nós, nomes inválidos ou conteúdo acima do orçamento de 900.000 bytes interrompem a migration, sem truncar ou descartar registros. Corrigir a condição e repetir pelo runner. Se 029 falhar, migrations anteriores já confirmadas permanecem aplicadas; 029 não fica registrada como concluída.

Não executar o SQL avulso nem reaplicá-lo manualmente: a repetição segura é pelo ledger `schema_migrations`. A aplicação repetida pelo runner ignora 029 já registrada. A migration não remove estruturas antigas, portanto uma falha de preparação não exige restaurar dados WIS. Após sucesso, manter o código compatível com `selectable`; não voltar ao parser antigo enquanto os rascunhos migrados estiverem expostos. Não há migration destrutiva de retorno: guardar o estágio importado e manter o classificador em WIS é a reversão operacional desta etapa.

## Evidências locais

```powershell
npm.cmd run build
npm.cmd run check:legacy-taxonomy-migration
npm.cmd run check:recommender-taxonomies
npm.cmd run check:deployment-migrations
npm.cmd run check:nfr-baseline
```

O ensaio de 029 usa schema descartável no PostgreSQL local e um fixture com versões ativas/inativas/vazias, posições repetidas, domínio/módulo vazio, operação de 180 caracteres, descrição acima de 2.000 caracteres e operações desativadas. Resultado: quatro versões preservadas, três rascunhos, uma versão vazia registrada, 38 nós e três operações desativadas; rollback por colisão, repetição, fonte intacta, evidência imutável e detecção de divergência conferidos. São dados de ensaio, não contagens de produção. Os oito cenários RNF permaneceram iguais; passaram os checks HTTP/publicação, cinco testes de domínio, cinco testes do release e 17 testes web existentes pertinentes.
