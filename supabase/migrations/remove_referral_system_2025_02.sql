-- Remover sistema de referência completamente
-- Nota: A tabela referral_program ainda existe por rastreamento histórico
-- Mas as funções e lógica de referência foram removidas do app

-- 1. Remover coluna referral_bonus_points de loyalty_settings
-- (Se a coluna ainda não foi removida na schema anterior)
ALTER TABLE loyalty_settings DROP COLUMN IF EXISTS referral_bonus_points;

-- 2. Comentário para documentar a remoção
COMMENT ON TABLE referral_program IS 'Tabela histórica - Sistema de referência foi removido em 2025-02. Mantida para auditoria.';
