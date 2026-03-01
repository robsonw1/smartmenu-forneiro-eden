import { useEffect } from 'react';
import { useSettingsStore } from '@/store/useSettingsStore';
import { supabase } from '@/integrations/supabase/client';

/**
 * Hook que sincroniza as configurações em tempo real do Supabase
 * Funciona entre navegadores, abas, modo incógnito - sincroniza para todos
 * SINCRONIZA TODOS OS CAMPOS: isManuallyOpen, schedule, timing, etc
 */
export function useSettingsRealtimeSync() {
  const updateSettings = useSettingsStore((s) => s.updateSettings);

  useEffect(() => {
    let isSubscribed = true;
    let channel: any = null;

    const setupRealtimeSync = async () => {
      try {
        console.log('🔄 [SETTINGS-SYNC] Carregando configurações do Supabase...');
        
        // 1. Carregar configurações atualizadas do Supabase na primeira vez
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
          console.log('⏰ [SETTINGS-SYNC] Dados:', {
            isManuallyOpen: settingsData.is_manually_open,
            enableScheduling: settingsData.enable_scheduling,
          });

          // Mapear para o formato do store
          await updateSettings({
            enableScheduling: settingsData.enable_scheduling ?? false,
            minScheduleMinutes: settingsData.min_schedule_minutes ?? 30,
            maxScheduleDays: settingsData.max_schedule_days ?? 7,
            allowSchedulingOnClosedDays: settingsData.allow_scheduling_on_closed_days ?? false,
            allowSchedulingOutsideBusinessHours: settingsData.allow_scheduling_outside_business_hours ?? false,
            respectBusinessHoursForScheduling: settingsData.respect_business_hours_for_scheduling ?? true,
            allowSameDaySchedulingOutsideHours: settingsData.allow_same_day_scheduling_outside_hours ?? false,
          });
          
          console.log('✅ [SETTINGS-SYNC] Store atualizado na primeira carga');
        }
      } catch (error) {
        console.error('❌ [SETTINGS-SYNC] Erro ao configurar realtime:', error);
      }
    };

    // Carregar dados iniciais
    setupRealtimeSync();

    // 2. Inscrever-se a mudanças em TEMPO REAL
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

          console.log('🔄 [SETTINGS-SYNC] ⚡ MUDANÇA DETECTADA EM TEMPO REAL!');
          console.log('📊 [SETTINGS-SYNC] Dados:', payload.new);

          const newData = payload.new as any;

          // Atualizar o store com TODOS os campos sincronizados
          await updateSettings({
            enableScheduling: newData.enable_scheduling ?? false,
            minScheduleMinutes: newData.min_schedule_minutes ?? 30,
            maxScheduleDays: newData.max_schedule_days ?? 7,
            allowSchedulingOnClosedDays: newData.allow_scheduling_on_closed_days ?? false,
            allowSchedulingOutsideBusinessHours: newData.allow_scheduling_outside_business_hours ?? false,
            respectBusinessHoursForScheduling: newData.respect_business_hours_for_scheduling ?? true,
            allowSameDaySchedulingOutsideHours: newData.allow_same_day_scheduling_outside_hours ?? false,
          });

          console.log('✅ [SETTINGS-SYNC] ⚡ Store atualizado em tempo real com TODOS os campos!');
        }
      )
      .subscribe((status, error) => {
        if (status === 'SUBSCRIBED') {
          console.log('✅ [SETTINGS-SYNC] ⚡ Canal Realtime ATIVO e escutando mudanças!');
        } else if (status === 'CLOSED') {
          console.log('🔴 [SETTINGS-SYNC] Canal Realtime FECHADO');
        } else if (error) {
          console.error('❌ [SETTINGS-SYNC] Erro no canal Realtime:', error);
        }
      });

    // Cleanup - executar apenas ao desmontar
    return () => {
      isSubscribed = false;
      if (channel) {
        console.log('🧹 [SETTINGS-SYNC] Limpando canal Realtime...');
        supabase.removeChannel(channel);
      }
    };
  }, []); // ✅ Dependências vazias - executa apenas uma vez ao montar
}
