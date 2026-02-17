-- Adicionar coluna customer_id à tabela orders e criar relacionamento com customers
-- Isso permite que a Edge Function encontre o cliente para adicionar pontos de lealdade

-- 0️⃣ Primeiro garantir que a coluna email existe (caso a outra migration não tenha rodado)
ALTER TABLE orders ADD COLUMN IF NOT EXISTS email VARCHAR(255);

-- 1️⃣ Adicionar coluna customer_id (inicialmente nullable)
ALTER TABLE orders ADD COLUMN IF NOT EXISTS customer_id UUID;

-- 2️⃣ Tentar extrair email do campo address (JSONB) se ainda estiver vazio
UPDATE orders
SET email = (address->>'email')::VARCHAR(255)
WHERE address->>'email' IS NOT NULL
  AND (email IS NULL OR email = '');

-- 3️⃣ Popular a coluna customer_id com base em email match
-- Procurar clientes pelo email na tabela orders
UPDATE orders
SET customer_id = c.id
FROM customers c
WHERE orders.email = c.email
  AND orders.customer_id IS NULL
  AND c.email IS NOT NULL
  AND orders.email IS NOT NULL;

-- 4️⃣ Adicionar constraint de chave estrangeira (se ainda não existir)
ALTER TABLE orders 
ADD CONSTRAINT fk_orders_customer_id 
FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE SET NULL;

-- 5️⃣ Criar índices para performance
CREATE INDEX IF NOT EXISTS idx_orders_customer_id ON orders(customer_id);
CREATE INDEX IF NOT EXISTS idx_orders_email ON orders(email);

-- 6️⃣ Log de verificação (opcional)
-- SELECT COUNT(*) as total_orders, 
--        COUNT(customer_id) as com_customer_id,
--        COUNT(email) as com_email
-- FROM orders;
