import { useEffect } from 'react';
import { useSettingsStore } from '@/store/useSettingsStore';
import { supabase } from '@/integrations/supabase/client';

/**
 * Hook que sincroniza as configurações em tempo real do Supabase
 * SINCRONIZA: isManuallyOpen (CRÍTICO), schedule, timing, etc
 */
export function useSettingsRealtimeSync() {
  const updateSettings = useSettingsStore((s) => s.updateSettings);

  useEffect(() => {
    let isSubscribed = true;
    let channel: any = null;

    const setupRealtimeSync = async () => {
      try {
        console.log('🔄 [SETTINGS-SYNC] Carregando configurações do Supabase...');
        
        const { data, error } = await supabase
          .from('settings')
          .select('*')
          .eq('id', 'store-settings')
          .single();

        if (error) {
          console.error('❌ [SETTINGS-SYNC] Erro ao carregar settings:', error.message);
          return;
        }

        if (data && isSubscribed) {
          console.log('📥 [SETTINGS-SYNC] Configurações carregadas com sucesso');
          
          const settingsData = data as any;
          const valueJson = settingsData.value || {};
          
          console.log('👀 [SETTINGS-SYNC] isManuallyOpen:', valueJson.isManuallyOpen);
          console.log('⏰ [SETTINGS-SYNC] schedule:', valueJson.schedule);

          // Mapear TODOS os campos para o store
          await updateSettings({
            name: valueJson.name || 'Forneiro Éden',
            phone: valueJson.phone || '(11) 99999-9999',
            address: valueJson.address || 'Rua das Pizzas, 123 - Centro',
            slogan: valueJson.slogan || 'A Pizza mais recheada da cidade 🇮🇹',
            schedule: valueJson.schedule || {},
            isManuallyOpen: valueJson.isManuallyOpen ?? true,
            deliveryTimeMin: valueJson.deliveryTimeMin ?? 60,
            deliveryTimeMax: valueJson.deliveryTimeMax ?? 70,
            pickupTimeMin: valueJson.pickupTimeMin ?? 40,
            pickupTimeMax: valueJson.pickupTimeMax ?? 50,
            orderAlertEnabled: valueJson.orderAlertEnabled ?? true,
            sendOrderSummaryToWhatsApp: valueJson.sendOrderSummaryToWhatsApp ?? false,
            enableScheduling: settingsData.enable_scheduling ?? false,
            minScheduleMinutes: settingsData.min_schedule_minutes ?? 30,
            maxScheduleDays: settingsData.max_schedule_days ?? 7,
            allowSchedulingOnClosedDays: settingsData.allow_scheduling_on_closed_days ?? false,
            allowSchedulingOutsideBusinessHours: settingsData.allow_scheduling_outside_business_hours ?? false,
            respectBusinessHoursForScheduling: settingsData.respect_business_hours_for_scheduling ?? true,
            allowSameDaySchedulingOutsideHours: settingsData.allow_same_day_scheduling_outside_hours ?? false,
          });
          
          console.log('✅ [SETTINGS-SYNC] Store atualizado com SUCESSO na primeira carga');
        }
      } catch (error) {
        console.error('❌ [SETTINGS-SYNC] Erro ao configurar realtime:', error);
      }
    };

    setupRealtimeSync();

    // Inscrever-se a mudanças em TEMPO REAL
    channel = supabase
      .channel('settings-realtime-sync')
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

          console.log('⚡⚡⚡ [SETTINGS-SYNC] MUDANÇA DETECTADA EM TEMPO REAL ⚡⚡⚡');
          
          const newData = payload.new as any;
          const newValueJson = newData.value || {};
          
          console.log('🔴 [SETTINGS-SYNC] NOVO isManuallyOpen:', newValueJson.isManuallyOpen);
          console.log('📊 [SETTINGS-SYNC] Novos dados completos:', {
            isManuallyOpen: newValueJson.isManuallyOpen,
            schedule: newValueJson.schedule,
            enable_scheduling: newData.enable_scheduling,
          });

          // Atualizar TODOS os campos
          await updateSettings({
            name: newValueJson.name || 'Forneiro Éden',
            phone: newValueJson.phone || '(11) 99999-9999',
            address: newValueJson.address || 'Rua das Pizzas, 123 - Centro',
            slogan: newValueJson.slogan || 'A Pizza mais recheada da cidade 🇮🇹',
            schedule: newValueJson.schedule || {},
            isManuallyOpen: newValueJson.isManuallyOpen ?? true,
            deliveryTimeMin: newValueJson.deliveryTimeMin ?? 60,
            deliveryTimeMax: newValueJson.deliveryTimeMax ?? 70,
            pickupTimeMin: newValueJson.pickupTimeMin ?? 40,
            pickupTimeMax: newValueJson.pickupTimeMax ?? 50,
            orderAlertEnabled: newValueJson.orderAlertEnabled ?? true,
            sendOrderSummaryToWhatsApp: newValueJson.sendOrderSummaryToWhatsApp ?? false,
            enableScheduling: newData.enable_scheduling ?? false,
            minScheduleMinutes: newData.min_schedule_minutes ?? 30,
            maxScheduleDays: newData.max_schedule_days ?? 7,
            allowSchedulingOnClosedDays: newData.allow_scheduling_on_closed_days ?? false,
            allowSchedulingOutsideBusinessHours: newData.allow_scheduling_outside_business_hours ?? false,
            respectBusinessHoursForScheduling: newData.respect_business_hours_for_scheduling ?? true,
            allowSameDaySchedulingOutsideHours: newData.allow_same_day_scheduling_outside_hours ?? false,
          });

          console.log('✅✅✅ [SETTINGS-SYNC] Store SINCRONIZADO em tempo real ✅✅✅');
        }
      )
      .subscribe((status, error) => {
        if (status === 'SUBSCRIBED') {
          console.log('✅ [SETTINGS-SYNC] Canal Realtime ATIVO - ouvindo mudanças');
        } else if (status === 'CLOSED') {
          console.log('🔴 [SETTINGS-SYNC] Canal Realtime FECHADO');
        } else if (error) {
          console.error('❌ [SETTINGS-SYNC] Erro:', error);
        }
      });

    return () => {
      isSubscribed = false;
      if (channel) {
        supabase.removeChannel(channel);
      }
    };
  }, []);
}
