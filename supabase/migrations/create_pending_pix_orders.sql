-- Tabela para armazenar pedidos PIX em espera de confirmação
-- Helps bridge between QR code generation and payment confirmation

CREATE TABLE IF NOT EXISTS pending_pix_orders (
    id TEXT PRIMARY KEY,
    payment_id TEXT NOT NULL,
    order_payload JSONB NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    expires_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() + INTERVAL '30 minutes',
    
    -- Customer info
    customer_name TEXT NOT NULL,
    customer_phone TEXT NOT NULL,
    customer_email TEXT,
    customer_id UUID,
    
    -- Status
    status TEXT DEFAULT 'pending', -- pending, confirmed, expired, failed
    confirmed_at TIMESTAMP WITH TIME ZONE
);

-- Index para buscas rápidas por payment_id
CREATE INDEX IF NOT EXISTS idx_pending_pix_orders_payment_id 
ON pending_pix_orders(payment_id);

-- Index para limpeza de expirados
CREATE INDEX IF NOT EXISTS idx_pending_pix_orders_expires_at 
ON pending_pix_orders(expires_at);

-- RLS Policy - Service role pode ler/escrever
ALTER TABLE pending_pix_orders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role can manage pending orders"
ON pending_pix_orders
FOR ALL
USING (
  auth.uid() = '00000000-0000-0000-0000-000000000000' OR 
  current_setting('role') = 'service_role'
)
WITH CHECK (
  auth.uid() = '00000000-0000-0000-0000-000000000000' OR 
  current_setting('role') = 'service_role'
);

-- Function para limpar pedidos expirados
CREATE OR REPLACE FUNCTION cleanup_expired_pending_pix_orders()
RETURNS void AS $$
BEGIN
  DELETE FROM pending_pix_orders
  WHERE status = 'pending' AND expires_at < NOW();
  
  RAISE NOTICE 'Cleanup: removed expired pending PIX orders';
END;
$$ LANGUAGE plpgsql;

-- Comentário para documentação
COMMENT ON TABLE pending_pix_orders IS 
'Armazena dados de pedidos PIX enquanto aguardam confirmação de pagamento. 
Quando o webhook confirma o pagamento, esses dados são usados para criar o order completo na tabela orders.
Expires automaticamente após 30 minutos.';
