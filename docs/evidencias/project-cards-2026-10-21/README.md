# Revisão dos cards de projetos — 21/10/2026

A revisão aplicou a skill UI UX Pro Max (`tmp/ui-ux-skills/ui-ux-pro-max/SKILL.md`). As consultas verificadas trataram de contraste e legibilidade, feedback ao passar o ponteiro e HTML semântico; as regras locais de hierarquia visual, agrupamento de conteúdo e foco complementaram a avaliação.

O layout anterior colocava título, indicadores e ação em uma mesma linha, comprimindo os totais em várias quebras de texto. O novo card apresenta cabeçalho com ícone consistente e nome completo, três indicadores separados e uma área própria para **Open project**. O card inteiro permanece um link nativo, com foco visível e sem controles interativos aninhados. As métricas usam os totais retornados pela API, inclusive zeros; enquanto não carregam, aparece um travessão.

- [Desktop — 1440 px](projects-1440.png).
- [Desktop — 1024 px](projects-1024.png).
- [Tablet — 768 px](projects-768.png).
- [Celular — 375 px](projects-375.png).
- [Resultados automatizados](browser-checks.json).

O [verificador](../../../scripts/check-project-cards-ux.mjs) usa Edge headless, API compilada e PostgreSQL local com schema descartável. As fixtures incluem projeto vazio, projeto com 24 histórias classificadas e nome longo com uma história ainda não classificada. Confere contagens reais, ausência de sobreposição e rolagem horizontal, rótulos, foco e navegação por Enter em quatro larguras. Build e 84 testes da interface aprovados.

São verificações de engenharia com dados sintéticos, sem avaliação com participantes. Não houve deploy ou migration nova.
