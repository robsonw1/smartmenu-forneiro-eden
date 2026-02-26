import { useEffect, useRef } from 'react';
import { useSettingsStore } from '@/store/useSettingsStore';
import { supabase } from '@/integrations/supabase/client';

/**
 * Hook que garante carregamento das settings do Supabase
 * e sincroniza em tempo real entre todos os navegadores
 */
export function useSettingsInitialLoad() {
  const updateSettings = useSettingsStore((s) => s.updateSettings);
  const hasLoaded = useRef(false);

  useEffect(() => {
    if (hasLoaded.current) return;
    hasLoaded.current = true;

    const loadSettings = async () => {
      try {
        console.log('📥 Carregando settings do Supabase...');
        
        const { data, error } = await supabase
          .from('settings')
          .select('*')
          .eq('id', 'store-settings')
          .single();

        if (error) {
          console.error('❌ Erro ao carregar settings:', error);
          return;
        }

        if (data) {
          const settingsData = data as any;
          console.log('✅ Settings carregadas:', {
            enable_scheduling: settingsData.enable_scheduling,
            min_schedule_minutes: settingsData.min_schedule_minutes,
            max_schedule_days: settingsData.max_schedule_days,
            allow_scheduling_on_closed_days: settingsData.allow_scheduling_on_closed_days,
          });

          // Atualizar o store com os valores do Supabase
          await updateSettings({
            enableScheduling: settingsData.enable_scheduling ?? false,
            minScheduleMinutes: settingsData.min_schedule_minutes ?? 30,
            maxScheduleDays: settingsData.max_schedule_days ?? 7,
            allowSchedulingOnClosedDays: settingsData.allow_scheduling_on_closed_days ?? false,
          });

          console.log('✅ Store atualizado com sucesso');
        }
      } catch (error) {
        console.error('❌ Erro ao carregar settings:', error);
      }
    };

    loadSettings();
  }, [updateSettings]);
}
