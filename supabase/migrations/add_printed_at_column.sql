-- Add printed_at column to track when orders were sent to the printer
ALTER TABLE orders ADD COLUMN IF NOT EXISTS printed_at TIMESTAMP;

-- Create index for faster filtering
CREATE INDEX IF NOT EXISTS idx_orders_printed_at ON orders(printed_at);
