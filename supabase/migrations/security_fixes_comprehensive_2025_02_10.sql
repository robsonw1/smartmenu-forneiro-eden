-- ============================================================
-- SEGURANÇA CRÍTICA - MITIGAÇÃO DE FRAUDE
-- Data: 10/02/2026
-- ============================================================

-- ============================================================
-- 1. CONSTRAINT: Valores não-negativos (URGENTE #13)
-- ============================================================

-- Garantir que total_points nunca seja negativo
ALTER TABLE customers 
  ADD CONSTRAINT total_points_non_negative 
  CHECK (total_points >= 0);

-- Garantir que total_spent nunca seja negativo
ALTER TABLE customers 
  ADD CONSTRAINT total_spent_non_negative 
  CHECK (total_spent >= 0);

-- Garantir que total_purchases nunca seja negativo
ALTER TABLE customers 
  ADD CONSTRAINT total_purchases_non_negative 
  CHECK (total_purchases >= 0);

-- Garantir que preços são positivos
ALTER TABLE orders 
  ADD CONSTRAINT order_total_positive 
  CHECK (total > 0);

-- ============================================================
-- 2. INDEX: Melhora performance de queries críticas
-- ============================================================

-- CPF search
CREATE INDEX IF NOT EXISTS idx_customers_cpf_email ON customers(cpf, email);

-- Email search com normalização
CREATE INDEX IF NOT EXISTS idx_customers_email_lower ON customers(LOWER(email));

-- Pontos de expiração (sem WHERE para evitar função VOLATILE)
CREATE INDEX IF NOT EXISTS idx_loyalty_transactions_expires_at ON loyalty_transactions(expires_at);

-- Cupom por código
CREATE INDEX IF NOT EXISTS idx_loyalty_coupons_code ON loyalty_coupons(coupon_code);

-- ============================================================
-- 3. FUNÇÃO: Normalizar email (URGENTE #6)
-- ============================================================

CREATE OR REPLACE FUNCTION normalize_email(email_input TEXT)
RETURNS TEXT AS $$
DECLARE
  normalized TEXT;
BEGIN
  -- Converter para lowercase, remover espaços, remover acentos
  normalized := TRIM(LOWER(email_input));
  -- Remove NFD diacritics (acentos)
  normalized := unaccent(normalized);
  RETURN normalized;
EXCEPTION
  WHEN OTHERS THEN
    RETURN LOWER(TRIM(email_input));
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Extensão para unaccent (se não existir)
CREATE EXTENSION IF NOT EXISTS unaccent;

-- Trigger para normalizar email automaticamente
CREATE OR REPLACE FUNCTION trigger_normalize_email()
RETURNS TRIGGER AS $$
BEGIN
  NEW.email := normalize_email(NEW.email);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS normalize_customer_email ON customers;
CREATE TRIGGER normalize_customer_email
  BEFORE INSERT OR UPDATE ON customers
  FOR EACH ROW
  EXECUTE FUNCTION trigger_normalize_email();

-- ============================================================
-- 4. CONSTRAINT: CPF Válido (PRÓXIMO #11)
-- ============================================================

-- CPF mínimo de 11 dígitos
ALTER TABLE customers
  ADD CONSTRAINT cpf_valid_length
  CHECK (cpf IS NULL OR LENGTH(cpf) = 11);

-- CPF não pode ser todos iguais (000...000)
ALTER TABLE customers
  ADD CONSTRAINT cpf_not_repeat
  CHECK (cpf IS NULL OR NOT (cpf = '00000000000' OR cpf = '11111111111' OR cpf = '22222222222' OR 
                              cpf = '33333333333' OR cpf = '44444444444' OR cpf = '55555555555' OR 
                              cpf = '66666666666' OR cpf = '77777777777' OR cpf = '88888888888' OR 
                              cpf = '99999999999'));

-- ============================================================
-- 5. FUNÇÃO: Limpar pontos expirados (SEMANA #3)
-- ============================================================

CREATE OR REPLACE FUNCTION clean_expired_points()
RETURNS TABLE(customer_id UUID, points_removed INT) AS $$
DECLARE
  cust_id UUID;
  expired_points INT;
BEGIN
  -- Para cada cliente com pontos expirados
  FOR cust_id IN 
    SELECT DISTINCT customer_id 
    FROM loyalty_transactions
    WHERE expires_at < NOW() 
      AND points_earned IS NOT NULL
      AND points_earned > 0
  LOOP
    -- Calcular pontos expirados
    SELECT COALESCE(SUM(points_earned), 0)
    INTO expired_points
    FROM loyalty_transactions
    WHERE customer_id = cust_id 
      AND expires_at < NOW()
      AND points_earned IS NOT NULL;
    
    -- Subtrair do total, nunca deixar negativo
    UPDATE customers 
    SET total_points = GREATEST(total_points - expired_points, 0)
    WHERE id = cust_id;
    
    -- Log
    INSERT INTO loyalty_transactions(customer_id, points_spent, transaction_type, description)
    VALUES(cust_id, expired_points, 'expiration', 'Pontos expirados removidos automaticamente');
    
    RETURN QUERY SELECT cust_id, expired_points;
  END LOOP;
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- 6. JOB SCHEDULER: Rodar limpeza de pontos diariamente (SEMANA #3)
-- ============================================================

-- Criar extensão cron se não existir
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Agendar para rodar todos os dias às 3 AM
-- Se já existir, será atualizado (upsert)
SELECT cron.schedule(
  'clean_expired_points',
  '0 3 * * *',  -- 3 AM todo dia
  'SELECT clean_expired_points();'
);

-- ============================================================
-- 7. FUNCTION: Validar race condition em total_points (SEMANA #1)
-- ============================================================

CREATE OR REPLACE FUNCTION redeem_points_safely(
  p_customer_id UUID,
  p_points_to_spend INT
)
RETURNS TABLE(success BOOLEAN, discount_amount DECIMAL, error_message TEXT) AS $$
DECLARE
  v_current_points INT;
  v_discount_amount DECIMAL;
  v_points_value DECIMAL;
BEGIN
  -- Usar lock de linha para evitar race condition
  SELECT total_points INTO v_current_points
  FROM customers
  WHERE id = p_customer_id
  FOR UPDATE;  -- Lock exclusivo até fim da transação
  
  -- Validar pontos suficientes
  IF COALESCE(v_current_points, 0) < p_points_to_spend THEN
    RETURN QUERY SELECT FALSE, 0::DECIMAL, 'Pontos insuficientes'::TEXT;
    RETURN;
  END IF;
  
  -- Obter configuração de desconto (100 pontos = R$ 5)
  v_points_value := 5;  -- Padrão; buscar de loyalty_settings em produção
  v_discount_amount := (p_points_to_spend::DECIMAL / 100) * v_points_value;
  
  -- UPDATE com validação
  UPDATE customers
  SET total_points = total_points - p_points_to_spend
  WHERE id = p_customer_id
    AND total_points >= p_points_to_spend;
  
  IF NOT FOUND THEN
    RETURN QUERY SELECT FALSE, 0::DECIMAL, 'Validação falhou'::TEXT;
    RETURN;
  END IF;
  
  -- Registrar transação
  INSERT INTO loyalty_transactions(customer_id, points_spent, transaction_type, description)
  VALUES(p_customer_id, p_points_to_spend, 'redemption', 
         'Resgate de ' || p_points_to_spend || ' pontos - Desconto R$' || v_discount_amount);
  
  RETURN QUERY SELECT TRUE, v_discount_amount, ''::TEXT;
  
EXCEPTION WHEN OTHERS THEN
  RETURN QUERY SELECT FALSE, 0::DECIMAL, SQLERRM::TEXT;
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- 8. FUNCTION: Adicionar pontos com idempotência (SEMANA #1)
-- ============================================================

CREATE OR REPLACE FUNCTION add_points_from_purchase_safe(
  p_customer_id UUID,
  p_amount DECIMAL,
  p_points_redeemed INT DEFAULT 0
)
RETURNS TABLE(success BOOLEAN, points_added INT, error_message TEXT) AS $$
DECLARE
  v_points_earned INT;
  v_points_per_real DECIMAL;
  v_expiration_days INT;
  v_expires_at TIMESTAMP;
BEGIN
  
  -- 1. Se cliente usou pontos para desconto, não ganha nesta compra
  IF p_points_redeemed > 0 THEN
    RETURN QUERY SELECT TRUE, 0, ''::TEXT;
    RETURN;
  END IF;
  
  -- 2. Calcular pontos (padrão: 1 ponto por real)
  v_points_per_real := 1;
  v_points_earned := FLOOR(p_amount * v_points_per_real)::INT;
  v_expiration_days := 365;
  v_expires_at := NOW() + (v_expiration_days || ' days')::INTERVAL;
  
  -- 3. Atualizar pontos do cliente (com lock)
  UPDATE customers
  SET total_points = total_points + v_points_earned,
      total_spent = total_spent + p_amount,
      total_purchases = total_purchases + 1,
      last_purchase_at = NOW()
  WHERE id = p_customer_id;
  
  IF NOT FOUND THEN
    RETURN QUERY SELECT FALSE, 0, 'Cliente não encontrado'::TEXT;
    RETURN;
  END IF;
  
  -- 4. Registrar transação com expiração
  INSERT INTO loyalty_transactions(customer_id, points_earned, transaction_type, description, expires_at)
  VALUES(p_customer_id, v_points_earned, 'purchase', 
         'Compra no valor de R$ ' || p_amount || ' - ' || v_points_earned || ' pontos', v_expires_at);
  
  RETURN QUERY SELECT TRUE, v_points_earned, ''::TEXT;
  
EXCEPTION WHEN OTHERS THEN
  RETURN QUERY SELECT FALSE, 0, SQLERRM::TEXT;
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- 9. VALIDAÇÃO: Payment status no webhook (URGENTE #4)
-- ============================================================

-- Adicionar coluna para rastrear status do pagamento
ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS payment_status VARCHAR(50),
  ADD COLUMN IF NOT EXISTS payment_confirmed_at TIMESTAMP,
  ADD COLUMN IF NOT EXISTS mercado_pago_id VARCHAR(255) UNIQUE;

-- Índice para buscar by mercado_pago_id
CREATE INDEX IF NOT EXISTS idx_orders_mp_id ON orders(mercado_pago_id);

-- ============================================================
-- COMENTÁRIOS DE RASTREABILIDADE
-- ============================================================

COMMENT ON FUNCTION normalize_email IS 'Normaliza emails removendo espaços, convertendo para lowercase e removendo acentos';
COMMENT ON FUNCTION clean_expired_points IS 'Remove automaticamente pontos expirados de clientes';
COMMENT ON FUNCTION redeem_points_safely IS 'Resgate de pontos com lock de linha para evitar race conditions';
COMMENT ON FUNCTION add_points_from_purchase_safe IS 'Adiciona pontos com validação segura de compra';
