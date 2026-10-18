# B02d — preparação rastreável das fontes E26

Versão `e26-source-preparation-v1`, 18/10/2026. Escopo: revisão de dados e rascunho da lista de critérios. Não é limpeza aprovada, população experimental, importação operacional, avaliação empírica ou nova configuração científica de TestRec.

## Entradas preservadas

Usar somente os quatro CSVs da versão Zenodo 16133793, DOI `10.5281/zenodo.16133793`, ligada ao conceito `16131516` citado em E26. Conferir o inventário original, tamanhos e hashes de B02c; conservar metadados/CC BY 4.0. O script não modifica os originais. Divergência de bytes invalida a preparação; não atualizar os checksums para aceitar uma fonte diferente silenciosamente.

## Arquivo de associações com formato inválido

O parser CSV preservado encontra o primeiro erro na linha física 86. Para localizar os demais trechos a revisar, dividir o arquivo em **unidades de linha física**, conservando faixa de bytes, SHA-256 e contexto adjacente. Cobrir do cabeçalho ao último byte sem lacunas ou sobreposição; reconhecer CRLF, LF, CR e a última linha sem terminador. Conservar BOM e texto bruto nas evidências, removendo o BOM apenas ao validar o cabeçalho.

Cada unidade é inspecionada isoladamente com o cabeçalho original. `parseable_in_isolation` significa apenas que esse trecho isolado é analisável; não equivale a registro recuperado, aceito ou pertencente ao experimento. `requires_review` significa que a unidade precisa de inspeção de contexto. Um registro CSV multilinha válido pode gerar várias unidades nessa fila. Não contar unidades como registros, não remover linhas e não reconstruir aspas/células pelo conteúdo aparente.

O pacote conserva a falha do parse do arquivo completo e mantém desconhecido o número de registros recuperados/aceitos. Não exporta CSV “corrigido” a partir das linhas analisáveis. Reparos futuros devem especificar bytes/células antes/depois, extensão de registros multilinha, justificativa, autoria da revisão e regras de seleção, preservando tanto os originais quanto as versões derivadas. A inspeção de contexto não comprova o texto pretendido pelo autor.

## Perfis e identidades

Comparar histórias pela mesma regra conservadora de B02c: projeto/ID aparados e um `#` inicial retirado, sem resolver outros aliases. Manter projeto/ID brutos e ordinal/linha de cada observação.

Listar histórias sem algum campo módulo/operação/plataforma e aquelas com múltiplos valores não vazios. Múltiplos valores podem representar classificação multirrótulo, variações ou inconsistência: não concluir que são erros nem escolher uma linha vencedora. Guardar os pares módulo/operação realmente observados e suas linhas; não produzir produto cartesiano ou mesclar valores para fabricar perfis completos. Conservar vínculos não correspondidos com sua localização. O rascunho não preenche domínio, plataforma, RNFs ou associações por inferência.

## Lista de critérios de aceitação

O CSV de critérios é analisável integralmente e contém IDs/descrições. Criar rascunho da taxonomia comum como **lista**, sem relações hierárquicas. O schema da plataforma exige IDs iniciados por letra, portanto usar a regra local e reversível `ca_<ID literal da fonte>`; registrar os IDs original/local e linha/ordinal. Não converter IDs para números ou remover zeros à esquerda.

Copiar a descrição exata da fonte para nome/descrição do nó, sem traduzir, truncar ou reformular. Validar pelo contrato taxonômico existente; texto que não couber no contrato deve produzir erro e revisão, não adaptação silenciosa. A origem registra DOI, arquivo, licença e hash. O rascunho pode ser inspecionado como JSON, mas sua geração não publica a taxonomia, altera definições ou converte a base real em fixture sintética.

## Exportação e revisão

`npm run prepare:testrec-source -- --output diretorio-novo` exporta `report.json`, `acceptance-taxonomy.draft.json` e manifesto com hashes de entradas/fontes/artefatos. Recusar diretório existente. `--replay diretorio` confere integridade e fontes e refaz integralmente o conteúdo. Não usa `.env`, banco, rede ou provedor.

Encerrar esta preparação exige cobertura dos bytes/unidades, textos/IDs rastreáveis, validação do rascunho e repetibilidade. Isso não encerra Q01–Q03, a conciliação dos dados, o catálogo completo ou a população/folds de E26. Antes do ensaio empírico, ainda é necessário revisar os casos, justificar seleção/exclusões, obter valores/artefatos ausentes e confirmar o método. A avaliação RNF de Felipe, configurabilidade com participantes e o caso Ademar continuam no plano.
