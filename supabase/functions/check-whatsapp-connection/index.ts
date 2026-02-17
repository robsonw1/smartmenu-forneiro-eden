import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface CheckConnectionRequest {
  instance_name: string;
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const evolutionUrl = Deno.env.get('EVOLUTION_API_URL');
    const evolutionKey = Deno.env.get('EVOLUTION_API_KEY');

    const body = await req.json() as CheckConnectionRequest;
    const { instance_name } = body;

    console.log(`🔍 [CHECK-CONNECTION] ${instance_name}`);

    if (!instance_name) {
      return new Response(
        JSON.stringify({ success: false, message: 'Missing instance_name' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!evolutionUrl || !evolutionKey) {
      return new Response(
        JSON.stringify({ success: false, message: 'Evolution API not configured' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const baseUrl = evolutionUrl.replace(/\/$/, '');
    
    // 1. Verificar status da conexão
    console.log(`🔗 GET ${baseUrl}/instance/connectionState/${instance_name}`);
    
    let isConnected = false;
    let phoneNumber: string | null = null;
    
    try {
      const statusResponse = await fetch(`${baseUrl}/instance/connectionState/${instance_name}`, {
        method: 'GET',
        headers: {
          'apikey': evolutionKey,
          'Content-Type': 'application/json',
        },
      });
      
      const statusData = await statusResponse.json();
      console.log(`📥 Status response (${statusResponse.status}):`, statusData);
      
      if (statusResponse.ok && statusData.instance) {
        // Verificar se state === "open"
        isConnected = statusData.instance.state === 'open';
        console.log(`📊 Connection state: ${statusData.instance.state}`);
      }
    } catch (err) {
      console.warn(`⚠️  Could not fetch connection state:`, err);
    }
    
    // 2. Se conectado, buscar número de telefone
    if (isConnected) {
      console.log(`🔗 GET ${baseUrl}/instance/fetchInstances?instanceName=${instance_name}`);
      
      try {
        const fetchResponse = await fetch(`${baseUrl}/instance/fetchInstances?instanceName=${instance_name}`, {
          method: 'GET',
          headers: {
            'apikey': evolutionKey,
            'Content-Type': 'application/json',
          },
        });
        
        const fetchData = await fetchResponse.json();
        console.log(`📥 Fetch response (${fetchResponse.status}):`, fetchData);
        
        if (fetchResponse.ok && Array.isArray(fetchData) && fetchData.length > 0) {
          const instance = fetchData[0];
          if (instance.instance && instance.instance.owner) {
            // owner format: "5511999999999@c.us" -> extract number
            phoneNumber = instance.instance.owner.split('@')[0];
            console.log(`📱 Phone: ${phoneNumber}`);
          }
        }
      } catch (err) {
        console.warn(`⚠️  Could not fetch phone number:`, err);
      }
    }
    
    console.log(`✅ [CHECK-CONNECTION] ${instance_name} => ${isConnected ? 'Connected' : 'Waiting'}`)

    return new Response(
      JSON.stringify({
        success: true,
        is_connected: isConnected,
        phone_number: phoneNumber,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    console.error('❌ [CHECK-CONNECTION] Error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ success: false, error: message, is_connected: false }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
