import { useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useSchedulingSlotsManagement, type SchedulingSlotManagement } from '@/hooks/use-scheduling-slots-management'
import { Plus, Trash2, Lock, Unlock, RotateCcw, Calendar } from 'lucide-react'
import { format, addDays } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { toast } from 'sonner'

interface SchedulingSlotManagementDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  tenantId: string | undefined
}

export function SchedulingSlotManagementDialog({
  open,
  onOpenChange,
  tenantId
}: SchedulingSlotManagementDialogProps) {
  const {
    slots,
    loading,
    createSlot,
    updateSlot,
    deleteSlot,
    toggleBlockSlot,
    resetSlotCounter
  } = useSchedulingSlotsManagement(tenantId)

  const [showCreateForm, setShowCreateForm] = useState(false)
  const [filterDate, setFilterDate] = useState<string>('all')
  const [actionInProgress, setActionInProgress] = useState<string | null>(null) // Rastrear qual ação está em progresso
  const [newSlot, setNewSlot] = useState({
    slot_date: format(new Date(), 'yyyy-MM-dd'),
    slot_time: '11:00',
    max_orders: 5
  })

  // 📊 Agrupar slots por data
  const slotsByDate = slots.reduce((acc, slot) => {
    if (filterDate === 'all' || slot.slot_date === filterDate) {
      if (!acc[slot.slot_date]) acc[slot.slot_date] = []
      acc[slot.slot_date].push(slot)
    }
    return acc
  }, {} as Record<string, SchedulingSlotManagement[]>)

  const handleCreateSlot = async () => {
    if (!newSlot.slot_date || !newSlot.slot_time || newSlot.max_orders < 1) {
      toast.error('Preencha todos os campos corretamente')
      return
    }

    try {
      await createSlot({
        slot_date: newSlot.slot_date,
        slot_time: newSlot.slot_time,
        max_orders: newSlot.max_orders,
        current_orders: 0,
        is_blocked: false,
        tenant_id: tenantId || ''
      })
      
      setShowCreateForm(false)
      setNewSlot({
        slot_date: format(new Date(), 'yyyy-MM-dd'),
        slot_time: '11:00',
        max_orders: 5
      })
    } catch (err) {
      console.error('Erro ao criar slot:', err)
    }
  }

  // ✅ HANDLERS COM CONTROLE DE AÇÃO EM PROGRESSO
  const handleDeleteSlot = async (slotId: string) => {
    setActionInProgress(`delete-${slotId}`)
    try {
      await deleteSlot(slotId)
    } catch (err) {
      console.error('Erro ao deletar:', err)
    } finally {
      setActionInProgress(null)
    }
  }

  const handleToggleBlockSlot = async (slotId: string, blocked: boolean) => {
    setActionInProgress(`block-${slotId}`)
    try {
      await toggleBlockSlot(slotId, !blocked)
    } catch (err) {
      console.error('Erro ao bloquear:', err)
    } finally {
      setActionInProgress(null)
    }
  }

  const handleResetSlotCounter = async (slotId: string) => {
    setActionInProgress(`reset-${slotId}`)
    try {
      await resetSlotCounter(slotId)
    } catch (err) {
      console.error('Erro ao resetar:', err)
    } finally {
      setActionInProgress(null)
    }
  }

  // Horários predefinidos
  const timeSlots = Array.from({ length: 10 }, (_, i) => {
    const hour = 11 + i
    return `${String(hour).padStart(2, '0')}:00`
  })

  // Próximos 30 dias
  const nextDays = Array.from({ length: 30 }, (_, i) => 
    format(addDays(new Date(), i), 'yyyy-MM-dd')
  )

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Calendar className="w-5 h-5" />
            Gerenciar Slots de Agendamento
          </DialogTitle>
          <DialogDescription>
            Adicione, bloqueie, desbloqueie ou delete horários de atendimento
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Filtro por Data */}
          <div className="flex gap-2">
            <div className="flex-1">
              <Label className="text-xs mb-1 block">Filtrar por data</Label>
              <Select value={filterDate} onValueChange={setFilterDate}>
                <SelectTrigger>
                  <SelectValue placeholder="Todas as datas" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas as datas</SelectItem>
                  {nextDays.map(date => (
                    <SelectItem key={date} value={date}>
                      {format(new Date(date), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-end">
              <Button
                onClick={() => setShowCreateForm(!showCreateForm)}
                variant={showCreateForm ? 'outline' : 'default'}
                className="gap-2"
              >
                <Plus className="w-4 h-4" />
                Novo Slot
              </Button>
            </div>
          </div>

          {/* Formulário de Criação */}
          {showCreateForm && (
            <div className="border rounded-lg p-4 bg-slate-50 dark:bg-slate-900 space-y-4">
              <h4 className="font-semibold">Adicionar Novo Slot</h4>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <Label htmlFor="date">Data</Label>
                  <Select 
                    value={newSlot.slot_date} 
                    onValueChange={(date) => setNewSlot({ ...newSlot, slot_date: date })}
                  >
                    <SelectTrigger id="date">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {nextDays.map(date => (
                        <SelectItem key={date} value={date}>
                          {format(new Date(date), "dd/MM/yyyy", { locale: ptBR })}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="time">Horário</Label>
                  <Select 
                    value={newSlot.slot_time} 
                    onValueChange={(time) => setNewSlot({ ...newSlot, slot_time: time })}
                  >
                    <SelectTrigger id="time">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {timeSlots.map(time => (
                        <SelectItem key={time} value={time}>
                          {time}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="max">Máx. de Pedidos</Label>
                  <Input
                    id="max"
                    type="number"
                    min="1"
                    max="20"
                    value={newSlot.max_orders}
                    onChange={(e) => setNewSlot({ ...newSlot, max_orders: parseInt(e.target.value) || 1 })}
                  />
                </div>
              </div>

              <div className="flex gap-2 justify-end">
                <Button
                  variant="outline"
                  onClick={() => setShowCreateForm(false)}
                >
                  Cancelar
                </Button>
                <Button onClick={handleCreateSlot}>
                  Criar Slot
                </Button>
              </div>
            </div>
          )}

          {/* Lista de Slots */}
          {loading ? (
            <div className="flex justify-center py-8">
              <div className="animate-spin w-5 h-5 border-2 border-primary border-t-transparent rounded-full" />
            </div>
          ) : Object.keys(slotsByDate).length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Calendar className="w-8 h-8 mx-auto mb-2 opacity-50" />
              <p>Nenhum slot encontrado</p>
            </div>
          ) : (
            <div className="space-y-4">
              {Object.entries(slotsByDate).map(([date, dateSlots]) => (
                <div key={date} className="border rounded-lg overflow-hidden">
                  <div className="bg-primary/10 px-4 py-2 font-semibold flex items-center gap-2">
                    <Calendar className="w-4 h-4" />
                    {format(new Date(date), "dddd, dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
                    <span className="text-sm text-muted-foreground ml-auto">
                      {dateSlots.length} slot{dateSlots.length !== 1 ? 's' : ''}
                    </span>
                  </div>

                  <div className="divide-y">
                    {dateSlots.map(slot => (
                      <div
                        key={slot.id}
                        className="p-4 flex items-center justify-between hover:bg-slate-50 dark:hover:bg-slate-900"
                      >
                        <div className="flex items-center gap-4 flex-1">
                          <div className="font-semibold text-lg min-w-16">
                            {slot.slot_time.substring(0, 5)}
                          </div>
                          
                          <div className="flex-1">
                            <div className="text-sm font-medium">
                              {slot.current_orders}/{slot.max_orders} pedidos
                            </div>
                            <div className="w-32 h-2 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                              <div
                                className={`h-full transition-all ${
                                  slot.current_orders >= slot.max_orders
                                    ? 'bg-red-500'
                                    : slot.current_orders >= Math.ceil(slot.max_orders * 0.7)
                                    ? 'bg-yellow-500'
                                    : 'bg-green-500'
                                }`}
                                style={{
                                  width: `${(slot.current_orders / slot.max_orders) * 100}%`
                                }}
                              />
                            </div>
                          </div>

                          {slot.is_blocked && (
                            <div className="px-2 py-1 bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-100 text-xs rounded font-medium">
                              🚫 Bloqueado
                            </div>
                          )}
                        </div>

                        {/* Ações */}
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleToggleBlockSlot(slot.id, slot.is_blocked)}
                            disabled={actionInProgress !== null}
                            title={slot.is_blocked ? 'Desbloquear' : 'Bloquear'}
                          >
                            {actionInProgress === `block-${slot.id}` ? (
                              <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                            ) : slot.is_blocked ? (
                              <Unlock className="w-4 h-4" />
                            ) : (
                              <Lock className="w-4 h-4" />
                            )}
                          </Button>

                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleResetSlotCounter(slot.id)}
                            disabled={actionInProgress !== null}
                            title="Zerar pedidos"
                          >
                            {actionInProgress === `reset-${slot.id}` ? (
                              <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                            ) : (
                              <RotateCcw className="w-4 h-4" />
                            )}
                          </Button>

                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleDeleteSlot(slot.id)}
                            disabled={actionInProgress !== null}
                            title="Deletar"
                            className="text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/20"
                          >
                            {actionInProgress === `delete-${slot.id}` ? (
                              <div className="w-4 h-4 border-2 border-red-600 border-t-transparent rounded-full animate-spin" />
                            ) : (
                              <Trash2 className="w-4 h-4" />
                            )}
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Fechar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
