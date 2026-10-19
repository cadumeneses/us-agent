# 035 — ARISE: fontes, contrato e auditoria

19/10/2026. Continuidade B19/E4 após o usuário fornecer PDF integral A26 e Zenodo 17093973.

## Resultado

O [contrato ARISE](../arise-contrato-e-auditoria.md) liga regras às páginas/equações e distingue o exemplo K=3 da configuração final Manhattan/K=2. Texto integral consultado, figura 4 inspecionada visualmente e dez arquivos do suplemento baixados com tamanho/MD5 conferidos. Nove arquivos públicos e os metadados foram preservados sob CC BY 4.0, com [inventário](../../research/sources/arise-a26/zenodo-17093973/inventory.json). O artigo fornecido permanece local; respostas ao questionário não foram adicionadas ao Git.

A [auditoria](../../research/sources/arise-a26/source-audit.json) lê o XLSX original, registra 46 colunas, dois cabeçalhos duplicados e alvo PE/PA; recalcula a equação sobre uma concatenação literal explicitamente diagnóstica, sem corrigir fontes. A [transcrição da figura](../../research/sources/arise-a26/figure-4-review.json) permite conferir empate e diferença entre união dos riscos dos vizinhos e lista exibida. Não é base empírica reconstruída.

O plano e a matriz de fidelidade agora registram acesso ao material atendido. Permanecem lacunas A01–A06 e ausência de matriz completa projeto–risco/código identificados no suplemento; B20/B21 não foram declarados concluídos. Não houve alteração de motor, importação operacional, migration, publicação ou coleta humana.

## Verificação

`python scripts/audit-arise-source.py --verify` passou: nove fontes preservadas conferidas, relatório idêntico e 46 dimensões literais. Também passaram 171 links locais sem destino ausente, `git diff --check` e `npm run check:scientific-index`, com os 198 hashes científicos anteriores preservados. O relatório reproduz um diagnóstico das fontes, sem alegar reprodução dos scores ou métricas publicados.

## Próxima passagem

Obter a matriz anonimizada projeto–risco e scripts citados, esclarecer representação/aliases/scores e desempates; então implementar política confirmada ou identificar explicitamente uma adaptação US-Agent com convenções locais. Não há necessidade de solicitar novamente o PDF ou suplemento já fornecidos.
