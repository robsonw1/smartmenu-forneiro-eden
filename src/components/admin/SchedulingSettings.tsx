import { useEffect, useState } from 'react';
import { Clock, Power } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { useSettingsStore, WeekSchedule } from '@/store/useSettingsStore';
import { SchedulingSlotManagementDialog } from './SchedulingSlotManagementDialog';
import { toast } from 'sonner';

type SchedulingForm = {
  enableScheduling: boolean;
  minScheduleMinutes: number;
  maxScheduleDays: number;
  allowSchedulingOnClosedDays: boolean;
  allowSchedulingOutsideBusinessHours: boolean;
  respectBusinessHoursForScheduling: boolean;
  allowSameDaySchedulingOutsideHours: boolean;
};

const dayLabels: Record<keyof WeekSchedule, string> = {
  monday: 'Segunda-feira',
  tuesday: 'Terça-feira',
  wednesday: 'Quarta-feira',
  thursday: 'Quinta-feira',
  friday: 'Sexta-feira',
  saturday: 'Sábado',
  sunday: 'Domingo',
};

const dayOrder: (keyof WeekSchedule)[] = [
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
  'sunday',
];

interface SchedulingSettingsProps {
  onScheduleChange?: (day: keyof WeekSchedule, updates: any) => void;
  onManualOpenToggle?: () => void;
}

export function SchedulingSettings({ onScheduleChange, onManualOpenToggle }: SchedulingSettingsProps = {}) {
  console.log('🚀 [SchedulingSettings] COMPONENTE RENDERIZANDO');
  const { settings, updateSettings, updateDaySchedule, toggleManualOpen, isStoreOpen } = useSettingsStore();
  const [isSaving, setIsSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const [showSlotsDialog, setShowSlotsDialog] = useState(false);
  const [tenantId, setTenantId] = useState<string>('');
  
  const [form, setForm] = useState<SchedulingForm>({
    enableScheduling: settings.enableScheduling ?? false,
    minScheduleMinutes: settings.minScheduleMinutes ?? 30,
    maxScheduleDays: settings.maxScheduleDays ?? 7,
    allowSchedulingOnClosedDays: settings.allowSchedulingOnClosedDays ?? false,
    allowSchedulingOutsideBusinessHours: settings.allowSchedulingOutsideBusinessHours ?? false,
    respectBusinessHoursForScheduling: settings.respectBusinessHoursForScheduling ?? true,
    allowSameDaySchedulingOutsideHours: settings.allowSameDaySchedulingOutsideHours ?? false,
  });

  useEffect(() => {
    setForm({
      enableScheduling: settings.enableScheduling ?? false,
      minScheduleMinutes: settings.minScheduleMinutes ?? 30,
      maxScheduleDays: settings.maxScheduleDays ?? 7,
      allowSchedulingOnClosedDays: settings.allowSchedulingOnClosedDays ?? false,
      allowSchedulingOutsideBusinessHours: settings.allowSchedulingOutsideBusinessHours ?? false,
      respectBusinessHoursForScheduling: settings.respectBusinessHoursForScheduling ?? true,
      allowSameDaySchedulingOutsideHours: settings.allowSameDaySchedulingOutsideHours ?? false,
    });
    console.log('✅ [SchedulingSettings] Form atualizado com settings:', {
      enableScheduling: settings.enableScheduling,
      allowSchedulingOutsideBusinessHours: settings.allowSchedulingOutsideBusinessHours,
      respectBusinessHoursForScheduling: settings.respectBusinessHoursForScheduling,
      allowSameDaySchedulingOutsideHours: settings.allowSameDaySchedulingOutsideHours,
    });
    setHasChanges(false);
  }, [settings]);

  // 🔑 RECUPERAR TENANT ID
  useEffect(() => {
    const storedTenantId = sessionStorage.getItem('oauth_tenant_id');
    if (storedTenantId) {
      setTenantId(storedTenantId);
    } else {
      // Fallback: tentar buscar do banco
      const fetchTenantId = async () => {
        try {
          const { data } = await (supabase as any)
            .from('tenants')
            .select('id')
            .limit(1);
          if (data?.length > 0) {
            setTenantId(data[0].id);
            sessionStorage.setItem('oauth_tenant_id', data[0].id);
          }
        } catch (err) {
          console.error('Erro ao recuperar tenant:', err);
        }
      };
      fetchTenantId();
    }
  }, []);

  const handleToggleChange = (field: keyof Pick<SchedulingForm, 'enableScheduling' | 'allowSchedulingOnClosedDays' | 'allowSchedulingOutsideBusinessHours' | 'respectBusinessHoursForScheduling' | 'allowSameDaySchedulingOutsideHours'>, value: boolean) => {
    setForm(prev => ({ ...prev, [field]: value }));
    setHasChanges(true);
  };

  const handleNumberChange = (field: keyof Pick<SchedulingForm, 'minScheduleMinutes' | 'maxScheduleDays'>, value: string) => {
    const numValue = parseInt(value) || 0;
    setForm(prev => ({ ...prev, [field]: numValue }));
    setHasChanges(true);
  };

  const handleDayScheduleChange = (day: keyof WeekSchedule, updates: any) => {
    updateDaySchedule(day, updates);
    onScheduleChange?.(day, updates);
  };

  const handleManualOpenToggle = () => {
    toggleManualOpen();
    onManualOpenToggle?.();
  };

  const handleSave = async () => {
    try {
      setIsSaving(true);

      // Validations
      if (form.minScheduleMinutes < 0) {
        toast.error('Tempo mínimo não pode ser negativo');
        return;
      }

      if (form.maxScheduleDays < 0) {
        toast.error('Máximo de dias não pode ser negativo');
        return;
      }

      if (form.minScheduleMinutes > form.maxScheduleDays * 24 * 60) {
        toast.error('Tempo mínimo muito alto em relação aos dias máximos');
      }

      await updateSettings({
        enableScheduling: form.enableScheduling,
        minScheduleMinutes: form.minScheduleMinutes,
        maxScheduleDays: form.maxScheduleDays,
        allowSchedulingOnClosedDays: form.allowSchedulingOnClosedDays,
        allowSchedulingOutsideBusinessHours: form.allowSchedulingOutsideBusinessHours,
        respectBusinessHoursForScheduling: form.respectBusinessHoursForScheduling,
        allowSameDaySchedulingOutsideHours: form.allowSameDaySchedulingOutsideHours,
      });

      console.log('💾 [SchedulingSettings] Salvo com sucesso:', {
        allowSchedulingOutsideBusinessHours: form.allowSchedulingOutsideBusinessHours,
      });

      setHasChanges(false);
      toast.success('Configurações de agendamento salvas com sucesso');
    } catch (error) {
      console.error('Erro ao salvar configurações:', error);
      toast.error('Falha ao salvar configurações');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div style={{ backgroundColor: '#FFFFFF', color: '#111827', padding: '24px' }} className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-2">
        <Clock style={{ color: '#16a34a' }} className="w-6 h-6" />
        <div>
          <h2 style={{ color: '#111827', fontSize: '24px', fontWeight: 'bold' }}>Agendamento de Pedidos</h2>
          <p style={{ color: '#4b5563', fontSize: '14px' }}>Configure e gerencie os horários disponíveis para agendamento</p>
        </div>
      </div>

      {/* Main Toggle Card */}
      <Card style={{ backgroundColor: '#FFFFFF', borderColor: '#dcfce7', borderWidth: '2px' }}>
        <CardContent className="pt-6">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '20px', backgroundColor: '#f0fdf4', borderRadius: '12px', borderColor: '#bbf7d0', borderWidth: '2px' }}>
            <div className="space-y-2">
              <Label style={{ fontSize: '18px', fontWeight: '700', color: '#000000' }}>Estado do Agendamento</Label>
              <p style={{ fontSize: '14px', color: '#4b5563' }}>
                {form.enableScheduling 
                  ? '✓ Agendamento ATIVO - Clientes podem agendar pedidos' 
                  : '✗ Agendamento DESATIVO - Clientes NÃO podem agendar'}
              </p>
            </div>
            <Switch
              checked={form.enableScheduling}
              onCheckedChange={(value) => handleToggleChange('enableScheduling', value)}
              className="ml-4 scale-125"
            />
          </div>
        </CardContent>
      </Card>

      {/* If Enabled - Show Management Interface */}
      {form.enableScheduling && (
        <>
          {/* Quick Actions Card */}
          <Card style={{ backgroundColor: '#FFFFFF', borderColor: '#bfdbfe' }}>
            <CardHeader style={{ backgroundColor: '#eff6ff', borderBottomColor: '#bfdbfe', borderBottomWidth: '1px' }}>
              <CardTitle style={{ color: '#1e40af', fontSize: '18px' }}>Gerenciar Horários Disponíveis</CardTitle>
              <CardDescription style={{ color: '#1e3a8a' }}>Adicione, bloqueie ou edite os horários de atendimento</CardDescription>
            </CardHeader>
            <CardContent className="pt-6 space-y-4">
              <div style={{ padding: '16px', backgroundColor: '#f0f9ff', borderRadius: '8px', borderColor: '#e0f2fe', borderWidth: '1px' }}>
                <p style={{ fontSize: '14px', color: '#0c4a6e', marginBottom: '12px' }}>
                  📅 <strong>Funcionalidade central:</strong> Customize completamente os dias e horários disponíveis para seus clientes
                </p>
                <Button
                  onClick={() => setShowSlotsDialog(true)}
                  className="w-full"
                  style={{ backgroundColor: '#16a34a', color: '#ffffff', height: '44px', fontSize: '16px', fontWeight: '600' }}
                  onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#15803d'}
                  onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#16a34a'}
                >
                  📅 Gerenciar Horários
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Horário de Funcionamento Card */}
          <Card style={{ backgroundColor: '#FFFFFF', borderColor: '#e0e7ff' }}>
            <CardHeader style={{ backgroundColor: '#f0f4ff', borderBottomColor: '#e0e7ff', borderBottomWidth: '1px' }}>
              <CardTitle style={{ color: '#4f46e5', fontSize: '18px' }}>🕐 Horário de Funcionamento</CardTitle>
              <CardDescription style={{ color: '#4338ca' }}>Configure os dias e horários de funcionamento do seu estabelecimento</CardDescription>
            </CardHeader>
            <CardContent className="pt-6 space-y-4">
              {/* Manual Open/Close Toggle */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px', backgroundColor: '#f5f3ff', borderRadius: '8px', borderColor: '#e0e7ff', borderWidth: '1px' }}>
                <div className="flex items-center gap-3">
                  <div style={{
                    width: '40px',
                    height: '40px',
                    borderRadius: '50%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: settings.isManuallyOpen ? '#dcfce7' : '#fee2e2'
                  }}>
                    <Power style={{ color: settings.isManuallyOpen ? '#16a34a' : '#dc2626', width: '20px', height: '20px' }} />
                  </div>
                  <div>
                    <p style={{ fontWeight: 'bold', color: '#000000' }}>Estabelecimento</p>
                    <p style={{ fontSize: '12px', color: '#6b7280' }}>
                      {settings.isManuallyOpen ? '✓ Aberto para pedidos' : '✗ Fechado manualmente'}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <Badge style={{
                    backgroundColor: isStoreOpen() ? '#dcfce7' : '#fee2e2',
                    color: isStoreOpen() ? '#166534' : '#991b1b',
                    border: 'none'
                  }}>
                    {isStoreOpen() ? '✓ ABERTO AGORA' : '✗ FECHADO'}
                  </Badge>
                  <Button
                    onClick={handleManualOpenToggle}
                    style={{
                      backgroundColor: settings.isManuallyOpen ? '#dc2626' : '#16a34a',
                      color: '#ffffff',
                      fontSize: '14px',
                      fontWeight: '600'
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.backgroundColor = settings.isManuallyOpen ? '#991b1b' : '#15803d'}
                    onMouseLeave={(e) => e.currentTarget.style.backgroundColor = settings.isManuallyOpen ? '#dc2626' : '#16a34a'}
                  >
                    {settings.isManuallyOpen ? '🔒 Fechar Loja' : '🔓 Abrir Loja'}
                  </Button>
                </div>
              </div>

              {/* Schedule per day */}
              <div className="space-y-3">
                <div style={{ fontSize: '14px', fontWeight: '600', color: '#000000', marginBottom: '12px' }}>
                  ⏰ <strong>Horário de Funcionamento por Dia</strong>
                </div>
                
                {dayOrder.map((day) => {
                  const schedule = settings.schedule[day];
                  return (
                    <div 
                      key={day} 
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        padding: '12px',
                        borderRadius: '8px',
                        border: '1px solid #e5e7eb',
                        backgroundColor: schedule.isOpen ? '#ffffff' : '#f9fafb',
                        opacity: schedule.isOpen ? 1 : 0.7
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flex: 1 }}>
                        <Switch
                          checked={schedule.isOpen}
                          onCheckedChange={(checked) => handleDayScheduleChange(day, { isOpen: checked })}
                        />
                        <span style={{ fontWeight: '600', width: '140px', color: '#111827', fontSize: '14px' }}>
                          {dayLabels[day]}
                        </span>
                      </div>
                      
                      {schedule.isOpen && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <Input
                            type="time"
                            value={schedule.openTime}
                            onChange={(e) => handleDayScheduleChange(day, { openTime: e.target.value })}
                            style={{ width: '100px', height: '36px', fontSize: '13px' }}
                          />
                          <span style={{ fontSize: '13px', color: '#6b7280', fontWeight: '500' }}>às</span>
                          <Input
                            type="time"
                            value={schedule.closeTime}
                            onChange={(e) => handleDayScheduleChange(day, { closeTime: e.target.value })}
                            style={{ width: '100px', height: '36px', fontSize: '13px' }}
                          />
                        </div>
                      )}
                      
                      {!schedule.isOpen && (
                        <Badge style={{ backgroundColor: '#f3f4f6', color: '#6b7280', border: '1px solid #e5e7eb' }}>
                          🚫 Fechado
                        </Badge>
                      )}
                    </div>
                  );
                })}
              </div>

              <div style={{ fontSize: '12px', backgroundColor: '#f0f4ff', color: '#4338ca', padding: '12px', borderRadius: '6px', borderLeft: '4px solid #4f46e5' }}>
                💡 <strong>Dica:</strong> O horário aqui define o funcionamento do estabelecimento e aparece no rodapé para o cliente. Ative/desative dias conforme necessário.
              </div>
            </CardContent>
          </Card>

          {/* Settings Grid */}
          <Card style={{ backgroundColor: '#FFFFFF', borderColor: '#fce7f3' }}>
            <CardHeader style={{ backgroundColor: '#fdf2f8', borderBottomColor: '#fce7f3', borderBottomWidth: '1px' }}>
              <CardTitle style={{ color: '#be185d', fontSize: '18px' }}>Configurações Globais</CardTitle>
              <CardDescription style={{ color: '#831843' }}>Parâmetros de validação para todos os pedidos agendados</CardDescription>
            </CardHeader>
            <CardContent className="pt-6 space-y-6">
              {/* Min Schedule Minutes */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label style={{ fontWeight: '600', color: '#000000', fontSize: '15px' }}>
                    ⏱️ Tempo Mínimo de Antecedência
                  </Label>
                  <span style={{ fontSize: '11px', backgroundColor: '#fef3c7', color: '#92400e', padding: '4px 10px', borderRadius: '4px', fontWeight: '600' }}>
                    Recomendado: 60-120 min
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <Input
                    id="minScheduleMinutes"
                    type="number"
                    min="0"
                    max="1440"
                    value={form.minScheduleMinutes}
                    onChange={(e) => handleNumberChange('minScheduleMinutes', e.target.value)}
                    className="w-24"
                    style={{ borderColor: '#d1d5db', color: '#111827', height: '40px', fontSize: '14px', fontWeight: '600' }}
                  />
                  <span style={{ fontSize: '14px', color: '#4b5563', fontWeight: '500' }}>minutos</span>
                  {form.minScheduleMinutes >= 60 && (
                    <span style={{ fontSize: '13px', color: '#6b7280', backgroundColor: '#f3f4f6', padding: '4px 8px', borderRadius: '4px' }}>
                      ({Math.floor(form.minScheduleMinutes / 60)}h {form.minScheduleMinutes % 60}min)
                    </span>
                  )}
                </div>
                <p style={{ fontSize: '12px', color: '#6b7280', marginTop: '6px' }}>
                  💡 Tempo mínimo que o cliente precisa esperar antes de poder agendar um pedido
                </p>
              </div>

              <div style={{ height: '1px', backgroundColor: '#e5e7eb' }} />

              {/* Max Schedule Days */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label style={{ fontWeight: '600', color: '#000000', fontSize: '15px' }}>
                    📅 Máximo de Dias de Antecedência
                  </Label>
                  <span style={{ fontSize: '11px', backgroundColor: '#dcfce7', color: '#166534', padding: '4px 10px', borderRadius: '4px', fontWeight: '600' }}>
                    Recomendado: 0-14 dias
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <Input
                    id="maxScheduleDays"
                    type="number"
                    min="0"
                    max="365"
                    value={form.maxScheduleDays}
                    onChange={(e) => handleNumberChange('maxScheduleDays', e.target.value)}
                    className="w-24"
                    style={{ borderColor: '#d1d5db', color: '#111827', height: '40px', fontSize: '14px', fontWeight: '600' }}
                  />
                  <span style={{ fontSize: '14px', color: '#4b5563', fontWeight: '500' }}>dias</span>
                </div>
                <p style={{ fontSize: '12px', color: '#6b7280', marginTop: '6px' }}>
                  💡 Quantos dias no futuro o cliente pode agendar um pedido (0 = mesmo dia apenas)
                </p>
              </div>

              <div style={{ height: '1px', backgroundColor: '#e5e7eb' }} />

              {/* Allow Scheduling on Closed Days */}
              <div className="space-y-3">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px', backgroundColor: '#fef3c7', borderRadius: '8px', borderColor: '#fcd34d', borderWidth: '1px' }}>
                  <div className="space-y-1">
                    <Label style={{ fontWeight: '600', color: '#000000', fontSize: '15px' }}>
                      📅 Permitir Agendamento em Dias Bloqueados
                    </Label>
                    <p style={{ fontSize: '12px', color: '#6b7280' }}>
                      {form.allowSchedulingOnClosedDays 
                        ? '✓ Clientes podem agendar em dias que você marcou como bloqueados' 
                        : '✗ Clientes NÃO podem agendar em dias bloqueados'}
                    </p>
                  </div>
                  <Switch
                    checked={form.allowSchedulingOnClosedDays}
                    onCheckedChange={(value) => handleToggleChange('allowSchedulingOnClosedDays', value)}
                    className="ml-4 scale-125"
                  />
                </div>
              </div>

              <div style={{ height: '1px', backgroundColor: '#e5e7eb' }} />

              {/* Allow Scheduling Outside Business Hours */}
              <div className="space-y-3">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px', backgroundColor: '#fce7f3', borderRadius: '8px', borderColor: '#fbcfe8', borderWidth: '1px' }}>
                  <div className="space-y-1">
                    <Label style={{ fontWeight: '600', color: '#000000', fontSize: '15px' }}>
                      🕐 Permitir Agendamento Fora do Horário
                    </Label>
                    <p style={{ fontSize: '12px', color: '#6b7280' }}>
                      {form.allowSchedulingOutsideBusinessHours
                        ? '✓ Clientes podem agendar mesmo quando a loja está fechada'
                        : '✗ Clientes NÃO podem agendar quando a loja está fechada'}
                    </p>
                  </div>
                  <Switch
                    checked={form.allowSchedulingOutsideBusinessHours}
                    onCheckedChange={(value) => {
                      console.log('🔄 [Toggle] Alterando allowSchedulingOutsideBusinessHours para:', value);
                      handleToggleChange('allowSchedulingOutsideBusinessHours', value);
                    }}
                    className="ml-4 scale-125"
                  />
                </div>
              </div>

              <div style={{ height: '1px', backgroundColor: '#e5e7eb' }} />

              {/* Respect Business Hours for Scheduling Display */}
              <div className="space-y-3">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px', backgroundColor: '#dbeafe', borderRadius: '8px', borderColor: '#bfdbfe', borderWidth: '1px' }}>
                  <div className="space-y-1">
                    <Label style={{ fontWeight: '600', color: '#000000', fontSize: '15px' }}>
                      ⏰ Respeitar Horário de Funcionamento na Seleção
                    </Label>
                    <p style={{ fontSize: '12px', color: '#6b7280' }}>
                      {form.respectBusinessHoursForScheduling
                        ? '✓ Apenas horários dentro do funcionamento aparecem'
                        : '✗ Todos os horários aparecem (cliente pode agendar 24/7)'}
                    </p>
                  </div>
                  <Switch
                    checked={form.respectBusinessHoursForScheduling}
                    onCheckedChange={(value) => {
                      console.log('🔄 [Toggle] Alterando respectBusinessHoursForScheduling para:', value);
                      handleToggleChange('respectBusinessHoursForScheduling', value);
                    }}
                    className="ml-4 scale-125"
                  />
                </div>
                <div style={{ fontSize: '12px', backgroundColor: '#eff6ff', color: '#1e40af', padding: '12px', borderRadius: '6px', borderLeft: '4px solid #3b82f6' }}>
                  💡 <strong>O que é:</strong> Controla se o cliente vê apenas slots dentro do seu horário de funcionamento (definido em "Horário de Funcionamento")
                </div>
              </div>

              <div style={{ height: '1px', backgroundColor: '#e5e7eb' }} />

              {/* Allow Same Day Scheduling Outside Hours */}
              <div className="space-y-3">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px', backgroundColor: '#f3e8ff', borderRadius: '8px', borderColor: '#e9d5ff', borderWidth: '1px' }}>
                  <div className="space-y-1">
                    <Label style={{ fontWeight: '600', color: '#000000', fontSize: '15px' }}>
                      📅 Permitir Agendamento Hoje Fora do Horário
                    </Label>
                    <p style={{ fontSize: '12px', color: '#6b7280' }}>
                      {form.allowSameDaySchedulingOutsideHours
                        ? '✓ Cliente consegue agendar para HOJE mesmo se loja está fechada AGORA'
                        : '✗ Cliente NÃO consegue agendar para hoje se loja está fechada AGORA'}
                    </p>
                  </div>
                  <Switch
                    checked={form.allowSameDaySchedulingOutsideHours}
                    onCheckedChange={(value) => {
                      console.log('🔄 [Toggle] Alterando allowSameDaySchedulingOutsideHours para:', value);
                      handleToggleChange('allowSameDaySchedulingOutsideHours', value);
                    }}
                    className="ml-4 scale-125"
                  />
                </div>
                <div style={{ fontSize: '12px', backgroundColor: '#fdf2f8', color: '#be185d', padding: '12px', borderRadius: '6px', borderLeft: '4px solid #ec4899' }}>
                  💡 <strong>Exemplo:</strong> São 21:30 (loja fechada) - Se ATIVADO: cliente consegue agendar para hoje 22:30. Se DESATIVADO: cliente recebe aviso e não consegue agendar.
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Info Card */}
          <div style={{ padding: '16px', backgroundColor: '#dbeafe', borderRadius: '8px', borderColor: '#bfdbfe', borderWidth: '1px', color: '#111827' }}>
            <p style={{ fontSize: '14px', fontWeight: '500', lineHeight: '1.6' }}>
              <strong>💡 Dicas para Configuração:</strong>
              <br />
              • Para pizzaria: tempo mínimo <strong>60-120 minutos</strong> (preparação e entrega)
              <br />
              • Máximo de <strong>0 dias</strong> = agendamento no mesmo dia apenas
              <br />
              • Máximo de <strong>7-14 dias</strong> permite boa gestão de demanda
              <br />
              • Use <strong>"Gerenciar Horários"</strong> para bloquear datas específicas
            </p>
          </div>
        </>
      )}

      {/* If Disabled - Show Info */}
      {!form.enableScheduling && (
        <div style={{ padding: '20px', backgroundColor: '#f3f4f6', borderRadius: '8px', borderColor: '#d1d5db', borderWidth: '1px', textAlign: 'center' }}>
          <p style={{ fontWeight: '500', color: '#374151', fontSize: '15px' }}>
            🔒 <strong>Agendamento desativado</strong> - Ative o toggle acima para começar
          </p>
        </div>
      )}

      {/* Save Button */}
      <div className="flex gap-3 pt-2">
        <Button
          onClick={handleSave}
          disabled={!hasChanges || isSaving}
          style={{ 
            backgroundColor: hasChanges ? '#16a34a' : '#d1d5db',
            color: '#ffffff',
            height: '44px',
            fontSize: '15px',
            fontWeight: '600'
          }}
          onMouseEnter={(e) => hasChanges && (e.currentTarget.style.backgroundColor = '#15803d')}
          onMouseLeave={(e) => hasChanges && (e.currentTarget.style.backgroundColor = '#16a34a')}
        >
          {isSaving ? '⏳ Salvando...' : '✅ Salvar Configurações'}
        </Button>
        {hasChanges && (
          <p style={{ fontSize: '14px', color: '#ea580c', display: 'flex', alignItems: 'center', gap: '8px', fontWeight: '500' }}>
            ⚠️ Mudanças não salvas
          </p>
        )}
      </div>

      {/* Dialog de Gerenciamento de Slots */}
      <SchedulingSlotManagementDialog
        open={showSlotsDialog}
        onOpenChange={setShowSlotsDialog}
        tenantId={tenantId}
      />
    </div>
  );
}
