-- Adicionar coluna email à tabela orders se não existir
-- Necessária para fazer o match com customer_id usando email como chave

-- 1️⃣ Adicionar coluna email
ALTER TABLE orders ADD COLUMN IF NOT EXISTS email VARCHAR(255);

-- 2️⃣ Tentar extrair email do campo address (JSONB) se existir
-- Para registros antigos que possam ter email aí
UPDATE orders
SET email = (address->>'email')::VARCHAR(255)
WHERE address->>'email' IS NOT NULL
  AND email IS NULL;

-- 3️⃣ Criar índice para performance (usado para match com customers)
CREATE INDEX IF NOT EXISTS idx_orders_email ON orders(email);
