# B02h — conciliação conservadora das relações E26

18/10/2026. Versão `e26-conservative-data-reconciliation-v1`. Usa perfis e vínculos de critérios originais de Zenodo 16133793 e o CSV de associações candidato B02g, com fontes e hashes separados. Não altera originais, a derivação B02g, exemplos, método ou banco operacional.

## Identidades e evidências

Comparar projeto/história após aparar espaços e remover apenas um `#` inicial da história. Conservar caixa, zeros, hífens, sufixos e nomes de projeto. O relatório mantém valores originais, papel do arquivo, ordinal e linha física, além da chave usada na comparação. Não tratar a linha física do derivado como referência direta ao original: a cadeia B02g conserva o ledger necessário.

Materializar observações por história: linhas de perfil com pares módulo/operação e seus próprios flags, associações de testes e referências de critérios/RNFs sem interpretação adicional. Presença de linhas não confirma completude; ausência é `not_observed`, nunca associação sabidamente vazia. Correspondência de chave identifica evidência encontrada, não perfil cientificamente correto ou elegível.

`Sim`, `Nao` e campo ausente em `Mapeado? (SIM ou NAO)` são estados distintos por linha. Não converter ausência em `Nao`, descartar linhas, selecionar um par vencedor ou criar combinações de classificações. O campo tem granularidade da linha de origem; não inferir dele exclusão/inclusão da história inteira.

## Revisões localizadas

- Para histórias sem perfil, listar as linhas de associação e os candidatos de mesmo projeto com sufixo `-...`; listar separadamente candidatos com ID igual em outro projeto. São pistas para revisão, sem alias, cópia de perfil ou união automática.
- Para ID padronizado ausente, localizar títulos exatamente iguais em outras associações e conservar cada ID/projeto/história observado. Igualdade de título não autoriza preencher o ID. Distinguir suporte no mesmo projeto/história de suporte em outro contexto.
- Expor títulos idênticos com IDs padronizados distintos, incluindo conflitos dentro da mesma história. Não escolher ID por maioria, número da linha, ID do registro ou descrição de critério.
- `associations.ID`, `associations.ID_STD_TC`, `criteriaLinks.ID_STD_AC` e `criteriaLinks.ID_TC` são papéis distintos. A comparação literal de referência de teste com título/campo `ID_TC` das associações é diagnóstico limitado; zero correspondências não comprova inexistência de um vínculo. Falta uma ponte documentada entre essas representações.
- Conservar `RNFs` como referência escrita, incluindo `1.2`, sem inferir decimal, lista, taxonomia ou propagação por projeto. Não inferir domínio ou Gherkin.

O relatório explicita bloqueios e a fila CSV localiza decisões ainda necessárias. A fila não é um importador de alterações: editar o CSV não muda dados ou aprova uma correção. Nenhum reparo sem fonte é aplicado.

## Reprodução e fechamento

`npm.cmd run reconcile:testrec-data -- --output diretório-novo` verifica todos os hashes da cadeia B02g e exporta relatório/CSV/manifesto. `--replay diretório` refaz o resultado e recusa adulteração, inclusive com checksum atualizado. Não sobrescreve pacotes. A origem dos dados e a licença CC BY 4.0 declarada, com crédito **Anonymous, Anonymous**, estão preservadas nos inventários dos registros 16133793 e 16133229.

O aceite desta etapa é localizar os vínculos observados e tornar auditáveis os bloqueios restantes. Não é aceite da amostra experimental, reprodução Euclidiana, qualidade empírica ou validação da orientação. A prioridade posterior é obter fonte para campos/relações/catálogo e Q01/recorte/folds; materiais de Felipe, terceiro exemplo sem US e medição de configurabilidade permanecem no plano.
