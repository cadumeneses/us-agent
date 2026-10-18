# Ednaldo — contrato de dados e representação confirmada

Data: 18/10/2026. Escopo: **B15a**, início do segundo exemplo solicitado. Referência efetivamente conferida: tese E21, §§4.4.1 e 4.5.3–4.5.5, pp.46–48 e 55–60 (PDF 60–62 e 69–74). O PDF local manteve o SHA-256 registrado na [matriz de fidelidade](referencias-e-fidelidade.md).

Esta implementação valida dados e reconstrói vetores da tabela 4.6. **Não executa recomendação TestRec**, não publica esse método na API e não afirma equivalência com o artigo SAC 2026. Similaridade e agregação permanecem explicitamente pendentes.

## Configuração e representação

O [rascunho E21](../config/recommenders/testrec-e21.draft.json) utiliza os mesmos contratos de atributos, entradas, bases em memória e taxonomias já usados no núcleo configurável. Seus campos são:

| Vínculo | Papel e cardinalidade | Fonte ou decisão |
| --- | --- | --- |
| `story_id` | Contexto, um identificador da fonte | Identidade técnica do registro; sem ID de classificação operacional. |
| `module`, `operation` | Características, uma categoria cada | Tabelas 4.5–4.6. São dimensões, sem aplicar o filtro rígido RNF. |
| `platforms` | Característica, lista | Tabela 4.5 e texto sobre múltiplas plataformas. |
| `application_domain` | Característica, uma categoria | Um domínio por perfil no exemplo ilustrado; não generalizar a cardinalidade sem outra fonte. |
| `acceptance_criteria` | Característica, lista de IDs | Critérios multivalorados da tabela 4.5; catálogo completo de 59 templates ainda indisponível. |
| `nfrs` | Característica, lista de IDs de contexto | RNFs são entrada neste método. Não são as sentenças de saída do recomendador RNF. |
| `test_case_ids` | Saída, lista opcional de referências | Associação proposta pelo US-Agent ao catálogo de testes. Não é afirmação sobre o schema original do TestRec. |

Cada característica do alvo define uma dimensão binária. Os valores do candidato são comparados por igualdade, com namespaces separados; atributos extras do candidato não acrescentam dimensões. No alvo e5, as dimensões são módulo, operação, Web, domínio, CA49, CA50, RNF1 e RNF2. Os quatro vetores de e1–e4 reproduzem a tabela 4.6. Não são calculadas distâncias, similaridades, vizinhos ou scores nesta etapa, nem aplicada decisão de elegibilidade.

IDs de atributos podem mudar via bindings. Campos adicionais de contexto reutilizam o validador genérico. Critérios podem apontar para uma taxonomia independente com versão/hash, demonstrado nos testes com uma lista parcial de IDs ilustrados e descrições marcadas como indisponíveis. Essa lista técnica não é o catálogo completo do autor e não inventa hierarquia para os templates.

## Casos de teste e origem

O contrato local de catálogo preserva ID, título, texto Gherkin e, quando fornecidos, propósito, modo de execução e metadados adicionais. Sintaxe/campos do JSON, limite de tamanho e referências são escolhas de engenharia identificadas do US-Agent. O texto de passos conserva quebras de linha; não é executado nem validado por um parser Gherkin.

Os IDs identificam os testes no catálogo fornecido. Títulos iguais podem representar testes diferentes; IDs duplicados ou associações duplicadas são recusados. Uma associação não vazia exige o catálogo e a existência de todos os IDs. O catálogo é preservado como snapshot completo na evidência do contrato; não há publicação persistida desse catálogo nesta etapa.

Na tabela 4.5, as associações a testes não são fornecidas. O exemplo mantém o campo ausente, identificado como `not_provided` e `ids=null`. Uma lista explícita vazia é diferente: `known` e `ids=[]`. Não contar desconhecidos como zero na futura heurística de desempate. O [catálogo de dois testes](../research/examples/testrec-e21/synthetic-catalog.json) contém somente fixtures sintéticas; não foi associado aos perfis como se fossem relações originais.

## Conferir o incremento

```powershell
npm.cmd run check:testrec-contract
npm.cmd run check:testrec-contract -- --output tmp/contrato-testrec-novo.json
```

O comando confere os vetores e, quando o PDF local está disponível, seu hash. Sem o PDF, informa `sourceVerified=false`; não afirma nova conferência documental. A opção de exportação exige arquivo novo. Evidência preservada nesta entrega: [contrato verificado](evidencias/b15a/data-contract.json), com `sourceVerified=true` e `canRecommend=false`.

Não há consulta ao banco, modelos externos, alteração de interface ou importação online TestRec. O contrato de publicação existente continua recusando o método de dados E21 como se fosse um RNF executável.

## O que fecha a próxima etapa

1. **Q01:** confirmar a transformação da distância Euclidiana em similaridade, distinguindo a escolha de §5.6 da equação 4.2.
2. **Q02:** conciliar a equação 4.3 e as associações/valores do CT01; o recálculo B16a confirmou CT04=0,54. Definir identidade e contagem de associações sem inventar relações originais.
3. Obter catálogo/associações e dados autorizados, ou delimitar uma demonstração sintética com regras explicitamente identificadas. Confirmar qual versão da referência deve orientar o segundo vertical.
4. Definir política de candidatos, empate residual e comportamento com menos de três vizinhos com fonte/adaptação registrada; então implementar a política e integrá-la ao fluxo comum.

Q03, sobre agregação das métricas experimentais, permanece necessária para reproduzir a avaliação; não impede validar este contrato de dados. Na consulta de 18/10/2026, tentativas de obter texto integral pelas páginas DOI/full/PDF da ACM não retornaram conteúdo utilizável; a busca não confirmou repositório original de código/dados. Isso não demonstra que os materiais sejam inexistentes ou indisponíveis por outros canais. Não foram enviados pedidos aos autores. Os exemplos desta entrega continuam baseados explicitamente na tese local.

Continuidade B16a: a [demonstração local das equações](testrec-equacoes-demonstracao.md) usa este contrato, o núcleo KNN e associações sintéticas separadas. Não altera `canRecommend=false` deste contrato nem habilita sua publicação. Similaridade Euclidiana e fidelidade do ranking selecionado continuam pendentes.

Continuidade B15b: [catálogos podem ser publicados por API](catalogos-casos-teste.md), com bytes originais, declaração de uso e versões imutáveis. Esse serviço é separado do contrato local acima; ainda falta vincular o catálogo selecionado à base e à execução persistida do segundo método.
