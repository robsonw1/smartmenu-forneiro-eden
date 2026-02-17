-- Sistema de Fidelização: Cupons Automáticos e Referral
-- Expande o sistema anterior com cupons por tier e programa de indicação

-- 1. Tabela de cupons automáticos por tier
CREATE TABLE IF NOT EXISTS loyalty_coupons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  coupon_code VARCHAR(50) UNIQUE NOT NULL,
  discount_percentage DECIMAL(5, 2) DEFAULT 10, -- 10% padrão
  discount_amount DECIMAL(10, 2), -- alternativa a percentual
  points_threshold INTEGER DEFAULT 100, -- ativa ao atingir X pontos
  is_active BOOLEAN DEFAULT TRUE,
  is_used BOOLEAN DEFAULT FALSE,
  used_at TIMESTAMP,
  expires_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT now()
);

-- 2. Tabela de referrals
CREATE TABLE IF NOT EXISTS referral_program (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  referrer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  referral_code VARCHAR(20) UNIQUE NOT NULL,
  referral_email VARCHAR(255),
  referred_customer_id UUID REFERENCES customers(id) ON DELETE SET NULL,
  status VARCHAR(50) DEFAULT 'pending', -- pending, completed, expired
  referrer_points_earned INTEGER DEFAULT 0,
  referred_points_earned INTEGER DEFAULT 0,
  bonus_points INTEGER DEFAULT 100, -- 100 pontos por referência
  created_at TIMESTAMP DEFAULT now(),
  completed_at TIMESTAMP,
  expires_at TIMESTAMP
);

-- 3. Criar índices
CREATE INDEX IF NOT EXISTS idx_loyalty_coupons_customer_id ON loyalty_coupons(customer_id);
CREATE INDEX IF NOT EXISTS idx_loyalty_coupons_coupon_code ON loyalty_coupons(coupon_code);
CREATE INDEX IF NOT EXISTS idx_loyalty_coupons_active ON loyalty_coupons(is_active, is_used);
CREATE INDEX IF NOT EXISTS idx_referral_program_referrer_id ON referral_program(referrer_id);
CREATE INDEX IF NOT EXISTS idx_referral_program_referral_code ON referral_program(referral_code);
CREATE INDEX IF NOT EXISTS idx_referral_program_status ON referral_program(status);

-- 4. Habilitar RLS
ALTER TABLE loyalty_coupons ENABLE ROW LEVEL SECURITY;
ALTER TABLE referral_program ENABLE ROW LEVEL SECURITY;

-- Políticas para leitura pública
CREATE POLICY "Allow public read access to loyalty_coupons" 
  ON loyalty_coupons FOR SELECT 
  USING (true);

CREATE POLICY "Allow public read access to referral_program" 
  ON referral_program FOR SELECT 
  USING (true);

-- Políticas para inserção pública
CREATE POLICY "Allow public insert to loyalty_coupons" 
  ON loyalty_coupons FOR INSERT 
  WITH CHECK (true);

CREATE POLICY "Allow public insert to referral_program" 
  ON referral_program FOR INSERT 
  WITH CHECK (true);

-- Políticas para atualização pública
CREATE POLICY "Allow public update to loyalty_coupons" 
  ON loyalty_coupons FOR UPDATE 
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow public update to referral_program" 
  ON referral_program FOR UPDATE 
  USING (true)
  WITH CHECK (true);
