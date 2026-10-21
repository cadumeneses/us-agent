# Controles de tags e ação de salvar — 21/10/2026

Revisão com a skill UI UX Pro Max (`tmp/ui-ux-skills/ui-ux-pro-max/SKILL.md`). Foram aplicadas as orientações verificadas de **Chip Collection Reflow**, rótulos de controles e semântica de ícones, preservando os componentes Lucide e os tokens do produto.

A regra global `.page button` aplicava padding e altura mínimos aos botões internos das tags, comprimindo seus ícones. O botão de salvar participava da mesma grade dos campos e se esticava conforme a altura da linha. A correção define estilos próprios para os controles das tags, ícones com espaço reservado, alvos de 44 px, texto legível e o botão **Add** junto ao campo de digitação. **Save profile** ocupa uma linha de ações abaixo dos campos, com tamanho independente da grade.

- [Perfil em desktop](profile-1440.png).
- [Perfil em celular](profile-375.png).
- [Tags e ação de salvar em celular](profile-actions-375.png).
- [Resultados do navegador](browser-checks.json).

O [verificador](../../../scripts/check-profile-controls-ux.mjs) usa Edge headless, API compilada e PostgreSQL local com schema descartável. Confere quatro larguras (1440, 1024, 768 e 375 px), dimensões dos ícones e alvos de toque, agrupamento entre input e **Add**, tamanho de **Save profile**, ausência de rolagem horizontal, adição por botão/Enter, remoção por clique/Space, prevenção de duplicatas e salvamento real do perfil. Os valores das capturas são fixtures sintéticas semelhantes ao exemplo apresentado pelo usuário.

Build aprovado e 84 testes da interface aprovados. A verificação visual e de interação não é uma certificação de acessibilidade. Não houve deploy, alteração de produção ou migration nova.
