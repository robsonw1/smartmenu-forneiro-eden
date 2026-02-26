import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { AlertCircle, Check, Clock, Calendar } from 'lucide-react'
import { useSchedulingSlots, type SchedulingSlot } from '@/hooks/use-scheduling-availability'
import { cn } from '@/lib/utils'

interface SchedulingSlotSelectorProps {
  tenantId: string | undefined
  selectedDate: string | null
  selectedTime: string | null
  onTimeChange: (time: string) => void
  minDate?: string
  maxDate?: string
}

export function SchedulingSlotSelector({
  tenantId,
  selectedDate,
  selectedTime,
  onTimeChange,
  minDate,
  maxDate
}: SchedulingSlotSelectorProps) {
  console.log('🔍 [SchedulingSlotSelector] Props recebidas:', { tenantId, selectedDate, selectedTime })
  
  const { slots, loading, error, isEmpty } = useSchedulingSlots(
    tenantId,
    selectedDate || undefined
  )

  if (!tenantId) {
    return (
      <div className="flex items-center gap-2 p-3 bg-yellow-100 dark:bg-yellow-900 border border-yellow-400 dark:border-yellow-700 rounded-lg text-sm text-yellow-900 dark:text-yellow-100">
        <Calendar className="w-4 h-4 flex-shrink-0" />
        ⚠️ Carregando informações necessárias... por favor aguarde
      </div>
    )
  }

  if (!selectedDate) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <Calendar className="w-6 h-6 mx-auto mb-2 opacity-50" />
        <p>Selecione uma data para ver horários disponíveis</p>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8 gap-2 text-muted-foreground">
        <div className="animate-spin w-4 h-4 border-2 border-primary border-t-transparent rounded-full" />
        Carregando horários...
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex items-center gap-2 p-3 bg-red-100 dark:bg-red-900 border border-red-400 dark:border-red-700 rounded-lg text-sm text-red-900 dark:text-red-100">
        <AlertCircle className="w-4 h-4 flex-shrink-0" />
        {error}
      </div>
    )
  }

  if (isEmpty) {
    return (
      <div className="flex items-center gap-2 p-3 bg-yellow-50 border border-yellow-200 rounded-lg text-sm text-yellow-700">
        <AlertCircle className="w-4 h-4 flex-shrink-0" />
        Nenhum horário disponível para esta data
      </div>
    )
  }

  // Encontrar melhor slot
  const bestSlot = slots
    .filter(s => s.availability_status === 'available')
    .sort((a, b) => b.available_spots - a.available_spots)[0]

  const getSlotColor = (slot: SchedulingSlot) => {
    if (slot.is_blocked) return 'opacity-50 cursor-not-allowed'
    if (slot.availability_status === 'full') return 'opacity-50 cursor-not-allowed'
    if (slot.availability_status === 'almost_full') return 'border-yellow-400'
    return 'border-green-400'
  }

  const getSlotBgColor = (slot: SchedulingSlot) => {
    if (selectedTime === slot.slot_time) return 'bg-primary text-white dark:text-white'
    if (slot.is_blocked || slot.availability_status === 'full') return 'bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-400'
    if (slot.availability_status === 'almost_full') return 'bg-yellow-100 dark:bg-yellow-900 text-yellow-900 dark:text-yellow-100'
    return 'bg-green-100 dark:bg-green-900 text-green-900 dark:text-green-100'
  }

  return (
    <div className="space-y-4">
      <Label className="font-semibold flex items-center gap-2">
        <Clock className="w-4 h-4" />
        Selecione o Horário *
      </Label>

      {bestSlot && (
        <div className="p-3 bg-blue-100 dark:bg-blue-900 border border-blue-400 dark:border-blue-700 rounded-lg text-sm text-blue-900 dark:text-blue-100 font-medium">
          💡 <strong>Melhor horário:</strong> {bestSlot.slot_time.substring(0, 5)} ({bestSlot.available_spots} lugares)
        </div>
      )}

      {/* Grade de horários */}
      <div className="grid grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-2">
        {slots.map(slot => {
          // PostgreSQL TIME retorna como "13:00:00" mas precisamos de "13:00"
          const formattedTime = slot.slot_time.substring(0, 5)
          const isSelected = selectedTime === formattedTime
          const isAvailable = slot.availability_status === 'available'
          const isAlmostFull = slot.availability_status === 'almost_full'
          const isFull = slot.availability_status === 'full'
          const isBlocked = slot.availability_status === 'blocked'

          return (
            <Button
              key={slot.id}
              onClick={() => !isFull && !isBlocked && onTimeChange(formattedTime)}
              disabled={isFull || isBlocked}
              variant={isSelected ? 'default' : 'outline'}
              className={cn(
                'flex flex-col items-center justify-center h-20 text-xs p-1',
                isSelected && 'ring-2 ring-offset-2 ring-primary',
                getSlotColor(slot),
                getSlotBgColor(slot)
              )}
            >
              <span className="font-semibold">{formattedTime}</span>
              <span className="text-xs mt-1 opacity-75">
                {slot.current_orders}/{slot.max_orders}
              </span>
              {isSelected && <Check className="w-3 h-3 mt-1" />}
              {isBlocked && <span className="text-xs">🚫</span>}
            </Button>
          )
        })}
      </div>

      {/* Legenda de cores */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs border-t border-border dark:border-slate-700 pt-3 text-foreground dark:text-slate-300">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 bg-green-500 dark:bg-green-400 rounded"></div>
          <span className="font-medium">Disponível</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 bg-yellow-500 dark:bg-yellow-400 rounded"></div>
          <span className="font-medium">Poucos spots</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 bg-gray-500 dark:bg-gray-400 rounded"></div>
          <span className="font-medium">Cheio</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 bg-gray-400 dark:bg-gray-500 rounded line-through"></div>
          <span className="font-medium">Bloqueado</span>
        </div>
      </div>
    </div>
  )
}
