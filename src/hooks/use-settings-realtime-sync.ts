import { useEffect } from 'react';
import { useSettingsStore } from '@/store/useSettingsStore';
import { supabase } from '@/integrations/supabase/client';

/**
 * Hook que sincroniza as configurações em tempo real do Supabase
 * Funciona entre navegadores, abas, modo incógnito - sincroniza para todos
 */
export function useSettingsRealtimeSync() {
  const updateSettings = useSettingsStore((s) => s.updateSettings);
  const syncSettings = useSettingsStore((s) => s.syncSettings); // ✅ Usar syncSettings para realtime

  useEffect(() => {
    let isSubscribed = true;

    const setupRealtimeSync = async () => {
      try {
        // 1. Carregar configurações atualizadas do Supabase na primeira vez
        const { data, error } = await supabase
          .from('settings')
          .select('*')
          .eq('id', 'store-settings')
          .single();

        if (error) {
          console.error('❌ Erro ao carregar settings do Supabase:', error);
          return;
        }

        if (data && isSubscribed) {
          console.log('📥 Configurações carregadas do Supabase:', data);

          // Sincronizar para o store - mapear ALL campos
          const settingsData = data as any;
          syncSettings({
            enableScheduling: settingsData.enable_scheduling ?? false,
            minScheduleMinutes: settingsData.min_schedule_minutes ?? 30,
            maxScheduleDays: settingsData.max_schedule_days ?? 7,
            allowSchedulingOnClosedDays: settingsData.allow_scheduling_on_closed_days ?? false,
          });
        }
      } catch (error) {
        console.error('❌ Erro ao configurar realtime sync:', error);
      }
    };

    // Carregar dados iniciais
    setupRealtimeSync();

    // 2. Inscrever-se a mudanças em TEMPO REAL
    const channel = supabase
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

          console.log('🔄 REALTIME: Mudança detectada em settings:', payload.new);

          const newData = payload.new as any;

          // Todas as configurações de scheduling
          if (
            newData.enable_scheduling !== undefined ||
            newData.min_schedule_minutes !== undefined ||
            newData.max_schedule_days !== undefined ||
            newData.allow_scheduling_on_closed_days !== undefined
          ) {
            syncSettings({
              enableScheduling: newData.enable_scheduling ?? false,
              minScheduleMinutes: newData.min_schedule_minutes ?? 30,
              maxScheduleDays: newData.max_schedule_days ?? 7,
              allowSchedulingOnClosedDays: newData.allow_scheduling_on_closed_days ?? false,
            });

            console.log('✅ REALTIME: Settings sincronizadas automaticamente!');
          }
        }
      )
      .subscribe((status, error) => {
        if (status === 'SUBSCRIBED') {
          console.log('✅ REALTIME: Sincronização em tempo real ativada para settings');
        } else if (status === 'CLOSED') {
          console.log('🔴 REALTIME: Sincronização fechada');
        } else if (error) {
          console.error('❌ REALTIME: Erro na sincronização:', error);
        }
      });

    // Cleanup
    return () => {
      isSubscribed = false;
      supabase.removeChannel(channel);
    };
  }, [syncSettings, updateSettings]);
}
