# Exercício de casos de teste — binding-check-0

Material técnico para revisão do roteiro. Este método é a demonstração sintética Manhattan/K=3 das equações E21; não reproduz o experimento Euclidiano original. O objetivo é configurar um segundo tipo de recomendação no fluxo comum, com consulta a este roteiro permitida para todas as pessoas.

Abra `tests/settings.json`, `tests/catalog.json`, `tests/dataset.json` e `tests/target.json`. Preserve o idioma original dos artefatos. Não gere novos passos ou classificações por LLM.

1. Em `/recommender-setup → Test catalogs`, selecione `tests/catalog.json`, use **Review catalog file**, informe a declaração de uso sintético contida em `settings.json → source.authorization.reference` e publique. O catálogo de artefatos é diferente da taxonomia de critérios e da base de perfis.
2. Em **Independent taxonomies**, crie a lista de critérios de `settings.json → taxonomy`, incluindo os IDs literais `required` e `unique`, nomes, descrições, origem, versão e pai vazio. Salve, revise e publique.
3. Em **Definitions**, escolha **New test-case demonstration**. Defina ID `binding-check-0-tests`, versão `1`. No atributo `acceptance_criteria`, selecione o tipo taxonômico e a publicação exata da lista anterior. Preserve os demais tipos, bindings e parâmetros do template. Salve, revise e publique.
4. Em **Import dataset**, selecione a definição, carregue seu schema e escolha o catálogo publicado neste exercício. Use ID/versão, origem e declaração sintética de `settings.json`. Importe `tests/dataset.json` como JSON com **Use US-Agent record mapping**. Confira os quatro registros e suas associações; publique a prévia revisada. Ausência de `test_case_ids` não significa lista vazia. Este arquivo já contém as associações conhecidas dos candidatos.
5. Em `/configured-recommendations`, selecione definição, base e catálogo compatíveis. Preencha a entrada com `tests/target.json`, preservando listas e IDs. O alvo não contém respostas de teste; este método não pede escolha do par módulo/operação RNF nem ID de classificação RNF.
6. Execute e inspecione vizinhos, contribuições, testes e seus artefatos originais. Use histórico, **Verify replay** e **Download JSON evidence**. Entregue as referências reais ao observador. Não aceite/rejeite ou adapte sugestões neste exercício: essas ações avaliam outra capacidade e não fazem parte deste roteiro.

Consulta ao roteiro é permitida; ajuda adicional segue a mesma regra do exercício RNF. Registre problemas, ajuda, pausas ou alterações de código sem ocultar tentativas incompletas. O gabarito do observador permanece separado.
