import { useEffect } from 'react';
import { useSettingsStore } from '@/store/useSettingsStore';
import { supabase } from '@/integrations/supabase/client';

/**
 * Hook dedicado para monitorar mudanças de isManuallyOpen
 * Usado especificamente no CheckoutModal para atualizar em tempo real
 * enquanto o cliente está fazendo o pedido
 */
export function useStoreStatusRealtime(isCheckoutOpen: boolean) {
  const updateSettings = useSettingsStore((s) => s.updateSettings);

  useEffect(() => {
    if (!isCheckoutOpen) return; // Só ativa se checkout está aberto

    let isSubscribed = true;
    let channel: any = null;

    console.log('🛍️ [CHECKOUT-REALTIME] Ativando monitoramento de status da loja...');

    const setupRealtimeSync = async () => {
      try {
        // Carregar status atual
        const { data, error } = await supabase
          .from('settings')
          .select('enable_scheduling, min_schedule_minutes, max_schedule_days, allow_scheduling_on_closed_days, allow_scheduling_outside_business_hours')
          .eq('id', 'store-settings')
          .single();

        if (!error && data && isSubscribed) {
          const settingsData = data as any;
          console.log('🛍️ [CHECKOUT-REALTIME] Status atual:', {
            enableScheduling: settingsData.enable_scheduling,
          });

          await updateSettings({
            enableScheduling: settingsData.enable_scheduling ?? false,
            minScheduleMinutes: settingsData.min_schedule_minutes ?? 30,
            maxScheduleDays: settingsData.max_schedule_days ?? 7,
            allowSchedulingOnClosedDays: settingsData.allow_scheduling_on_closed_days ?? false,
            allowSchedulingOutsideBusinessHours: settingsData.allow_scheduling_outside_business_hours ?? false,
          });
        }
      } catch (error) {
        console.error('❌ [CHECKOUT-REALTIME] Erro ao carregar status:', error);
      }
    };

    setupRealtimeSync();

    // Subscrever a mudanças
    channel = supabase
      .channel(`checkout-status-${Date.now()}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'settings',
          filter: 'id=eq.store-settings',
        },
        async (payload: any) => {
          if (!isSubscribed) return;

          const newData = payload.new as any;

          console.log('⚡ [CHECKOUT-REALTIME] MUDANÇA DETECTADA');
          console.log('📊 [CHECKOUT-REALTIME] Novos dados:', {
            enableScheduling: newData.enable_scheduling,
            minScheduleMinutes: newData.min_schedule_minutes,
          });

          // Atualizar campos críticos
          await updateSettings({
            enableScheduling: newData.enable_scheduling ?? false,
            minScheduleMinutes: newData.min_schedule_minutes ?? 30,
            maxScheduleDays: newData.max_schedule_days ?? 7,
            allowSchedulingOnClosedDays: newData.allow_scheduling_on_closed_days ?? false,
            allowSchedulingOutsideBusinessHours: newData.allow_scheduling_outside_business_hours ?? false,
          });

          console.log('✅ [CHECKOUT-REALTIME] Status da loja atualizado em tempo real!');
        }
      )
      .subscribe((status, error) => {
        if (status === 'SUBSCRIBED') {
          console.log('✅ [CHECKOUT-REALTIME] ⚡ Monitorando status da loja em tempo real');
        } else if (status === 'CLOSED') {
          console.log('🔴 [CHECKOUT-REALTIME] Monitoramento encerrado');
        } else if (error) {
          console.error('❌ [CHECKOUT-REALTIME] Erro:', error);
        }
      });

    return () => {
      isSubscribed = false;
      if (channel) {
        console.log('🛍️ [CHECKOUT-REALTIME] Desativando monitoramento');
        supabase.removeChannel(channel);
      }
    };
  }, [isCheckoutOpen]);
}
