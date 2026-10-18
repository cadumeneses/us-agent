# B02g — derivação candidata das associações públicas E26

18/10/2026. Versão `e26-reviewed-associations-v1`. Origem principal: registro Zenodo 16133793 indicado novamente pelo usuário. A saída é uma **derivação local candidata com duas versões identificadas**, não um arquivo original dos autores ou uma base experimental validada.

## Decisões e alcance

O plano fixa hashes e faixas de bytes antes de executar qualquer mudança. Preserva todos os bytes recentes fora das 48 faixas revisadas. Seis faixas mantêm as cinco células literais recentes sob a convenção B02e; as outras 42 adotam células de registros específicos da publicação anterior 16133229, incluindo nove registros multilinha. A escolha trata sintaxe inválida comprovada, sem procurar obter as quantidades ou métricas do artigo.

Cada substituição precisa da mesma posição revista, do mesmo ID numérico do registro e do mesmo ID literal da história em ambas as fontes. As diferenças de aspas no nome do projeto ficam identificadas por decisão; não há tabela de aliases entre projetos. A linha física sozinha não comprova identidade. Toda faixa e cada célula adotada são verificadas de novo contra os bytes publicados preservados.

Quando o trecho anterior é CSV válido, usa-se somente a decodificação estrita existente. Para títulos anteriores não delimitados com aspas internas, o plano declara as cinco células literais e a convenção de transporte: somente o título pode conter aspas, nenhum separador ou quebra de linha pode tornar os limites ambíguos. Isso adota uma interpretação local explícita, sem atribuir intenção aos autores. Texto estranho, repetido ou com grafia irregular permanece intacto. Títulos adotados podem diferir da versão recente; o ledger conserva ambos os trechos, fonte e células antes de qualquer uso operacional.

As 57 unidades físicas sinalizadas ficam cobertas, com nove pares formando registros multilinha completos. O CSV inteiro precisa passar pelo parser estrito e preservar os IDs de registro consecutivos e únicos; nenhuma linha é descartada. Células de ID padronizado vazias continuam vazias. Cada patch permite recuperar byte a byte o original recente, incluindo sintaxe inválida e padding.

## Evidência e limites

O pacote contém CSV candidato, relatório com ledger, auditoria dos quatro papéis usando esse CSV e os outros três arquivos recentes, e manifesto. A auditoria dessa combinação é explicitamente derivada, separada da auditoria original B02c. Não há publicação no banco, seleção de folds, resolução de campos faltantes/conflitos, criação de domínio, catálogo completo ou Gherkin. O conjunto não está pronto para execução científica.

O pacote também registra a revisão visual das figuras E21 4.8/4.9 e E26 3, feita nos PDFs locais cujos hashes foram conferidos. As arestas e similaridades ilustrativas exibidas são transcritas em `research/examples/testrec-figures-v1/associations.json`; o núcleo KNN e a agregação existentes recalculam seleção e scores. Não se calculam novas distâncias a partir das tabelas de atributos. CT01/TC01 tem dois apoios em cada exemplo e arredonda a 0,42. E21 4.8 sem heurística difere de E21 4.9/E26 3 com heurística. A figura E21 4.8 mostra CT05=0,25 onde pesos/aresta/equação produzem 0,29: conservar essa divergência, sem corrigir o documento. Q01 e Q03 permanecem abertas; o código/experimento original não foi obtido.

## Reprodução

`npm.cmd run prepare:testrec-reviewed -- --output diretório-novo` exporta o pacote offline e recusa sobrescrita. `--replay diretório` verifica fontes, artefatos e recálculo exato; atualizar apenas o checksum de um resultado adulterado não basta. A inversão exige identidade byte a byte com o CSV recente. Os arquivos originais e pacotes anteriores não são alterados.

A revisão é técnica por Codex, sem aprovação atribuída aos autores ou à orientação. A prioridade seguinte é conciliar as relações agora legíveis, identificar o catálogo e recorte experimental e confirmar a política Euclidiana. Felipe, configuração com participantes e terceiro caso sem US continuam no workflow.
