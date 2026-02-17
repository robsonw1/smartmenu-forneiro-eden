-- Handle pending_points when order is cancelled
-- Creates a trigger to clear pending_points if order status is changed to cancelled

CREATE OR REPLACE FUNCTION trg_handle_cancelled_order()
RETURNS TRIGGER AS $$
BEGIN
  -- If order is being cancelled, clear pending_points (they are not earned)
  IF NEW.status = 'cancelled' AND OLD.status != 'cancelled' THEN
    NEW.pending_points := 0;
    
    -- Also need to REVERSE any points that were already moved (if payment was already confirmed)
    IF OLD.status = 'confirmed' AND NEW.customer_id IS NOT NULL THEN
      -- This will be handled in application logic or via separate function
      -- For now, admin must manually reverse via UI
      RAISE LOG 'Order % cancelled but was already confirmed. Points may need manual reversal.', NEW.id;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop existing trigger if it exists
DROP TRIGGER IF EXISTS trg_handle_cancelled_order ON public.orders;

-- Create the trigger
CREATE TRIGGER trg_handle_cancelled_order
BEFORE UPDATE ON public.orders
FOR EACH ROW
EXECUTE FUNCTION trg_handle_cancelled_order();

COMMENT ON FUNCTION trg_handle_cancelled_order() IS 
'Clears pending_points when order is cancelled. Prevents points from being added to customer.';
