-- ============================================================
-- CONSTRAINT: Tornar telefone obrigatório
-- Data: 10/02/2026
-- ============================================================

-- Adicionar constraint para telefone não ser NULL
ALTER TABLE customers
  ADD CONSTRAINT phone_required 
  CHECK (phone IS NOT NULL AND LENGTH(phone) >= 11);

-- Comentário de rastreabilidade
COMMENT ON CONSTRAINT phone_required ON customers 
  IS 'Garante que todo cliente registrado tem um número de telefone válido com mínimo 11 dígitos';
