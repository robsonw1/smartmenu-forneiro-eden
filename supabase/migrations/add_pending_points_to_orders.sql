-- Add pending_points column to orders table
-- Stores points earned from purchase temporarily until admin confirms payment

ALTER TABLE public.orders
ADD COLUMN pending_points NUMERIC DEFAULT 0;

-- Create comment explaining the column
COMMENT ON COLUMN public.orders.pending_points IS 
'Points earned from this purchase, stored temporarily. Moved to customer.total_points when payment is confirmed.';

-- Create index for querying pending points
CREATE INDEX idx_orders_pending_points ON public.orders(pending_points) 
WHERE pending_points > 0;
