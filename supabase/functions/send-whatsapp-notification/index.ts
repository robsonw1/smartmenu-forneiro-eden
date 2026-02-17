import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface NotificationRequest {
  orderId: string;
  status: string;
  phone: string;
  customerName: string;
  tenantId: string;
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
    
    const supabase = createClient(supabaseUrl, supabaseKey);

    const body = await req.json() as NotificationRequest;
    const { orderId, status, phone, customerName, tenantId } = body;

    console.log(`
╔═══════════════════════════════════════╗
║  📱 NOTIFICAÇÃO WHATSAPP              ║
╠═══════════════════════════════════════╣
║  Pedido:    ${orderId}
║  Status:    ${status}
║  Telefone:  ${phone}
║  Cliente:   ${customerName}
║  TenantID:  ${tenantId}
╚═══════════════════════════════════════╝
`);

    // ✅ 1. Validar dados básicos
    if (!orderId || !status || !phone || !tenantId) {
      console.error('❌ [WHATSAPP] Dados faltando:', { orderId, status, phone, tenantId });
      return new Response(
        JSON.stringify({ error: 'Missing required fields', success: false }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ✅ 2. Buscar configurações do tenant (nome da instância apenas)
    const { data: tenant, error: tenantError } = await supabase
      .from('tenants')
      .select('id, name, evolution_instance_name, whatsapp_notifications_enabled')
      .eq('id', tenantId)
      .single();

    if (tenantError || !tenant) {
      console.error('❌ [WHATSAPP] Tenant não encontrado:', tenantError);
      return new Response(
        JSON.stringify({ error: 'Tenant not found', success: false }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ✅ 3. Validar se notificações estão habilitadas
    if (!tenant.whatsapp_notifications_enabled) {
      console.log(`⚠️ [WHATSAPP] Notificações desabilitadas para tenant ${tenant.name}`);
      await logNotification(supabase, tenantId, orderId, phone, status, null, false, 'Notifications disabled');
      return new Response(
        JSON.stringify({ success: false, message: 'Notifications disabled' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ✅ 4. Obter credenciais de Evolution do backend (Deno.env)
    const evolutionUrl = Deno.env.get('EVOLUTION_API_URL');
    const evolutionKey = Deno.env.get('EVOLUTION_API_KEY');
    const instanceName = tenant.evolution_instance_name;

    if (!evolutionUrl || !evolutionKey || !instanceName) {
      console.error(`❌ [WHATSAPP] Evolution não configurada no backend ou instância não definida`);
      await logNotification(supabase, tenantId, orderId, phone, status, null, false, 'Evolution not configured');
      return new Response(
        JSON.stringify({ error: 'Evolution API not configured', success: false }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ✅ 5. Buscar mensagem de template por status
    console.log(`🔍 [WHATSAPP] Procurando template para status: "${status}" (tenant: ${tenantId})`);
    
    const { data: messageTemplate, error: templateError } = await supabase
      .from('whatsapp_status_messages')
      .select('message_template, enabled')
      .eq('tenant_id', tenantId)
      .eq('status', status)
      .eq('enabled', true)
      .single();

    if (templateError || !messageTemplate) {
      console.error(`❌ [WHATSAPP] Template não encontrado:`, templateError);
      console.log(`📋 Status esperado: "${status}"`);
      
      // Listar templates disponíveis para debug
      const { data: allTemplates } = await supabase
        .from('whatsapp_status_messages')
        .select('status, enabled')
        .eq('tenant_id', tenantId);
      
      if (allTemplates && allTemplates.length > 0) {
        console.log(`📋 Templates disponíveis:`);
        allTemplates.forEach((t: any) => {
          console.log(`   - ${t.status} (${t.enabled ? '✅ ativo' : '❌ inativo'})`);
        });
      } else {
        console.log(`📋 ⚠️ NENHUM template configurado para este tenant!`);
      }
      
      await logNotification(supabase, tenantId, orderId, phone, status, null, false, `No template for status: ${status}`);
      return new Response(
        JSON.stringify({ 
          success: false, 
          message: `Template not found for status: ${status}`,
          availableStatuses: allTemplates?.map((t: any) => t.status) || [],
          debug: 'Check admin panel > Notificações WhatsApp > Configurar Mensagens'
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    console.log(`✅ [WHATSAPP] Template encontrado para status: "${status}"`);

    // ✅ 6. Preparar mensagem substituindo variáveis
    let finalMessage = messageTemplate.message_template
      .replace('{pedido}', orderId)
      .replace('{nome}', customerName)
      .replace('{status}', status);

    console.log(`
📝 [WHATSAPP] Mensagem preparada:
   "${finalMessage}"
`);

    // ✅ 7. Formatar telefone (remover caracteres especiais, garantir +55)
    let formattedPhone = phone.replace(/\D/g, '');
    if (!formattedPhone.startsWith('55')) {
      formattedPhone = '55' + formattedPhone;
    }

    console.log(`📲 [WHATSAPP] Telefone original: ${phone}`);
    console.log(`📲 [WHATSAPP] Telefone formatado: ${formattedPhone}`);

    // ✅ 8. Enviar via Evolution API
    // Formato correto: POST /message/sendText/{instanceName} com { number, text }
    const evolutionPayload = {
      number: formattedPhone,
      text: finalMessage,
    };

    const evolutionApiUrl = `${evolutionUrl.replace(/\/$/, '')}/message/sendText/${instanceName}`;
    
    console.log(`
🚀 [EVOLUTION] Enviando mensagem:
   URL: ${evolutionApiUrl}
   Payload: ${JSON.stringify(evolutionPayload, null, 2)}
`);

    const response = await fetch(evolutionApiUrl, {
      method: 'POST',
      headers: {
        'apikey': evolutionKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(evolutionPayload),
    });

    const responseData = await response.json();
    console.log(`📥 [EVOLUTION] Response (${response.status}): ${JSON.stringify(responseData)}`);
    
    if (response.ok) {
      console.log(`✅ [WHATSAPP] Mensagem enviada com sucesso para ${formattedPhone}`);
      await logNotification(supabase, tenantId, orderId, phone, status, finalMessage, true, null);
      return new Response(
        JSON.stringify({ success: true, message: 'Message sent', evolutionResponse: responseData }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    } else {
      const error = `Evolution API error: ${response.status}`;
      console.error(`❌ [WHATSAPP] Erro ao enviar: ${error}`, responseData);
      await logNotification(supabase, tenantId, orderId, phone, status, finalMessage, false, error);
      return new Response(
        JSON.stringify({ success: false, error, evolutionResponse: responseData }),
        { status: response.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

  } catch (error: unknown) {
    console.error('❌ [WHATSAPP] Erro geral:', error);
    const message = error instanceof Error ? error.message : 'Erro desconhecido';
    return new Response(
      JSON.stringify({ success: false, error: message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

// Helper para registrar no log
async function logNotification(
  supabase: any,
  tenantId: string,
  orderId: string,
  phone: string,
  status: string,
  messageSent: string | null,
  success: boolean,
  errorMessage: string | null
) {
  try {
    await supabase.from('whatsapp_notification_logs').insert({
      tenant_id: tenantId,
      order_id: orderId,
      phone,
      status,
      message_sent: messageSent,
      success,
      error_message: errorMessage,
    });
  } catch (error) {
    console.warn('⚠️ Falha ao registrar log de notificação:', error);
  }
}
