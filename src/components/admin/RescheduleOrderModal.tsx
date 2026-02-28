import { useState, useEffect } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { useRescheduling } from '@/hooks/use-rescheduling'
import { useSchedulingSlots } from '@/hooks/use-scheduling-availability'
import { SchedulingSlotSelector } from './SchedulingSlotSelector'
import { AlertCircle, Calendar, Clock, Loader2, CheckCircle } from 'lucide-react'
import { toast } from 'sonner'

interface RescheduleOrderModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  orderId: string
  currentScheduledFor: string
  currentSlotId: string
  tenantId: string
  weekSchedule?: any
  respectBusinessHours?: boolean
}

export function RescheduleOrderModal({
  open,
  onOpenChange,
  orderId,
  currentScheduledFor,
  currentSlotId,
  tenantId,
  weekSchedule,
  respectBusinessHours,
}: RescheduleOrderModalProps) {
  const { canReschedule, rescheduleOrder, isProcessing } = useRescheduling()
  const [canRes, setCanRes] = useState<any>(null)
  const [newDate, setNewDate] = useState<string | null>(null)
  const [newTime, setNewTime] = useState<string | null>(null)
  const [newSlotId, setNewSlotId] = useState<string | null>(null)
  const [step, setStep] = useState<'verify' | 'select' | 'confirm'>('verify')
  const [error, setError] = useState<string | null>(null)

  const { slots: availableSlots } = useSchedulingSlots(
    tenantId,
    newDate || undefined,
    weekSchedule,
    respectBusinessHours
  )

  // Verificar se pode remarcar ao abrir
  useEffect(() => {
    if (open) {
      const checkRescheduling = async () => {
        const result = await canReschedule(orderId)
        setCanRes(result)

        if (!result.canReschedule) {
          setStep('verify')
          setError(result.reason)
        } else {
          setStep('select')
          setError(null)
        }
      }

      checkRescheduling()
    }
  }, [open, orderId])

  const handleSelectNewSlot = () => {
    if (!newDate || !newTime) {
      toast.error('Selecione data e horário')
      return
    }

    // Buscar o slot_id correspondente
    const selectedSlot = availableSlots.find(
      (s) => s.slot_date === newDate && s.slot_time.substring(0, 5) === newTime
    )

    if (!selectedSlot) {
      toast.error('Horário não encontrado')
      return
    }

    if (selectedSlot.availability_status === 'full' || selectedSlot.availability_status === 'blocked') {
      toast.error('Horário indisponível')
      return
    }

    setNewSlotId(selectedSlot.id)
    setStep('confirm')
  }

  const handleConfirmReschedule = async () => {
    if (!newSlotId) return

    const result = await rescheduleOrder({
      orderId,
      currentSlotId,
      newSlotId,
      newSlotTime: newTime || '',
      newSlotDate: newDate || '',
    })

    if (result.success) {
      setStep('verify') // Reset
      onOpenChange(false)
    }
  }

  const currentDateTime = new Date(currentScheduledFor).toLocaleDateString('pt-BR', {
    weekday: 'long',
    day: '2-digit',
    month: 'long',
    hour: '2-digit',
    minute: '2-digit',
  })

  const newDateTime = newDate
    ? new Date(`${newDate}T${newTime}`).toLocaleDateString('pt-BR', {
        weekday: 'long',
        day: '2-digit',
        month: 'long',
        hour: '2-digit',
        minute: '2-digit',
      })
    : ''

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Calendar className="w-5 h-5" />
            Remarcar Pedido
          </DialogTitle>
          <DialogDescription>
            Altere a data e horário do seu agendamento
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* STEP 1: Verificar se pode remarcar */}
          {step === 'verify' && (
            <div className="space-y-4">
              {error ? (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              ) : (
                <>
                  <Alert className="bg-green-50 dark:bg-green-950 border-green-200 dark:border-green-800">
                    <CheckCircle className="h-4 w-4 text-green-600" />
                    <AlertDescription className="text-green-800 dark:text-green-200">
                      ✓ Você pode remarcar este pedido até {canRes?.rescheduleUntil?.toLocaleDateString('pt-BR')}
                    </AlertDescription>
                  </Alert>

                  <div className="space-y-3 p-4 bg-slate-50 dark:bg-slate-900 rounded-lg">
                    <h3 className="font-semibold flex items-center gap-2">
                      <Clock className="w-4 h-4" />
                      Agendamento Atual
                    </h3>
                    <p className="text-sm text-slate-600 dark:text-slate-400">
                      {currentDateTime}
                    </p>
                  </div>

                  <Button
                    onClick={() => setStep('select')}
                    className="w-full"
                  >
                    Continuar para Seleção
                  </Button>
                </>
              )}
            </div>
          )}

          {/* STEP 2: Selecionar novo slot */}
          {step === 'select' && (
            <div className="space-y-4">
              <SchedulingSlotSelector
                tenantId={tenantId}
                selectedDate={newDate}
                selectedTime={newTime}
                onTimeChange={setNewTime}
                weekSchedule={weekSchedule}
                respectBusinessHours={respectBusinessHours}
              />

              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={() => setStep('verify')}
                  className="flex-1"
                >
                  Voltar
                </Button>
                <Button
                  onClick={handleSelectNewSlot}
                  disabled={!newDate || !newTime}
                  className="flex-1"
                >
                  Revisar
                </Button>
              </div>
            </div>
          )}

          {/* STEP 3: Confirmar remarcação */}
          {step === 'confirm' && (
            <div className="space-y-4">
              <div className="space-y-3 p-4 bg-blue-50 dark:bg-blue-950 rounded-lg">
                <h3 className="font-semibold flex items-center gap-2 text-blue-900 dark:text-blue-100">
                  <Calendar className="w-4 h-4" />
                  Novo Horário
                </h3>
                <p className="text-sm text-blue-800 dark:text-blue-200">{newDateTime}</p>
              </div>

              <Alert className="bg-slate-100 dark:bg-slate-800">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  Confirme para remarcar seu pedido para o novo horário
                </AlertDescription>
              </Alert>

              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={() => setStep('select')}
                  className="flex-1"
                  disabled={isProcessing}
                >
                  Escolher outro
                </Button>
                <Button
                  onClick={handleConfirmReschedule}
                  disabled={isProcessing}
                  className="flex-1"
                >
                  {isProcessing ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin mr-2" />
                      Remarcando...
                    </>
                  ) : (
                    'Confirmar Remarcação'
                  )}
                </Button>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
