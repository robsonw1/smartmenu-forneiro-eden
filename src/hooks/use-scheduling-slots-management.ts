import { useEffect, useState } from 'react'
import { supabase } from '@/integrations/supabase/client'
import { toast } from 'sonner'

export interface SchedulingSlotManagement {
  id: string
  tenant_id: string
  slot_date: string
  slot_time: string
  max_orders: number
  current_orders: number
  is_blocked: boolean
  created_at?: string
}

/**
 * Hook para gerenciar slots de agendamento (CRUD + realtime)
 */
export function useSchedulingSlotsManagement(tenantId: string | undefined) {
  const [slots, setSlots] = useState<SchedulingSlotManagement[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // 📡 CARREGAR TODOS OS SLOTS
  const loadSlots = async () => {
    if (!tenantId) return
    
    setLoading(true)
    setError(null)
    try {
      const { data, error: queryError } = await (supabase as any)
        .from('scheduling_slots')
        .select('*')
        .eq('tenant_id', tenantId)
        .order('slot_date', { ascending: true })
        .order('slot_time', { ascending: true })

      if (queryError) throw queryError
      
      setSlots(data || [])
      console.log(`✅ ${data?.length || 0} slots carregados`)
    } catch (err: any) {
      console.error('❌ Erro ao carregar slots:', err)
      setError(err.message)
      toast.error('Erro ao carregar slots')
    } finally {
      setLoading(false)
    }
  }

  // 🆕 CRIAR NOVO SLOT
  const createSlot = async (slot: Omit<SchedulingSlotManagement, 'id' | 'created_at'>) => {
    try {
      console.log('➕ Criando novo slot:', { date: slot.slot_date, time: slot.slot_time, max: slot.max_orders })
      
      const { data, error: insertError } = await (supabase as any)
        .from('scheduling_slots')
        .insert([
          {
            ...slot,
            tenant_id: tenantId,
            current_orders: 0,
            is_blocked: false
          }
        ])
        .select()

      if (insertError) throw insertError
      
      console.log('✅ Slot criado com sucesso:', data?.[0]?.id)
      toast.success(`Slot ${slot.slot_time} criado com sucesso`)
      return data?.[0]
    } catch (err: any) {
      console.error('❌ Erro ao criar slot:', err)
      toast.error(`Erro ao criar slot: ${err.message}`)
      throw err
    }
  }

  // ✏️ ATUALIZAR SLOT
  const updateSlot = async (id: string, updates: Partial<SchedulingSlotManagement>) => {
    try {
      const { data, error: updateError } = await (supabase as any)
        .from('scheduling_slots')
        .update(updates)
        .eq('id', id)
        .select()

      if (updateError) throw updateError
      
      toast.success('Slot atualizado com sucesso')
      return data?.[0]
    } catch (err: any) {
      console.error('❌ Erro ao atualizar slot:', err)
      toast.error(`Erro ao atualizar slot: ${err.message}`)
      throw err
    }
  }

  // 🗑️ DELETAR SLOT
  const deleteSlot = async (id: string) => {
    try {
      // ✅ OTIMISTA: Atualizar estado local IMEDIATAMENTE
      setSlots(prev => prev.filter(s => s.id !== id))
      
      const { error: deleteError } = await (supabase as any)
        .from('scheduling_slots')
        .delete()
        .eq('id', id)

      if (deleteError) {
        // ❌ Se falhar, refazer o estado
        await loadSlots()
        throw deleteError
      }
      
      console.log('✅ Slot deletado com sucesso (local + db)')
      toast.success('Slot deletado com sucesso')
    } catch (err: any) {
      console.error('❌ Erro ao deletar slot:', err)
      toast.error(`Erro ao deletar slot: ${err.message}`)
      throw err
    }
  }

  // 🔒 BLOQUEAR/DESBLOQUEAR SLOT
  const toggleBlockSlot = async (id: string, blocked: boolean) => {
    try {
      console.log(blocked ? '🔒 Bloqueando slot' : '🔓 Desbloqueando slot', { slotId: id })
      
      const { data, error: updateError } = await (supabase as any)
        .from('scheduling_slots')
        .update({ is_blocked: blocked })
        .eq('id', id)
        .select()

      if (updateError) throw updateError
      
      console.log('✅ Status de bloqueio atualizado')
      toast.success(blocked ? 'Slot bloqueado' : 'Slot desbloqueado')
      return data?.[0]
    } catch (err: any) {
      console.error('❌ Erro ao bloquear slot:', err)
      toast.error(`Erro: ${err.message}`)
      throw err
    }
  }

  // ⏱️ RESETAR CONTADOR DE PEDIDOS
  const resetSlotCounter = async (id: string) => {
    try {
      console.log('🔄 Resetando contador do slot:', { slotId: id })
      
      const { data, error: updateError } = await (supabase as any)
        .from('scheduling_slots')
        .update({ current_orders: 0 })
        .eq('id', id)
        .select()

      if (updateError) throw updateError
      
      console.log('✅ Contador resetado')
      toast.success('Contador resetado')
      return data?.[0]
    } catch (err: any) {
      console.error('❌ Erro ao resetar contador:', err)
      toast.error(`Erro: ${err.message}`)
      throw err
    }
  }

  // 📡 SETUP REALTIME
  useEffect(() => {
    loadSlots()

    if (!tenantId) return

    const channel = supabase
      .channel(`scheduling-slots-management-${tenantId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'scheduling_slots',
          filter: `tenant_id=eq.${tenantId}`
        },
        (payload: any) => {
          console.log('📡 [REALTIME-MANAGEMENT] Evento recebido:', {
            event: payload.eventType,
            slotId: payload.new?.id || payload.old?.id,
            time: payload.new?.slot_time || payload.old?.slot_time,
            currentOrders: payload.new?.current_orders
          })
          
          if (payload.eventType === 'UPDATE') {
            setSlots(prev =>
              prev.map(s => {
                if (s.id === payload.new.id) {
                  console.log('✅ Slot atualizado:', { id: s.id, time: s.slot_time, orders: payload.new.current_orders })
                  return payload.new
                }
                return s
              })
            )
          } else if (payload.eventType === 'INSERT') {
            console.log('✅ Novo slot inserido')
            setSlots(prev => 
              [...prev, payload.new].sort((a, b) => {
                if (a.slot_date !== b.slot_date) {
                  return a.slot_date.localeCompare(b.slot_date)
                }
                return a.slot_time.localeCompare(b.slot_time)
              })
            )
          } else if (payload.eventType === 'DELETE') {
            console.log('✅ Slot deletado:', payload.old.id)
            setSlots(prev => prev.filter(s => s.id !== payload.old.id))
          }
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [tenantId])

  return {
    slots,
    loading,
    error,
    createSlot,
    updateSlot,
    deleteSlot,
    toggleBlockSlot,
    resetSlotCounter,
    refetch: loadSlots
  }
}
