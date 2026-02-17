-- Add payment-specific auto-print configurations
ALTER TABLE settings ADD COLUMN IF NOT EXISTS auto_print_pix BOOLEAN DEFAULT false;
ALTER TABLE settings ADD COLUMN IF NOT EXISTS auto_print_card BOOLEAN DEFAULT false;
ALTER TABLE settings ADD COLUMN IF NOT EXISTS auto_print_cash BOOLEAN DEFAULT false;
