# B02e — normalização reversível de codificação CSV

Versão `e26-literal-title-encoding-v1`, 18/10/2026. Convenção local de transporte para seis unidades isoladas, tecnicamente revisadas no US-Agent. Não é confirmação da intenção dos autores, correção semântica, validação do professor ou reprodução experimental. Os dados originais e B02c/B02d ficam imutáveis.

## Decisões e evidência

O plano `encoding-plan.json` enumera explicitamente as linhas físicas 292, 308, 312, 324, 332 e 338. Cada decisão contém o hash da fonte completa, tamanho, hash do trecho/contextos adjacentes e as cinco células literais antes da transformação. Não se descobrem novas decisões automaticamente em cada execução. Hashs ou conteúdo divergentes bloqueiam a operação; a mesma versão não é reaplicada à saída já transformada.

Essas unidades têm cinco segmentos separados por quatro `;`, três células de identificação sem aspas, ID de linha numérico e último segmento numérico com eventual padding. O título tem aspas internas sem começar por aspas. Ambas as unidades adjacentes são analisáveis isoladamente e seus IDs numéricos ancoram a sequência anterior/atual/posterior. Esses controles limitam o alcance da convenção; não provam limites lógicos de todos os registros do arquivo danificado.

A interpretação adotada é explícita: nesses seis trechos selecionados, os cinco segmentos são células literais. Aspas do título são caracteres de dados, e não delimitadores já válidos. A transformação envolve o título com aspas e duplica cada aspa interna conforme o encoding CSV. Depois, o parser estrito precisa retornar exatamente as cinco strings literais, incluindo espaços, aspas repetidas e trechos estranhos. A edição pode modificar a representação em bytes, mas não o conteúdo dessas células sob essa convenção. A intenção original desses caracteres continua não confirmada.

Exemplos de conteúdo estranho são mantidos: repetição do nome de projeto no final do título da linha 292 e aspas repetidas na 308/332/338. Não se simplificam aspas, corrigem redações ou traduzem nomes para tornar a base mais plausível. Não se repara a linha 86, cujo ID final contém aspa, nem unidades multilinha como 876–877. Nenhum registro é removido. A saída continua com formato integral inválido e não é uma base apta a importação/avaliação.

## Antes/depois e inversão

O relatório preserva snapshots do plano, hashes/tamanhos de fonte/derivado e cada patch: faixas de bytes na fonte/saída, bytes antes/depois em base64, hashes e células literais. Trechos fora dos patches são copiados byte a byte; terminadores de linha e padding são preservados. A inversão valida a saída e cada patch, reconstrói o arquivo inteiro e exige igualdade de tamanho/SHA-256 com o original. Não basta obter um CSV semanticamente equivalente.

O comando exporta um diretório novo com `report.json`, `test-cases.transport-view.csv` e `manifest.json`. O nome *transport-view* identifica a derivação local; não substitui o arquivo fonte. Replay valida fontes/artefatos, refaz a transformação e a inversão. Recusa sobrescrita, alterações de conteúdo e planos incompatíveis. Não acessa banco, `.env`, rede ou provedor.

## Limites preservados

As unidades que exigem inspeção isolada passam de 57 a 51, mas isso não equivale a seis registros corretos nem a 51 registros defeituosos. Registros recuperados/aceitos e limites lógicos seguem desconhecidos. As faltas, múltiplos valores e aliases de perfis não são resolvidos pelo encoding.

Na revisão adicional dos vínculos, `ARTools/#11971` tem candidato com mesmo ID em `AR Tools Web/#11971`, linha 395 do categorizado. Mesmo ID em projetos diferentes não autoriza fusão. As oito ocorrências do vínculo conservam o projeto original. `SGCond/SGC-US30`, em duas ocorrências, não recebeu perfil fabricado. Os dois casos continuam pendentes; a normalização de títulos não aplica aliases.

Antes do experimento ainda são necessários reparos/decisões evidenciados para os demais trechos, catálogo/valores completos, recorte/código/folds e Q01–Q03. Os métodos e pacotes de Felipe/Ednaldo são preservados. Esta convenção deve permanecer identificada separadamente de qualquer reprodução do TestRec.
