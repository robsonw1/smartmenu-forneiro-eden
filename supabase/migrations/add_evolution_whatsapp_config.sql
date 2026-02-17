-- Adicionar configuração de Evolution API para notificações WhatsApp
-- Tabela: tenants - adicionar colunas de Evolution

-- 🔑 IMPORTANTE: URL_API e API_KEY são gerenciadas APENAS no backend (variáveis de ambiente)
-- Os gerentes APENAS colocam o NOME da INSTÂNCIA que será criada

ALTER TABLE tenants ADD COLUMN IF NOT EXISTS evolution_instance_name TEXT;
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS evolution_connected_at TIMESTAMP;
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS whatsapp_notifications_enabled BOOLEAN DEFAULT true;

-- Criar tabela para mensagens de notificação por status
CREATE TABLE IF NOT EXISTS whatsapp_status_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  status VARCHAR(50) NOT NULL,
  message_template TEXT NOT NULL,
  enabled BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT now(),
  updated_at TIMESTAMP DEFAULT now(),
  UNIQUE(tenant_id, status)
);

-- Criar índices para performance
CREATE INDEX IF NOT EXISTS idx_whatsapp_status_messages_tenant ON whatsapp_status_messages(tenant_id);
CREATE INDEX IF NOT EXISTS idx_whatsapp_status_messages_status ON whatsapp_status_messages(status);

-- Tabela de log de notificações (para auditoria e debug)
CREATE TABLE IF NOT EXISTS whatsapp_notification_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  order_id VARCHAR(50) NOT NULL,
  phone VARCHAR(20) NOT NULL,
  status VARCHAR(50) NOT NULL,
  message_sent TEXT,
  success BOOLEAN DEFAULT false,
  error_message TEXT,
  sent_at TIMESTAMP DEFAULT now()
);

-- Índices para logs
CREATE INDEX IF NOT EXISTS idx_whatsapp_logs_tenant ON whatsapp_notification_logs(tenant_id);
CREATE INDEX IF NOT EXISTS idx_whatsapp_logs_order ON whatsapp_notification_logs(order_id);
CREATE INDEX IF NOT EXISTS idx_whatsapp_logs_sent_at ON whatsapp_notification_logs(sent_at);
