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
      <div className="flex items-center gap-2 p-3 bg-yellow-50 border border-yellow-200 rounded-lg text-sm text-yellow-700">
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
      <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
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
    if (selectedTime === slot.slot_time) return 'bg-primary text-white'
    if (slot.is_blocked || slot.availability_status === 'full') return 'bg-gray-100'
    if (slot.availability_status === 'almost_full') return 'bg-yellow-50'
    return 'bg-green-50'
  }

  return (
    <div className="space-y-4">
      <Label className="font-semibold flex items-center gap-2">
        <Clock className="w-4 h-4" />
        Selecione o Horário *
      </Label>

      {bestSlot && (
        <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg text-sm text-blue-700">
          💡 <strong>Melhor horário:</strong> {bestSlot.slot_time} ({bestSlot.available_spots} lugares)
        </div>
      )}

      {/* Grade de horários */}
      <div className="grid grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-2">
        {slots.map(slot => {
          const isSelected = selectedTime === slot.slot_time
          const isAvailable = slot.availability_status === 'available'
          const isAlmostFull = slot.availability_status === 'almost_full'
          const isFull = slot.availability_status === 'full'
          const isBlocked = slot.availability_status === 'blocked'

          return (
            <Button
              key={slot.id}
              onClick={() => !isFull && !isBlocked && onTimeChange(slot.slot_time)}
              disabled={isFull || isBlocked}
              variant={isSelected ? 'default' : 'outline'}
              className={cn(
                'flex flex-col items-center justify-center h-20 text-xs p-1',
                isSelected && 'ring-2 ring-offset-2 ring-primary',
                getSlotColor(slot),
                getSlotBgColor(slot)
              )}
            >
              <span className="font-semibold">{slot.slot_time}</span>
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
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs border-t pt-3">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 bg-green-400 rounded"></div>
          <span>Disponível</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 bg-yellow-400 rounded"></div>
          <span>Poucos spots</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 bg-gray-400 rounded"></div>
          <span>Cheio</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 bg-gray-300 rounded line-through"></div>
          <span>Bloqueado</span>
        </div>
      </div>
    </div>
  )
}
