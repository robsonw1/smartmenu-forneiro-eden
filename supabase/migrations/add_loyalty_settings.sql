-- Criar tabela de configurações de fidelização
CREATE TABLE IF NOT EXISTS loyalty_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  points_per_real DECIMAL(5,3) DEFAULT 1.0,         -- 1 ponto por R$1 gasto
  discount_per_100_points DECIMAL(5,2) DEFAULT 5.0, -- R$5 de desconto por 100 pontos
  min_points_to_redeem INTEGER DEFAULT 50,          -- Mínimo de 50 pontos para resgatar
  bronze_multiplier DECIMAL(5,3) DEFAULT 1.0,       -- 0% bônus (nível bronze = normal)
  silver_multiplier DECIMAL(5,3) DEFAULT 1.1,       -- 10% bônus em pontos
  gold_multiplier DECIMAL(5,3) DEFAULT 1.2,         -- 20% bônus em pontos
  silver_threshold INTEGER DEFAULT 500,             -- Pontos totais para atingir SILVER
  gold_threshold INTEGER DEFAULT 1500,              -- Pontos totais para atingir GOLD
  signup_bonus_points INTEGER DEFAULT 50,           -- Bônus de cadastro
  updated_at TIMESTAMP DEFAULT now()
);

-- Inserir configurações padrão se nenhuma existir
INSERT INTO loyalty_settings (id, points_per_real, discount_per_100_points, min_points_to_redeem, bronze_multiplier, silver_multiplier, gold_multiplier, silver_threshold, gold_threshold, signup_bonus_points)
VALUES ('550e8400-e29b-41d4-a716-446655440000', 1.0, 5.0, 50, 1.0, 1.1, 1.2, 500, 1500, 50)
ON CONFLICT (id) DO NOTHING;

-- Criar índice para acesso rápido
CREATE INDEX IF NOT EXISTS idx_loyalty_settings_id ON loyalty_settings(id);

-- Habilitar RLS
ALTER TABLE loyalty_settings ENABLE ROW LEVEL SECURITY;

-- Remover políticas antigas se existirem
DROP POLICY IF EXISTS "Allow public read loyalty_settings" ON loyalty_settings;
DROP POLICY IF EXISTS "Allow update loyalty_settings" ON loyalty_settings;

-- Política de leitura pública (admin pode ler)
CREATE POLICY "Allow public read loyalty_settings" 
  ON loyalty_settings FOR SELECT 
  USING (true);

-- Política de update para admin (será controlado pela aplicação)
CREATE POLICY "Allow update loyalty_settings" 
  ON loyalty_settings FOR UPDATE 
  USING (true)
  WITH CHECK (true);
