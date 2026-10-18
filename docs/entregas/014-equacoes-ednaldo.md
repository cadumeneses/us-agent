# Entrega 014 — Equações E21 e auditoria do ranking ilustrativo

Data: 18/10/2026. Escopo **B16a**, continuidade de B15a, RF07/RF10 em demonstração local. Foram reconferidos o documento de requisitos fornecido e a tese E21. Requisitos derivados continuam propostas de engenharia; não há aprovação nova da orientação.

Foi implementada a [demonstração das equações](../testrec-equacoes-demonstracao.md), com o núcleo KNN compartilhado, três vizinhos, heurística por quantidade de testes, agregação explicável e catálogo preservado. Perfis/associações artificiais ficam separados da tabela original. Regras técnicas sem fonte conclusiva são identificadas como adaptações do US-Agent no resultado. Dados insuficientes/associações ausentes bloqueiam a execução, sem produzir recomendações inventadas.

A auditoria corrigiu a formulação anterior de Q02: CT04 resulta em 0,54 conforme o texto; CT01 resulta em 0,25 pelas associações textuais, frente a 0,42 reportado. O exemplo CT03 também coincide após arredondamento. Isso delimita a dúvida sem encerrar a conciliação com figuras/código.

## Evidências

| Verificação | Resultado |
| --- | --- |
| API | 96 testes passaram, incluindo cinco novos para fórmulas, limites binários, associações, desempate, invariância da seleção à ordem da base, conteúdo preservado e bloqueios. |
| Build API | TypeScript passou. |
| Demonstração | Quatro candidatos elegíveis, três vizinhos, dois testes sintéticos; tabela 4.5 permanece bloqueada pela ausência de associações. |
| Pacote | [equations-demo.json](../evidencias/b16a/equations-demo.json), hash de conteúdo `76e1f0b0e8ef3febbf4851800825743a0f5f00ec31383fe845f8f9e6a6a07f5e`. Inclui entradas, resultados, contribuições, regras, auditoria numérica e inventário de fontes. |
| Replay e integridade | Replay coincidiu; tentativa de sobrescrever a evidência foi recusada com `EEXIST`; cópia com similaridade adulterada foi recusada como evidência corrompida. |
| Regressão | Contrato B15a manteve seu hash; oito cenários RNF passaram; replay B14a manteve o hash `d26d28d5ee2da92f6449fe8fb18ed2bfdfd55192bb3a96fdb0a3e8b58a89a3dd`; sete arquivos RNF preservados byte a byte. |

Sem mudanças em interface, rotas, banco, migrations, fórmulas RNF ou dados operacionais. Não houve novo ensaio de navegador ou PostgreSQL. A verificação atual cobre o incremento local; não é avaliação de desempenho, estudo com participantes ou reprodução do experimento original.

## Aderência e próximo passo

O avanço está ligado ao segundo exemplo pedido em A3/A5: outra representação/política/saída reutiliza o núcleo, sem adicionar algoritmos ou ampliar infraestrutura. Contudo, **B16a não conclui o segundo recomendador integrado**. Q01 Euclidiana e Q02 CT01 continuam abertas, o texto integral de E26 não foi obtido, e os dados originais não foram importados. Não anunciar reprodução de TestRec.

Próximo: preparar a integração do segundo método com identidade e regras explícitas, mantendo a demonstração distinta da configuração científica a confirmar. Persistência do catálogo, publicação/importação e execução pela interface ainda faltam. Em paralelo científico, seguem dados/protocolo empírico RNF, terceiro caso sem US e revisão da orientação.
