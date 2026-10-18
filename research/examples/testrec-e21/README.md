# E21 — ilustração de dados e demonstração separada

Fonte: tese de Ednaldo Dilorenzo de Souza Filho (2021), tabelas 4.5–4.6, pp.55–56 (PDF 69–70). SHA-256 do PDF local: `f69cd99f2a68b2cc349bcb294f0873439d31c0a93a50272c3d6668740a1eee53`.

`table-4-5.json` transcreve os perfis ilustrativos e preserva os vetores binários da tabela 4.6 como referência. Não contém a base experimental nem as associações originais a testes. Campo `test_case_ids` ausente significa informação indisponível, não lista conhecida vazia. Critérios e RNFs mantêm os IDs numéricos da tabela como strings; não representam seus catálogos completos.

`synthetic-catalog.json` contém dois testes artificiais para verificar preservação de conteúdo e validação de referências. Não são casos recuperados do estudo original, e este arquivo não declara associações científicas aos perfis e1–e5.

O [rascunho de configuração](../../../config/recommenders/testrec-e21.draft.json) é aceito pelo contrato local de dados, sem publicação ou recomendação. `npm.cmd run check:testrec-contract` verifica quatro vetores e o hash do PDF quando disponível. A [documentação](../../../docs/testrec-contrato-dados.md) separa evidência da fonte, adaptações do US-Agent e decisões pendentes de similaridade/agregação.

`equations-synthetic.json` acrescenta perfis e associações inteiramente artificiais para a [demonstração das equações](../../../docs/testrec-equacoes-demonstracao.md). Não completa os dados ausentes da tabela original. `npm.cmd run check:testrec-equations` verifica ranking, recuperação do catálogo e auditoria aritmética; `--replay docs/evidencias/b16a/equations-demo.json` compara o pacote preservado. O perfil Manhattan ilustrativo não equivale à configuração Euclidiana selecionada pela tese e não está publicado na API/interface.
