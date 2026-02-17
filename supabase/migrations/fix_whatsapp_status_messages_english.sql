-- Limpar e recrear templates WhatsApp apenas em INGLÊS
-- Este script resolve o problema de status em português vs inglês

-- 1. Deletar templates antigos (em português)
DELETE FROM whatsapp_status_messages 
WHERE status IN ('confirmado', 'pendente', 'processando', 'rejeitado', 'cancelado', 'reembolsado');

-- 2. Deletar templates em inglês também para resetar
DELETE FROM whatsapp_status_messages 
WHERE status IN ('confirmed', 'pending', 'processing', 'rejected', 'cancelled', 'refunded');

-- 3. Recrear SOMENTE em inglês com os UUIDs corretos de tenants
-- Pega todos os tenants e cria templates para cada um
INSERT INTO whatsapp_status_messages (tenant_id, status, message_template, enabled)
SELECT 
  t.id,
  s.status,
  s.message_template,
  true
FROM tenants t
CROSS JOIN (
  VALUES
    ('pending', '📋 Oi {nome}! Recebemos seu pedido #{pedido}. Você receberá uma confirmação em breve!'),
    ('confirmed', '🍕 Oi {nome}! Seu pedido #{pedido} foi confirmado! ⏱️ Saindo do forno em ~25min'),
    ('preparing', '👨‍🍳 Seu pedido #{pedido} está sendo preparado com capricho!'),
    ('delivering', '🚗 Seu pedido #{pedido} está a caminho! 📍 Chega em ~15min'),
    ('delivered', '✅ Pedido #{pedido} entregue! Valeu pela compra 🙏'),
    ('cancelled', '❌ Pedido #{pedido} foi cancelado. Em caso de dúvidas, nos contate!')
) s(status, message_template)
ON CONFLICT (tenant_id, status) 
DO UPDATE SET 
  message_template = EXCLUDED.message_template,
  enabled = true;

-- 4. Verificar resultado
SELECT tenant_id, status, enabled, message_template FROM whatsapp_status_messages ORDER BY tenant_id, status;
