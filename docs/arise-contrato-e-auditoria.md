# ARISE — contrato do método e auditoria A26

**Escopo esclarecido pelo usuário em 19/10/2026:** este material é referência para um exemplo de recomendação sem US. As lacunas abaixo limitam alegações de reprodução do artigo; não são pré-requisitos da demonstração US-Agent. B20/B21 devem avançar com perfil de projeto → riscos, base sintética identificada e escolhas locais explícitas, pelo fluxo comum. Não é necessário obter mais material dos autores para esse recorte.

19/10/2026. B19/E4. Fontes: PDF integral A26 fornecido pelo usuário (22 páginas, SHA-256 `7e76ace7a48bcd4b2b60633d00dcf354d5ab6deb034effd229215abe719841e3`) e [suplemento Zenodo 17093973](https://zenodo.org/records/17093973), citado como Sousa (2025) pelo próprio artigo. O fornecimento fecha a pendência de acesso ao texto e ao suplemento publicado; não constitui aceite científico nem reprodução empírica.

## Fontes preservadas

O [inventário](../research/sources/arise-a26/zenodo-17093973/inventory.json) registra versão, licença CC BY 4.0, tamanhos, MD5 publicados e SHA-256 calculados. Os dez arquivos foram baixados e verificados. Nove foram preservados com os metadados; a planilha de respostas de participantes permanece somente em `tmp`, pois não é necessária ao contrato do recomendador. O PDF fornecido permanece local, identificado por hash, fora deste pacote.

O depósito contém três diagramas, exemplos de vetores em XLSX, catálogo de riscos, características de projetos, resumo dos 17 projetos, dois PDFs estatísticos e respostas ao questionário. Não há `.R`, `.py`, `.ipynb` ou matriz completa projeto–risco identificada nesses arquivos. Isso descreve o registro consultado, não prova inexistência em outra fonte. A seção de disponibilidade (p.20 do PDF) anuncia scripts R e perfis anonimizados; scripts não aparecem na lista publicada deste registro.

## Regras verificadas no texto

| Aspecto | Fonte e regra | Limite para implementação |
| --- | --- | --- |
| Entrada/saída | §4, pp.7–9: perfil de projeto → riscos associados aos projetos vizinhos. | Entrada independente de US, classificação ou sprint artificiais. |
| Dimensões | Stage 1, pp.4–5, nomeia Environment, Architecture, Integration, Platform. Tabela 5 e suplemento usam Environment, Architecture, Integration, Method. | Preservar cada namespace; Platform/Method não são aliases confirmados. |
| Representação | Data Transformer, pp.8–9: comparação binária relativa ao alvo; coincidência recebe 1, diferença 0. Tabelas 6/8 usam referência de uns. | Não substituir por Jaccard, expansão hierárquica ou vetor global de presença/ausência por conveniência. Definição operacional de coincidência/ausência ainda exige conferência. |
| Similaridade | Equação 2, p.9: `sim = 1 - sum(abs(target_i - candidate_i)) / n`. | Para vetores binários não vazios de mesmo tamanho, resultado em [0,1]. A fórmula não especifica vetor vazio nem pesos por macro-dimensão. |
| Seleção | §4: selecionar os K projetos de maior similaridade e recuperar seus riscos. §5: alvo externo ao conjunto histórico. | Não herdar filtros de módulo/operação do RNF. Desempate, k maior que candidatos e eventual limiar não são definidos no trecho. |
| K | §5/Fig.4 usa K=3 para ilustração; §6.7 escolhe Manhattan/K=2 para a configuração final. | Separar os dois casos, sem tratar K=3 como configuração final. |
| Riscos | Stage 2 e `identified_risk.pdf` fornecem descrições/estrutura; §5 recupera riscos dos vizinhos. | Não preencher associação projeto–risco a partir de semelhança de título ou de fatores tecnológicos. Não há equação de score por risco explicitada para reproduzir a lista priorizada. |
| Avaliação | §6.1: 17-fold, precisão, recall e F1; §6.3 varia K de 1 a 17 e cinco distâncias; §6.4 descreve 17 projetos móveis. | Leave-one-out de 17 itens oferece 16 candidatos: execução de K=17 precisa de esclarecimento/código. Folds, empates, denominadores vazios e agregação não foram reproduzidos. |

O artigo descreve um framework mais amplo de gestão de riscos; a integração do recomendador não implica implementar todos os papéis/cerimônias Scrum nem uma rede Bayesiana. A menção a probabilidades em Stage 1 não fornece parâmetros para acrescentar inferência probabilística ao KNN.

## Auditoria numérica e divergências

O [relatório reproduzível](../research/sources/arise-a26/source-audit.json) lê diretamente o XLSX original, sem alterar células. A [transcrição visual da Figura 4](../research/sources/arise-a26/figure-4-review.json) é evidência ilustrativa, separada dos 17 projetos do estudo.

| ID | Evidência localizada | Consequência |
| --- | --- | --- |
| A01 | Vetores: Environment tem 8 colunas, Architecture 15, Integration 14, Method 9. Architecture repete `A1.1.1.1` e `A1.1.1.3`, com espaços finais em uma cópia de cada. | 46 colunas literais; deduplicar alteraria o denominador/peso. Não foi feita correção automática. |
| A02 | Linha 2 da aba Environment chama o alvo `PE`; as outras usam `PA`. Todas contêm uns. | Não afirmar identidade PE=PA sem evidência. O cálculo abaixo usa a linha 2 de cada aba apenas como diagnóstico. |
| A03 | Aplicar equação 2 à concatenação literal das 46 colunas produz P01=5/46≈0,1087; P03=4/46≈0,0870; P02=3/46≈0,0652. §5/Fig.4 publica 0,81; 0,72; 0,65. | A ordem inicial coincide nesse diagnóstico, mas os scores não são reproduzidos. Concatenação é convenção de auditoria; não foi confirmada como código dos autores. Não inverter scores para forçar concordância. |
| A04 | Fig.4 empata P02/P06 em 0,65 e destaca P02; os códigos dos riscos destacados não formam a lista exibida à direita. | Registrar empate e inconsistência; não inventar regra de desempate, score de risco ou aliases para fechar o exemplo. |
| A05 | Artigo alterna A/Q/M com E/A/P. `Project_features.pdf` contém `1.3` e `Data (2)` sem prefixo; resumo P01 contém `A1..1.1.3`, P08 repete `I2.1.2`; catálogo distingue literalmente `A5` e `A05`. | Preservar literais e contextos. IDs ilustrativos P01–P08 não identificam automaticamente os P01–P17 empíricos. |
| A06 | §6.1 implica 16 candidatos por alvo, mas §6.3 inclui K=17; disponibilidade anuncia scripts R ausentes da lista consultada. | Solicitar código/saídas por fold e matriz projeto–risco antes de alegar reprodução do estudo. |

São pendências de interpretação/reprodução localizadas, não uma conclusão de que o método é inválido. Não foram alteradas as fontes para acomodar o motor existente.

## Passagem para B20/B21

B19 avançou de referência/resumo para texto integral, inventário e contrato com lacunas localizadas. A parte empírica e algumas regras permanecem abertas. Próximas fontes úteis: matriz anonimizada projeto–risco dos 17 projetos, scripts usados, definição de representação/dimensões e esclarecimento dos scores/IDs ilustrativos. Sem isso, uma implementação pode ser apresentada apenas como adaptação explicitamente versionada, com convenções locais e dados sintéticos identificados; não como reprodução fiel de ARISE.

Uma futura adaptação deverá separar catálogo de riscos e associações da base; preservar texto, origem e versão; receber perfil de projeto sem US; registrar política, vizinhos e contribuições; e permitir replay. Não transformar ausência de associação em lista vazia, nem usar os riscos escolhidos pela equipe na Tabela 9 como resposta completa esperada do recomendador.

## Verificação

Com o ambiente Python ativado, executar `python scripts/audit-arise-source.py --verify`. Usa somente biblioteca padrão, não consulta rede e confere bytes contra metadados/inventário, lê as quatro abas e compara o resultado com o relatório preservado. A extração inicial dos PDFs usou `pypdf` localmente; os PDFs originais foram preservados, sem depender de OCR para corrigi-los.
