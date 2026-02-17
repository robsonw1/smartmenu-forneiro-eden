-- Permitir que cupons administrativos (sem customer_id) sejam usados por qualquer cliente
-- Cupons com customer_id = NULL são cupons gerais criados pelo admin
-- Cupons com customer_id != NULL são cupons automáticos específicos de clientes

ALTER TABLE loyalty_coupons
ALTER COLUMN customer_id DROP NOT NULL;

-- Adicionar comentário para clareza
COMMENT ON COLUMN loyalty_coupons.customer_id IS 'NULL = cupom geral (admin), UUID = cupom específico de cliente (automático)';
