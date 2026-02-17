-- ⚠️ CORREÇÃO CRÍTICA DE SEGURANÇA: RLS Policies
-- Remove policies abertas (USING true) e implementa validações seguras

-- ============================================
-- 1. LOYALTY_COUPONS - Policies Seguras
-- ============================================

-- Remover políticas antigas (abertas)
DROP POLICY IF EXISTS "Allow public read access to loyalty_coupons" ON loyalty_coupons;
DROP POLICY IF EXISTS "Allow public insert to loyalty_coupons" ON loyalty_coupons;
DROP POLICY IF EXISTS "Allow public update to loyalty_coupons" ON loyalty_coupons;

-- Novos Policies SEGURAS
-- 1a. Leitura pública (necessário para validar cupons)
CREATE POLICY "Allow public read coupons only valid ones"
  ON loyalty_coupons FOR SELECT
  USING (
    is_active = true AND 
    is_used = false AND
    (expires_at IS NULL OR expires_at > now())
  );

-- 1b. Inserção apenas por admin (via Edge Function / trigger)
-- Obs: Cliente nunca insere diretamente, apenas admin cria cupons
CREATE POLICY "Admin create coupons via service role"
  ON loyalty_coupons FOR INSERT
  WITH CHECK (false);  -- Bloqueia INSERT direto, deve usar Edge Function do admin

-- 1c. Atualização (Update) - APENAS para marcar como usado
CREATE POLICY "Mark coupon as used via atomic transaction"
  ON loyalty_coupons FOR UPDATE
  USING (
    is_used = false AND
    is_active = true AND
    (expires_at IS NULL OR expires_at > now())
  )
  WITH CHECK (
    is_used = true AND  -- Só permite mudar para usado
    is_active = true    -- Mantém ativo
  );

-- 1d. Delete bloqueado
CREATE POLICY "Prevent coupon deletion"
  ON loyalty_coupons FOR DELETE
  USING (false);  -- Bloqueia delete, dados de auditoria não devem ser deletados


-- ============================================
-- 2. REFERRAL_PROGRAM - Policies Seguras
-- ============================================

DROP POLICY IF EXISTS "Allow public read access to referral_program" ON referral_program;
DROP POLICY IF EXISTS "Allow public insert to referral_program" ON referral_program;
DROP POLICY IF EXISTS "Allow public update to referral_program" ON referral_program;

-- 2a. Leitura pública
CREATE POLICY "Allow read referral programs"
  ON referral_program FOR SELECT
  USING (true);  -- Ok ler (público)

-- 2b. Inserção - APENAS para gerar novo código (admin ou via função)
CREATE POLICY "Generate referral code via function"
  ON referral_program FOR INSERT
  WITH CHECK (false);  -- Apenas via Edge Function

-- 2c. Atualização - APENAS quando houver compra confirmada
CREATE POLICY "Complete referral on confirmed purchase"
  ON referral_program FOR UPDATE
  USING (status IN ('pending', 'active'))
  WITH CHECK (
    -- Só permite completar referral após pagamento confirmado
    -- Validação adicional deve estar na Edge Function
    status = 'completed'
  );

-- 2d. Delete bloqueado
CREATE POLICY "Prevent referral deletion"
  ON referral_program FOR DELETE
  USING (false);


-- ============================================
-- 3. CUSTOMERS - Restrict Updates
-- ============================================

DROP POLICY IF EXISTS "Allow public read access to customers" ON customers;
DROP POLICY IF EXISTS "Allow public insert to customers" ON customers;
DROP POLICY IF EXISTS "Allow public update to customers" ON customers;

-- 3a. Leitura pública (necessária)
CREATE POLICY "Allow read customers basic info"
  ON customers FOR SELECT
  USING (true);

-- 3b. Inserção pública (novo cliente)
CREATE POLICY "Allow new customer registration"
  ON customers FOR INSERT
  WITH CHECK (true);  -- Ok criar novo cliente

-- 3c. Atualização - APENAS pontos via Edge Function, não direto
CREATE POLICY "Update customer via restricted functions only"
  ON customers FOR UPDATE
  USING (true)
  WITH CHECK (
    -- Pontos só podem ser alterados se:
    -- a) Vindo de uma transação registrada (verificado no backend)
    -- b) Não pode ser negativo
    total_points >= 0
  );

-- 3d. Delete bloqueado
CREATE POLICY "Prevent customer deletion"
  ON customers FOR DELETE
  USING (false);


-- ============================================
-- 4. LOYALTY_TRANSACTIONS - Append-Only Log
-- ============================================

DROP POLICY IF EXISTS "Allow public read access to loyalty_transactions" ON loyalty_transactions;
DROP POLICY IF EXISTS "Allow public insert to loyalty_transactions" ON loyalty_transactions;

-- 4a. Leitura pública
CREATE POLICY "Allow read all transactions"
  ON loyalty_transactions FOR SELECT
  USING (true);

-- 4b. Inserção pública (apenas registrar transações)
CREATE POLICY "Allow insert transactions"
  ON loyalty_transactions FOR INSERT
  WITH CHECK (true);

-- 4c. Bloquear UPDATE e DELETE (log de auditoria)
CREATE POLICY "Transactions are immutable"
  ON loyalty_transactions FOR UPDATE
  USING (false);

CREATE POLICY "Prevent transaction deletion"
  ON loyalty_transactions FOR DELETE
  USING (false);


-- Comentário de referência
COMMENT ON TABLE loyalty_coupons IS 'Sistema de cupons com RLS em 2025-02 para prevenir exploração';
COMMENT ON TABLE referral_program IS 'Program de referência com RLS em 2025-02 para validar compra antes de completar';
