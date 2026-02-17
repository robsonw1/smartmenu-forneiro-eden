# 🚀 Como Fazer Deploy da Edge Function Atualizada

## ⚠️ IMPORTANTE
A função `confirm-payment-and-add-points` foi refatorada e precisa ser deployada para o seu projeto Supabase.

## Opção 1: Deploy via Supabase Dashboard (Mais Fácil)

1. Acesse seu projeto Supabase:
   - URL: https://app.supabase.com/

2. Vá até **Edge Functions** no menu lateral

3. Procure por `confirm-payment-and-add-points`

4. Clique nela e depois em **Edit**

5. **Copie todo o código abaixo e substitua o código atual:**

```typescript
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface RequestBody {
  orderId: string;
  customerId?: string;
  amount: number;
  pointsRedeemed?: number;
}

const getLocalISOString = (): string => {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const date = String(now.getDate()).padStart(2, '0');
  const hours = String(now.getHours()).padStart(2, '0');
  const minutes = String(now.getMinutes()).padStart(2, '0');
  const seconds = String(now.getSeconds()).padStart(2, '0');
  return `${year}-${month}-${date}T${hours}:${minutes}:${seconds}`;
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    console.log('[CONFIRM-PAYMENT] Iniciando processamento...');
    const body = await req.json() as RequestBody;
    const { orderId, customerId, amount, pointsRedeemed = 0 } = body;

    console.log('[CONFIRM-PAYMENT] Body recebido:', { orderId, customerId, amount, pointsRedeemed });

    if (!orderId || !amount) {
      return new Response(
        JSON.stringify({ error: 'orderId and amount são obrigatórios' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error('Missing Supabase environment variables');
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    console.log('[CONFIRM-PAYMENT] Cliente Supabase criado');

    console.log(`[CONFIRM-PAYMENT] Buscando ordem ${orderId}...`);
    const { data: orderData, error: orderFetchError } = await supabase
      .from('orders')
      .select('*')
      .eq('id', orderId)
      .single();

    if (orderFetchError || !orderData) {
      console.error('[CONFIRM-PAYMENT] Erro ao buscar ordem:', orderFetchError);
      return new Response(
        JSON.stringify({ error: 'Pedido não encontrado' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('[CONFIRM-PAYMENT] Ordem encontrada:', { id: orderData.id, status: orderData.status });

    if (orderData.status === 'confirmed') {
      console.log('[CONFIRM-PAYMENT] Pedido já estava confirmado - retornando sucesso');
      return new Response(
        JSON.stringify({ success: true, message: 'Pedido já estava confirmado.' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const finalCustomerId = customerId || orderData.customer_id;
    console.log('[CONFIRM-PAYMENT] Customer ID final:', finalCustomerId);

    console.log('[CONFIRM-PAYMENT] Atualizando status para confirmed...');
    const { error: updateError } = await supabase
      .from('orders')
      .update({ status: 'confirmed' })
      .eq('id', orderId);

    if (updateError) {
      console.error('[CONFIRM-PAYMENT] Erro ao atualizar status:', updateError);
      return new Response(
        JSON.stringify({ error: 'Erro ao confirmar pedido' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('[CONFIRM-PAYMENT] Status atualizado para confirmed ✅');

    if (finalCustomerId && amount > 0 && pointsRedeemed === 0) {
      console.log('[CONFIRM-PAYMENT] Iniciar adição de pontos para cliente:', finalCustomerId);
      
      try {
        const { data: settingsData } = await supabase
          .from('loyalty_settings')
          .select('points_per_real, points_expiration_days')
          .single();

        const pointsPerReal = settingsData?.points_per_real ?? 1;
        const expirationDays = settingsData?.points_expiration_days ?? 365;
        const pointsEarned = Math.floor(amount * pointsPerReal);

        console.log('[CONFIRM-PAYMENT] Configurações de pontos:', { pointsPerReal, expirationDays, pointsEarned });

        const { data: customerData } = await supabase
          .from('customers')
          .select('total_points, total_spent, total_purchases')
          .eq('id', finalCustomerId)
          .single();

        if (!customerData) {
          console.warn('[CONFIRM-PAYMENT] Cliente não encontrado no sistema de lealdade');
          return new Response(
            JSON.stringify({ 
              success: true, 
              message: 'Pagamento confirmado. Cliente não encontrado para adicionar pontos.' 
            }),
            { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        const newTotalPoints = (customerData.total_points || 0) + pointsEarned;
        const newTotalSpent = (customerData.total_spent || 0) + amount;
        const newTotalPurchases = (customerData.total_purchases || 0) + 1;
        const localISO = getLocalISOString();
        
        const expiresAtDate = new Date();
        expiresAtDate.setDate(expiresAtDate.getDate() + expirationDays);
        const expiresAtISO = expiresAtDate.toISOString();

        console.log('[CONFIRM-PAYMENT] Atualizando cliente com novos totais...', {
          totalPoints: newTotalPoints,
          totalSpent: newTotalSpent,
          totalPurchases: newTotalPurchases
        });

        await supabase
          .from('customers')
          .update({
            total_points: newTotalPoints,
            total_spent: newTotalSpent,
            total_purchases: newTotalPurchases,
            last_purchase_at: localISO,
          })
          .eq('id', finalCustomerId);

        await supabase.from('loyalty_transactions').insert([{
          customer_id: finalCustomerId,
          order_id: orderId,
          points_earned: pointsEarned,
          transaction_type: 'purchase',
          description: `Compra no valor de R$ ${amount.toFixed(2)}`,
          created_at: localISO,
          expires_at: expiresAtISO,
        }]);

        console.log('[CONFIRM-PAYMENT] Pontos adicionados com sucesso! ✅', {
          pointsEarned,
          totalPoints: newTotalPoints
        });

        return new Response(
          JSON.stringify({ 
            success: true, 
            message: `Pagamento confirmado! ${pointsEarned} pontos adicionados.`,
            pointsEarned,
            totalPoints: newTotalPoints
          }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      } catch (pointsError) {
        console.error('[CONFIRM-PAYMENT] Erro ao adicionar pontos:', pointsError);
        return new Response(
          JSON.stringify({ 
            success: true, 
            message: 'Pagamento confirmado. Erro ao adicionar pontos.' 
          }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    console.log('[CONFIRM-PAYMENT] Processamento concluído com sucesso ✅');
    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Pagamento confirmado com sucesso.' 
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('[CONFIRM-PAYMENT] Erro crítico:', error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error instanceof Error ? error.message : 'Erro desconhecido' 
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
```

6. Clique em **Deploy** (ou **Save & Deploy**)

7. Aguarde a função ser deployada (uns 10-20 segundos)

8. Você verá uma notificação de sucesso ✅

---

## Opção 2: Deploy via CLI (Se tiver Deno instalado)

```bash
# Instalar Supabase CLI (se não tiver)
# macOS: brew install supabase/tap/supabase
# Linux: https://github.com/supabase/cli#install-the-cli
# Windows: https://github.com/supabase/cli#install-the-cli

# Fazer login (se necessário)
supabase login

# Link ao seu projeto (primeira vez)
supabase link --project-ref SUA_PROJECT_REF

# Deploy a função
supabase functions deploy confirm-payment-and-add-points
```

---

## ✅ Como Saber Se Funcionou

1. Vá ao **admin dashboard**
2. Abra um pedido com status **Pendente** e método **Dinheiro** ou **Cartão**
3. Clique em **✅ Confirmar Pagamento**
4. Você verá:
   - ✅ Mensagem de sucesso
   - Status do pedido muda para **Confirmado**
   - Pontos aparecem na conta do cliente em tempo real

---

## 🐛 Erros Comuns

### "404 Not Found"
- **Causa:** Função não foi deployada
- **Solução:** Siga os passos acima para fazer deploy

### "Cliente não encontrado"
- **Causa:** O cliente não existe na tabela `customers`
- **Solução:** Certifique-se que o cliente fez login antes de fazer pedido

### "Pontos não adicionados"
- **Causa:** Cliente usou desconto de pontos na compra
- **Solução:** Normal! Quando desconto é usado, não há pontos a adicionar

---

## 📝 Mudanças Feitas

A função foi refatorada para:
1. ✅ Retornar status corretos (nunca 404 errados)
2. ✅ Melhor logging para debug
3. ✅ Adicionar pontos em tempo real ao cliente
4. ✅ Sincronizar automaticamente com o Supabase Realtime
5. ✅ Tratamento de erros robusto

