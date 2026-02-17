-- ============================================================
-- OAUTH MERCADO PAGO: Permitir clientes conectar sua própria conta
-- Data: 10/02/2026
-- ============================================================

-- Adicionar colunas para armazenar credenciais OAuth do Mercado Pago
ALTER TABLE tenants
  ADD COLUMN IF NOT EXISTS mercadopago_access_token VARCHAR(500),
  ADD COLUMN IF NOT EXISTS mercadopago_refresh_token VARCHAR(500),
  ADD COLUMN IF NOT EXISTS mercadopago_user_id VARCHAR(100),
  ADD COLUMN IF NOT EXISTS mercadopago_merchant_account_id VARCHAR(100),
  ADD COLUMN IF NOT EXISTS mercadopago_connected_at TIMESTAMP,
  ADD COLUMN IF NOT EXISTS mercadopago_token_expires_at TIMESTAMP,
  ADD COLUMN IF NOT EXISTS mercadopago_oauth_state VARCHAR(255);

-- Índice para buscar tenant por estado OAuth (para validação)
CREATE INDEX IF NOT EXISTS idx_tenants_oauth_state ON tenants(mercadopago_oauth_state);

-- Índice para buscar tenant por access token
CREATE INDEX IF NOT EXISTS idx_tenants_access_token ON tenants(mercadopago_access_token);

-- ============================================================
-- FUNÇÃO: Atualizar credenciais OAuth do Mercado Pago
-- ============================================================

CREATE OR REPLACE FUNCTION update_mercadopago_credentials(
  p_tenant_id UUID,
  p_access_token VARCHAR,
  p_refresh_token VARCHAR,
  p_user_id VARCHAR,
  p_merchant_account_id VARCHAR,
  p_expires_in INT DEFAULT 21600  -- 6 horas padrão
)
RETURNS TABLE(success BOOLEAN, message TEXT) AS $$
DECLARE
  v_expires_at TIMESTAMP;
BEGIN
  v_expires_at := NOW() + (p_expires_in || ' seconds')::INTERVAL;
  
  UPDATE tenants
  SET 
    mercadopago_access_token = p_access_token,
    mercadopago_refresh_token = p_refresh_token,
    mercadopago_user_id = p_user_id,
    mercadopago_merchant_account_id = p_merchant_account_id,
    mercadopago_connected_at = NOW(),
    mercadopago_token_expires_at = v_expires_at,
    mercadopago_oauth_state = NULL  -- Limpar state após sucesso
  WHERE id = p_tenant_id;
  
  IF NOT FOUND THEN
    RETURN QUERY SELECT FALSE, 'Tenant não encontrado'::TEXT;
    RETURN;
  END IF;
  
  RETURN QUERY SELECT TRUE, 'Credenciais atualizadas com sucesso'::TEXT;
  
EXCEPTION WHEN OTHERS THEN
  RETURN QUERY SELECT FALSE, SQLERRM::TEXT;
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- FUNÇÃO: Validar se token está expirado
-- ============================================================

CREATE OR REPLACE FUNCTION is_mercadopago_token_expired(p_tenant_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
  v_expires_at TIMESTAMP;
BEGIN
  SELECT mercadopago_token_expires_at INTO v_expires_at
  FROM tenants
  WHERE id = p_tenant_id;
  
  IF v_expires_at IS NULL THEN
    RETURN TRUE;  -- Sem token = expirado
  END IF;
  
  RETURN v_expires_at < NOW();
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- FUNÇÃO: Obter token válido do Mercado Pago (com refresh se necessário)
-- ============================================================

CREATE OR REPLACE FUNCTION get_mercadopago_access_token(p_tenant_id UUID)
RETURNS VARCHAR AS $$
DECLARE
  v_access_token VARCHAR;
  v_is_expired BOOLEAN;
BEGIN
  SELECT mercadopago_access_token, is_mercadopago_token_expired(p_tenant_id)
  INTO v_access_token, v_is_expired
  FROM tenants
  WHERE id = p_tenant_id;
  
  IF v_access_token IS NULL THEN
    RETURN NULL;
  END IF;
  
  -- Se expirou, retorna NULL (frontend/backend deve fazer refresh)
  IF v_is_expired THEN
    RETURN NULL;
  END IF;
  
  RETURN v_access_token;
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- COMENTÁRIOS
-- ============================================================

COMMENT ON COLUMN tenants.mercadopago_access_token IS 'Token de acesso OAuth do Mercado Pago do cliente';
COMMENT ON COLUMN tenants.mercadopago_refresh_token IS 'Token de refresh para renovar access_token';
COMMENT ON COLUMN tenants.mercadopago_user_id IS 'ID do usuário Mercado Pago';
COMMENT ON COLUMN tenants.mercadopago_merchant_account_id IS 'ID da conta merchant Mercado Pago';
COMMENT ON COLUMN tenants.mercadopago_connected_at IS 'Data de conexão com Mercado Pago';
COMMENT ON COLUMN tenants.mercadopago_token_expires_at IS 'Data de expiração do token';
COMMENT ON COLUMN tenants.mercadopago_oauth_state IS 'State aleatório para validar callback OAuth';

COMMENT ON FUNCTION update_mercadopago_credentials IS 'Atualiza credenciais OAuth do Mercado Pago do tenant';
COMMENT ON FUNCTION is_mercadopago_token_expired IS 'Verifica se token do Mercado Pago está expirado';
COMMENT ON FUNCTION get_mercadopago_access_token IS 'Obtém token de acesso válido, retorna NULL se expirado';
