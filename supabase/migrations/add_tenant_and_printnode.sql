-- Adicionar suporte a multi-tenancy e configuração de impressão
-- Esta migration é compatível com dados existentes

-- 1. Criar tabela de tenants (clientes) - para uso futuro
CREATE TABLE IF NOT EXISTS tenants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  slug VARCHAR(255) UNIQUE NOT NULL,
  created_at TIMESTAMP DEFAULT now(),
  updated_at TIMESTAMP DEFAULT now()
);

-- 2. Atualizar tabela settings com campos de PrintNode
-- NOTA: printnode_api_key é gerenciada via Supabase Secrets, não é armazenada no banco
ALTER TABLE settings ADD COLUMN IF NOT EXISTS printnode_printer_id VARCHAR(255);
ALTER TABLE settings ADD COLUMN IF NOT EXISTS print_mode VARCHAR(50) DEFAULT 'auto';

-- Criar índices para performance
CREATE INDEX IF NOT EXISTS idx_tenants_slug ON tenants(slug);
