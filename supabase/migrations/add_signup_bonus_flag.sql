-- Adicionar flag para rastrear se cliente recebeu bônus de cadastro
ALTER TABLE customers ADD COLUMN IF NOT EXISTS received_signup_bonus BOOLEAN DEFAULT FALSE;

-- Criar índice para queries rápidas
CREATE INDEX IF NOT EXISTS idx_customers_signup_bonus ON customers(received_signup_bonus);
