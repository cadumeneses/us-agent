# B02f — comparação das versões publicadas de E26

Versão `e26-source-version-comparison-v1`, 18/10/2026. Comparação de fontes separadas, sem reposição de dados, fusão de versões ou conclusão experimental.

## Proveniência e alcance

A consulta pública `https://zenodo.org/api/records/16133793/versions` retornou três registros do conceito `10.5281/zenodo.16131516`: 16131517, 16133229 e 16133793. A resposta bruta foi preservada em `research/sources/testrec-e26/versions-response.json`. Metadados dos três registros listam arquivos CSV; código/scripts/folds não foram localizados nessa lista. Isso não demonstra que inexistam em outra fonte.

A versão anterior 16133229 tem quatro arquivos (`uss.csv`, `usscas.csv`, `cas2.csv`, `tcs.csv`) sob CC BY 4.0. Foram baixados e verificados por tamanho, MD5 publicado e SHA-256 local, mantendo bytes e atribuição separados da versão 16133793. `record-metadata.json` dessa versão é uma extração identificada do registro na resposta de versões, não uma segunda resposta HTTP independente.

A versão 16131517 anuncia três CSVs com os mesmos MD5 publicados dos arquivos correspondentes de 16133229; seus bytes não foram baixados nesta etapa. A igualdade declarada de checksums é reportada como tal, sem afirmar conferência local de SHA-256 desses arquivos.

## Regras de comparação

Associar papéis de arquivos apenas para comparação: `uss.csv`/categorizado, `usscas.csv`/vínculos, `cas2.csv`/critérios, `tcs.csv`/associações. Isso não renomeia arquivos ou demonstra igualdade de conteúdo. Verificar headers, bytes/hashes e parse estrito individualmente em cada versão; não transportar contagens de uma para a outra. Parse bloqueado mantém contagens desconhecidas.

O plano `comparison-plan.json` fixa as 57 posições físicas sinalizadas em B02d, as seis com derivação literal B02e e nove pares de linhas multilinha selecionados para inspeção. Toda comparação conserva faixas de bytes, hashes, texto e contexto em ambas as fontes. A mesma posição física é ponto de investigação, não prova de identidade.

Em posições com cinco segmentos literais e terceiro segmento numérico, comparar projeto/ID da história/ID do registro exatamente. Diferenças de identidade não são normalizadas ou unidas. Segmentar por `;` não equivale a decodificar células CSV: o relatório mantém essa distinção. Registrar diferenças de padding separadamente de diferenças em caracteres, sem apagar nenhuma das duas.

Um ID final numérico na versão anterior, onde o segmento da mais recente não é numérico, é somente candidato de apoio à revisão. A versão anterior não ganha precedência automática; títulos e IDs permanecem inalterados em ambas. São vinte candidatos entre as 51 posições ainda pendentes, não vinte reparos aprovados.

## Grupos multilinha

Nos pares explicitamente selecionados, analisar os bytes completos da versão anterior usando cabeçalho e parser estrito existentes. Exigir um registro decodificado e conservar os valores exatos, inclusive a quebra de linha dentro do título. Registrar contexto anterior/posterior e verificar sequência numérica dos IDs para apoiar a delimitação local. Fazer a mesma tentativa na versão mais recente, conservando sua falha.

Nove grupos anteriores são decodificáveis com esse contexto. Isso confirma a decodificação daqueles trechos da versão 16133229; não recupera automaticamente registros de 16133793 nem confirma a semântica dos testes ou a amostra E26. Não copiar títulos, remover newlines, retirar aspas de IDs ou unir projetos pelo resultado dessa análise.

## Reprodução e continuidade

`npm run compare:testrec-sources -- --output diretorio-novo` exporta relatório e manifesto, exigindo originais/hashs e seleções preservadas. `--replay diretorio` confere bytes/fontes e recalcula a comparação. Execução é offline; download/consulta pública são atividades anteriores, registradas na proveniência. Recusa sobrescrita.

Próxima etapa: revisar propostas por fonte, definindo se haverá restauração de uma versão específica ou derivação local claramente nomeada. Toda adoção exige plano antes/depois e justificativa; não produzir um dataset híbrido sem nome/proveniência. Q01–Q03, código/folds, recorte, valores/artefatos completos e avaliação empírica continuam pendentes. Métodos e pacotes anteriores de Felipe/Ednaldo não são alterados.
