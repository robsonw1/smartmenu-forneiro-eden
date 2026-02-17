-- Adicionar campos de endereço à tabela customers
-- Migration para suportar salvamento de endereço padrão

ALTER TABLE customers ADD COLUMN IF NOT EXISTS street VARCHAR(255);
ALTER TABLE customers ADD COLUMN IF NOT EXISTS number VARCHAR(20);
ALTER TABLE customers ADD COLUMN IF NOT EXISTS complement VARCHAR(255);
ALTER TABLE customers ADD COLUMN IF NOT EXISTS neighborhood VARCHAR(255);
ALTER TABLE customers ADD COLUMN IF NOT EXISTS city VARCHAR(255);
ALTER TABLE customers ADD COLUMN IF NOT EXISTS zip_code VARCHAR(20);

-- Criar índice para bairro para futura filtragem
CREATE INDEX IF NOT EXISTS idx_customers_neighborhood ON customers(neighborhood);
