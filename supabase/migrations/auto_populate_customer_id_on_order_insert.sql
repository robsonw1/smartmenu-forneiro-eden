-- Criar trigger automático para preencher customer_id quando um novo pedido é inserido
-- Assim novo clientes não terão o problema de customer_id NULL

-- 1️⃣ Criar função que preenche customer_id automaticamente
CREATE OR REPLACE FUNCTION auto_populate_customer_id_on_order()
RETURNS TRIGGER AS $$
BEGIN
  -- Se email foi fornecido e customer_id ainda está NULL
  IF NEW.email IS NOT NULL AND NEW.customer_id IS NULL THEN
    -- Procurar o customer pelo email
    SELECT id INTO NEW.customer_id
    FROM customers
    WHERE email = NEW.email
    LIMIT 1;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 2️⃣ Criar trigger que executa ANTES de inserir
DROP TRIGGER IF EXISTS trg_auto_populate_customer_id ON orders;

CREATE TRIGGER trg_auto_populate_customer_id
BEFORE INSERT ON orders
FOR EACH ROW
EXECUTE FUNCTION auto_populate_customer_id_on_order();

-- 3️⃣ Comentário explicativo
COMMENT ON FUNCTION auto_populate_customer_id_on_order IS 
'Trigger automático que preenche customer_id baseado no email quando um novo pedido é criado';

-- 4️⃣ Para pedidos antigos que ainda têm customer_id NULL, rodamos um UPDATE
-- (isso é uma operação única, não um trigger)
UPDATE orders
SET customer_id = (
  SELECT id FROM customers c
  WHERE c.email = orders.email
  LIMIT 1
)
WHERE customer_id IS NULL 
  AND email IS NOT NULL;
