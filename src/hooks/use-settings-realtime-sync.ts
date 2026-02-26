import { useEffect } from 'react';
import { useSettingsStore } from '@/store/useSettingsStore';
import { supabase } from '@/integrations/supabase/client';

export function useSettingsRealtimeSync() {
  const { updateSettings, setSetting } = useSettingsStore();

  useEffect(() => {
    // Inscrever-se a mudanças na tabela 'settings'
    const channel = supabase
      .channel('realtime:settings')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'settings',
          filter: "id=eq.store-settings",
        },
        (payload: any) => {
          console.log('🔄 Sincronização em tempo real detectada:', payload.new);
          
          const newData = payload.new;
          
          // Mapear as colunas do banco para as propiedades do store
          if (newData.enable_scheduling !== undefined) {
            setSetting('enableScheduling', newData.enable_scheduling);
          }
          if (newData.min_schedule_minutes !== undefined) {
            setSetting('minScheduleMinutes', newData.min_schedule_minutes);
          }
          if (newData.max_schedule_days !== undefined) {
            setSetting('maxScheduleDays', newData.max_schedule_days);
          }
          if (newData.allow_scheduling_on_closed_days !== undefined) {
            setSetting('allowSchedulingOnClosedDays', newData.allow_scheduling_on_closed_days);
          }
          
          // Sincronizar outras configurações do JSON 'value'
          if (newData.value) {
            const value = typeof newData.value === 'string' ? JSON.parse(newData.value) : newData.value;
            
            if (value.name !== undefined) setSetting('name', value.name);
            if (value.phone !== undefined) setSetting('phone', value.phone);
            if (value.address !== undefined) setSetting('address', value.address);
            if (value.slogan !== undefined) setSetting('slogan', value.slogan);
            if (value.schedule !== undefined) setSetting('schedule', value.schedule);
            if (value.isManuallyOpen !== undefined) setSetting('isManuallyOpen', value.isManuallyOpen);
            if (value.deliveryTimeMin !== undefined) setSetting('deliveryTimeMin', value.deliveryTimeMin);
            if (value.deliveryTimeMax !== undefined) setSetting('deliveryTimeMax', value.deliveryTimeMax);
            if (value.pickupTimeMin !== undefined) setSetting('pickupTimeMin', value.pickupTimeMin);
            if (value.pickupTimeMax !== undefined) setSetting('pickupTimeMax', value.pickupTimeMax);
          }
          
          // PrintNode settings
          if (newData.printnode_printer_id !== undefined) {
            setSetting('printnode_printer_id', newData.printnode_printer_id);
          }
          if (newData.print_mode !== undefined) {
            setSetting('print_mode', newData.print_mode);
          }
          if (newData.auto_print_pix !== undefined) {
            setSetting('auto_print_pix', newData.auto_print_pix);
          }
          if (newData.auto_print_card !== undefined) {
            setSetting('auto_print_card', newData.auto_print_card);
          }
          if (newData.auto_print_cash !== undefined) {
            setSetting('auto_print_cash', newData.auto_print_cash);
          }
        }
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          console.log('✅ Sincronização em tempo real de configurações ativada');
        }
      });

    // Cleanup - desinscrever quando componente desmontar
    return () => {
      supabase.removeChannel(channel);
    };
  }, [setSetting]);
}
