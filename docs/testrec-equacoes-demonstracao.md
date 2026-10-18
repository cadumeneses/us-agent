# Ednaldo — demonstração local das equações E21

Data: 18/10/2026. Escopo **B16a**, usando o contrato B15a. Método técnico: `us_agent_e21_equations_demo_v1`. A fonte é a tese E21, p.58 e pp.59–60 (PDF 72–74), com SHA-256 conferido. Esta demonstração não reproduz a configuração Euclidiana selecionada no experimento, nem substitui a conferência do artigo E26.

## O que executa

O [executor local](../apps/api/src/services/testrec-equations.ts) reutiliza a definição/validação/snapshots de B15a e o mesmo núcleo KNN utilizado pela política RNF. Calcula a distância Manhattan binária e a similaridade `1 − distância/n`, seleciona três vizinhos e agrega os testes por ID. O score de cada teste é a soma das similaridades dos vizinhos que o contêm, dividida por três. O resultado preserva numerador, denominador, suporte, contribuições por vizinho e conteúdo completo do artefato do catálogo. Não arredonda pesos antes de agregar.

| Regra | Origem e limite |
| --- | --- |
| Dimensões binárias orientadas ao alvo | Tabelas 4.5–4.6, já verificadas em B15a. |
| Manhattan normalizada | Equação 4.2 explícita; não é confirmação da transformação Euclidiana Q01. |
| Soma de similaridades dividida por K | Equação 4.3; K=3 neste recorte. |
| Mais testes associados quando a similaridade empata | §4.5.5. Conta IDs distintos validados, sem considerar títulos iguais como identidade. |
| Empate residual entre histórias e entre itens | Adaptação US-Agent: ID crescente por comparação determinística de strings, sem dependência da ordem da base ou do locale. |
| Exclusão do registro alvo ou de história com o mesmo ID | Proteção local contra autorrecomendação, identificada como US-Agent. Módulo/operação diferentes continuam elegíveis. Não detecta histórias clonadas com outros IDs. |
| Menos de três candidatos elegíveis | Proteção local: bloqueia, preservando K=3 e o denominador; não infere a política original. |
| Associação ausente em qualquer candidato elegível | Bloqueia: não é possível determinar sua contagem para desempate ou seus itens. Lista conhecida vazia é permitida. |
| Respostas do alvo | Proteção local: lista de testes não vazia no alvo bloqueia a demonstração. Referências de avaliação devem ficar separadas. |
| Similaridade zero | Adaptação US-Agent: mantém o candidato, sem limiar adicional. Itens podem ter score zero. |

Essas escolhas estão gravadas na evidência. O rascunho de dados original permanece `data_contract_only`; a demonstração não o publica como método científico confirmado. Não há mudanças em rotas, banco ou interface, nem transformação de testes, geração por LLM ou substituição de vizinhos sem testes. Três vizinhos com associações conhecidas vazias produzem `no_test_cases`; dados insuficientes produzem `blocked` com motivos explícitos.

## Dados e auditoria numérica

[equations-synthetic.json](../research/examples/testrec-e21/equations-synthetic.json) contém somente perfis e associações artificiais, separados da tabela da tese. Seus quatro candidatos elegíveis demonstram a heurística: `candidate-a` tem similaridade 1; os demais, 0,875. `candidate-c` e `candidate-d`, com dois testes cada, precedem `candidate-b`, com um. O empate residual é por ID. Um registro da própria história alvo é excluído. São recuperados dois testes sintéticos com seus textos preservados.

A tabela 4.5 continua sem associações inventadas. Tentar executá-la retorna `blocked` por `unknown_test_associations`.

Recalculando apenas as associações descritas no texto da p.58:

| Item | Similaridades que contribuem | Equação 4.3 | Texto da tese |
| --- | --- | --- | --- |
| CT03 | 0,50; 0,87; 0,75 | 0,706666… | 0,71 |
| CT04 | 0,87; 0,75 | 0,54 | 0,54 |
| CT01 | 0,75 | 0,25 | 0,42 |

CT03 e CT04 são aritmeticamente compatíveis. A dúvida Q02 fica delimitada ao CT01 e à conciliação com as figuras/código; não foi encerrada. Esse recálculo não reconstrói todas as associações das figuras 4.8/4.9. O valor 0,42 não foi incorporado como resultado esperado da equação. Q01 também permanece aberta: a igualdade eventual da ordem dos vizinhos não garante igualdade dos pesos agregados.

## Verificação e replay

```powershell
npm.cmd run check:testrec-equations
npm.cmd run check:testrec-equations -- --output tmp/equacoes-e21-novo.json
npm.cmd run check:testrec-equations -- --replay docs/evidencias/b16a/equations-demo.json
```

A exportação exige arquivo novo. O replay compara integridade, conteúdo e inventário de fontes, recalculando a demonstração. A presença do PDF pode variar entre ambientes; seu hash esperado permanece fixo e, se ele estiver disponível, deve coincidir. `sourceVerified=true` verifica os bytes locais da fonte, sem significar confirmação do artigo posterior ou dos resultados experimentais.

A [entrega 014](entregas/014-equacoes-ednaldo.md) registra os checks. B15/B16 completos ainda exigem decidir a política a integrar, confirmar fontes/dados e publicar/executar o segundo método no fluxo comum. Este incremento verifica regras explícitas e adaptações visíveis; não demonstra qualidade empírica ou generalidade da plataforma pela interface.

## Continuidade B15c/B16b

A [entrega 017](entregas/017-testes-no-executor-comum.md) publica a identidade `us_agent_e21_equations_demo_v1` e integra catálogo, importação e execuções aos endpoints comuns, reutilizando este cálculo congelado. O [novo contrato](testrec-execucoes-publicadas.md) registra a projeção interna para o contrato de dados, os snapshots completos e o replay. Não altera o pacote B16a nem o estado de Q01/Q02; interface e reprodução Euclidiana continuam pendentes.
