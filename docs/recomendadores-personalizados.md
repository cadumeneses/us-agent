# Recomendadores personalizados — RF0XX (recorte KNN)

21/10/2026. O usuário pode instanciar recomendadores por configuração, com campos, taxonomias, pesos, número de vizinhos e bases de referência próprios. A criação reutiliza o método executável `configurable_project_knn_v1`, as publicações versionadas e o histórico existentes.

## Criar e utilizar

1. Em **Recommenders**, abra a aba **New recommender**, em `/recommenders/new`.
2. Na etapa **Name**, informe um nome, como **Architecture recommender**. O ID é gerado automaticamente; ID e versão podem ser ajustados em **Advanced: identifier and version**.
3. Em **Inputs**, configure as características a comparar: categorias, opções ou taxonomias publicadas, com um valor ou uma lista. **Add comparison input** acrescenta campos. **Fill from an existing project** permite preencher categorias a partir do perfil cadastrado. Campos taxonômicos usam os IDs da publicação escolhida. **Additional information (optional)** permite coletar contexto sem afetar a similaridade.
4. Em **Recommendations**, dê nome aos tipos de itens recomendados. **Add recommendation type** acrescenta outras listas de saída.
5. Em **Matching**, ajuste **Number of neighbors (k)** e o peso de cada entrada. A etapa **Review** apresenta um resumo e permite voltar para corrigir campos. **Create recommender** salva e publica a configuração revisada.
6. A conclusão oferece **Add reference data**, que abre a importação com a definição publicada já selecionada. A [revisão UI/UX](revisao-criacao-recomendadores.md) registra critérios e capturas do novo percurso.
7. Escolha **Import CSV or JSON** ou **Build from registered projects**. Na segunda opção, carregue os projetos e acrescente os desejados. Confira os atributos e informe as saídas associadas a cada projeto. O botão **Use project names as recommendations** permite recomendar os próprios projetos, quando esse for o objetivo. Confirme a revisão das saídas de cada registro; uma lista vazia significa ausência conhecida de associações.
8. Use **Use selected project records**, informe identidade/versão da base e sua origem e declaração de uso. Gere a prévia, revise os registros e publique. Alterar os registros invalida o arquivo preparado e exige nova revisão. As edições são destinadas à base, sem salvar alterações nos projetos de origem.
9. **Run this recommender with this dataset** abre o formulário gerado pela configuração. Também é possível abrir a instância pelo nome em **Your published recommenders**, na tela principal. Informe um perfil manual ou escolha um projeto cadastrado; selecione a base compatível e execute **Recommend**.

Por exemplo, um recomendador de arquiteturas pode comparar `technology` (categoria) e `scope` (enumeração), com pesos 1 e 3, e recomendar `architectures` (lista de texto). Os registros de referência precisam conter as características e as arquiteturas associadas; o cadastro de uma taxonomia não cria essas associações.

## Cobertura do requisito

| Critério | Comportamento entregue |
| --- | --- |
| Cadastro genérico | Criação independente dos templates de RNF, testes e riscos; identidade, campos e configuração KNN editáveis. |
| Múltiplas instâncias | Cada definição publicada aparece como opção própria na tela principal. Formulários, bases compatíveis e perfis salvos são vinculados à definição e versão. |
| Entradas dinâmicas | Categorias, enumerações e taxonomias como características; campos adicionais de contexto, inclusive opcionais. Os formulários seguem a configuração publicada. |
| Fonte de conhecimento | Importação CSV/JSON existente e montagem revisada a partir de projetos registrados. Publicação explícita da seleção e da origem. |
| Algoritmo executável | KNN com `k` de 1 a 100 e pesos positivos até 1.000 por característica, usando a distância Manhattan sobre presença categórica. |
| Execução e evidência | Saídas associadas aos vizinhos, contribuições por característica, snapshots, histórico e replay existentes. |

O algoritmo disponível neste cadastro é KNN. Não há envio de código arbitrário nem seleção de algoritmos ainda não implementados. Características influenciam a distância; filtros rígidos configuráveis de elegibilidade não foram acrescentados. Texto livre e números podem ser contexto, mas não características de similaridade. As saídas são listas de texto. As regras de distância, desempate e agregação continuam identificadas pela versão existente do método.

**Download example for this recommender** gera exemplos sintéticos com os campos obrigatórios e IDs taxonômicos selecionáveis da publicação. O download não publica uma base nem comprova qualidade das recomendações.

## Validação e disponibilidade

- 84 testes da interface aprovados, incluindo configuração, exemplos taxonômicos, importação, isolamento entre instâncias, execução pelo motor real e recuperação de falha na criação.
- O assistente também foi verificado no Edge com API e PostgreSQL locais: 25 verificações de layout e 12 verificações de fluxo, com publicações sintéticas em schema descartável. A [revisão UI/UX](revisao-criacao-recomendadores.md) registra o recorte e as evidências.
- 157 testes da API aprovados. Para o teste de indisponibilidade do registro organizacional, a suíte foi executada com `DATABASE_URL` temporariamente apontando para uma porta local indisponível, sem alterar arquivos de ambiente. O PostgreSQL padrão acessível causava a falha dessa precondição.
- Build da API e da interface aprovado.

A entrega modifica a interface e reutiliza os contratos de backend existentes; não exige migration adicional. O ambiente precisa oferecer o backend configurável e as migrations correspondentes, incluindo 028. Não houve deploy nem alteração de dados de produção nesta entrega.
