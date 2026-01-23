import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Validate webhook signature
async function validateWebhookSignature(body: string, signature: string): Promise<boolean> {
  const webhookSecret = Deno.env.get('MERCADO_PAGO_WEBHOOK_SECRET');
  
  if (!webhookSecret) {
    console.warn('MERCADO_PAGO_WEBHOOK_SECRET not configured, skipping signature validation');
    return true; // Allow if secret not configured (for testing)
  }

  try {
    const encoder = new TextEncoder();
    const data = encoder.encode(body + webhookSecret);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const computedSignature = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    
    return computedSignature === signature;
  } catch (error) {
    console.error('Signature validation error:', error);
    return false;
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const accessToken = Deno.env.get('MERCADO_PAGO_ACCESS_TOKEN');
    
    if (!accessToken) {
      throw new Error('MERCADO_PAGO_ACCESS_TOKEN not configured');
    }

    const body = await req.text();
    const signature = req.headers.get('x-signature') || '';
    
    // Validate signature
    const isValid = await validateWebhookSignature(body, signature);
    if (!isValid) {
      console.warn('Invalid webhook signature');
      return new Response(JSON.stringify({ error: 'Invalid signature' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const payloadData = JSON.parse(body);
    console.log('Webhook received:', JSON.stringify(payloadData, null, 2));

    // Handle payment notification
    if (payloadData.type === 'payment' && payloadData.data?.id) {
      const paymentId = payloadData.data.id;
      
      // Get payment details from Mercado Pago
      const paymentResponse = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
        headers: {
          'Authorization': `Bearer ${accessToken}`
        }
      });

      const paymentData = await paymentResponse.json();
      console.log('Payment data:', JSON.stringify(paymentData, null, 2));

      const orderId = paymentData.external_reference;
      const status = paymentData.status;

      // Map Mercado Pago status to our status
      const statusMap: Record<string, string> = {
        'approved': 'confirmado',
        'pending': 'pendente',
        'in_process': 'processando',
        'rejected': 'rejeitado',
        'cancelled': 'cancelado',
        'refunded': 'reembolsado'
      };

      console.log(`Order ${orderId} payment status: ${status} (${statusMap[status] || status})`);

      // Here you could update order status in database if needed
      // For now, we just log it
    }

    return new Response(JSON.stringify({ received: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error: unknown) {
    console.error('Webhook error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
