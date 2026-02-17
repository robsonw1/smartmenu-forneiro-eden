# ✅ Teste Completo - Notificações WhatsApp

**Status**: ✅ Código atualizado e testado  
**Data**: 17/02/2026

---

## 🎯 O que foi CORRIGIDO

### 1️⃣ **Templates Padrão Não Eram Salvos**
**Antes**: Criava templates em memória mas nunca salvava no banco  
**Agora**: Salva automaticamente na primeira carga do admin

### 2️⃣ **Status em Português vs Inglês**
**Antes**: Templates usavam `confirmado: string` mas banco usava `confirmed`  
**Agora**: Tudo está em **inglês** consistente:
- `pending` (Pendente)
- `confirmed` (Confirmado)
- `preparing` (Preparando)
- `delivering` (Em Entrega)
- `delivered` (Entregue)
- `cancelled` (Cancelado)

### 3️⃣ **Logs Melhorados**
**Antes**: Pouco visível o que estava acontecendo  
**Agora**: Logs em formato ASCII art com emojis para fácil rastreamento

---

## 🧪 PASSO A PASSO DE TESTE

### **Fase 1: Verificar Templates (Backend)**

#### 1.1 - Abrir Admin Dashboard
- URL: `https://app-forneiro-eden.ehns1c.easypanel.host/admin/dashboard`
- Ir em: **Notificações** → Seção de "Notificações WhatsApp"

#### 1.2 - Templates Serão Criados Automaticamente
Na tela deve aparecer:
```
✅ Notificações WhatsApp configuradas!
```

#### 1.3 - Validar no Banco
Abrir: Supabase Dashboard → Database → `whatsapp_status_messages`

Deve ter **6 linhas** com status:
- ✅ `pending`
- ✅ `confirmed`
- ✅ `preparing`
- ✅ `delivering`
- ✅ `delivered`
- ✅ `cancelled`

Todos com `enabled = true`

---

### **Fase 2: Testar Envio Real**

#### 2.1 - Ir para Admin → Pedidos
- Clique em qualquer pedido com status "Pendente"
- Abra a modal de detalhes

#### 2.2 - Mudar Status para "Confirmado"
```
Alterar Status dropdown → "Confirmado" → Pressionar Enter
```

**Esperado**: Toast verde aparece: `"Status alterado para 'Confirmado'"`

#### 2.3 - Verificar Logs Console (F12)
Procure por:
```
╔═══════════════════════════════════════╗
║  UPDATE ORDER STATUS                  ║
╠═══════════════════════════════════════╣
║  Pedido:  PED-906100
║  Status:  confirmed
╚═══════════════════════════════════════╝

📦 Order data: { ..., customer_phone: "(21) 97224-3112", tenant_id: "..." }
✅ Status atualizado no banco: confirmed

🔔 [DISPARO-NOTIFICAÇÃO] Iniciando envio...
   Pedido: PED-906100
   Status: confirmed
   Telefone: (21) 97224-3112
   Tenant: (seu tenant id)
   Cliente: Robson William

✅ [WHATSAPP] Notificação disparada com sucesso: {...}
```

---

### **Fase 3: Verificar Logs da Edge Function**

#### 3.1 - Abrir Supabase Dashboard
- URL: `https://supabase.com/dashboard/project/lcstywjyktqdivoennhe`
- Ir em: **Functions** → `send-whatsapp-notification`

#### 3.2 - Abrir Aba "Logs"
Procure por logs com timestamp recente (últimos 5 minutos)

**Esperado**: Ver isto:
```
╔═══════════════════════════════════════╗
║  📱 NOTIFICAÇÃO WHATSAPP              ║
╠═══════════════════════════════════════╣
║  Pedido:    PED-906100
║  Status:    confirmed
║  Telefone:  (21) 97224-3112
║  Cliente:   Robson William
╚═══════════════════════════════════════╝

✅ [WHATSAPP] Validações OK
🔍 Procurando template para status: "confirmed"
✅ Template encontrado para status: "confirmed"

📝 Mensagem preparada:
   "🍕 Oi Robson William! Seu pedido #PED-906100 foi confirmado! ⏱️ Saindo do forno em ~25min"

📲 Telefone original: (21) 97224-3112
📲 Telefone formatado: 5521972243112

🚀 Enviando para: https://n8n-evolution.ehnsic.easypanal.host/message/sendText/forneiro-eden
✅ Mensagem enviada com sucesso para 5521972243112
```

---

### **Fase 4: Verificar Banco de Dados de Logs**

#### 4.1 - Abrir Supabase → Database
- Tabela: `whatsapp_notification_logs`

**Esperado**: Nova linha com:
- `order_id`: PED-906100
- `status`: confirmed
- `phone`: (21) 97224-3112
- `message_sent`: "🍕 Oi Robson William! Seu pedido #PED-906100 foi confirmado!..."
- `success`: **true** (verde)
- `error_message`: (NULL)

---

### **Fase 5: Testar com Todos os Status**

Repita a Fase 2 com **cada status**:

```javascript
Status disponíveis:
✅ Pendente → muda para → Confirmado
✅ Confirmado → muda para → Preparando
✅ Preparando → muda para → Em Entrega
✅ Em Entrega → muda para → Entregue
✅ Entregue → muda para → (qualquer um)
✅ Cancelado (a qualquer momento)
```

---

## 🚑 Se Não Funcionar

### **❌ Ao mudar status, nenhum log aparece**

**Diagnóstico**: Função não está sendo invocada

**Solução**:
1. Abrir Console (F12)
2. Verificar se há erro na invocação
3. Se houver erro 401/403, verificar credenciais Supabase

```bash
# Verificar credenciais no .env
cat .env | grep SUPABASE
```

---

### **❌ Logs aparecem mas dizem "No message template"**

**Diagnóstico**: Templates não foram salvos

**Solução**:
1. Abrir Supabase Dashboard
2. Ir em: Database → `whatsapp_status_messages`
3. Verificar se tem registros
4. Se vazio, executar SQL:

```sql
DELETE FROM whatsapp_status_messages;

INSERT INTO whatsapp_status_messages (tenant_id, status, message_template, enabled)
VALUES 
  ((SELECT id FROM tenants LIMIT 1), 'pending', '📋 Oi {nome}! Recebemos seu pedido #{pedido}. Você receberá uma confirmação em breve!', true),
  ((SELECT id FROM tenants LIMIT 1), 'confirmed', '🍕 Oi {nome}! Seu pedido #{pedido} foi confirmado! ⏱️ Saindo do forno em ~25min', true),
  ((SELECT id FROM tenants LIMIT 1), 'preparing', '👨‍🍳 Seu pedido #{pedido} está sendo preparado com capricho!', true),
  ((SELECT id FROM tenants LIMIT 1), 'delivering', '🚗 Seu pedido #{pedido} está a caminho! 📍 Chega em ~15min', true),
  ((SELECT id FROM tenants LIMIT 1), 'delivered', '✅ Pedido #{pedido} entregue! Valeu pela compra 🙏', true),
  ((SELECT id FROM tenants LIMIT 1), 'cancelled', '❌ Pedido #{pedido} foi cancelado. Em caso de dúvidas, nos contate!', true);
```

---

### **❌ Templates existem mas diz "Evolution API error: 404"**

**Diagnóstico**: Instância não está conectada OU endpoint errado

**Solução**:
1. Ir em Admin → Notificações
2. Verificar se status é **"Conectado"** (verde)
3. Se não:
   - Clique em "Criar Conexão"
   - Escaneie QR code com WhatsApp Business
   - Aguarde 5-10 segundos
4. Se problema continua, check logs do Evolution API

---

### **❌ Mensagem foi enviada conforme logs, mas cliente não recebe**

**Diagnóstico**: Problema na Evolution API ou WhatsApp não está genuinamente conectado

**Solução**:
1. Testar manualmente via Evolution API:

```bash
curl -X POST https://n8n-evolution.ehnsic.easypanal.host/message/sendText/forneiro-eden \
  -H "apikey: YOUR_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "number": "5521972243112",
    "text": "Teste de mensagem"
  }'
```

2. Se 404/erro, recriar a instância:
   - Admin → Notificações
   - Delete pedido anterior
   - Clique "Adicionar WhatsApp" → nova instância

---

## 📊 Checklist Final

- [ ] Build passou sem erros
- [ ] Admin carrega e mostra "Templates configurados"
- [ ] Banco tem 6 templates (pending, confirmed, preparing...)
- [ ] Console mostra logs de UPDATE ORDER STATUS
- [ ] Supabase logs mostram notificação sendo processada
- [ ] Tabela `whatsapp_notification_logs` tem novo registro
- [ ] Status de sucesso é TRUE ou FALSE?
  - ✅ TRUE = tudo funcionando
  - ❌ FALSE = ver `error_message` para diagnosticar

---

## 📞 Próximos Testes

1. **Testar com cliente real**: Criar um pedido, mudar status, verificar se WhatsApp recebe
2. **Testar todos os status**: Pendente → Confirmado → Preparando → Entregue
3. **Testar cancelamento**: Verificar se mensagem de cancelamento é enviada
4. **Performance**: Testar com 10+ pedidos mudando status simultaneamente

---

**Boa sorte! 🚀 Avise se tiver problemas nos logs!**
