-- Script para testar multi-tenant setup com Mercado Pago
-- Execute este script no Supabase Dashboard SQL Editor

-- 1. Verificar se tenants já existe
SELECT COUNT(*) as tenant_count FROM tenants;

-- 2. Inserir um tenant de teste (execute se não existe nenhum)
INSERT INTO tenants (name, slug, mercadopago_access_token)
VALUES (
  'Forneiro Eden',
  'forneiro-eden',
  'APP_USR-180002917099817-100219-2471147eb2598b1c33200e807331f6db-1934091703'
)
ON CONFLICT (slug) DO UPDATE SET
  mercadopago_access_token = 'APP_USR-180002917099817-100219-2471147eb2598b1c33200e807331f6db-1934091703'
RETURNING id, name, slug, mercadopago_access_token;

-- 3. Verificar que o tenant foi criado/atualizado
SELECT id, name, slug, mercadopago_access_token FROM tenants LIMIT 5;

-- 4. Verificar a estrutura da tabela tenants
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'tenants'
ORDER BY ordinal_position;
