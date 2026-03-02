import { useEffect, useRef } from 'react';
import { useSettingsStore } from '@/store/useSettingsStore';
import { supabase } from '@/integrations/supabase/client';

/**
 * Hook que garante carregamento COMPLETO das settings do Supabase
 * Sincroniza TUDO: isManuallyOpen, schedule, horários, etc
 */
export function useSettingsInitialLoad() {
  const updateSettings = useSettingsStore((s) => s.updateSettings);
  const hasLoaded = useRef(false);

  useEffect(() => {
    if (hasLoaded.current) return;
    hasLoaded.current = true;

    const loadSettings = async () => {
      try {
        console.log('📥 ⚡ Carregando TODAS as settings do Supabase...');
        
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
          const valueJson = settingsData.value || {};
          
          // ✅✅✅ CRÍTICO: Se schedule não tiver, carregar com defaults
          const loadedSchedule = valueJson.schedule || {
            monday: { isOpen: false, openTime: '18:00', closeTime: '23:00' },
            tuesday: { isOpen: true, openTime: '18:00', closeTime: '23:00' },
            wednesday: { isOpen: true, openTime: '18:00', closeTime: '23:00' },
            thursday: { isOpen: true, openTime: '18:00', closeTime: '23:00' },
            friday: { isOpen: true, openTime: '18:00', closeTime: '23:00' },
            saturday: { isOpen: true, openTime: '17:00', closeTime: '00:00' },
            sunday: { isOpen: true, openTime: '17:00', closeTime: '23:00' },
          };
          
          console.log('✅✅✅ Settings carregadas COMPLETAS:', {
            isManuallyOpen: valueJson.isManuallyOpen,
            schedule: loadedSchedule,
            enable_scheduling: settingsData.enable_scheduling,
          });

          // Atualizar o store com TODOS os valores do Supabase
          await updateSettings({
            // Do JSON 'value'
            name: valueJson.name || 'Forneiro Éden',
            phone: valueJson.phone || '(11) 99999-9999',
            address: valueJson.address || 'Rua das Pizzas, 123 - Centro',
            slogan: valueJson.slogan || 'A Pizza mais recheada da cidade 🇮🇹',
            schedule: loadedSchedule, // ✅ USE LOADED SCHEDULE
            isManuallyOpen: valueJson.isManuallyOpen ?? true,
            deliveryTimeMin: valueJson.deliveryTimeMin ?? 60,
            deliveryTimeMax: valueJson.deliveryTimeMax ?? 70,
            pickupTimeMin: valueJson.pickupTimeMin ?? 40,
            pickupTimeMax: valueJson.pickupTimeMax ?? 50,
            orderAlertEnabled: valueJson.orderAlertEnabled ?? true,
            sendOrderSummaryToWhatsApp: valueJson.sendOrderSummaryToWhatsApp ?? false,
            // Das colunas
            enableScheduling: settingsData.enable_scheduling ?? false,
            minScheduleMinutes: settingsData.min_schedule_minutes ?? 30,
            maxScheduleDays: settingsData.max_schedule_days ?? 7,
            allowSchedulingOnClosedDays: settingsData.allow_scheduling_on_closed_days ?? false,
            allowSchedulingOutsideBusinessHours: settingsData.allow_scheduling_outside_business_hours ?? false,
            respectBusinessHoursForScheduling: settingsData.respect_business_hours_for_scheduling ?? true,
            allowSameDaySchedulingOutsideHours: settingsData.allow_same_day_scheduling_outside_hours ?? false,
          });

          console.log('✅✅✅ Store atualizado com SUCESSO - schedule:', loadedSchedule);

        }
      } catch (error) {
        console.error('❌ Erro ao carregar settings:', error);
      }
    };

    loadSettings();
  }, [updateSettings]);
}
