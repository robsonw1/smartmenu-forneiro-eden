import { useEffect, useState } from 'react'
import { supabase } from '@/integrations/supabase/client'
import { toast } from 'sonner'

export interface SchedulingSlot {
  id: string
  slot_date: string
  slot_time: string
  max_orders: number
  current_orders: number
  available_spots: number
  is_blocked: boolean
  availability_status: 'blocked' | 'full' | 'almost_full' | 'available'
}

/**
 * Hook para gerenciar slots de agendamento
 * Carrega slots disponíveis para uma data específica e sincroniza em realtime
 */
export function useSchedulingSlots(tenantId: string | undefined, date?: string) {
  const [slots, setSlots] = useState<SchedulingSlot[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!date || !tenantId) {
      setSlots([])
      return
    }

    setLoading(true)
    setError(null)

    const loadSlots = async () => {
      try {
        const { data, error: queryError } = await (supabase as any)
          .from('scheduling_slots_with_availability')
          .select('*')
          .eq('tenant_id', tenantId)
          .eq('slot_date', date)
          .order('slot_time', { ascending: true })

        if (queryError) throw queryError
        setSlots(data || [])
      } catch (err) {
        console.error('❌ Erro ao carregar slots:', err)
        setError('Erro ao carregar horários')
        toast.error('Não foi possível carregar horários disponíveis')
      } finally {
        setLoading(false)
      }
    }

    loadSlots()

    // Subscrever a atualizações realtime
    const channel = supabase
      .channel(`scheduling-slots-${tenantId}-${date}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'scheduling_slots',
          filter: `tenant_id=eq.${tenantId} AND slot_date=eq.${date}`
        },
        (payload: any) => {
          const newSlot = payload.new as SchedulingSlot
          console.log('📡 Slot atualizado:', newSlot?.slot_time)
          
          if (payload.eventType === 'UPDATE') {
            const updatedSlot = newSlot
            setSlots(prev =>
              prev.map(s =>
                s.id === updatedSlot.id
                  ? { ...s, ...updatedSlot }
                  : s
              )
            )
            
            // Alertar se ficou cheio
            const oldSlot = payload.old as SchedulingSlot
            if (oldSlot.current_orders < updatedSlot.max_orders && 
                updatedSlot.current_orders >= updatedSlot.max_orders) {
              console.log(`🚫 Slot ${updatedSlot.slot_time} ficou cheio`)
            }
          } else if (payload.eventType === 'INSERT') {
            setSlots(prev => [...prev, newSlot].sort((a, b) =>
              a.slot_time.localeCompare(b.slot_time)
            ))
          } else if (payload.eventType === 'DELETE') {
            setSlots(prev => prev.filter(s => s.id !== (payload.old as any).id))
          }
        }
      )
      .subscribe((status) => {
        console.log(`📡 Channel status: ${status}`)
      })

    return () => {
      supabase.removeChannel(channel)
    }
  }, [date, tenantId])

  return {
    slots,
    loading,
    error,
    isEmpty: slots.length === 0
  }
}

/**
 * Hook para sincronizar cancelamentos de pedidos agendados
 * Libera o slot quando um pedido é cancelado
 */
export function useSchedulingCancellationSync(
  isOpen: boolean,
  email: string | undefined,
  tenantId: string | undefined
) {
  useEffect(() => {
    if (!isOpen || !email || !tenantId) return

    console.log('🔴 [CANCEL-SYNC] Ativado')

    const channel = supabase
      .channel(`order-cancel-sync-${email}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'orders',
          filter: `email=eq.${encodeURIComponent(email)}`
        },
        async (payload: any) => {
          const order = payload.new
          
          if (order.status === 'cancelled' && payload.old?.status !== 'cancelled') {
            console.log(`🔴 [CANCEL-SYNC] Liberando slot do pedido ${order.id}`)
            
            if (order.scheduled_for && order.scheduling_slot_id) {
              try {
                // Use edge function to atomically release slot
                const { error } = await supabase.functions.invoke(
                  'release-scheduling-slot',
                  {
                    body: {
                      orderId: order.id,
                      slotId: order.scheduling_slot_id,
                      tenantId,
                    },
                  }
                )

                if (error) throw error
                console.log('✅ [CANCEL-SYNC] Slot liberado')
                toast.info('Seu agendamento foi cancelado. Horário disponível para próximos clientes.')
              } catch (err) {
                console.error('❌ [CANCEL-SYNC] Erro ao liberar:', err)
              }
            }
          }
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [isOpen, email, tenantId])
}
