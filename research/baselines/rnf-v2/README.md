# Referência congelada do RNF v2

Captura inicial: 17/10/2026, sobre o código local anterior à extração do motor.

`reference.json` contém perfis de entrada, candidatos, seleção do par e resultado completo esperado em oito cenários. Os perfis `fa`, `f4` e `f5` representam as nove dimensões do exemplo da tabela 5.7 de Felipe Ramos (2019). Textos, sentenças de RNF, IDs e os demais cenários são sintéticos. Este material verifica compatibilidade do US-Agent; não é a base original nem uma reprodução das métricas da NFRec.

`manifest.json` registra método, commit de origem, hashes das fontes e inventário das alterações locais preexistentes. O commit isoladamente não descreve o código capturado, pois a árvore estava modificada. Os hashes das fontes se referem aos bytes locais da captura; mudanças de final de linha em outro checkout podem alterá-los sem alterar o comportamento. A verificação de compatibilidade usa as saídas congeladas.

Para verificar, sem banco ou provedor LLM:

```powershell
npm.cmd run check:nfr-baseline
```

O comando valida o hash do arquivo de referência, reproduz cada resultado completo, inverte a ordem dos candidatos e verifica que as entradas permanecem intactas. O hash de `reference.json` normaliza CRLF para LF para permitir checkout no Windows. A suíte de testes da API também executa essa verificação.

| Cenário | O que preserva |
| --- | --- |
| `table-5-7-nearest` | Nove dimensões e vizinho `f4` com similaridade 1. |
| `table-5-7-distance-six` | Vizinho `f5`, seis diferenças e similaridade `1 - 6/9`. |
| `nearest-without-items` | Mantém o vizinho mais próximo e retorna `no_items`. |
| `excluded-candidates` | Exclui a própria US, protótipos e revisão pendente. |
| `numeric-tie` | Mantém o desempate pelo menor ID numérico. |
| `taxonomy-version-compatibility` | Mantém a comparação por nome entre versões no método legado. |
| `missing-profile-field` | Entrada incompleta produz `blocked`. |
| `multi-label-second-pair` | Respeita o segundo par selecionado, sem fundir classificações. |

Resultados esperados não são recalculados pelo comando de verificação. Uma mudança metodológica futura deve manter esta referência histórica e acrescentar outra versão, com fonte, justificativa e comparação explícitas. Não corrigir um teste de regressão simplesmente substituindo a saída esperada pela saída nova.
