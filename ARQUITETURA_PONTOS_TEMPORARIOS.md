# 🎯 ARQUITETURA DE PONTOS TEMPORÁRIOS - IMPLEMENTAÇÃO DEFINITIVA

## Problem Identified
Os pontos **não eram calculados** quando o cliente fazia a compra. Eles só eram adicionados quando o gerente confirmava manualmente o pagamento na dashboard. Isso violava a lógica de negócio onde os pontos devem ser **reservados imediatamente** na compra e apenas **confirmados** quando o pagamento é validado.

## Solution Architecture 

### Fluxo NOVO (Correto) 📊

```
COMPRA (Cliente):
├─ Pedido criado no sistema
├─ pending_points = valor_total_em_reais (calculado AQUI)
└─ Armazenado em coluna "pending_points" da tabela orders

CONFIRMAÇÃO DE PAGAMENTO (Gerente):
├─ Clica botão "Confirmar Pagamento" no admin
├─ Edge Function invocada
├─ Busca "pending_points" da ordem
├─ Move para customer.total_points (com vencimento)
├─ cria loyalty_transaction
└─ pending_points zerado na order (auditoria)

CANCELAMENTO (Gerente):
├─ Clica "Cancelar Pedido"  
├─ Trigger automático zera pending_points
└─ Pontos NÃO são adicionados ao cliente
```

## Migrations Necessárias

Execute estas SQL queries NO SUPABASE SQL EDITOR (não via CLI):

### Migration 1: Adicionar coluna pending_points

```sql
-- Add pending_points column to orders table
-- Stores points earned from purchase temporarily until admin confirms payment

ALTER TABLE public.orders
ADD COLUMN pending_points NUMERIC DEFAULT 0;

-- Create comment explaining the column
COMMENT ON COLUMN public.orders.pending_points IS 
'Points earned from this purchase, stored temporarily. Moved to customer.total_points when payment is confirmed.';

-- Create index for querying pending points
CREATE INDEX idx_orders_pending_points ON public.orders(pending_points) 
WHERE pending_points > 0;
```

### Migration 2: Trigger para cancelamento

```sql
-- Handle pending_points when order is cancelled
-- Creates a trigger to clear pending_points if order status is changed to cancelled

CREATE OR REPLACE FUNCTION trg_handle_cancelled_order()
RETURNS TRIGGER AS $$
BEGIN
  -- If order is being cancelled, clear pending_points (they are not earned)
  IF NEW.status = 'cancelled' AND OLD.status != 'cancelled' THEN
    NEW.pending_points := 0;
    
    -- Also need to REVERSE any points that were already moved (if payment was already confirmed)
    IF OLD.status = 'confirmed' AND NEW.customer_id IS NOT NULL THEN
      -- This will be handled in application logic or via separate function
      -- For now, admin must manually reverse via UI
      RAISE LOG 'Order % cancelled but was already confirmed. Points may need manual reversal.', NEW.id;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop existing trigger if it exists
DROP TRIGGER IF EXISTS trg_handle_cancelled_order ON public.orders;

-- Create the trigger
CREATE TRIGGER trg_handle_cancelled_order
BEFORE UPDATE ON public.orders
FOR EACH ROW
EXECUTE FUNCTION trg_handle_cancelled_order();

COMMENT ON FUNCTION trg_handle_cancelled_order() IS 
'Clears pending_points when order is cancelled. Prevents points from being added to customer.';
```

## Mudanças no Código (JÁ APLICADAS) ✅

### 1️⃣ Frontend - `src/store/useOrdersStore.ts`

Agora calcula `pending_points` quando a ordem é criada:

```typescript
// Calculate pending points earned from this purchase (1 real = 1 point)
const pendingPoints = Math.round(newOrder.total);

const { error } = await supabase.from('orders').insert([
  {
    id: newOrder.id,
    customer_name: newOrder.customer.name,
    customer_phone: newOrder.customer.phone,
    email: newOrder.customer.email,
    delivery_fee: newOrder.deliveryFee,
    status: newOrder.status,
    total: newOrder.total,
    points_discount: newOrder.pointsDiscount || 0,
    points_redeemed: newOrder.pointsRedeemed || 0,
    pending_points: pendingPoints,  // ✅ NOVO: Armazena pontos temporários
    payment_method: newOrder.paymentMethod,
    created_at: localISO,
    address: addressWithMetadata,
  },
] as any);
```

### 2️⃣ Backend - Edge Function `confirm-payment-and-add-points`

Agora **move** (não calcula) os pontos:

```typescript
// 2️⃣ Mover pending_points para o saldo total do cliente
if (finalCustomerId && orderData.pending_points > 0) {
  // Busca os pending_points já calculados
  const pendingPoints = orderData.pending_points;
  
  // Atualiza customer.total_points COM esse valor
  const newTotalPoints = (customerData.total_points || 0) + pendingPoints;
  
  // Cria transação de lealdade
  await supabase.from('loyalty_transactions').insert([{
    customer_id: finalCustomerId,
    order_id: orderId,
    points_earned: pendingPoints,  // ✅ Usa pendingPoints, não recalcula
    transaction_type: 'purchase',
    description: `Compra no valor de R$ ${amount.toFixed(2)} (${pendingPoints} pontos)`,
    created_at: localISO,
    expires_at: expiresAtISO,
  }]);
}
```

## Passo a Passo: Executar as Migrations

### ✅ PASSO 1: Abrir Supabase Console
- Acesse: https://supabase.com/dashboard/project/lcstywjyktqdivoennhe/sql
- Clique em "SQL Editor"

### ✅ PASSO 2: Copiar e Colar Migration 1
1. Crie uma **nova query**
2. Cole o código SQL: **Migration 1** (coluna pending_points)
3. Clique em **"Execute"** (ícone play)

### ✅ PASSO 3: Copiar e Colar Migration 2
1. Crie uma **nova query**
2. Cole o código SQL: **Migration 2** (trigger cancelamento)
3. Clique em **"Execute"**

### ✅ PASSO 4: Verificar Coluna Criada
Execute esta query para confirmar:

```sql
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'orders' AND column_name = 'pending_points';
```

Deve retornar: `pending_points | numeric`

## Teste Prático - Novo Fluxo

### Cenário: Novo Cliente - CARTÃO/DINHEIRO

1. **Abra o App** como cliente
2. **Faça um pedido**: 
   - 2x Pizza R$ 50
   - 1x Refrigerante R$ 10
   - **Total: R$ 110** 
   - Pagamento: **CARTÃO** (não PIX)
3. **Vá ao Admin** e procure o pedido
4. **Consulte o Supabase** (antes de confirmar):
   ```sql
   SELECT id, customer_name, total, pending_points, status 
   FROM orders 
   WHERE customer_name = 'Seu Nome'
   ORDER BY created_at DESC LIMIT 1;
   ```
   **Esperado:** `pending_points = 110` ✅

5. **Clique "Confirmar Pagamento"** no admin
6. **Consulte novamente**:
   ```sql
   SELECT total_points FROM customers WHERE customer_name = 'Seu Nome';
   ```
   **Esperado:** `total_points = 110` ✅

### Cenário: Cancelamento

1. **Faça outro pedido**: R$ 100
2. **Sem confirmar**, clique "Cancelar Pedido"
3. **Consulte**:
   ```sql
   SELECT id, pending_points, status 
   FROM orders 
   WHERE id = 'PED-XXXXX';
   ```
   **Esperado:** `pending_points = 0`, `status = cancelled` ✅
   **Esperado:** Cliente NÃO ganhou pontos ✅

## Verificação Completa - SQL Queries

```sql
-- 1. Ver todos os pedidos com pending_points
SELECT 
  id,
  customer_name,
  total,
  pending_points,
  status,
  created_at
FROM orders
ORDER BY created_at DESC
LIMIT 20;

-- 2. Ver cliente com seus pontos
SELECT 
  name,
  total_points,
  total_spent,
  total_purchases,
  created_at
FROM customers
WHERE name = 'Nome do Cliente'
ORDER BY created_at DESC;

-- 3. Ver transações de lealdade
SELECT 
  customer_id,
  order_id,
  points_earned,
  transaction_type,
  description,
  created_at,
  expires_at
FROM loyalty_transactions
WHERE transaction_type = 'purchase'
ORDER BY created_at DESC
LIMIT 20;

-- 4. Verificar coluna existe
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'orders' 
  AND column_name IN ('pending_points', 'customer_id', 'email', 'payment_method');
```

## Status Final ✅

| Componente | Status | Detalhes |
|-----------|--------|---------|
| **Migration pending_points** | 🔄 AGUARDANDO | Execute SQL no Supabase |
| **Migration cancelamento** | 🔄 AGUARDANDO | Execute SQL no Supabase |
| **Frontend (useOrdersStore)** | ✅ DEPLOYADO | Calcula pontos na criação |
| **Edge Function** | ✅ DEPLOYADO | Move pontos ao confirmar |
| **Build** | ✅ SUCESSO | 1,002.56 kB, sem erros |

## Próximos Passos

1. ✅ Faça login no Supabase Console
2. ✅ Execute Migration 1 (coluna pending_points)
3. ✅ Execute Migration 2 (trigger cancelamento)
4. ✅ Teste o fluxo completo com um novo pedido
5. ✅ Verifique que os pontos aparecem no perfil do cliente após confirmação

---

**Versão:** 1.0 - Arquitetura de Pontos Temporários  
**Data:** 13 Fev 2026  
**Status:** Pronto para Testes
