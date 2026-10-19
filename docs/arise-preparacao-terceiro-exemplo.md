# ARISE — preparação do terceiro exemplo

19/10/2026. B19/E4. O usuário confirmou nesta conversa que o trabalho de Ademar pretendido é A26, DOI `10.1016/j.jss.2026.112987`. Isso fecha a identificação da referência, sem aprovação presumida do método ou da avaliação.

## Evidência disponível

**Atualização após o fornecimento do PDF e do Zenodo:** texto integral e dez arquivos públicos foram recebidos e conferidos. O estado atual é o [contrato e auditoria A26](arise-contrato-e-auditoria.md), com inventário, regras verificadas e divergências localizadas. O relato de busca abaixo é histórico e não representa mais falta de acesso ao artigo/suplemento.

O [resumo da editora](https://www.sciencedirect.com/science/article/pii/S0164121226002207) descreve perfis de projeto como entrada e recomendação de riscos como saída; informa Manhattan/k=2 e estudos com 17 projetos móveis e 24 profissionais. Esses números pertencem ao artigo e não são resultados do US-Agent nem tamanho sugerido de amostra para nosso estudo.

Os [metadados Crossref](https://api.crossref.org/works/10.1016%2Fj.jss.2026.112987) retornaram o DOI, título, autores e licença CC BY 4.0 para a versão publicada, com início em 15/06/2026. A consulta não trouxe relação com um repositório de artefatos. Isso não comprova inexistência de dados e não transfere automaticamente a licença do artigo para arquivos não identificados.

A consulta pública à API da editora retornou HTTP 429, sem texto utilizável. As buscas por DOI/título e materiais não localizaram um repositório confirmado. A busca no Drive conectado por `ARISE`, `112987`, `Ademar`, `risk identification` e `automated risk` também não identificou uma cópia confirmada do artigo; isso não constitui inventário exaustivo. Não foram contornadas restrições de acesso. O [registro da descoberta](../research/sources/arise-a26/discovery.json) separa metadados, observações do resumo e pendências. Não foi obtido texto integral nem dataset/código nesta etapa.

## O que obter e conferir antes de implementar

| Material/regra | Informação necessária | Aceite |
| --- | --- | --- |
| Texto completo e suplemento | Seções/tabelas/equações da versão A26 e endereço dos artefatos citados. | Associar cada regra a uma localização verificável na fonte. |
| Atributos de projeto | Lista, tipos, unidades, cardinalidades, categorias, codificação, faltantes e obrigatoriedade. | Formulário e importador derivados desses campos, sem inventar dimensões. |
| Representação e similaridade | Normalização, pesos, fórmula que transforma distância em similaridade e tratamento de vetor vazio. | Caso numérico recalculável; Manhattan/k=2 isoladamente não fecha o contrato. |
| Elegibilidade/vizinhos | Candidatos, exclusões, desempates, menos de dois candidatos e eventual uso de thresholds. | Política explicitamente identificada; não transportar filtros RNF automaticamente. |
| Catálogo e associações | IDs/textos completos de riscos e vínculos projeto–risco; identidade e licença dos arquivos. | Recuperar itens com origem, distinguindo associação desconhecida de lista vazia. |
| Agregação e saída | Score por risco, itens repetidos, ordenação, conteúdo retornado e eventual tratamento de riscos já conhecidos. | Oráculo numérico com item compartilhado por vizinhos e origem preservada. |
| Avaliação | Partições, relevância, ajuste de parâmetros, denominadores e resultados por unidade. | Separar reprodução do artigo de avaliação adicional do US-Agent. |

Não reutilizar por título um dataset de outro artigo de riscos, nem considerar qualquer projeto chamado ARISE como este método. Não cadastrar um motor chamado ARISE com pesos, fórmula ou riscos escolhidos localmente enquanto essas regras estiverem pendentes.

## Recorte de engenharia já definido pelo plano

O terceiro exemplo deve receber perfil de projeto independente de US, sprint ou `classificationId` artificiais. Deve reutilizar publicação de definição/taxonomias/base, validação e KNN comuns, snapshots, explicação e replay. Esse é um requisito do US-Agent; o resumo não basta para afirmar todos os detalhes da implementação original.

Próxima entrada útil após a auditoria: matriz projeto–risco, scripts e esclarecimentos de representação/scores/IDs indicados no contrato. O PDF e o suplemento já foram recebidos; as lacunas não devem ser preenchidas por suposição. Nenhuma mensagem foi enviada aos autores.
