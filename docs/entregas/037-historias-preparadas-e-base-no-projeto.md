# 037 — Histórias preparadas e base publicada no projeto

19/10/2026. Continuidade da revisão do plano após 036, RF01/RF06/RF09–RF10 e jornada operacional solicitada. Interface em inglês.

## Comportamento entregue

O projeto permite salvar uma história sem classificação, editar seu texto enquanto não classificada e cadastrar tarefas/categorias/tecnologias. A história possui identidade própria em `stories`; a migration 027 acrescenta preparação/revisão por história, sem criar classificações fictícias. A listagem de projetos conta também histórias não classificadas.

**Classify story** abre a entrada salva com projeto/sprint/texto preservados e a configuração de classificação existente. A classificação usa a mesma história e leva os detalhes preparados à primeira classificação. Reclassificar conserva a identidade da história, cria outra classificação e copia os detalhes da anterior. Alterações concorrentes são recusadas com 409. O texto já classificado permanece como evidência; textos diferentes são cadastrados como outra história.

Em **Recommenders**, RNFs oferecem **Published dataset** e **Operational project history** explicitamente. O primeiro carrega definição/base publicadas e projeta os valores salvos com o adaptador RNF existente, incluindo tarefas e mapeamentos taxonômicos declarados. Uma cópia do contrato é usada para preparar a entrada; a publicação e seu hash continuam preservados. O segundo mantém a política operacional anterior. O fluxo publicado não exige digitar novamente identidade, perfil ou tarefas; os campos podem ser conferidos em seção expansível. Casos de teste continuam no executor demonstrativo existente.

## Verificação

- Build API/web aprovado; 154 testes API e 65 web preexistentes aprovados. Nenhum caso de teste automatizado novo; uma expectativa de texto existente foi atualizada de `Executando…` para `Running…` para acompanhar o idioma solicitado.
- Migration 027 aplicada somente à branch temporária `br-summer-shape-avdnmsg3`, derivada da produção; contagens das 51 tabelas anteriores preservadas. Manifesto de release com 28 migrations verificado. Dados sintéticos do percurso ficaram nessa branch, removida após preservar as evidências e encerrar a prévia.
- Percurso manual em Edge local: projeto/perfil → história não classificada → tarefa → classificação por regras locais → reclassificação → seleção de base publicada → recomendação RNF → replay. História 271 preservada, classificações 271/272 distintas, tarefa/categoria mantidas e gravação obsoleta recusada com 409. Verificação móvel em 390×844 sem overflow horizontal.
- [Evidências sanitizadas](../evidencias/project-workflow-2026-10-19/manifest.json): migration, observações do percurso e capturas desktop/mobile. São verificações de engenharia com dados sintéticos, não sessões de participantes ou resultados empíricos dos artigos.

## Disponibilização e limites

Aplicar a migration 027 pelo runner de release antes de publicar este código na Vercel. Produção e deployment não foram alterados nesta entrega. Configurações/bases demonstrativas usadas na conferência não são provisionadas automaticamente em produção.

Continuam pendentes atributos adicionais de cálculo por configuração, terceiro exemplo sem US e avaliação integrada/empírica. O caminho de classificação por texto livre existente permanece disponível; o fluxo com `storyId` é o que conserva explicitamente a identidade da entrada preparada. Papéis/organizações e autoria de domínio continuam no backlog próprio.
