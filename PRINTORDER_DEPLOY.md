# Deploy Manual da Edge Function PrintOrder

## Como fazer o deploy correto:

1. Abra [Supabase Dashboard](https://supabase.com/dashboard/project/ltmhmjnvksbkiqbdcxkj/functions)

2. Clique em **Edge Functions** → **printorder** → **Editar** (ícone de lápis)

3. **Delete TODO o código** e **Cole o código abaixo** inteiro:

```typescript
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.0";

// CORS headers
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Max-Age": "86400",
};

interface PrintOrderRequest {
  orderId: string;
  tenantId?: string;
  force?: boolean;
}

export async function handler(req: Request): Promise<Response> {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders, status: 200 });
  }

  try {
    if (req.method !== "POST") {
      return new Response(
        JSON.stringify({ error: "Only POST requests allowed" }),
        { status: 405, headers: corsHeaders }
      );
    }

    const body: PrintOrderRequest = await req.json();
    const { orderId, force = false } = body;

    if (!orderId) {
      return new Response(
        JSON.stringify({ error: "orderId is required" }),
        { status: 400, headers: corsHeaders }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // 1. Buscar dados do pedido
    const { data: order, error: orderError } = await supabase
      .from("orders")
      .select("*")
      .eq("id", orderId)
      .single();

    if (orderError || !order) {
      return new Response(
        JSON.stringify({ error: "Order not found", details: orderError }),
        { status: 404, headers: corsHeaders }
      );
    }

    // 2. Buscar configuração de impressão com filtro correto
    const { data: settings, error: settingsError } = await supabase
      .from("settings")
      .select("printnode_printer_id, print_mode")
      .eq("id", "store-settings")
      .single();

    if (settingsError || !settings?.printnode_printer_id) {
      console.error("Settings error:", settingsError);
      return new Response(
        JSON.stringify({
          error: "Printer not configured",
          details: settingsError?.message || "No printer ID found",
        }),
        { status: 400, headers: corsHeaders }
      );
    }

    // 3. Buscar API Key
    const printNodeApiKey = Deno.env.get("PRINTNODE_API_KEY");
    if (!printNodeApiKey) {
      return new Response(
        JSON.stringify({ error: "PrintNode API key not configured" }),
        { status: 500, headers: corsHeaders }
      );
    }

    console.log(`Printer ID: ${settings.printnode_printer_id}, Mode: ${settings.print_mode}`);

    // 4. Verificar modo de impressão
    if (settings.print_mode === "manual" && !force) {
      return new Response(
        JSON.stringify({
          success: true,
          message: "Print mode is manual. Use force=true to print.",
        }),
        { status: 200, headers: corsHeaders }
      );
    }

    // 5. Buscar itens do pedido
    const { data: orderItems, error: itemsError } = await supabase
      .from("order_items")
      .select("*")
      .eq("order_id", orderId);

    if (itemsError) {
      return new Response(
        JSON.stringify({ error: "Failed to fetch order items" }),
        { status: 500, headers: corsHeaders }
      );
    }

    // 6. Montar HTML
    const html = buildHTML(order, orderItems || []);

    // 7. Enviar para PrintNode
    const printNodeResponse = await sendToPrintNode(
      printNodeApiKey,
      settings.printnode_printer_id,
      html
    );

    if (!printNodeResponse.success) {
      return new Response(
        JSON.stringify({
          error: "Failed to send to PrintNode",
          details: printNodeResponse.error,
        }),
        { status: 500, headers: corsHeaders }
      );
    }

    console.log(`Order ${orderId} sent to printer successfully`);

    return new Response(
      JSON.stringify({
        success: true,
        message: "Order sent to printer",
        printJobId: printNodeResponse.printJobId,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error:", error);
    return new Response(
      JSON.stringify({
        error: "Internal server error",
        details: error instanceof Error ? error.message : String(error),
      }),
      { status: 500, headers: corsHeaders }
    );
  }
}

function buildHTML(order: any, items: any[]): string {
  const itemsHTML = items.map((item) => 
    `<div style="margin-bottom: 10px; font-family: monospace;">
      <strong>${item.quantity}x ${item.product_name}</strong>
      ${item.size ? `<div>Tamanho: ${item.size}</div>` : ""}
      ${item.custom_ingredients ? `<div>Adicionais: ${item.custom_ingredients}</div>` : ""}
    </div>`
  ).join("");

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <style>
        body { font-family: Arial, sans-serif; max-width: 400px; padding: 20px; }
        h2 { text-align: center; margin-bottom: 20px; }
        .item { margin-bottom: 15px; }
        .total { font-size: 18px; font-weight: bold; margin-top: 20px; text-align: center; border-top: 2px solid #000; padding-top: 10px; }
      </style>
    </head>
    <body>
      <h2>COMANDA</h2>
      <div>Cliente: ${order.customer?.name || "Sem nome"}</div>
      <div>Telefone: ${order.customer?.phone || "Sem telefone"}</div>
      <div>Data: ${new Date(order.created_at).toLocaleString("pt-BR")}</div>
      <hr>
      <div>${itemsHTML}</div>
      <div class="total">Total: R$ ${(order.total || 0).toFixed(2)}</div>
    </body>
    </html>
  `;
}

async function sendToPrintNode(
  apiKey: string,
  printerId: string,
  htmlContent: string
): Promise<{ success: boolean; printJobId?: string; error?: string }> {
  try {
    const base64HTML = btoa(htmlContent);

    const response = await fetch("https://api.printnode.com/printjobs", {
      method: "POST",
      headers: {
        Authorization: `Basic ${btoa(apiKey + ":")}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        printerId: parseInt(printerId),
        title: "Comanda - Forneiro Éden",
        contentType: "raw_base64",
        content: base64HTML,
      }),
      signal: AbortSignal.timeout(15000),
    });

    if (!response.ok) {
      const errorText = await response.text();
      return {
        success: false,
        error: `PrintNode API error: ${response.status} - ${errorText}`,
      };
    }

    const data = await response.json();
    return {
      success: true,
      printJobId: data.id,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}
```

4. Clique **Deploy** (ou **Save**)

5. Espere carregar (30-60 segundos)

6. Volte para a app e testa novamente o botão "Testar Impressão"

**IMPORTANTE:** Copie e cole TODO o código acima, pixel por pixel!
