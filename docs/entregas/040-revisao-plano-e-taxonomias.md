# 040 — Revisão do plano e entrada única de taxonomias

20/10/2026. Conferência do plano e da interface no código local, a partir de `c963b61` e das entregas 037–039. Produção não foi consultada ou alterada.

O plano completo continua parcial. Os três exemplos técnicos (RNF, testes e perfil → riscos sem histórias), configuração, publicação, importação, execução, explicação e replay estão documentados nas entregas anteriores. A entrega 039 consolida 23 condições técnicas preservadas. Isso não conclui B14/B18/B22/B23: faltam decisões/dados empíricos, previsões e revisões observadas, estudo de esforço para os três casos com participantes e material acadêmico final. B13 continua parcial por papéis, autoria/auditoria de domínio e isolamento organizacional. RF11 ainda tem adaptação de sentenças RNF pendente. A disponibilização de 037/038 exige conferir a instalação e aplicar 027/028 antes do código.

## Divergência encontrada e correção

`TaxonomyPage` ainda cadastrava diretamente versões/domínios/módulos/operações na estrutura WIS. Separadamente, `RecommenderSetupPage` oferecia `TaxonomyEditor` com listas/árvores, IDs, rascunho e publicação imutável. A coexistência vinha da introdução incremental de B08/B12b; a tela antiga não havia acompanhado o novo fluxo.

A criação/publicação passa a ter uma única entrada em `/taxonomy`, usando o editor versionado existente. A configuração dos recomendadores leva a essa mesma página, sem outro editor embutido. `/taxonomias` redireciona para ela. Menu e editor usam o nome **Taxonomies**. O catálogo WIS permanece em uma seção de consulta carregada sob demanda, com acesso à fila de revisão de propostas; os formulários diretos antigos foram removidos da página. Tutorial e roteiros de navegador acompanham a navegação atual.

## Limite e próximo aceite

Esta mudança unifica a entrada de cadastro na interface; **não unifica a persistência nem o consumo pelo classificador**. WIS continua nas tabelas antigas e as propostas de revisão continuam operando nelas. Uma taxonomia publicada no editor não passa automaticamente a classificar histórias.

A harmonização completa requer um incremento explícito: mapear versões/domínios/módulos/operações existentes para IDs estáveis do catálogo comum, vincular projetos/classificação a publicações exatas e fazer propostas de revisão produzirem novas versões revisáveis. Preservar IDs/histórico, os pares e snapshots das classificações anteriores e as saídas RNF congeladas; não presumir equivalência por nome nem alterar publicações. Até esse aceite, a integração das taxonomias com a classificação deve constar como pendência de produto.

## Verificação

Build web e os 14 testes existentes de configuração/importação passaram, incluindo a navegação até a página central, validação de árvore e publicação pelo hash salvo. Os roteiros de navegador foram ajustados, sem executar novamente os pacotes científicos. Nenhuma migration, alteração de banco ou deploy foi realizado.
