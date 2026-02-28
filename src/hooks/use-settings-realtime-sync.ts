import { useEffect } from 'react';
import { useSettingsStore } from '@/store/useSettingsStore';
import { supabase } from '@/integrations/supabase/client';

/**
 * Hook que sincroniza as configurações em tempo real do Supabase
 * Funciona entre navegadores, abas, modo incógnito - sincroniza para todos
 */
export function useSettingsRealtimeSync() {
  const updateSettings = useSettingsStore((s) => s.updateSettings);

  useEffect(() => {
    let isSubscribed = true;
    let channel: any = null;

    const setupRealtimeSync = async () => {
      try {
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
          console.log('📥 [SETTINGS-SYNC] Configurações carregadas do Supabase');

          // Sincronizar para o store - mapear ALL campos
          const settingsData = data as any;
          updateSettings({
            enableScheduling: settingsData.enable_scheduling ?? false,
            minScheduleMinutes: settingsData.min_schedule_minutes ?? 30,
            maxScheduleDays: settingsData.max_schedule_days ?? 7,
            allowSchedulingOnClosedDays: settingsData.allow_scheduling_on_closed_days ?? false,
            allowSchedulingOutsideBusinessHours: settingsData.allow_scheduling_outside_business_hours ?? false,
          });
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

          console.log('🔄 [SETTINGS-SYNC] Mudança detectada em tempo real:', {
            enableScheduling: payload.new.enable_scheduling,
            minScheduleMinutes: payload.new.min_schedule_minutes,
            maxScheduleDays: payload.new.max_schedule_days,
          });

          const newData = payload.new as any;

          // Atualizar o store quando qualquer campo de scheduling mudar
          updateSettings({
            enableScheduling: newData.enable_scheduling ?? false,
            minScheduleMinutes: newData.min_schedule_minutes ?? 30,
            maxScheduleDays: newData.max_schedule_days ?? 7,
            allowSchedulingOnClosedDays: newData.allow_scheduling_on_closed_days ?? false,
            allowSchedulingOutsideBusinessHours: newData.allow_scheduling_outside_business_hours ?? false,
          });

          console.log('✅ [SETTINGS-SYNC] Store atualizado em tempo real!');
        }
      )
      .subscribe((status, error) => {
        if (status === 'SUBSCRIBED') {
          console.log('✅ [SETTINGS-SYNC] Canal realtime ativo');
        } else if (status === 'CLOSED') {
          console.log('🔴 [SETTINGS-SYNC] Canal fechado');
        } else if (error) {
          console.error('❌ [SETTINGS-SYNC] Erro no canal:', error);
        }
      });

    // Cleanup - executar apenas ao desmontar
    return () => {
      isSubscribed = false;
      if (channel) {
        supabase.removeChannel(channel);
      }
    };
  }, []); // ✅ Dependências vazias - executa apenas uma vez ao montar
}
