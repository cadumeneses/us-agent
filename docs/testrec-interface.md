# Interface da demonstração de casos de teste

Data: 18/10/2026. B17a, [entrega 018](entregas/018-interface-casos-teste.md). A interface usa os mesmos endpoints de definição, importação, base e execução do RNF. Este recorte cobre configuração, publicação, execução, explicação, histórico, replay e exportação. B17b acrescenta [avaliações persistidas e cópias adaptadas](avaliacoes-testes.md), separadas do resultado bruto.

## Preparar o catálogo e a definição

Em `/recommender-setup`, abrir **Test catalogs**, selecionar um JSON sintético e usar **Review catalog file**. O formato está exemplificado em [synthetic-catalog.json](../research/examples/testrec-e21/synthetic-catalog.json). A revisão verifica UTF-8, chaves JSON duplicadas, estrutura mínima, IDs de teste distintos e origem sintética; mostra os artefatos e o hash dos bytes originais. A API continua responsável pela validação completa. Trocar o arquivo invalida a revisão anterior.

Informar **Catalog use declaration** e publicar o arquivo revisado. A declaração fica preservada junto do arquivo, sem concluir autorização de uso de material de terceiros. A publicação é imutável; alteração exige outra versão no arquivo. O catálogo pode ser inspecionado posteriormente e o arquivo original pode ser recuperado. Catálogos com outras origens continuam disponíveis pelos contratos da API, mas não são publicados por este fluxo sintético nem aceitos pela demonstração E21.

Na aba **Definitions**, usar **New test-case demonstration**, escolher ID/versão e revisar os oito atributos, bindings e parâmetros. Campos adicionais de contexto e taxonomias independentes reutilizam os editores existentes. A demonstração permite vincular, por exemplo, uma taxonomia aos critérios de aceitação; a publicação fixa os IDs, a versão e o hash. O método não aceita novos parâmetros de cálculo implicitamente. Salvar o rascunho antes de publicar o hash revisado.

O template RNF continua separado e preserva a política de Felipe. A demonstração de testes declara Manhattan, k=3, dados sintéticos e ausência de reprodução científica. A configuração Euclidiana e as questões Q01/Q02 continuam pendentes.

## Importar a base

Em **Import dataset**, escolher a definição publicada e carregar seu schema. Para testes, escolher também **Catalog and version**, com referência exata à publicação, e declarar origem sintética. Preencher o mapeamento CSV/JSON e gerar a prévia. **Use US-Agent record mapping** mapeia objetos com `id` e `values`; para a fixture [equations-synthetic.json](../research/examples/testrec-e21/equations-synthetic.json), o arquivo de importação deve conter o array `dataset.records`, não o envelope completo de pesquisa.

Cada registro da base precisa declarar `test_case_ids`: `[]` é conhecido e vazio; ausência é desconhecida e invalida a linha. Os nomes podem variar conforme os bindings da definição. A prévia mostra definição e catálogo preservados; publicar exige resolver erros e marcar exclusões explicitamente. Trocar catálogo, arquivo, mapeamento ou metadados invalida a prévia atual. Recuperar uma prévia pelo ID usa sua identidade e seus vínculos originais.

O catálogo é distinto da taxonomia de critérios e da base de perfis/associações. Importar uma base já rotulada não chama LLM nem refaz sua classificação.

## Executar e verificar

Em `/configured-recommendations`, escolher a definição e uma base publicada compatível. Selecionar explicitamente a publicação do catálogo exigida por essa base; outra versão/hash não aparece como opção compatível. A API verifica novamente a disponibilidade e a integridade de todas as dependências ao executar.

O formulário usa os atributos configurados. O alvo não apresenta campos de resposta de teste, não exige `classification_id` e não exige seleção de par RNF. Informar ID, origem e características do alvo. Valores de saída ficam retidos fora da requisição; a base mantém suas associações conhecidas. Uma falha de rede preserva entrada e UUID para repetir o mesmo pedido; alterar a entrada cria outro UUID. Não há envio automático ao trocar de base/catálogo.

O resultado apresenta os três vizinhos, distâncias/similaridades, vetor comparado, testes em Gherkin, scores da equação 4.3, contribuições por vizinho e metadados originais. Conteúdo importado mantém seu idioma; controles e explicações novos estão em inglês. Similaridade e score não são probabilidades de acerto. Estados bloqueado e sem testes associados têm mensagens próprias.

Histórico, **Verify replay** e **Download JSON evidence** reutilizam o fluxo comum. O histórico de testes pode ser aberto diretamente pelo `runId`, inclusive depois de retirar as dependências, sem carregar seus catálogos ativos. Retirada impede novos usos; o replay usa os snapshots. O leitor RNF específico continua recusando envelopes de teste; o leitor comum escolhe a apresentação pelo schema/método.

## Verificações e limites

```powershell
npm.cmd run build
npm.cmd run test -w @us-agent/web
npm.cmd run check:testrec-browser
```

O check de navegador usa Edge headless, build local e schema PostgreSQL descartável em `127.0.0.1:5432/us_agent`, sem ler `.env` ou usar provedores externos. Exige o executável de Edge no caminho Windows indicado no script. Escreve capturas/resumo em `tmp/testrec_browser_*` e remove somente o schema aleatório validado, preservando os arquivos de evidência.

A [evidência B17a](evidencias/b17a/summary.json) inclui publicação do catálogo com BOM/CRLF, taxonomia independente de critérios, template de testes, importação com exclusão explícita, seleção de base/catálogo, scores/artefatos, download e replay após retirada. Capturas foram verificadas em [desktop](evidencias/b17a/desktop-artifact.png) e [celular](evidencias/b17a/mobile-artifact.png), sem transbordamento horizontal nos tamanhos ensaiados. A [regressão RNF](evidencias/b17a/rnf-regression.json) conserva seu percurso com aceitar/rejeitar, vínculos, projetos e replay.

B17b permite confirmar a entrada como destino, aceitar/rejeitar testes e adaptar cópias com motivo e proveniência, conforme a [ADR 006](decisoes/006-avaliacoes-e-copias-testes.md). Esses comportamentos geram registros separados do resultado bruto. Os endpoints RNF não são usados para materializar testes. Também permanecem confirmação científica, dados/protocolo empíricos, métricas de qualidade e terceiro exemplo sem US.
