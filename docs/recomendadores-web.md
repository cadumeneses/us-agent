# Execução de recomendadores pela interface

## Fluxo atual — Recomendadores (19/10/2026)

A aba **Recomendadores**, em `/recommendations`, reúne a escolha de RNFs e casos de teste. Depois de cadastrar projeto/perfil, tarefas e classificar histórias no fluxo existente, a pessoa escolhe o recomendador, o projeto e a história classificada. Há um atalho **Recomendadores** no detalhe do projeto, conservando esse contexto. Classificações que ainda precisam de revisão oferecem acesso à revisão antes de executar.

RNFs reutilizam o contexto/histórico operacional e as decisões já existentes. Casos de teste usam definição e base publicadas; campos compatíveis são preenchidos com identidade da história, módulo/operação, plataformas e domínio de aplicação. Havendo mais de um par de classificação, a escolha é explícita. Critérios de aceitação, RNFs de contexto e valores que não pertencem à taxonomia selecionada são completados no formulário. Não se infere ID taxonômico por nome nem se reclassifica a base.

Uma única configuração/base compatível carregada é selecionada automaticamente no fluxo de testes; múltiplas opções exigem escolha. O catálogo é o publicado exato da base e sua disponibilidade é consultada antes de habilitar a execução. Listas paginadas mantêm **Carregar mais**. Falta de publicação/base apresenta acesso à configuração, sem criar dados silenciosamente. A identidade/origem são preservadas no pedido, incluindo o identificador da classificação de origem; editar os campos da execução não altera o perfil salvo.

O resultado destaca título/passos dos casos de teste; origem, vizinhos, avaliação/adaptação e replay ficam em seções expansíveis. O resultado preserva o input; avaliação de testes não cria automaticamente um vínculo operacional com a história. A implementação de testes continua sendo a demonstração E21 com base sintética e método identificado, sem alegar reprodução empírica.

**Configuração, bases e histórico** abre as áreas existentes de configuração/importação e execuções com bases publicadas. Elas continuam em `/recommender-setup` e `/configured-recommendations`, acessíveis dentro da área Recomendadores. Links antigos com `classificationId` continuam abrindo o RNF daquela classificação. O registro B12 abaixo descreve o percurso técnico original.

B12a acrescenta **Bases publicadas**, em `/configured-recommendations`; B12b integra **Configurar e importar bases**, em `/recommender-setup`; B12c acrescenta avaliação por item com destino explícito e histórico. O fluxo anterior de RNFs por história continua em `/recommendations`.

## Preparação e acesso

Use a API com as migrations até 021 e a interface compilada nesta entrega. Definição e base podem ser publicadas na nova área, conforme os contratos de [definição](publicacao-definicoes.md) e [importação](importacao-bases.md). O botão de modelo RNF prepara o formulário; não publica exemplos automaticamente.

As chamadas usam a mesma origem e a [proteção central da API](seguranca-acesso.md), introduzida em B13a também nas rotas antigas. Não há chave interna embutida no JavaScript, variável `VITE_` com segredo ou armazenamento de credencial. Sem chave, o desenvolvimento exige conexão/Host locais diretos e as demais condições do contrato de acesso. Em ambiente protegido, as chamadas sem autorização são recusadas e a interface aguarda o login pessoal de B13b. Pessoas/sessões/permissões e isolamento organizacional continuam pendentes em B13; não habilitar o navegador distribuindo a chave de integração.

## Roteiro de demonstração

Antes de executar, abra **Configurar e importar bases**:

1. Em **Definições**, use **Novo RNF pelo modelo** ou carregue uma versão. Edite atributos, tipos e campos. Ao renomear IDs, revise explicitamente os vínculos do método. Enumerações usam uma opção por linha e preservam a opção vazia quando declarada.
2. Em **Taxonomias independentes**, informe identidade, origem, estrutura, regra de seleção e nós. Salve o rascunho válido, revise e publique. Uma publicação fica somente para leitura; **Criar nova versão** copia o conteúdo e exige outra versão.
3. Vincule atributos/campos à taxonomia publicada exata. Atributos científicos exigem correspondência explícita de cada ID para o nome do método de Felipe, com cobertura completa dos nós selecionáveis. Nomes de apresentação não criam equivalência.
4. Salve e revise a definição, depois publique. Edição local desabilita a publicação até salvar novamente. O hash é conferido na transação; se o rascunho mudou desde a revisão, carregue a versão atual e revise de novo.
5. Em **Importar base**, carregue uma definição publicada. Informe ID/versão da base, origem, autorização, formato e arquivo de até 5 MB. Mapeie identidade e atributos, uma chave de caminho por linha: `tecnologia.nome` em uma linha representa um cabeçalho literal; duas linhas representam um caminho aninhado. A leitura de conteúdo JSON de célula é explícita.
6. **Usar mapeamento de registros US-Agent** preenche `id` e caminhos `values → atributo` para JSON, ou colunas com IDs de atributos para CSV. Revise as escolhas; o botão não reconhece arquivos de outras fontes automaticamente.
7. Gere a prévia, confira valores, problemas, campos não mapeados e hashes. Exclua explicitamente cada registro necessário, inclusive para resolver duplicatas. Erros fatais exigem corrigir o arquivo. Publique a base revisada e use **Ir às execuções** para selecionar as versões.
8. Para retomar uma importação, use **Recuperar prévia preservada** com seu ID. A publicação usa a identidade e o conteúdo da prévia exibidos na revisão, independentemente dos campos atuais do formulário.

Trocar arquivo, mapeamento ou metadados invalida a prévia exibida e as exclusões locais. Alternar abas conserva os formulários; sair da página descarta alterações locais não salvas. Solicitações de escrita bloqueiam os controles e a navegação da área enquanto aguardam resposta.

Com definição e base publicadas, execute:

1. Abra **Bases publicadas → Nova execução** e escolha uma definição/versão. A seleção inicial fica vazia. O serviço carrega o pacote publicado e suas taxonomias exatas.
2. Escolha uma base/versão. São mostradas somente bases vinculadas ao mesmo ID, versão, formato e hash da definição escolhida. As listas carregam 50 versões por página; use **Carregar mais** quando houver outras. Uma lista parcial sem correspondência não afirma que nenhuma base compatível exista no banco.
3. Informe identificador e origem da entrada. Preencha os atributos declarados pela definição. Campos de contexto adicionais aparecem sem alterar a interface; campos de cálculo continuam limitados ao método implementado.
4. Nas listas, adicione ou remova valores explicitamente. Registros exibem seus campos; números e booleanos conservam seus tipos. Atributos opcionais só são enviados quando a pessoa escolhe informá-los. Taxonomias mostram nomes e caminhos, mas enviam IDs; a seleção respeita `any`/`leaf` do catálogo preservado.
5. Informe os pares módulo/operação e escolha explicitamente qual será usado nesta execução. A escolha não remove os demais pares. Alterar a lista de pares exige escolher novamente.
6. Clique em **Executar recomendação**. A API valida novamente hashes, dependências, tipos e regras do método. O UUID da requisição é mantido se a resposta falhar e a pessoa tentar novamente com os mesmos dados. Uma entrada alterada recebe outro UUID. A tela bloqueia envio e troca de definição durante a solicitação.
7. O resultado abre no histórico e identifica entrada, base, definição, hashes, origem, autorização da base e método. Confira a entrada preservada, vizinho, dimensões, candidatos e exclusões. Dimensões e candidatos são paginados na explicação.
8. Use **Verificar replay**. Resultado, explicação e projeção são comparados com os snapshots. Divergência ou erro não substitui a evidência original. **Baixar evidência JSON** exporta o envelope completo retornado pela API.
9. Reabra a execução por `?runId=<UUID>` ou pelo histórico. A leitura não depende de selecionar uma definição ativa. Atualizar o histórico preserva o formulário em preenchimento.
10. Em **Avaliar sugestões**, confirme o destino. **Entrada preservada** registra o vínculo genérico, sem escrever nas histórias operacionais. **História escolhida do US-Agent** exige escolher a história, clicar em **Revisar história de destino** e justificar a correspondência. IDs importados não preenchem essa escolha.
11. Após **Confirmar destino revisado**, registre observações e aceite ou rejeite cada sugestão. O destino vale para todos os itens e não pode ser trocado nessa execução. Se o contexto operacional mudar, a aceitação será recusada; faça outra execução e confirme o destino atual. Uma avaliação diferente também exige outra execução.
12. Consulte a decisão preservada e use **Baixar evidência com avaliações** para exportar execução, destino e avaliações. Falhas de rede mantêm observações e UUID para nova tentativa. Repetir aceitação não duplica o vínculo; rejeitar não associa o item.

Identidades importadas são as declaradas na fonte. Os IDs de história/classificação exibidos no resultado não se tornam links para registros operacionais. Use o mesmo espaço de identidade ao representar o mesmo artefato na entrada e na base; a interface não infere equivalência entre fontes.

## Estados e erros

- `blocked`: dados pendentes segundo o método, com motivos preservados.
- `no_candidates`: nenhum candidato compatível na base escolhida.
- `no_items`: o vizinho selecionado não tem RNFs elegíveis; não se troca o vizinho.
- `completed`: sugestões recuperadas, com utilidade e origem.

Erros HTTP são exibidos sem limpar a entrada; caminhos de validação enviados pela API também aparecem. Catálogos, definição, execução histórica e replay têm estados de carregamento/falha e nova tentativa. Respostas de uma definição ou execução anteriormente selecionada são descartadas após a troca. Não existe fallback para outra base ou para o histórico operacional.

Listas vazias de atributos obrigatórios e textos vazios podem ser estruturalmente válidos; a completude científica é avaliada pelo backend e pode resultar em `blocked`. A interface verifica tipos, nós selecionáveis, identificador/origem e escolha do par antes de enviar, sem recalcular a distância ou a política de elegibilidade.

## Verificação e limites

Os testes de interface exercitam formulários e interações em jsdom e o executor/importador reais. O check HTTP/PostgreSQL verifica persistência, integridade, decisões, rollback e as oito comparações completas. `npm.cmd run check:recommender-browser` percorre o vertical real no Edge headless com API/PostgreSQL local isolado, desktop/mobile, histórico e replay. As [capturas e evidências](entregas/010-avaliacoes-e-vertical-rnf.md) foram inspecionadas; isso não equivale a estudo de usabilidade, auditoria completa de acessibilidade ou reprodução empírica dos artigos.

Similaridade e utilidade não são probabilidade de correção nem avaliação científica de relevância. O formulário usa a política RNF implementada; nenhum método de Ednaldo foi inferido. As questões das fontes continuam na [matriz de fidelidade](referencias-e-fidelidade.md).

## Fechamento e continuidade

- **B12b concluído:** editores/publicação e importação CSV/JSON com prévia e exclusões; [entrega 009](entregas/009-configuracao-importacao-web.md).
- **B12c concluído:** [avaliações persistidas e destinos explícitos](avaliacoes-configuraveis.md), com deduplicação e original preservado.
- **B12 tecnicamente verificado no recorte RNF:** vertical percorrido em navegador e capturas desktop/mobile inspecionadas; [entrega 010](entregas/010-avaliacoes-e-vertical-rnf.md).
- **Continuidade atual: preparação B18**, com protocolo/referência e avaliação do segundo exemplo. B17b entregou avaliação/cópias rastreáveis. B13a foi entregue; pessoas/organizações permanecem condicionantes de bases restritas/uso multiusuário protegido, conforme as [pendências](pendencias-e-proximos-passos.md).

## Segundo método na interface

B17a habilita a demonstração de testes na configuração/importação/execução e no histórico comum. O [roteiro de testes](testrec-interface.md) descreve catálogo sintético, taxonomia independente, template, base/catálogo explícitos, formulário sem respostas de teste, artefatos/contribuições, replay e download. B17b acrescenta [decisões/cópias de testes](avaliacoes-testes.md), com destino na entrada preservada; o fluxo RNF mantém suas decisões e vínculos próprios. Métodos não suportados continuam desabilitados.
