# E26 — artigo fornecido e registro público associado

O usuário forneceu `3748522.3779891.pdf` em 18/10/2026. DOI conferido no PDF: `10.1145/3748522.3779891`; nove páginas; SHA-256 `cc895b9d7cbc49af9c63f0466f1050b82b432450bf0798307229c5a0cf23f445`. O PDF permanece fora do Git. A leitura e a comparação metodológica estão em [revisão E26](../../../docs/revisao-artigo-ednaldo-e26.md).

A seção *Artifacts Availability* e a referência [1], PDF p.8, apontam para [DOI conceitual Zenodo 16131516](https://doi.org/10.5281/zenodo.16131516). A consulta à API desse conceito retornou a versão [16133793 — Trainning dataset](https://zenodo.org/records/16133793), DOI `10.5281/zenodo.16133793`, publicada em 18/07/2025. O vínculo conceito/versão é preservado nos metadados. Não substituir o conceito pela versão sem registrar ambos.

Crédito conforme metadados: **Anonymous, Anonymous**. Licença declarada pelo registro: [Creative Commons Attribution 4.0](https://creativecommons.org/licenses/by/4.0/). Os quatro CSVs em `zenodo-16133793/` são cópias integrais, sem alteração de bytes, obtidas desse registro. `record-metadata.json` preserva a resposta da API; `inventory.json` registra origem, versão, tamanho, MD5 publicado e SHA-256 local. A normalização de cabeçalhos/IDs existe somente na comparação da auditoria e é identificada no relatório. Nenhuma modificação é atribuída aos autores dos arquivos.

Este registro lista somente dados, embora o artigo anuncie código/scripts/resultados públicos. A localização do código e do manifesto dos folds continua pendente. Os arquivos contêm diferentes granularidades e populações: suas contagens não equivalem automaticamente às 217 histórias/13 projetos/1.077 testes do experimento. O relatório preserva problemas de formato, lacunas e divergências de identidade; não escolhe registros a excluir nem preenche valores faltantes.

```powershell
npm.cmd run audit:testrec-source
npm.cmd run audit:testrec-source -- --replay docs/evidencias/b02c/source-audit.json
```

A auditoria é offline e não publica estes dados no método demonstrativo, que continua restrito a dados sintéticos, nem no banco operacional. A disponibilidade de dados não confirma reprodução do experimento.

## Versões adicionais consultadas em B02f

A resposta de `api/records/16133793/versions` está preservada em `versions-response.json` e lista os registros 16131517, 16133229 e 16133793. Os quatro CSVs de [16133229](https://zenodo.org/records/16133229) foram baixados sem alterações para `zenodo-16133229/`, com inventário separado e checksums conferidos. Crédito conforme metadados: **Anonymous, Anonymous**; licença declarada [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/). `record-metadata.json` anterior é uma extração do registro na resposta bruta preservada, identificada no inventário.

Não houve substituição/fusão de fontes. Os três arquivos anunciados no registro 16131517 têm checksums MD5 publicados coincidentes com os correspondentes de 16133229; seus bytes não foram baixados. A [comparação reproduzível](../../../docs/comparacao-versoes-ednaldo.md) explica diferenças, limites e próximos passos. `cas2.csv` anterior é idêntico ao CSV mais recente de critérios; os demais papéis apresentam conteúdo/encoding diferentes e não constituem uma base limpa por escolha automática da versão mais antiga.
