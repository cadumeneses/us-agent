# 039 — Consolidação dos três exemplos

Continuidade B22/B23: pacote técnico integrado, tutorial de operação em inglês, arquitetura executada e atualização das pendências. Não encerra avaliação empírica, classificação observada, estudo com participantes ou material acadêmico final.

## Entregue

- [Ensaio integrado](../avaliacao-integrada.md), pelo comando `evaluate:integrated`, reutilizando os avaliadores RNF/testes e o executor configurável de projeto. Dois bundles e quatro execuções de risco preservados originam 23 condições; nenhuma condição, anotação ou previsão nova é criada.
- [Protocolo versionado](../../research/integrated-demonstration-v1/protocol.md), pacote com entradas por bytes exatos, resultado/CSV/resumo/observações/manifesto e replay. As anotações sintéticas não são agregadas como qualidade empírica da plataforma.
- [Tutorial dos três recomendadores](../tutorial-three-recommenders.md), com os controles atuais da interface, projeto/histórias preparadas, configuração/importação, demonstrações e rastreabilidade. O gerador existente forneceu um lote `demo039` de RNF/testes; o roteiro atual não substitui o vínculo dos instrumentos de estudo antigos.
- Material importável de riscos com atributo adicional, derivado dos registros sintéticos preservados de 038. Nenhum registro ou associação nova foi inventado para essa derivação.
- [Arquitetura executada](../arquitetura-executada.md), incluindo políticas separadas, núcleo KNN comum, persistência, limites de tipos, decisões disponíveis e autorização ainda parcial.
- README e documentos de planejamento corrigidos para não apresentar o terceiro exemplo como inexistente ou o release de migrations como tendo somente 28 arquivos.

## Conferência e interpretação

O pacote [integrated-demonstration-v1](../evidencias/integrated-demonstration-v1/summary.md) conserva os oito resultados RNF de compatibilidade, os estados dos seis cenários de testes e resultado/explicação/representação das quatro execuções de riscos. Cada condição é repetida duas vezes. Os cenários bloqueados, vazios e as duas falhas deliberadas continuam nos relatórios.

O atributo configurado é conferido entre as duas condições de risco da versão 2, mantendo base, definição e identidade/origem da entrada. Comparar essa versão com a primeira também altera k; o relatório não atribui a mudança exclusivamente ao atributo.

O comando não usa banco/provedor e não revalida o navegador ou produção. Nenhum teste automatizado novo ou caso adicional foi criado. A conferência usa execução/replay do pacote, checagem TypeScript do CLI e os inventários existentes apropriados. Os pacotes científicos anteriores não são modificados.

B22a e B23a entregues neste recorte. B22 continua parcial por relevância/dados empíricos e previsões/revisões observadas; B23 continua parcial por extensão do estudo de esforço aos três casos, coleta humana e texto acadêmico final. A ausência desses dados é declarada como “não medido”, não como resultado positivo ou falha dos métodos.

## Operação

Esta entrega não aplica migrations, publica configurações, altera contas ou faz deploy. Para instalar o código 037/038, aplicar 027/028 antes do código, verificar o estado real do ambiente e publicar configuração/base apropriada. A migration release contém 29 arquivos SQL. Uma branch isolada usada em uma entrega anterior não prova a situação atual da instalação de produção.
