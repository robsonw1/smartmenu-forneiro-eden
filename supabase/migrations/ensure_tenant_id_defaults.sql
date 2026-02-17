-- Garantir que orders sempre tenham tenant_id válido
-- Adicionar trigger para auto-preencher tenant_id se NULL

-- 1. Primeiro, atualizar registros com NULL para usar o primeiro tenant
UPDATE orders 
SET tenant_id = (SELECT id FROM tenants LIMIT 1)
WHERE tenant_id IS NULL;

-- 2. Criar trigger para garantir tenant_id em novos inserts
CREATE OR REPLACE FUNCTION set_default_tenant_id()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.tenant_id IS NULL THEN
    NEW.tenant_id := (SELECT id FROM tenants LIMIT 1);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 3. Dropa trigger se existir e recriar
DROP TRIGGER IF EXISTS set_orders_tenant_id ON orders;

CREATE TRIGGER set_orders_tenant_id
BEFORE INSERT ON orders
FOR EACH ROW
EXECUTE FUNCTION set_default_tenant_id();

-- 4. Alterar coluna para NOT NULL se possível
ALTER TABLE orders 
ALTER COLUMN tenant_id SET NOT NULL;
