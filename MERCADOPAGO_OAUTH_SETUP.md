# ============================================================
# MERCADO PAGO - OAUTH Configuration
# ============================================================

# Para habilitar OAuth do Mercado Pago:
# 1. Acesse https://developers.mercadopago.com/
# 2. Vá em "Aplicações" e crie uma nova app
# 3. Autorizar usuários → Configurar e obter credentials
# 4. Preencher os valores abaixo

# Client ID para OAuth (public, pode estar no .env.local do frontend)
VITE_MERCADOPAGO_CLIENT_ID=seu_client_id_aqui

# Client Secret (SECRETO! Manter apenas no servidor/Edge Functions)
# Use em .env.local do Supabase
MERCADOPAGO_CLIENT_SECRET=seu_client_secret_aqui

# URI para redirect após autorização (deve estar cadastrado no Mercado Pago)
# Padrão: https://seu-dominio.com/admin/mercadopago-callback
MERCADOPAGO_REDIRECT_URI=https://seu-dominio.com/admin/mercadopago-callback

# Token de acesso "fallback" (para quando cliente não conectou sua conta)
# Se deixar vazio, sistema obrigará cliente a conectar sua conta
MERCADO_PAGO_ACCESS_TOKEN=seu_token_fallback_aqui

# Secret para validar webhook signature
MERCADO_PAGO_WEBHOOK_SECRET=seu_webhook_secret_aqui

# ============================================================
# COMO FUNCIONA O FLUXO:
# ============================================================
# 1. Cliente clica "Conectar Mercado Pago" no admin
# 2. É redirecionado para Mercado Pago para autorizar
# 3. Autoriza e Mercado Pago redireciona para /admin/mercadopago-callback
# 4. Edge Function mercadopago-oauth-callback recebe código
# 5. Troca código por access_token e armazena no banco (tenants.mercadopago_access_token)
# 6. Webhook usa token do cliente para processar pagamentos
# 7. Pagamentos caem direto na conta do cliente!
# ============================================================
