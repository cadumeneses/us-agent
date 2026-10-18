# 028 — Roteiros e materiais executáveis de configuração

18/10/2026 — B18c, preparação B14/B18/RQ05. Estado: dois exercícios revisáveis com arquivos importáveis e verificação offline entregues; protocolo/material final, vínculo da coleta, percurso no navegador e estudo com pessoas permanecem pendentes.

## Resultado

O [lote B18c](../roteiros-configuracao.md) contém 15 arquivos: materiais e roteiros dos dois exercícios, guia/gabarito do observador, fichas vazias, manifesto de materiais e verificação técnica. A geração exige namespace e recusa sobrescrita. Os originais e o pacote B18b não são alterados.

O exercício RNF pede uma taxonomia de contexto e atributo adicional; o resultado permanece igual ao caso de compatibilidade sem esse contexto. Testes pedem catálogo sintético, taxonomia independente, base de quatro registros e alvo sem respostas; vizinhos/scores da demonstração permanecem iguais. A fábrica usa publicações em memória, os importadores reais e o executor comum; não publica no banco ou faz chamadas a provedores.

Os materiais fornecem passos explícitos e medem potencialmente configuração orientada por manual. O gabarito fica separado, com resultados técnicos; checkpoints têm status pendente e não há tentativas/tempos de pessoas inventados. O material do observador propõe regras de erro, ajuda e registro de não iniciadas, sem fixar amostra/tempo ou atribuir validação antecipada à orientação.

## Verificação

- 154 testes API passaram, incluindo quatro testes de importação/execução dos materiais, preservação de fontes, isolamento de namespaces e rejeição de associações desconhecidas; build API passou.
- Replay integral do lote, repetibilidade de todos os arquivos, recusa de sobrescrita, corrupção do gabarito com checksum atualizado e validação de namespace/argumentos passaram.
- O lote foi verificado offline; seu percurso no navegador não foi realizado nesta entrega. Não há mudança de método, interface, banco ou resultado científico.
- As oito referências RNF e os replays B14a/B18a/B18b/B02h permaneceram iguais. O índice Git conferiu 151 hashes preparados e a checagem de whitespace passou, preservando os CSVs inventariados. Alterações em staged; os três PDFs locais continuam fora do Git.

Hash determinístico da verificação: `edac5500c6b57315474f812e3587b51b51cb8069b805d829c6a7252b02847255`.

## Continuidade

Consolidar protocolo/material de coleta em nova versão que vincule esses arquivos ao analisador, preservando B18b. Fechar parâmetros metodológicos, conferir o lote na instalação real e só então realizar observações. Confirmar material/método de Ademar para o terceiro exercício e acompanhar fontes experimentais de Felipe/Ednaldo. A versão completa pretendida pelo professor continua dependendo dos três exemplos e de avaliação empírica, além da preparação técnica aqui entregue.
