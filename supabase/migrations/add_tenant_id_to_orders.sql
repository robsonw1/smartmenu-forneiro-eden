-- Adicionar tenant_id à tabela orders para suportar multi-tenancy
-- Importante para notificações Evolution API por estabelecimento

ALTER TABLE orders ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE;

-- Criar índice para performance
CREATE INDEX IF NOT EXISTS idx_orders_tenant_id ON orders(tenant_id);

-- Atualizar registros existentes com tenant_id padrão (primeiro tenant ou NULL)
-- Isso assume que se não há multi-tenancy, todos os pedidos pertencem ao primeiro tenant
DO $$
DECLARE
  default_tenant_id UUID;
BEGIN
  -- Tentar pegar o primeiro tenant
  SELECT id INTO default_tenant_id FROM tenants LIMIT 1;
  
  -- Se existir, atualizar todos os pedidos sem tenant_id
  IF default_tenant_id IS NOT NULL THEN
    UPDATE orders SET tenant_id = default_tenant_id WHERE tenant_id IS NULL;
  END IF;
END $$;
