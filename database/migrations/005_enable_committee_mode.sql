-- O modo de comitê é suportado pela API e deve ficar disponível também nas
-- bases já migradas em produção. A migração 003 o havia desativado enquanto
-- os provedores de IA ainda não estavam disponíveis.
UPDATE execution_modes
SET is_active = TRUE
WHERE key = 'committee';
