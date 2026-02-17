import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface GenerateQRRequest {
  instance_name: string;
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
    const evolutionUrl = Deno.env.get('EVOLUTION_API_URL');
    const evolutionKey = Deno.env.get('EVOLUTION_API_KEY');

    const supabase = createClient(supabaseUrl, supabaseKey);

    const body = await req.json() as GenerateQRRequest;
    const { instance_name } = body;

    console.log(`🔐 [GENERATE-QR] ${instance_name}`);

    if (!instance_name) {
      return new Response(
        JSON.stringify({ success: false, message: 'Missing instance_name' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!evolutionUrl || !evolutionKey) {
      console.error('Evolution credentials not configured');
      return new Response(
        JSON.stringify({ success: false, message: 'Evolution API not configured' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const baseUrl = evolutionUrl.replace(/\/$/, '');

    // Buscar QR code do endpoint correto
    console.log(`🔗 GET ${baseUrl}/instance/connect/${instance_name}`);
    
    let response: Response | null = null;
    let data: any = null;
    let qrCode = null;
    
    try {
      response = await fetch(`${baseUrl}/instance/connect/${instance_name}`, {
        method: 'GET',
        headers: {
          'apikey': evolutionKey || '',
          'Content-Type': 'application/json',
        },
      });
      
      data = await response.json();
      console.log(`📥 Response (${response.status}):`, JSON.stringify(data));
      
      if (!response.ok) {
        console.error('❌ Failed to get QR code:', data);
        return new Response(
          JSON.stringify({ 
            success: false, 
            message: 'Failed to generate QR code. Instance may not be created yet.',
            details: data
          }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      // Extrair QR code - prioridade: data.qrcode.base64 > data.code
      if (data.qrcode && data.qrcode.base64) {
        qrCode = data.qrcode.base64;
        console.log(`✅ QR code found in data.qrcode.base64 (PNG base64)`);
      } else if (data.code) {
        qrCode = data.code;
        console.log(`✅ QR code found in data.code (string, will convert to SVG)`);
      } else if (data.qrcode) {
        qrCode = data.qrcode;
        console.log(`✅ QR code found in data.qrcode`);
      }
      
      if (!qrCode) {
        console.warn('❌ No QR code in response:', data);
        return new Response(
          JSON.stringify({ 
            success: false, 
            message: 'QR code not available. Please try again in a few moments.',
            raw_response: data,
          }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
    } catch (err) {
      console.error(`❌ Fetch error:`, err);
      return new Response(
        JSON.stringify({ 
          success: false, 
          message: 'Failed to connect to Evolution API',
          error: err instanceof Error ? err.message : String(err)
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Converter QR code para formato exibível
    let qrCodeBase64 = qrCode;
    
    // Se for string (data.code), converter para SVG via QR library
    if (typeof qrCode === 'string' && !qrCode.startsWith('data:') && qrCode.length < 1000) {
      // É um código QR string, vamos usar qr-code lib
      // Por enquanto, retornar com aviso que precisa converter
      console.log(`📝 QR string received, needs conversion to SVG`);
      // Usar biblioteca qrcode para gerar SVG
      try {
        const QRCode = await import('https://cdn.jsdelivr.net/npm/qrcode@1.5.3/+esm');
        const svgString = await QRCode.default.toString(qrCode, { type: 'image/svg+xml', width: 300 });
        qrCodeBase64 = `data:image/svg+xml;base64,${btoa(svgString)}`;
        console.log(`✅ Converted to SVG`);
      } catch (e) {
        console.warn(`Could not convert to SVG, returning raw string`);
        qrCodeBase64 = qrCode;
      }
    } else if (qrCode.startsWith('iVBORw0KGgo') || qrCode.startsWith('/9j/')) {
      // É PNG ou JPEG base64
      qrCodeBase64 = `data:image/png;base64,${qrCode}`;
      console.log(`✅ PNG base64 converted to data URL`);
    }

    console.log(`✅ [GENERATE-QR] QR code ready for ${instance_name}`);

    return new Response(
      JSON.stringify({
        success: true,
        qr_code: qrCodeBase64,
        message: 'QR code generated successfully. Scan with WhatsApp Business.',
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    console.error('❌ [GENERATE-QR] Error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ success: false, error: message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
