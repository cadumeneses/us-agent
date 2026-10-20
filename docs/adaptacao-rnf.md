# Adaptação versionada de RNFs

A migration 030 acrescenta `nfr_adapted_copies`, sem editar o resultado, a decisão, a base ou a sentença operacional original. Na avaliação de uma execução RNF, primeiro confirmar o destino e aceitar o item. **Adapt accepted NFR** permite informar uma sentença e justificativa e salvar outra revisão.

Cada cópia mantém o item original completo, o destino, a decisão aceita, motivo, ator, hash da requisição, revisão e referência ao hash da cópia anterior. Tipo/atributo do RNF original são preservados. O histórico e as cópias entram no download das avaliações. Essa adaptação não é aplicada automaticamente à história nem à base de referência; trata-se de um artefato separado associado àquele destino.

`POST /api/internal/recommendation-runs/:id/copies` exige `id`, `runSha256`, `targetSha256`, `decisionId`, `itemKey`, `previousCopy` (nulo na primeira revisão), `sentence` e `reason`. Item rejeitado, destino/hash divergente e revisão anterior desatualizada são recusados. Repetir a mesma requisição/UUID retorna a mesma cópia; reaproveitar o UUID para outro conteúdo retorna conflito. Requisições concorrentes são serializadas por identidade e execução. As linhas são imutáveis e a leitura confere a cadeia com a decisão/original preservados.

`GET /api/internal/recommendation-runs/:id/review` inclui `copies`. O fluxo legado de aceitação de RNFs continua preservado; esta adaptação está disponível para execuções com base publicada. O check `check:recommendation-runs` percorre duas revisões, repetição, conflitos, rejeição de item não aceito, imutabilidade, fonte preservada e replay original.
