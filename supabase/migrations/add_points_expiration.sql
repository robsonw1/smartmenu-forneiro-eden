-- Adicionar coluna de expiração em loyalty_settings se não existir
ALTER TABLE loyalty_settings ADD COLUMN IF NOT EXISTS points_expiration_days INTEGER DEFAULT 365;

-- Adicionar coluna de expiração em loyalty_transactions se não existir
ALTER TABLE loyalty_transactions ADD COLUMN IF NOT EXISTS expires_at TIMESTAMP NULL;

-- Criar índice para queries de expiração
CREATE INDEX IF NOT EXISTS idx_loyalty_transactions_expires_at ON loyalty_transactions(expires_at);
CREATE INDEX IF NOT EXISTS idx_loyalty_transactions_customer_expires ON loyalty_transactions(customer_id, expires_at);

-- Atualizar dados existentes: definir expiração em 365 dias (1 ano) para pontos não resgatados
UPDATE loyalty_transactions 
SET expires_at = CURRENT_TIMESTAMP + INTERVAL '365 days'
WHERE expires_at IS NULL 
  AND transaction_type IN ('purchase', 'signup_bonus');
