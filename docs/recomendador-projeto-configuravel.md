# Recomendação configurável por perfil de projeto

Entrega técnica B20/B21, vinculada a RF02/RF07/RF08. O exemplo inicial recomenda riscos; o motor lê os papéis e identificadores dos atributos, sem campos de risco ou de história embutidos no cálculo. As políticas anteriores de RNF e testes continuam versionadas separadamente.

## Utilização

1. Cadastre o projeto em **My Projects** e preencha seu perfil.
2. Em **Recommenders → Configuration, datasets, and history**, abra a configuração e escolha **New project-risk recommender**.
3. Defina ID, versão e nome. Ajuste os atributos, sua ordem, **Number of neighbors (k)** e os pesos. Um atributo novo com papel **Feature** participa do cálculo; não exige implementação específica.
4. Salve o rascunho e publique o conteúdo revisado. Alterações posteriores exigem outra versão.
5. Importe a referência em **Import dataset**, usando a definição publicada. **Download risk sample dataset** fornece três perfis sintéticos no formato de registros da plataforma; ele não publica dados automaticamente. Se acrescentar um atributo obrigatório, inclua-o também nos registros importados.
6. Escolha **Recommenders → Project risks**, o projeto e a configuração. Confira os campos preenchidos a partir do perfil e complete os atributos adicionais. Escolha a base publicada e execute **Recommend**; os valores do perfil são salvos antes da execução.
7. Confira os itens, os projetos vizinhos e as contribuições de cada característica. Histórico, download e replay usam os snapshots da execução.

Não é necessário criar história, sprint, tarefa, rótulo funcional ou classificação. A interface de execução manual de bases também aceita essa configuração sem projeto operacional, solicitando identificador e origem do perfil.

## Contrato implementado

Método `configurable_project_knn_v1`, versão `1`; adaptador `configurable-project-knn-v1`. A publicação verifica atributos e parâmetros, além das dependências taxonômicas. A configuração inicial está em [project-risks.draft.json](../config/recommenders/project-risks.draft.json); a referência sintética está em [project-risks.synthetic.json](../config/recommenders/examples/project-risks.synthetic.json).

| Parte | Regra |
| --- | --- |
| Características | Atributos de projeto com papel `feature`, obrigatórios, simples ou múltiplos; categoria, enumeração ou nó de taxonomia; representação explícita `presence`. |
| Contexto | Validado e preservado; não participa da distância. Texto e números permanecem contexto, sem conversão implícita para características. |
| Saídas | Uma ou mais listas obrigatórias de texto com papel `output`. Na consulta são listas vazias; na referência `[]` significa associação conhecida vazia. Associação ausente é inválida. |
| Limites | Até 100 atributos, 10.000 registros e 2.000.000 comparações de dimensões; exceder um limite impede a execução, sem truncamento silencioso. |
| Parâmetros | `k` inteiro de 1 a 100; exatamente um peso positivo, finito e no máximo 1.000 por característica. Os demais parâmetros declaram a política implementada por literais validados. |
| Ausências | Característica vazia ou ausente impede executar. Não vira zero nem é preenchida por inferência. Valores categóricos são preservados e comparados exatamente. |
| Vocabulário | União ordenada dos valores do alvo e da referência completa, separada por ID de atributo. Registrado no snapshot, sem colunas específicas de domínio. |
| Distância | Manhattan binária simétrica: soma de `pesoDoAtributo × abs(alvo − candidato)` por dimensão. O peso se aplica a cada dimensão do atributo. |
| Similaridade | `1 − distância / somaDosPesosDasDimensões`. Características extras do candidato também contam como diferenças. O vocabulário depende da base selecionada. |
| Elegibilidade | Exclui somente registro com ID exatamente igual ao da entrada. Não infere identidade entre IDs distintos; não há filtros configuráveis neste método. |
| Seleção | Até `k` vizinhos pelo núcleo KNN compartilhado; desempate por ID em ordem de pontos de código. Zero de similaridade não é descartado por limiar implícito. |
| Agregação | União dos textos associados aos vizinhos, por atributo de saída; suporte contado uma vez por vizinho. Ordem por suporte decrescente e hash do item. Não troca vizinho com saída vazia. |

O parâmetro `profile_sources` permite copiar fontes compatíveis do perfil operacional na primeira utilização. É uma ponte de preenchimento, não um cadastro de campos do motor: atributos novos podem ser preenchidos diretamente no formulário. Taxonomias exigem seleção por ID; nomes operacionais não são convertidos implicitamente em IDs.

Os perfis adicionais são salvos por projeto e versão da definição, com revisão otimista. Um salvamento desatualizado recebe 409 e oferece recarga. Alterar o perfil operacional depois do primeiro salvamento não sobrescreve silenciosamente o perfil específico desse recomendador. As execuções preservam seus valores independentemente de mudanças futuras.

## Evidência e limites

A [revisão de engenharia](evidencias/project-risks-2026-10-19/review.json) registra um projeto sem histórias, publicação/importação de referências sintéticas, alteração do vizinho por um atributo adicional, rejeições e replay. A [entrega 038](entregas/038-perfil-configuravel-e-riscos.md) registra também o percurso no navegador.

O exemplo comprova uma entrada alternativa à história e atributos efetivos de cálculo por configuração. Não reproduz o experimento de referência nem fornece probabilidade de ocorrência dos riscos. A representação binária simétrica, vocabulário da base, pesos, agregação e associações sintéticas são escolhas locais explicitamente versionadas. A [auditoria da referência](arise-contrato-e-auditoria.md) permanece separada da interface do produto.

Aceitação/rejeição operacional dos riscos, adaptação de seus textos e coleta humana não são implementadas por esta entrega. O resultado é uma sugestão rastreável para revisão. RF09 genérico, demais extensões de representação/filtros e o restante do plano não estão implicitamente concluídos.

## Disponibilização

Aplicar as migrations **027 e 028 antes do novo código**. A migration 028 permite execuções de esquema 3 na tabela compartilhada e acrescenta `project_recommender_profiles`; definições e bases continuam nas tabelas existentes. A validação ocorreu em branch temporária de produção, sem modificar produção. Configurações e bases usadas na conferência não são sementes automáticas do ambiente de produção.
