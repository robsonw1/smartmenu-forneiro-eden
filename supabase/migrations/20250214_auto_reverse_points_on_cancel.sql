-- Auto-reverse loyalty points when order is cancelled
-- Handles both pending points and redeemed points reversal
-- Works for all payment methods (PIX, Card, Cash)

CREATE OR REPLACE FUNCTION fn_reverse_points_on_cancel()
RETURNS TRIGGER AS $$
DECLARE
  v_pending_points INTEGER;
  v_customer_id UUID;
  v_points_redeemed INTEGER;
  v_order_id TEXT;
BEGIN
  -- If order is being cancelled from any confirmed/pending status
  IF NEW.status = 'cancelled' AND OLD.status IN ('confirmed', 'pending', 'preparing', 'delivering') THEN
    v_customer_id := NEW.customer_id;
    v_pending_points := COALESCE(OLD.pending_points, 0);
    v_points_redeemed := COALESCE(OLD.points_redeemed, 0);
    v_order_id := NEW.id;
    
    RAISE LOG '[CANCEL] 🔴 === INICIANDO REVERSÃO DE PONTOS PARA PEDIDO % ===', v_order_id;
    RAISE LOG '[CANCEL] pendingPoints=%  pointsRedeemed=% customerID=%', v_pending_points, v_points_redeemed, v_customer_id;
    
    -- 1️⃣ SE CLIENTE USOU PONTOS (pointsRedeemed > 0): RESTAURAR OS PONTOS
    IF v_points_redeemed > 0 AND v_customer_id IS NOT NULL THEN
      BEGIN
        UPDATE public.customers
        SET total_points = total_points + v_points_redeemed
        WHERE id = v_customer_id;
        
        INSERT INTO public.loyalty_transactions (
          customer_id, 
          order_id,
          points_earned, 
          transaction_type, 
          description, 
          created_at
        )
        VALUES (
          v_customer_id,
          v_order_id,
          v_points_redeemed,
          'cancellation_reversal',
          concat('Cancelamento do pedido ', v_order_id, ' - Restauração de ', v_points_redeemed, ' pontos resgatados'),
          NOW()
        );
        
        RAISE LOG '[CANCEL] ✅ PONTOS RESTAURADOS para cliente %: +% pontos devolvidos', v_customer_id, v_points_redeemed;
      EXCEPTION WHEN OTHERS THEN
        RAISE LOG '[CANCEL] ❌ ERRO ao restaurar pontos: %', SQLERRM;
      END;
    END IF;
    
    -- 2️⃣ SE CLIENTE GANHOU PONTOS (pendingPoints > 0): REMOVER OS PONTOS PENDENTES
    IF v_pending_points > 0 AND v_customer_id IS NOT NULL THEN
      BEGIN
        -- NÃO subtrair do total_points pois pending_points ainda não foram movidos
        -- Apenas registrar que estos pontos foram cancelados
        INSERT INTO public.loyalty_transactions (
          customer_id, 
          order_id,
          points_spent, 
          transaction_type, 
          description, 
          created_at
        )
        VALUES (
          v_customer_id,
          v_order_id,
          v_pending_points,
          'cancellation_reversal',
          concat('Cancelamento do pedido ', v_order_id, ' - Remoção de ', v_pending_points, ' pontos pendentes não ganhos'),
          NOW()
        );
        
        RAISE LOG '[CANCEL] ✅ PONTOS PENDENTES REMOVIDOS do pedido %: -%  pontos descartados', v_order_id, v_pending_points;
      EXCEPTION WHEN OTHERS THEN
        RAISE LOG '[CANCEL] ❌ ERRO ao remover pending_points: %', SQLERRM;
      END;
    END IF;
    
    -- 3️⃣ LIMPAR PENDING_POINTS NO PEDIDO
    NEW.pending_points := 0;
    RAISE LOG '[CANCEL] ✅ Status atualizado para cancelled e processos completados para pedido %', v_order_id;
    
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop existing trigger if it exists to avoid conflicts
DROP TRIGGER IF EXISTS trg_reverse_points_on_cancel ON public.orders;

-- Create trigger for order cancellation
CREATE TRIGGER trg_reverse_points_on_cancel
BEFORE UPDATE ON public.orders
FOR EACH ROW
EXECUTE FUNCTION fn_reverse_points_on_cancel();

COMMENT ON FUNCTION fn_reverse_points_on_cancel() IS 
'Automatically reverses loyalty points when an order is cancelled. 
Works for all payment methods (PIX, Card, Cash).
Handles two cases:
1. If points_redeemed > 0: restores them to customer total_points (customer paid with points discount)
2. If pending_points > 0: records them as cancelled (prevents earning points on cancelled purchase)
This ensures punkt integrity and prevents fraud.';
