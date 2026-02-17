-- Script para inicializar mensagens de notificação padrão para todos os tenants
-- Execute este script uma vez para cada novo tenant criado

DO $$ 
DECLARE
  v_tenant_id UUID;
BEGIN
  -- Para cada tenant que não tem mensagens configuradas
  FOR v_tenant_id IN
    SELECT t.id FROM tenants t 
    WHERE NOT EXISTS (
      SELECT 1 FROM whatsapp_status_messages 
      WHERE tenant_id = t.id
    )
  LOOP
    -- Inserir mensagens padrão
    INSERT INTO whatsapp_status_messages (tenant_id, status, message_template, enabled)
    VALUES
      (v_tenant_id, 'confirmed', '🍕 Oi {nome}! Seu pedido #{pedido} foi confirmado! ⏱️ Saindo do forno em ~25min', true),
      (v_tenant_id, 'preparing', '👨‍🍳 Seu pedido #{pedido} está sendo preparado com capricho!', true),
      (v_tenant_id, 'delivering', '🚗 Seu pedido #{pedido} está a caminho! 📍 Chega em ~15min', true),
      (v_tenant_id, 'delivered', '✅ Pedido #{pedido} entregue! Valeu pela compra 🙏', true),
      (v_tenant_id, 'cancelled', '❌ Pedido #{pedido} foi cancelado. Em caso de dúvidas, nos contate!', true);
      
    RAISE NOTICE 'Mensagens padrão criadas para tenant: %', v_tenant_id;
  END LOOP;
END $$;

SELECT 'Inicialização concluída' as status;
