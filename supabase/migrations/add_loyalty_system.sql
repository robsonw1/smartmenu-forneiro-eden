-- Sistema de Fidelização - Tabela de Clientes e Pontos
-- Migration para adicionar suporte a fidelização de clientes

-- 1. Criar tabela de clientes com sistema de pontos
CREATE TABLE IF NOT EXISTS customers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) NOT NULL UNIQUE,
  cpf VARCHAR(11) UNIQUE,
  name VARCHAR(255),
  phone VARCHAR(20),
  total_points INTEGER DEFAULT 0,
  total_spent DECIMAL(10, 2) DEFAULT 0,
  total_purchases INTEGER DEFAULT 0,
  is_registered BOOLEAN DEFAULT FALSE,
  registered_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT now(),
  updated_at TIMESTAMP DEFAULT now(),
  last_purchase_at TIMESTAMP
);

-- 2. Criar tabela de histórico de pontos (transações)
CREATE TABLE IF NOT EXISTS loyalty_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  order_id VARCHAR(255),
  points_earned INTEGER,
  points_spent INTEGER,
  transaction_type VARCHAR(50), -- 'purchase', 'redemption', 'signup_bonus'
  description TEXT,
  created_at TIMESTAMP DEFAULT now()
);

-- 3. Criar índices para performance
CREATE INDEX IF NOT EXISTS idx_customers_email ON customers(email);
CREATE INDEX IF NOT EXISTS idx_customers_cpf ON customers(cpf);
CREATE INDEX IF NOT EXISTS idx_loyalty_transactions_customer_id ON loyalty_transactions(customer_id);
CREATE INDEX IF NOT EXISTS idx_loyalty_transactions_created_at ON loyalty_transactions(created_at);

-- 4. Habilitar RLS (Row Level Security) - permitir leitura pública
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE loyalty_transactions ENABLE ROW LEVEL SECURITY;

-- Política para leitura pública (qualquer um pode ler)
CREATE POLICY "Allow public read access to customers" 
  ON customers FOR SELECT 
  USING (true);

CREATE POLICY "Allow public read access to loyalty_transactions" 
  ON loyalty_transactions FOR SELECT 
  USING (true);

-- Política para inserção pública
CREATE POLICY "Allow public insert to customers" 
  ON customers FOR INSERT 
  WITH CHECK (true);

CREATE POLICY "Allow public insert to loyalty_transactions" 
  ON loyalty_transactions FOR INSERT 
  WITH CHECK (true);

-- Política para atualização pública
CREATE POLICY "Allow public update to customers" 
  ON customers FOR UPDATE 
  USING (true)
  WITH CHECK (true);
