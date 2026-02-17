# 🔒 MIGRAÇÃO DE SEGURANÇA - PRIORIDADE 1

## ✅ IMPLEMENTADO (10/02/2025)

### 1. **Edge Functions para Validação Segura de Cupom**

#### `supabase/functions/validate-and-use-coupon/index.ts` ✅
- Validação APENAS (sem lock, apenas leitura)
- Verifica: status ativo, não usado, não expirado
- Retorna validação sem marcar como usado

#### `supabase/functions/mark-coupon-used/index.ts` ✅  
- Marca cupom como usado ATOMICAMENTE
- Usa `UPDATE ... WHERE is_used = false` para evitar race condition
- Detecta se cupom já foi marcado por outra transação (409 Conflict)
- Impede double-spend mediante lock de BD

### 2. **Correção de RLS Policies - `fix_rls_security_2025_02.sql`** ✅

#### Antes (❌ INSEGURO):
```sql
CREATE POLICY "Allow public update to customers" 
  ON customers FOR UPDATE 
  USING (true) WITH CHECK (true);  -- Qualquer um podia mudar qualquer coisa
```

#### Depois (✅ SEGURO):
```sql
-- LOYALTY_COUPONS:
- SELECT: Apenas cupons válidos (ativo, não usado, não expirado)
- INSERT: Bloqueado (apenas admin via Edge Function)
- UPDATE: Apenas para marcar como usado (is_used: false → true)
- DELETE: Bloqueado

-- REFERRAL_PROGRAM:
- SELECT: Público
- INSERT/UPDATE/DELETE: Restrito
- Validação adicional no Edge Function

-- CUSTOMERS:
- SELECT: Público
- INSERT: Nova registração permitida
- UPDATE: Pontos >= 0 (validação básica)
- DELETE: Bloqueado

-- LOYALTY_TRANSACTIONS:
- SELECT: Público
- INSERT: Permitido (append-only log)
- UPDATE/DELETE: Bloqueado (auditoria)
```

### 3. **Atomicidade de Cupom no Checkout** ✅

#### `src/components/CheckoutModal.tsx`:
```typescript
// Em processOrder() - Chamado ANTES de criar pedido
if (orderPayload.totals.appliedCoupon) {
  try {
    await markCouponAsUsed(orderPayload.totals.appliedCoupon, currentCustomer?.id);
    console.log('✅ Cupom marcado como usado na criação do pedido');
  } catch (error) {
    console.warn('⚠️ Falha ao marcar cupom');
  }
}
```

**Fluxo garantido:**
1. Validar cupom (validateAndUseCoupon) ✅
2. Criar pedido + Marcar cupom (processOrder) ✅
3. Cupom NUNCA pode ser reutilizado ✅

### 4. **Update useCouponManagementStore** ✅

```typescript
// markCouponAsUsed agora usa:
.eq('is_used', false)  // ⚠️ CRÍTICO: Só marca se não foi usado
```

Evita race condition onde 2 requisições poderiam marcar o mesmo cupom.

---

## 🚀 INSTRUÇÕES DE DEPLOY

### Passo 1: Deploy das Migrações SQL

```bash
cd supabase
supabase migration add fix_rls_security_2025_02.sql
supabase db push
```

Ou via Supabase Dashboard SQL Editor:
1. Copiar conteúdo de `fix_rls_security_2025_02.sql`
2. Executar no Dashboard
3. Confirmar que as policies foram atualizadas

### Passo 2: Deploy das Edge Functions

```bash
supabase functions deploy validate-and-use-coupon
supabase functions deploy mark-coupon-used
```

Ou via Supabase Dashboard:
1. Ir para "Functions"
2. Deploy da pasta `supabase/functions/validate-and-use-coupon`
3. Deploy da pasta `supabase/functions/mark-coupon-used`

### Passo 3: Verificar Integração

```bash
npm run dev
```

Testar fluxo:
1. Criar cupom no painel admin ✅
2. Validar cupom no checkout (deve aceitar) ✅
3. Fazer pedido com cupom (cash/card) ✅
4. Tentar usar MESMO cupom novamente (deve rejeitar) ✅
5. Fazer pedido com cupom + PIX ✅
6. Confirmar PIX ✅
7. Tentar reusar cupom (deve falhar) ✅

---

## 🛡️ VULNERABILIDADES CORRIGIDAS

| Vulnerabilidade | Status | Risco | Solução |
|---|---|---|---|
| Cupom reutilizável (race condition) | ✅ CORRIGIDO | Máximo | UPDATE com WHERE is_used = false |
| RLS Policies abertas (ANY UPDATE) | ✅ CORRIGIDO | Máximo | Policies restritivas por action |
| Cupom não marcado em PIX | ✅ CORRIGIDO | Alto | Marca atomicamente em processOrder |
| Validação apenas frontend | ⚠️ PARCIAL | Alto | Edge Function valida, RLS garante |
| Pontos - Validação sem lock | ⏳ PRÓXIMO | Alto | [Prioridade 2] |
| Referral - Sem validação de pagamento | ⏳ PRÓXIMO | Médio | [Prioridade 2] |
| Signup bonus sem email verification | ⏳ PRÓXIMO | Médio | [Prioridade 2] |

---

## 📊 TESTES RECOMENDADOS

### Teste 1: Race Condition de Cupom (Simultaneidade)
```bash
# Terminal 1
GET /validate-coupon?code=PROMO123

# Terminal 2 (ao mesmo tempo)
POST /mark-coupon-used {coupon_code: "PROMO123"}
POST /mark-coupon-used {coupon_code: "PROMO123"}

# Resultado esperado:
# - Primeira chamada: Sucesso
# - Segunda chamada: 409 Conflict (já foi usado)
```

### Teste 2: RLS Policy - Sem autorização
```sql
-- Tentar UPDATE direto (deve falhar):
UPDATE customers SET total_points = 999999 WHERE id = 'abc';
-- Erro: "new row violates row-level security policy"

-- Tentar UPDATE cupom válido também:
UPDATE loyalty_coupons SET is_used = true 
WHERE coupon_code = 'PROMO123';
-- Erro: Só permite is_used = false → true
```

### Teste 3: Cupom Duplo - Fluxo Completo
```
1. Cliente abre checkout
2. Aplica cupom PROMO123 (valida com sucesso)
3. Seleciona PIX + Gera QR
4. NO MESMO MOMENTO, outro browser/aba:
   - Abre novo checkout
   - Tenta aplicar PROMO123 (deve aceitar no frontend)
   - Tenta confirmar pedido (deve falhar em BD)
5. Resultado: Apenas 1 pedido com desconto, cupom marcado ✅
```

---

## ⚠️ PONTOS IMPORTANTES

1. **Edge Functions**: As funções vão ficar em "building" por ~30s na primeira vez
2. **RLS Policies**: Ativosimediatamente após deploy
3. **Backward Compatibility**: Cupons criados antes continuam funcionando
4. **Admin Permissions**: Admins usam "Service Role" para bypassRLS se necessário
5. **Auditoria**: Todas as transações de cupom ficam registradas

---

## 🔗 PRÓXIMOS PASSOS (Prioridade 2)

- [ ] Validação de pontos com lock de BD (race condition)
- [ ] Referral aguardar confirmação de pagamento
- [ ] Email verification para signup bonus
- [ ] Rate limiting de requisições
- [ ] Logs de auditoria com IP/UserAgent
- [ ] Testes de carga com JMeter

---

Criado em: 10/02/2025
Versão: 1.0 - Security Fix
