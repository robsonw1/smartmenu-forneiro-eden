-- Adicionar campos de desconto de pontos à tabela orders
-- Esta migration permite rastrear descontos de pontos lealdade nos pedidos

ALTER TABLE orders ADD COLUMN IF NOT EXISTS points_discount DECIMAL(10, 2) DEFAULT 0;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS points_redeemed INTEGER DEFAULT 0;

-- Criar índices para facilitar consultas
CREATE INDEX IF NOT EXISTS idx_orders_points_discount ON orders(points_discount);
CREATE INDEX IF NOT EXISTS idx_orders_points_redeemed ON orders(points_redeemed);

-- Adicionar comentários para documentação
COMMENT ON COLUMN orders.points_discount IS 'Desconto em R$ aplicado através do resgate de pontos de lealdade';
COMMENT ON COLUMN orders.points_redeemed IS 'Quantidade de pontos de lealdade resgatados neste pedido';
