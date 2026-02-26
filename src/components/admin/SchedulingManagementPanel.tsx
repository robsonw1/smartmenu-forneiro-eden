import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { supabase } from '@/integrations/supabase/client'
import { Plus, Trash2, Edit2, Lock, Unlock, AlertCircle, Loader2 } from 'lucide-react'
import { toast } from 'sonner'

interface SchedulingSlot {
  id: string
  tenant_id: string
  slot_date: string
  slot_time: string
  max_orders: number
  current_orders: number
  is_blocked: boolean
  created_at: string
}

export function SchedulingManagementPanel() {
  const [tenantId, setTenantId] = useState<string>('')
  const [slots, setSlots] = useState<SchedulingSlot[]>([])
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)

  // Form state
  const [slotDate, setSlotDate] = useState('')
  const [slotTime, setSlotTime] = useState('')
  const [maxOrders, setMaxOrders] = useState('5')
  const [editingId, setEditingId] = useState<string>('')

  // Initialize
  useEffect(() => {
    const getTenant = async () => {
      const stored = localStorage.getItem('admin-tenant-id')
      if (stored) {
        setTenantId(stored)
        await loadSlots(stored)
      }
    }
    getTenant()
  }, [])

  // Load slots
  const loadSlots = async (tenant: string) => {
    setLoading(true)
    try {
      const { data, error } = await (supabase as any)
        .from('scheduling_slots')
        .select('*')
        .eq('tenant_id', tenant)
        .order('slot_date', { ascending: true })
        .order('slot_time', { ascending: true })

      if (error) throw error
      setSlots(data || [])
    } catch (err) {
      console.error('Erro ao carregar slots:', err)
      toast.error('Erro ao carregar slots')
    } finally {
      setLoading(false)
    }
  }

  // Add/Update slot
  const handleSaveSlot = async () => {
    if (!slotDate || !slotTime || !maxOrders || !tenantId) {
      toast.error('Preencha todos os campos')
      return
    }

    setSaving(true)
    try {
      if (editingId) {
        // Update
        const { error } = await (supabase as any)
          .from('scheduling_slots')
          .update({
            max_orders: parseInt(maxOrders),
          })
          .eq('id', editingId)

        if (error) throw error
        toast.success('Slot atualizado com sucesso')
        setEditingId('')
      } else {
        // Insert
        const { error } = await (supabase as any)
          .from('scheduling_slots')
          .insert([
            {
              tenant_id: tenantId,
              slot_date: slotDate,
              slot_time: slotTime,
              max_orders: parseInt(maxOrders),
              current_orders: 0,
              is_blocked: false,
            },
          ] as any)

        if (error) throw error
        toast.success('Slot criado com sucesso')
      }

      // Reset form
      setSlotDate('')
      setSlotTime('')
      setMaxOrders('5')

      // Reload
      await loadSlots(tenantId)
    } catch (err: any) {
      console.error('Erro:', err)
      if (err.code === '23505') {
        toast.error('Este slot já existe')
      } else {
        toast.error(err.message || 'Erro ao salvar slot')
      }
    } finally {
      setSaving(false)
    }
  }

  // Delete slot
  const handleDeleteSlot = async (id: string) => {
    if (!confirm('Tem certeza que deseja deletar este slot?')) return

    try {
      const { error } = await (supabase as any)
        .from('scheduling_slots')
        .delete()
        .eq('id', id)

      if (error) throw error
      toast.success('Slot deletado')
      await loadSlots(tenantId)
    } catch (err) {
      console.error('Erro:', err)
      toast.error('Erro ao deletar slot')
    }
  }

  // Toggle block
  const handleBlockSlot = async (id: string, isBlocked: boolean) => {
    try {
      const { error } = await (supabase as any)
        .from('scheduling_slots')
        .update({ is_blocked: !isBlocked } as any)
        .eq('id', id)

      if (error) throw error
      toast.success(isBlocked ? 'Slot desbloqueado' : 'Slot bloqueado')
      await loadSlots(tenantId)
    } catch (err) {
      console.error('Erro:', err)
      toast.error('Erro ao alterar bloqueio')
    }
  }

  // Edit slot
  const handleEditSlot = (slot: SchedulingSlot) => {
    setSlotDate(slot.slot_date)
    setSlotTime(slot.slot_time)
    setMaxOrders(slot.max_orders.toString())
    setEditingId(slot.id)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  // Cancel edit
  const handleCancelEdit = () => {
    setSlotDate('')
    setSlotTime('')
    setMaxOrders('5')
    setEditingId('')
  }

  // Get today's date for min attribute
  const today = new Date().toISOString().split('T')[0]

  // Group slots by date
  const slotsByDate = slots.reduce((acc, slot) => {
    if (!acc[slot.slot_date]) acc[slot.slot_date] = []
    acc[slot.slot_date].push(slot)
    return acc
  }, {} as Record<string, SchedulingSlot[]>)

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Gerenciamento de Agendamentos</h2>
        <p className="text-muted-foreground">Configure horários disponíveis para entrega/retirada</p>
      </div>

      {/* Form */}
      <Card>
        <CardHeader>
          <CardTitle>{editingId ? 'Editar Slot' : 'Novo Slot'}</CardTitle>
          <CardDescription>
            {editingId ? 'Atualize a capacidade do slot' : 'Configure um novo horário de entrega/retirada'}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <Label htmlFor="slot-date">Data *</Label>
              <Input
                id="slot-date"
                type="date"
                value={slotDate}
                onChange={(e) => setSlotDate(e.target.value)}
                disabled={!!editingId}
                min={today}
              />
            </div>
            <div>
              <Label htmlFor="slot-time">Horário *</Label>
              <Input
                id="slot-time"
                type="time"
                value={slotTime}
                onChange={(e) => setSlotTime(e.target.value)}
                disabled={!!editingId}
              />
            </div>
            <div>
              <Label htmlFor="max-orders">Máx. Pedidos *</Label>
              <Input
                id="max-orders"
                type="number"
                value={maxOrders}
                onChange={(e) => setMaxOrders(e.target.value)}
                min="1"
                max="100"
              />
            </div>
          </div>

          <div className="flex gap-2">
            <Button onClick={handleSaveSlot} disabled={saving}>
              {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {editingId ? 'Atualizar' : 'Criar Slot'}
            </Button>
            {editingId && (
              <Button variant="outline" onClick={handleCancelEdit}>
                Cancelar
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Slots List */}
      <Card>
        <CardHeader>
          <CardTitle>Slots Agendados</CardTitle>
          <CardDescription>
            {loading ? 'Carregando...' : `Total: ${slots.length} slots`}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin" />
            </div>
          ) : slots.length === 0 ? (
            <Alert>
              <AlertCircle className="w-4 h-4" />
              <AlertDescription>Nenhum slot configurado ainda</AlertDescription>
            </Alert>
          ) : (
            <Tabs defaultValue="grouped" className="w-full">
              <TabsList>
                <TabsTrigger value="grouped">Agrupado por Data</TabsTrigger>
                <TabsTrigger value="list">Lista Completa</TabsTrigger>
              </TabsList>

              <TabsContent value="grouped" className="space-y-4">
                {Object.entries(slotsByDate).map(([date, dateSlots]) => (
                  <Card key={date} className="border-l-4 border-l-primary">
                    <CardHeader className="pb-3">
                      <CardTitle className="text-base">
                        {new Date(`${date}T00:00`).toLocaleDateString('pt-BR', {
                          weekday: 'long',
                          day: '2-digit',
                          month: 'long',
                        })}
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {dateSlots.map((slot) => (
                          <div
                            key={slot.id}
                            className={`flex items-center justify-between p-3 rounded-lg border transition-colors ${
                              slot.is_blocked
                                ? 'bg-red-100 dark:bg-red-900 border-red-400 dark:border-red-700 text-red-900 dark:text-red-100'
                                : slot.current_orders >= slot.max_orders
                                ? 'bg-orange-100 dark:bg-orange-900 border-orange-400 dark:border-orange-700 text-orange-900 dark:text-orange-100'
                                : 'bg-green-100 dark:bg-green-900 border-green-400 dark:border-green-700 text-green-900 dark:text-green-100'
                            }`}
                          >
                            <div className="flex-1">
                              <p className="font-semibold">{slot.slot_time}</p>
                              <p className="text-sm opacity-90">
                                {slot.current_orders}/{slot.max_orders} pedidos
                              </p>
                              {slot.is_blocked && (
                                <p className="text-xs font-semibold mt-1">🚫 Bloqueado</p>
                              )}
                            </div>
                            <div className="flex gap-1">
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => handleEditSlot(slot)}
                              >
                                <Edit2 className="w-4 h-4" />
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => handleBlockSlot(slot.id, slot.is_blocked)}
                              >
                                {slot.is_blocked ? (
                                  <Unlock className="w-4 h-4" />
                                ) : (
                                  <Lock className="w-4 h-4" />
                                )}
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => handleDeleteSlot(slot.id)}
                              >
                                <Trash2 className="w-4 h-4 text-red-600 dark:text-red-400" />
                              </Button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </TabsContent>

              <TabsContent value="list">
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Data</TableHead>
                        <TableHead>Horário</TableHead>
                        <TableHead>Ocupação</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Ações</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {slots.map((slot) => (
                        <TableRow key={slot.id}>
                          <TableCell>
                            {new Date(`${slot.slot_date}T00:00`).toLocaleDateString('pt-BR')}
                          </TableCell>
                          <TableCell className="font-semibold">{slot.slot_time}</TableCell>
                          <TableCell>
                            <span
                              className={`inline-block px-2 py-1 rounded text-xs font-semibold ${
                                slot.current_orders >= slot.max_orders
                                  ? 'bg-red-100 dark:bg-red-900 text-red-900 dark:text-red-100'
                                  : 'bg-green-100 dark:bg-green-900 text-green-900 dark:text-green-100'
                              }`}
                            >
                              {slot.current_orders}/{slot.max_orders}
                            </span>
                          </TableCell>
                          <TableCell>
                            {slot.is_blocked ? (
                              <span className="text-xs font-semibold text-red-700 dark:text-red-300">🚫 Bloqueado</span>
                            ) : slot.current_orders >= slot.max_orders ? (
                              <span className="text-xs font-semibold text-orange-700 dark:text-orange-300">⚠️ Cheio</span>
                            ) : (
                              <span className="text-xs font-semibold text-green-700 dark:text-green-300">✅ Disponível</span>
                            )}
                          </TableCell>
                          <TableCell className="text-right">
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleEditSlot(slot)}
                            >
                              <Edit2 className="w-4 h-4" />
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleBlockSlot(slot.id, slot.is_blocked)}
                            >
                              {slot.is_blocked ? (
                                <Unlock className="w-4 h-4" />
                              ) : (
                                <Lock className="w-4 h-4" />
                              )}
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleDeleteSlot(slot.id)}
                            >
                              <Trash2 className="w-4 h-4 text-red-600 dark:text-red-400" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </TabsContent>
            </Tabs>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
