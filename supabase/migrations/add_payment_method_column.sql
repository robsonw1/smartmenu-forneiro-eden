-- Adicionar coluna payment_method à tabela orders e extrair dos dados armazenados
-- Isso permite concontar corretamente qual foi o método de pagamento utilizado

-- 1️⃣ Adicionar coluna payment_method se não existir
ALTER TABLE orders ADD COLUMN IF NOT EXISTS payment_method VARCHAR(50) DEFAULT 'pix';

-- 2️⃣ Tentar extrair payment_method do campo address (JSONB) se existir
-- Para registros que têm paymentMethod armazenado na metadata do address
UPDATE orders
SET payment_method = (address->>'paymentMethod')::VARCHAR(50)
WHERE address->>'paymentMethod' IS NOT NULL
  AND (payment_method IS NULL OR payment_method = 'pix');

-- 3️⃣ Para pedidos PIX confirmados via webhook, garantir que é 'pix'
-- PIX orders têm payment_status iniciado pelo webhook
UPDATE orders
SET payment_method = 'pix'
WHERE (status = 'confirmed' OR payment_status = 'pix')
  AND payment_method IS NULL;

-- 4️⃣ Criar índice para performance
CREATE INDEX IF NOT EXISTS idx_orders_payment_method ON orders(payment_method);

-- 5️⃣ Log de verificação (opcional, pode ser removido)
-- SELECT 
--   payment_method,
--   COUNT(*) as total,
--   COUNT(CASE WHEN address->>'paymentMethod' IS NOT NULL THEN 1 END) as with_metadata
-- FROM orders
-- GROUP BY payment_method;
