# 🚨 ANÁLISE COMPLETA DE FRAUDE - SISTEMA DE FIDELIZAÇÃO

**Data:** 10/02/2026  
**Status:** 9 VULNERABILIDADES CRÍTICAS + 5 MÉDIAS IDENTIFICADAS

---

## 🔴 VULNERABILIDADES CRÍTICAS (Máximo Risco)

### 1. **FRAUDE DE PONTOS POR MANIPULAÇÃO DE TOTAL_POINTS**

**Risco:** Máximo - Essertinho muda `total_points` direto no banco  
**Como funciona a fraude:**

```typescript
// PROBLEMA NO CÓDIGO (useLoyaltyStore.ts - linha ~330):
const newTotalPoints = (customerData.total_points || 0) + pointsEarned;
await (supabase as any)
  .from('customers')
  .update({ total_points: newTotalPoints })  // ❌ SEM VALIDAÇÃO DE RACE CONDITION
  .eq('id', customerId);
```

**Ataque simultâneo:**
- Dois `redeemPoints` ao mesmo tempo do mesmo cliente
- Sistema lê `total_points = 100`
- Ambos subtraem 100, deixam com `0` (deveria ficar `-100`)
- Resultado: Cliente ganha desconto 2x

**Severidade:** 🔴🔴🔴
- Perda de dinheiro direto
- Sem auditoria de conflito
- RLS nova ajuda MAS NÃO PREVINE múltiplos UPDATEs simultâneos

**Solução Priority 2:**
```sql
-- Adicionar CONSTRAINT no banco
ALTER TABLE customers ADD CONSTRAINT total_points_non_negative CHECK (total_points >= 0);

-- Ou usar transação SERIALIZABLE:
BEGIN TRANSACTION ISOLATION LEVEL SERIALIZABLE;
  SELECT total_points FROM customers WHERE id = ? FOR UPDATE;
  UPDATE customers SET total_points = ? WHERE id = ?;
COMMIT;
```

---

### 2. **CUPOM PODE SER BAIXADO (0%) SEM SER VALIDADO**

**Risco:** Máximo - Cupom inválido = desconto grátis  
**Problema:**

```javascript
// CheckoutModal.tsx linha ~190
const result = await validateAndUseCoupon(couponCode, currentCustomer?.id);

if (result.valid) {
  setAppliedCoupon(couponCode);
  setCouponDiscount(result.discount); // ⚠️ result.discount pode ser 0 ou undefined!
}
```

**Ataque:**
1. Espertinho insere cupom com `discount_percentage = 0` no banco (via INSERT bypass)
2. RLS nova bloqueia INSERT MAS se ele conseguir inserir:
   - `is_active = true, is_used = false, expires_at = null`
   - `discount_percentage = 0`
3. Sistema aceita cupom com 0% desconto
4. Cliente pensa que tem cupom "especial" gratuito

**Severidade:** 🔴🔴
- Cupom válido = qualquer % (0-100%)
- Sem validação de faixa de desconto
- Frontend não valida min/max

**Solução Priority 2:**
```typescript
// Adicionar validação no frontend + Edge Function
if (!result.valid || result.discount <= 0) {
  toast.error('Cupom inválido');
  return;
}

// Edge Function também validar:
if (coupon.discount_percentage < 0 || coupon.discount_percentage > 100) {
  return { valid: false, error: 'Desconto inválido' };
}
```

---

### 3. **PONTOS NÃO EXPIRAM AUTOMATICAMENTE**

**Risco:** Máximo - Cliente ganha R$ infinito  
**Problema:**

```typescript
// useLoyaltyStore.ts linha ~290
const expiresAtDate = new Date();
expiresAtDate.setDate(expiresAtDate.getDate() + expirationDays);
const expiresAtISO = expiresAtDate.toISOString();

// REGISTRA expiração em loyalty_transactions
await (supabase as any)
  .from('loyalty_transactions')
  .insert([{
    expires_at: expiresAtISO  // ⚠️ SÓ A TRANSAÇÃO TEM DATA DE EXPIRAÇÃO!
  }]);

// MAS redeemPoints LÊ DO TOTAL_POINTS SEM VERIFICAR EXPIRAÇÃO
const discountAmount = (pointsToSpend / 100) * pointsValue;
await (supabase as any)
  .from('customers')
  .update({ total_points: customer.totalPoints - pointsToSpend })
  .eq('id', customerId);
```

**Ataque:**
1. Cliente ganha 100 pontos dia 01/02/2026
2. Pontos expiram dia 01/02/2027
3. Cliente resgata pontos dia 02/02/2027 (EXPIRADO)
4. Sistema permite porque `customers.total_points` não tem `expires_at`

**Severidade:** 🔴🔴🔴
- Pontos vivem eternamente no `total_points`
- Sem trigger para apagar automaticamente
- Cliente pode chamar: "Meus pontos não expiraram!"

**Solução Priority 2:**
```sql
-- Trigger para remover pontos expirados
CREATE OR REPLACE FUNCTION clean_expired_points()
RETURNS void AS $$
DECLARE
  expired_points INT;
  cust_id UUID;
BEGIN
  FOR cust_id IN 
    SELECT DISTINCT customer_id FROM loyalty_transactions 
    WHERE expires_at < NOW() AND (points_earned IS NOT NULL)
  LOOP
    SELECT COALESCE(SUM(COALESCE(points_earned, 0)), 0)
    INTO expired_points
    FROM loyalty_transactions
    WHERE customer_id = cust_id AND expires_at < NOW();
    
    UPDATE customers SET total_points = GREATEST(total_points - expired_points, 0)
    WHERE id = cust_id;
  END LOOP;
END;
$$ LANGUAGE plpgsql;

-- Rodar todo dia às 3 AM
SELECT cron.schedule('clean_expired_points', '0 3 * * *', 'SELECT clean_expired_points()');
```

---

### 4. **PAGAMENTO PODE NÃO SER VALIDADO ANTES DE ADICIONAR PONTOS (PIX)**

**Risco:** Máximo - Cliente paga 0, ganha pontos  
**Problema:**

```typescript
// CheckoutModal.tsx linha ~670
const handlePixConfirmed = async () => {
  // ⚠️ NÃO VERIFICA SE PAGAMENTO FOI REALMENTE CONFIRMADO NO MERCADO PAGO!
  
  if (isRemembered && currentCustomer?.email) {
    const loyaltyCustomer = await findOrCreateCustomer(currentCustomer.email);
    const pointsEarned = Math.floor(finalTotal * 1); // 1 ponto por real
    setLastPointsEarned(pointsEarned);
    
    // ADICIONA PONTOS CONFIANDO APENAS NO FRONTEND
    await addPointsFromPurchase(loyaltyCustomer.id, finalTotal, lastOrderEmail);
```

**Ataque:**
1. Cliente inicia pagamento PIX
2. Cliente fecha a janela de PIX (payment = PENDING, NÃO approved)
3. Cliente chama `handlePixConfirmed()` localmente via DevTools
4. Frontend adiciona pontos mesmo SEM pagamento ter sido processado
5. Webhook do MercadoPago nunca confirma o pagamento
6. Cliente não paga, ganha pontos

**Severidade:** 🔴🔴🔴
- Perda de receita direta
- Clientes ganham R$ em desconto sem pagar
- Webhook do Mercado Pago NÃO impede isso

**Solução Priority 2:**
```typescript
// Antes de adicionar pontos, SEMPRE verificar payment status:
const handlePixConfirmed = async () => {
  // 1. Buscar status do pagamento no Mercado Pago
  const mpStatus = await fetch(`
    https://api.mercadopago.com/v1/payments/${paymentId}?access_token=${MERCADO_PAGO_TOKEN}
  `);
  const payment = await mpStatus.json();
  
  // 2. VALIDAR que payment.status === 'approved'
  if (payment.status !== 'approved') {
    toast.error('Pagamento não foi confirmado. Aguarde a confirmação.');
    return;
  }
  
  // 3. AGORA sim, adicionar pontos
  await addPointsFromPurchase(...);
}
```

---

### 5. **CLIENTE NÃO-REGISTRADO PODE USAR CUPOM = FRAUDE DUPLA**

**Risco:** Máximo - Cupom vazado entre clientes  
**Problema:**

```typescript
// CheckoutModal.tsx linha ~188
const handleApplyCoupon = async () => {
  if (!couponCode.trim()) return;
  
  if (!isRemembered) {
    setCouponValidationMessage('❌ Apenas clientes registrados podem usar cupons');
    return; // ✅ BLOQUEIA - Mas...
  }
  
  // PORÉM: validateAndUseCoupon() chama a Edge Function
  const result = await validateAndUseCoupon(couponCode, currentCustomer?.id);
```

**Ataque:**
1. Cupom é criado para cliente A (ex: "SUPER50")
2. Cliente A compartilha cupom em grupo WhatsApp
3. Clientes B, C, D tentam usar em checkout
4. Frontend bloqueia (✅)
5. **MAS Client D pode chamar a Edge Function DIRETO:**

```javascript
// Devtools Console:
fetch('https://supabase.com/functions/v1/validate-and-use-coupon', {
  method: 'POST',
  body: JSON.stringify({ coupon_code: 'SUPER50', customer_id: 'uuid-fake' })
})
.then(r => r.json())
.then(console.log)
```

**Severidade:** 🔴🔴
- Edge Function NÃO valida se cliente é registrado
- Cupom vinculado a customer_id específico MAS Edge Function não valida propriedade

**Solução Priority 2:**
```typescript
// validate-and-use-coupon/index.ts
// Adicionar validação de propriedade:
if (coupon.customer_id && coupon.customer_id !== customer_id) {
  return { 
    valid: false, 
    error: 'Cupom não é válido para você'
  };
}
```

---

### 6. **MÚLTIPLOS CLIENTES COM 1 PEDIDO = FRAUDE DE PONTOS**

**Risco:** Máximo - Ganham pontos sem fazer compra  
**Problema:**

```typescript
// CheckoutModal.tsx linha ~500
const findOrCreateCustomer = useLoyaltyStore((s) => s.findOrCreateCustomer);

// Cliente digita EMAIL ERRADO no checkout
setCustomer({ email: 'joao@gmail.com' }); // Digitou errado, era joão@

// Sistema pensa que é cliente novo, cria novo registro
const loyaltyCustomer = await findOrCreateCustomer(customerEmail); 

// Mas no banco já existe João com 50 pontos
// AGORA TEM 2 CLIENTES: joao@gmail vs joão@
```

**Ataque:**
1. Sistema cria cliente novo a cada email com variação:
   - `joao@gmail.com` (com tilde)
   - `joao@gmail.com` (sem tilde)
   - `JOAO@GMAIL.COM` (maiúsculas)
   - `joao@gmail.com ` (com espaço)
2. CADA um ganha bônus de signup (50 pontos)
3. Cliente malandro cria 10 emails "variados" e ganha 500 pontos sem nada fazer

**Severidade:** 🔴🔴🔴
- Múltiplas contas = múltiplos bônus
- Sem email verification
- Sem documento único (CPF validado)

**Solução Priority 2:**
```typescript
// Normalizar email ANTES de buscar/criar:
const normalizeEmail = (email: string): string => {
  return email
    .toLowerCase()
    .trim()
    .normalize('NFD')                           // Remove acentos
    .replace(/[\u0300-\u036f]/g, '');          // Aplica NFD
};

const normalizedEmail = normalizeEmail(customerEmail);
const loyaltyCustomer = await findOrCreateCustomer(normalizedEmail);
```

---

### 7. **VALIDAÇÃO DE CUPOM É FRONTEND-FIRST (FALHA CRÍTICA)**

**Risco:** Máximo - Cliente desativa JavaScript e usa cupom expirado  
**Problema:**

```typescript
// CheckoutModal.tsx linha ~188
const handleApplyCoupon = async () => {
  const result = await validateAndUseCoupon(couponCode, currentCustomer?.id);
  
  if (result.valid) {
    setAppliedCoupon(couponCode);     // ⚠️ STATE LOCAL
    setCouponDiscount(result.discount);
  }
};

// Depois no checkout final:
const finalTotal = total - pointsDiscount - couponDiscountAmount;

// ⚠️ MAS: Espertinho pode fazer:
// 1. Desabilitar JavaScript
// 2. Ou usar DevTools para mudar:
//    setAppliedCoupon(''); -> setAppliedCoupon('EXPIRADO');
//    setCouponDiscount(0); -> setCouponDiscount(50);
```

**Ataque:**
1. Cliente vê cupom expirado → "CUPOM_EXPIRADO"
2. Frontend mostra: ❌ Cupom expirado
3. Cliente abre DevTools:
```javascript
// Muda manualmente no Redux/Zustand
setState({ appliedCoupon: 'CUPOM_VALIDO', couponDiscount: 50 });
```
4. Processa pedido com cupom fake no estado
5. `processOrder()` cria pedido com `appliedCoupon: 'CUPOM_VALIDO'` no banco
6. Servidor confia e aplica 50% de desconto

**Severidade:** 🔴🔴
- Frontend state é CONFIÁVEL demais
- Sem validação server-side antes de criar pedido

**Solução Priority 1 (já parcialmente feita):** ✅
```typescript
// CheckoutModal.tsx linha ~520
if (orderPayload.totals.appliedCoupon) {
  // ✅ JÁ TENTA MARCAR CUPOM - mas precisa validar resposta
  try {
    await markCouponAsUsed(orderPayload.totals.appliedCoupon, currentCustomer?.id);
  } catch (error) {
    // ⚠️ AQUI DEVERIA CANCELAR O PEDIDO SE CUPOM FALHAR
    throw new Error('Cupom inválido ao confirmar pedido');
  }
}
```

---

### 8. **POINTS DISCOUNT PODE SER MANIPULADO SEM VALIDAÇÃO**

**Risco:** Máximo - Cliente muda desconto sem ter pontos  
**Problema:**

```typescript
// CheckoutModal.tsx linha ~1230
<input
  type="range"
  min="0"
  max={currentCustomer.totalPoints}
  value={pointsToRedeem}
  onChange={(e) => setPointsToRedeem(parseInt(e.target.value))}
/>

// ⚠️ Frontend validation apenas!
// Espertinho abre DevTools:
```

**Ataque:**
```javascript
// DevTools Console:
setPointsToRedeem(999999); // Cliente tem 100, tries usar 999999

// Mesmo se estado não permitir, ele pode chamar redeemPoints direto:
fetch('/.../api/redeem-points', {
  method: 'POST',
  body: JSON.stringify({ 
    customerId: 'seu-id',
    pointsToSpend: 999999
  })
})
```

**Severidade:** 🔴🔴
- Sem server-side validation no redeemPoints
- Sistema confia no total_points do currentCustomer (ele pode ter sido alterado)

**Solução Priority 2:**
```typescript
// redeemPoints em useLoyaltyStore.ts linha ~330
redeemPoints: async (customerId: string, pointsToSpend: number) => {
  try {
    // ✅ RE-BUSCAR total_points do banco (não confiador no estado local)
    const { data: freshCustomer, error } = await supabase
      .from('customers')
      .select('total_points')
      .eq('id', customerId)
      .single();
    
    if (freshCustomer.total_points < pointsToSpend) {
      return { success: false, error: 'Pontos insuficientes' };
    }
    
    // Apenas AGORA fazer UPDATE
    await supabase.from('customers')
      .update({ total_points: freshCustomer.total_points - pointsToSpend })
      .eq('id', customerId);
```

---

### 9. **WEBHOOK MERCADO PAGO NÃO FORÇA CONFIRMAÇÃO**

**Risco:** Médio → Alto - Pagamento pode ser forever "pending"  
**Problema:**

```typescript
// supabase/functions/mercadopago-webhook/index.ts linha ~70
const statusMap: Record<string, string> = {
  'approved': 'confirmado',
  'pending': 'pendente',
  'rejected': 'rejeitado',
};

console.log(`Order ${orderId} payment status: ${status}`);
// AQUI NÃO FAZ NADA! Só loga!

// NÃO atualiza order.status no banco
// CLIENTE NUNCA SABE QUE PAGAMENTO FOI REJEITADO
```

**Ataque:**
1. Cliente faz pedido PIX de R$ 100
2. MercadoPago manda webhook: `status: 'rejected'`
3. Servidor loga e... ignora

4. Cliente chama: "Onde está meu pedido?"
5. Ao conferir, vê `status: 'aguardando_pagamento'` forever
6. Pensa que entregaram, cobra no Pix
7. Caos

**Severidade:** 🔴
- Ordre pode ficar em limbo
- Sem notificação ao cliente
- Admin não vê pagamentos rejeitados

**Solução Priority 2:**
```typescript
// mercadopago-webhook/index.ts
const supabase = createClient(...);

// Atualizar status do order
await supabase.from('orders')
  .update({ 
    status: statusMap[status] || 'desconhecido',
    payment_status: status,
    payment_status_updated_at: new Date()
  })
  .eq('external_reference', orderId);

// Se rejeitado, notificar admin via email
if (status === 'rejected') {
  // Enviar email alert
}
```

---

## 🟡 VULNERABILIDADES MÉDIAS (Risco Alto)

### 10. **EMAIL NÃO TIENE VERIFICAÇÃO = SPAM DE CONTAS**
- Qualquer um cria 1000 contas fake
- Ganha 50k pontos = R$ 2.500 em desconto gratuito
- Sem verificação, sem limite

### 11. **CPF NÃO ÚNICO NEM VALIDADO**
- Pode ter CPF repetido
- Não valida CPF inválido (00000000000)
- Não bloqueie CPF fraudado

### 12. **ADMIN PODE CRIAR CUPOM ILIMITADO = FRAUDE INTERNA**
- Admin cria cupom com 100% desconto
- Não há limite de cupons por dia/mês
- Sem auditoria de quem criou

### 13. **SISTEMA ACEITA VALORES NEGATIVOS**
```typescript
const discountAmount = (pointsToSpend / 100) * pointsValue; // Pode ser negativo!
const finalTotal = total - pointsDiscount; // Cliente paya -R$50 = ganha dinheiro!
```

### 14. **PONTOS PODEM SER ADICIONADOS MÚLTIPLAS VEZES**
- `addPointsFromPurchase()` chamado 2x do mesmo orderId
- Não há UNIQUE constraint em orderId

---

## 📊 RESUMO DE RISCO

| # | Vulnerabilidade | Risco | Status | Solução |
|---|---|---|---|---|
| 1 | Race condition em total_points | 🔴🔴🔴 | ⚠️ | Usar WHERE clause + CONSTRAINT |
| 2 | Cupom 0% aceito | 🔴🔴 | ⚠️ | Validar min/max desconto |
| 3 | Pontos não expiram | 🔴🔴🔴 | ⚠️ | Trigger + daily cron job |
| 4 | Pagamento PIX não validado | 🔴🔴🔴 | 🔴 | Verificar MP status antes de adicionar pontos |
| 5 | Cupom sem validação de cliente | 🔴🔴 | ⚠️ | Edge Function validar customer_id |
| 6 | Email não normalizado | 🔴🔴🔴 | 🔴 | normalize() + lower() + trim() |
| 7 | Frontend-first validation | 🔴🔴 | ⚠️ | Server-side marcar cupom MUST succeed |
| 8 | Points discount manipulável | 🔴🔴 | ⚠️ | Validar points no banco antes de redeem |
| 9 | Webhook não atualiza order | 🔴 | 🔴 | UPDATE order.status na webhook |
| 10 | Email sem verificação | 🟡 | 🔴 | Send verification link |
| 11 | CPF não validado | 🟡 | 🔴 | Validar dígitos + verificador |
| 12 | Admin sem limite de cupons | 🟡 | ⚠️ | Rate limit por dia |
| 13 | Valores negativos | 🟡 | 🔴 | CHECK constraint >= 0 |
| 14 | orderId não unique | 🟡 | ⚠️ | UNIQUE(orderId) + rejeitar duplicado |

---

## 🎯 PRIORIDADES DE FIX

### 🚨 URGENTE (Rodas HOJE)
- [ ] #4: Validar pagamento PIX antes de adicionar pontos
- [ ] #6: Normalizar email
- [ ] #13: Adicionar CHECK constraints para valores >= 0

### ⚠️ SEMANA QUE VEM
- [ ] #1: Race condition em total_points → Usar transação SERIALIZABLE
- [ ] #3: Trigger para limpar pontos expirados
- [ ] #9: Webhook atualizar order status

### 📋 PRÓXIMO SPRINT
- [ ] #10: Email verification
- [ ] #11: CPF validation digitos
- [ ] #14: UNIQUE(orderId)

---

## ✅ JÁ CORRIGIDO
- ✅ #7: Cupom marcado via Edge Function (PARTIAL)
- ✅ RLS Policies (fix_rls_security_2025_02.sql)

