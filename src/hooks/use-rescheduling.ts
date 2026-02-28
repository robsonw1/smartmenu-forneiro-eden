import { useState } from 'react'
import { supabase } from '@/integrations/supabase/client'
import { toast } from 'sonner'

export interface RescheduleData {
  orderId: string
  currentSlotId: string
  newSlotId: string
  newSlotTime: string
  newSlotDate: string
}

/**
 * Hook para gerenciar remarcações de pedidos agendados
 * Permite que clientes remarquem agendamentos até 48h antes
 */
export function useRescheduling() {
  const [isProcessing, setIsProcessing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  /**
   * Verificar se um pedido pode ser remarcado
   */
  const canReschedule = async (orderId: string): Promise<{
    canReschedule: boolean
    reason?: string
    rescheduleUntil?: Date
  }> => {
    try {
      const { data: order, error: queryError } = await (supabase as any)
        .from('orders')
        .select('id, scheduled_for, can_reschedule, reschedule_limit, status, is_scheduled')
        .eq('id', orderId)
        .single()

      if (queryError) {
        console.error('❌ Erro ao buscar pedido:', queryError)
        return { canReschedule: false, reason: 'Pedido não encontrado' }
      }

      // Verificar se é agendado
      if (!order.is_scheduled) {
        return { canReschedule: false, reason: 'Este pedido não é agendado' }
      }

      // Verificar se foi cancelado
      if (order.status === 'cancelled') {
        return { canReschedule: false, reason: 'Pedido cancelado não pode ser remarcado' }
      }

      // Verificar se já foi remarcado
      if (order.is_rescheduled) {
        return { canReschedule: false, reason: 'Este pedido já é uma remarcação' }
      }

      // Verificar flag de permissão
      if (!order.can_reschedule) {
        return { canReschedule: false, reason: 'Este pedido não permite remarcação' }
      }

      // Verificar limite de tempo (ex: 48h antes do agendamento)
      const rescheduleLimit = order.reschedule_limit ? new Date(order.reschedule_limit) : null
      const now = new Date()

      if (rescheduleLimit && now > rescheduleLimit) {
        return {
          canReschedule: false,
          reason: `Limite para remarcar expirou em ${rescheduleLimit.toLocaleString()}`,
        }
      }

      return {
        canReschedule: true,
        rescheduleUntil: rescheduleLimit || new Date(new Date(order.scheduled_for).getTime() - 48 * 60 * 60 * 1000),
      }
    } catch (err: any) {
      console.error('❌ Erro ao verificar rescheduling:', err)
      return { canReschedule: false, reason: 'Erro ao verificar disponibilidade' }
    }
  }

  /**
   * Remarcar pedido para novo slot
   */
  const rescheduleOrder = async (data: RescheduleData): Promise<{
    success: boolean
    newOrderId?: string
    message: string
  }> => {
    setIsProcessing(true)
    setError(null)

    try {
      console.log('🔄 [RESCHEDULING] Iniciando remarcação:', {
        orderId: data.orderId,
        novoSlot: `${data.newSlotDate} ${data.newSlotTime}`,
      })

      // ✅ PASSO 1: Verificar se pode remarcar
      const canRes = await canReschedule(data.orderId)
      if (!canRes.canReschedule) {
        setError(canRes.reason || 'Não é possível remarcar este pedido')
        toast.error(canRes.reason || 'Não é possível remarcar este pedido')
        return { success: false, message: canRes.reason || 'Erro ao remarcar' }
      }

      // ✅ PASSO 2: Decrementar slot antigo e incrementar novo
      // Liberar slot antigo (decrementar)
      const decrementOld = await (supabase as any)
        .from('scheduling_slots')
        .update({
          current_orders: (await (supabase as any)
            .from('scheduling_slots')
            .select('current_orders')
            .eq('id', data.currentSlotId)
            .single()).data?.current_orders - 1 || 0,
          updated_at: new Date().toISOString(),
        })
        .eq('id', data.currentSlotId)

      if (decrementOld.error) {
        console.error('❌ Erro ao liberar slot anterior:', decrementOld.error)
        throw new Error(`Erro ao liberar slot: ${decrementOld.error.message}`)
      }

      // Reservar novo slot (incrementar)
      const newSlotData = await (supabase as any)
        .from('scheduling_slots')
        .select('current_orders, max_orders, is_blocked')
        .eq('id', data.newSlotId)
        .single()

      if (newSlotData.error) {
        // Reverter: re-incrementar slot antigo
        await (supabase as any)
          .from('scheduling_slots')
          .update({ current_orders: (newSlotData.data?.current_orders || 0) + 1 })
          .eq('id', data.currentSlotId)
        throw new Error('Novo slot não encontrado')
      }

      const slot = newSlotData.data
      if (slot.is_blocked || slot.current_orders >= slot.max_orders) {
        throw new Error('Novo slot não está disponível')
      }

      const incrementNew = await (supabase as any)
        .from('scheduling_slots')
        .update({
          current_orders: slot.current_orders + 1,
          updated_at: new Date().toISOString(),
        })
        .eq('id', data.newSlotId)

      if (incrementNew.error) {
        console.error('❌ Erro ao reservar novo slot:', incrementNew.error)
        // Reverter: re-incrementar slot antigo
        await (supabase as any)
          .from('scheduling_slots')
          .update({ current_orders: (newSlotData.data?.current_orders || 0) + 1 })
          .eq('id', data.currentSlotId)
        throw new Error(`Erro ao reservar novo slot: ${incrementNew.error.message}`)
      }

      // ✅ PASSO 3: Marcar pedido antigo como rescheduled
      const markOldOrder = await (supabase as any)
        .from('orders')
        .update({
          is_rescheduled: true,
          status: 'cancelled',
          reschedule_count: Math.max(0, (await (supabase as any)
            .from('orders')
            .select('reschedule_count')
            .eq('id', data.orderId)
            .single()).data?.reschedule_count || 0) + 1,
        })
        .eq('id', data.orderId)

      if (markOldOrder.error) {
        console.error('❌ Erro ao marcar pedido antigo:', markOldOrder.error)
        // Reverter tudo
        const oldSlot = await (supabase as any)
          .from('scheduling_slots')
          .select('current_orders')
          .eq('id', data.currentSlotId)
          .single()
        const newSlot = await (supabase as any)
          .from('scheduling_slots')
          .select('current_orders')
          .eq('id', data.newSlotId)
          .single()
        
        await (supabase as any)
          .from('scheduling_slots')
          .update({ current_orders: (oldSlot.data?.current_orders || 0) + 1 })
          .eq('id', data.currentSlotId)
        await (supabase as any)
          .from('scheduling_slots')
          .update({ current_orders: Math.max(0, (newSlot.data?.current_orders || 0) - 1) })
          .eq('id', data.newSlotId)
        throw new Error('Erro ao processar remarcação')
      }

      // ✅ PASSO 4: Criar novo pedido com novo agendamento
      const originalOrder = await (supabase as any)
        .from('orders')
        .select('*')
        .eq('id', data.orderId)
        .single()

      if (originalOrder.error) {
        throw new Error('Erro ao buscar dados do pedido original')
      }

      const order = originalOrder.data
      const newOrderId = `PED-${String(Date.now()).slice(-6)}`
      const newScheduledFor = new Date(`${data.newSlotDate}T${data.newSlotTime}`)

      const createNewOrder = await (supabase as any)
        .from('orders')
        .insert([
          {
            id: newOrderId,
            tenant_id: order.tenant_id,
            customer_email: order.customer_email,
            customer_phone: order.customer_phone,
            items: order.items,
            total: order.total,
            status: 'pending',
            payment_method: order.payment_method,
            address: order.address,
            is_scheduled: true,
            scheduled_for: newScheduledFor.toISOString(),
            scheduling_slot_id: data.newSlotId,
            rescheduled_from_order_id: data.orderId,
            can_reschedule: true,
            // Calcular novo reschedule_limit (48h antes do novo agendamento)
            reschedule_limit: new Date(
              newScheduledFor.getTime() - 48 * 60 * 60 * 1000
            ).toISOString(),
            // Copiar outros campos relevantes
            customer_name: order.customer_name,
            delivery_type: order.delivery_type,
            neighborhood_id: order.neighborhood_id,
            points_redeemed: order.points_redeemed || 0,
            pending_points: order.pending_points || 0,
            loyalty_customer_id: order.loyalty_customer_id,
            created_at: new Date().toISOString(),
          },
        ])

      if (createNewOrder.error) {
        console.error('❌ Erro ao criar novo pedido:', createNewOrder.error)
        // Reverter tudo
        const oldSlot = await (supabase as any)
          .from('scheduling_slots')
          .select('current_orders')
          .eq('id', data.currentSlotId)
          .single()
        const newSlot = await (supabase as any)
          .from('scheduling_slots')
          .select('current_orders')
          .eq('id', data.newSlotId)
          .single()
        
        await (supabase as any)
          .from('scheduling_slots')
          .update({ current_orders: (oldSlot.data?.current_orders || 0) + 1 })
          .eq('id', data.currentSlotId)
        await (supabase as any)
          .from('scheduling_slots')
          .update({ current_orders: Math.max(0, (newSlot.data?.current_orders || 0) - 1) })
          .eq('id', data.newSlotId)
        throw new Error('Erro ao criar novo pedido')
      }

      console.log('✅ Pedido remarcado com sucesso:', {
        oldOrderId: data.orderId,
        newOrderId,
        newScheduledFor: newScheduledFor.toISOString(),
      })

      toast.success(`Pedido remarcado com sucesso para ${data.newSlotDate} às ${data.newSlotTime}`)
      return { success: true, newOrderId, message: 'Remarcação realizada com sucesso' }

    } catch (err: any) {
      const message = err.message || 'Erro ao remarcar pedido'
      console.error('❌ Erro na remarcação:', err)
      setError(message)
      toast.error(message)
      return { success: false, message }
    } finally {
      setIsProcessing(false)
    }
  }

  /**
   * Cancelar pedido agendado (libera slot automaticamente)
   */
  const cancelScheduledOrder = async (
    orderId: string,
    reason?: string
  ): Promise<{
    success: boolean
    message: string
  }> => {
    setIsProcessing(true)
    setError(null)

    try {
      console.log('🚫 [CANCEL SCHEDULED] Cancelando pedido agendado:', orderId)

      // Buscar pedido
      const { data: order, error: queryError } = await (supabase as any)
        .from('orders')
        .select('id, status, is_scheduled, scheduling_slot_id')
        .eq('id', orderId)
        .single()

      if (queryError) {
        throw new Error('Pedido não encontrado')
      }

      if (!order.is_scheduled) {
        throw new Error('Este pedido não é agendado')
      }

      // Liberar slot (decrementar)
      if (order.scheduling_slot_id) {
        const slotData = await (supabase as any)
          .from('scheduling_slots')
          .select('current_orders')
          .eq('id', order.scheduling_slot_id)
          .single()
        
        if (slotData.data?.current_orders && slotData.data.current_orders > 0) {
          await (supabase as any)
            .from('scheduling_slots')
            .update({
              current_orders: slotData.data.current_orders - 1,
              updated_at: new Date().toISOString(),
            })
            .eq('id', order.scheduling_slot_id)
        }
      }

      // Atualizar status para cancelled
      const { error: updateError } = await (supabase as any)
        .from('orders')
        .update({
          status: 'cancelled',
          cancelled_reason: reason || 'Cancelado pelo cliente',
          updated_at: new Date().toISOString(),
        })
        .eq('id', orderId)

      if (updateError) {
        throw updateError
      }

      console.log('✅ Pedido cancelado com sucesso, slot liberado')
      toast.success('Pedido cancelado com sucesso')
      return { success: true, message: 'Pedido cancelado com sucesso' }

    } catch (err: any) {
      const message = err.message || 'Erro ao cancelar pedido'
      console.error('❌ Erro ao cancelar:', err)
      setError(message)
      toast.error(message)
      return { success: false, message }
    } finally {
      setIsProcessing(false)
    }
  }

  return {
    isProcessing,
    error,
    canReschedule,
    rescheduleOrder,
    cancelScheduledOrder,
  }
}
