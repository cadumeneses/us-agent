# ADR 004 — Destinos explícitos e avaliação imutável

Data: 17/10/2026. Estado: decisão de engenharia implementada em B12c; não representa aprovação metodológica da orientação.

Uma entrada importada pode conter `classification_id: "1"` sem identificar a classificação 1 do banco operacional. Usar esse campo como chave estrangeira implicitamente permitiria associar sugestões à história errada. Por outro lado, a aceitação precisa ter um destino rastreável, sem reescrever o resultado do método.

Adotar confirmação explícita por execução: entrada preservada ou classificação operacional escolhida, revisada e justificada. O destino confirmado é imutável e compartilhado por todos os itens daquela execução. A confirmação fixa a referência do resultado e, quando operacional, o hash da prévia do destino. A aceitação revalida o contexto; rejeitar não precisa criar ou manter vínculo operacional.

Manter execução, destino, decisões e vínculos em registros separados. Uma decisão por execução/item permanece imutável; reavaliação ou outro destino exige outra execução. UUID e conteúdo permitem repetir solicitações sem duplicar efeitos. A deduplicação operacional usa a classificação escolhida e a chave normalizada do RNF; a genérica usa definição publicada e entrada exatas, sem procurar equivalências entre fontes.

Registrar a sugestão original, notas, destino e efeito da aceitação no momento da transação. Não oferecer texto adaptado sem um contrato que também conserve original, motivo e autoria. Feedback não altera bases publicadas e não participa do replay científico do resultado bruto.

Preservar o fluxo RNF anterior e os sete arquivos inventariados. Usar os mesmos locks de classificação para coexistir com edição manual e aceitação legada. Não atribuir identidade pessoal à chave técnica; permissões e isolamento permanecem em B13. Detalhes executáveis: [avaliações configuráveis](../avaliacoes-configuraveis.md).
