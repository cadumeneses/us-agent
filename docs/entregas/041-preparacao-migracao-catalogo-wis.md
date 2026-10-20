# 041 — Preparação da migração do catálogo WIS

20/10/2026. Continuidade da harmonização de taxonomias da entrega 040, a pedido do usuário. A migration 029 está incluída no release de produção com hash; não foi executada em produção.

A [preparação e roteiro](../migracao-catalogo-wis.md) descrevem a cópia aditiva para rascunhos do catálogo comum, identidade estável, hierarquia, textos/descrições e ordem preservados, desativação respeitada e retrato imutável da origem. O mapeamento de IDs e a atividade das versões permanecem consultáveis sem modificar projetos/classificações ou substituir snapshots anteriores. Versões vazias ficam registradas sem conteúdo inventado.

O novo campo opcional `selectable` evita selecionar operações desativadas ou organizadores vazios, com suporte no editor, formulário, validação e mapeamento científico. Catálogos anteriores não ganham campos implícitos, preservando hashes. Nomes de operações de até 180 caracteres e descrições longas são aceitos sem truncamento. O verificador pós-migration é somente leitura e acusa alterações na origem após a cópia.

O release possui 30 arquivos e exclui o SQL local não revisado `016_sheet_source_links.sql`. O runner aceita `--through` para aplicar até 028, publicar o parser compatível e só então executar 029. O ensaio local confirmou 38 nós, quatro versões, repetição pelo ledger, rollback de colisão, fonte intacta e evidência imutável. Build API/web, cinco testes de domínio, cinco de release, 17 web pertinentes, check HTTP de taxonomias e oito resultados RNF passaram. Nenhum pacote científico congelado foi alterado.

Próxima passagem operacional: ensaiar numa branch/cópia atual de produção, executar a sequência documentada no ambiente real e conferir os rascunhos. A migração definitiva da leitura/classificação/revisão para publicações comuns continua como incremento separado; preparar a cópia não significa concluir esse aceite nem o plano global.
