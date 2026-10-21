# WIS no catálogo comum — evidências locais

21/10/2026. Revisão que substitui a separação entre WIS e taxonomias de referência. A WIS usa o mesmo catálogo, editor, rascunhos e publicação das demais taxonomias, com dois níveis: módulo → operação.

As capturas e verificações usam dados sintéticos em schemas descartáveis do PostgreSQL local. Não representam avaliação com participantes nem aplicação da migration 032 em produção.

## Interface

- [Catálogo comum em desktop](taxonomies-1440.png) e [celular](taxonomies-375.png).
- [Árvore WIS no editor comum](wis-tree-1440.png).
- [Versão WIS publicada em desktop](wis-published-tree-1440.png) e [celular](wis-published-tree-375.png).
- [Resultado automatizado de interface](browser-checks.json): 11 telas em quatro larguras, 44 verificações de layout e sete fluxos, sem erros de execução.
- [Fluxo completo de recomendadores](recommender-workflow.json).

O navegador verificou a inclusão de módulo e operação, salvamento e publicação de uma nova versão WIS pelo fluxo comum, seguida da consulta à classificação para confirmar a projeção publicada. A revisão das demais telas incluiu navegação responsiva, formulários separados das listagens, permissões, auditoria e foco dos diálogos.

## Verificação técnica

- Build da API e da interface aprovado.
- 157 testes de API e 75 testes de interface aprovados.
- Cinco testes do executor de migrations aprovados; manifesto com 33 arquivos, incluindo 032.
- Integração WIS aprovada: dois níveis, publicação comum atualiza classificação, IDs e hashes estáveis, histórico preservado, alterações de rotas anteriores versionadas, retirada, idempotência e rollback em colisão.
- Integrações de classificação, taxonomias de recomendadores, acesso privado e isolamento por organização aprovadas.
- Fluxos completos no navegador de recomendadores e revisão da interface aprovados.

O [guia da migração](../../../migracao-catalogo-wis.md) descreve o modelo, a preservação dos dados e os passos de implantação. Produção ainda precisa receber a migration 032 e o código correspondente.
