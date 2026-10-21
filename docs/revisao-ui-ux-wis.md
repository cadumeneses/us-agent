# Revisão de usabilidade e integração WIS — 21/10/2026

A WIS integra o mesmo catálogo, editor e fluxo de versões das demais taxonomias. A árvore tem dois níveis, módulo → operação. O catálogo continua crescendo por novas versões; publicações anteriores preservam conteúdo e hash. A migration 032 mantém os dados de classificação e conecta os consumidores existentes à taxonomia comum.

## Critérios utilizados

Foi usada a skill [UI UX Pro Max](https://github.com/nextlevelbuilder/ui-ux-pro-max-skill), obtida em `tmp/ui-ux-skills/ui-ux-pro-max`. Foram consultados `SKILL.md`, regras de interação, foco de diálogos e HTML semântico. As decisões aplicadas incluem divulgação progressiva, hierarquia de navegação, retorno previsível, foco visível e adaptação a telas menores. Preservaram-se a marca azul e a tipografia existente.

## Alterações

| Área | Resultado |
| --- | --- |
| Taxonomias | Catálogo pesquisável separado do editor. Consulta, criação e edição têm contextos distintos; versões retiradas ficam disponíveis sob demanda. |
| WIS | Mesmo fluxo das demais taxonomias. Módulos na raiz e operações como filhos, sem nível intermediário de domínio ou preparação de cópias. |
| Editor | Árvore com hierarquia visível, edição de um nó por vez e identificadores técnicos recolhidos. A WIS oferece ações para adicionar módulo/operação e restringe os pais ao nível correto. |
| Configuração | Navegação compartilhada entre recomendadores, configuração e execuções; consulta/importação de catálogos em áreas distintas. |
| Acesso | Tabela de membros separada do formulário de concessão/edição. Falhas preservam o formulário. |
| Auditoria | Colunas de data, ator, ação e recurso; registro completo sob demanda. |
| Navegação | Agrupamento das áreas, acesso ao histórico e menu móvel com tratamento de teclado. |
| Diálogos | Componente compartilhado com foco inicial, contenção do foco, Escape e retorno ao elemento que abriu o diálogo. |
| Histórico e revisão | Busca, estados de carregamento/erro e repetição, links para história/revisão, seleção acessível e colunas adaptáveis. |
| Transversal | Controles de 42–44 px, foco visível, espaçamento e respeito a movimento reduzido. |
| Carregamento | Rotas carregadas sob demanda para reduzir o JavaScript inicial. |

## Evidências

[Capturas e resultados automatizados](evidencias/ui-ux-2026-10-21/unified-wis/README.md): 44 verificações de layout em 11 telas e quatro larguras, sete fluxos, sem erros de execução. O navegador confirmou a criação/publicação de versão WIS pelo fluxo comum e sua disponibilidade na classificação. Passaram 157 testes de API e 75 de interface, além das integrações de classificação, taxonomias, autenticação, isolamento e recomendadores.

As verificações usam fixtures sintéticas locais; não constituem avaliação com participantes. Os critérios de contraste e navegação foram tratados na implementação, sem alegar certificação de acessibilidade.

O [guia WIS](migracao-catalogo-wis.md) descreve o modelo e a preservação dos dados. O [roteiro 043](entregas/043-wis-unificada-e-ui-ux.md) prepara o ensaio e a implantação em produção. Esta revisão ainda não foi publicada em produção.
