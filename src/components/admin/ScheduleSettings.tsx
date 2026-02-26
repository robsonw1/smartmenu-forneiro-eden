import { useEffect, useState } from 'react';
import { Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { useSettingsStore } from '@/store/useSettingsStore';
import { toast } from 'sonner';

type SchedulingForm = {
  enableScheduling: boolean;
  minScheduleMinutes: number;
  maxScheduleDays: number;
  allowSchedulingOnClosedDays: boolean;
};

interface SchedulingSettingsProps {
  onScheduleChange?: (day: any, updates: any) => Promise<void>;
  onManualOpenToggle?: (day: any, isManuallyOpen: boolean) => Promise<void>;
}

export function SchedulingSettings({ onScheduleChange, onManualOpenToggle }: SchedulingSettingsProps = {}) {
  const { settings, updateSettings } = useSettingsStore();
  const [isSaving, setIsSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const [form, setForm] = useState<SchedulingForm>({
    enableScheduling: settings.enableScheduling ?? false,
    minScheduleMinutes: settings.minScheduleMinutes ?? 30,
    maxScheduleDays: settings.maxScheduleDays ?? 7,
    allowSchedulingOnClosedDays: settings.allowSchedulingOnClosedDays ?? false,
  });

  useEffect(() => {
    setForm({
      enableScheduling: settings.enableScheduling ?? false,
      minScheduleMinutes: settings.minScheduleMinutes ?? 30,
      maxScheduleDays: settings.maxScheduleDays ?? 7,
      allowSchedulingOnClosedDays: settings.allowSchedulingOnClosedDays ?? false,
    });
    setHasChanges(false);
  }, [settings]);

  const handleToggleChange = (field: keyof Pick<SchedulingForm, 'enableScheduling' | 'allowSchedulingOnClosedDays'>, value: boolean) => {
    setForm(prev => ({ ...prev, [field]: value }));
    setHasChanges(true);
  };

  const handleNumberChange = (field: keyof Pick<SchedulingForm, 'minScheduleMinutes' | 'maxScheduleDays'>, value: string) => {
    const numValue = parseInt(value) || 0;
    setForm(prev => ({ ...prev, [field]: numValue }));
    setHasChanges(true);
  };

  const handleSave = async () => {
    try {
      setIsSaving(true);

      // Validations
      if (form.minScheduleMinutes < 0) {
        toast.error('Tempo mínimo não pode ser negativo');
        return;
      }

      if (form.maxScheduleDays < 1) {
        toast.error('Máximo de dias deve ser pelo menos 1');
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
          <h2 style={{ color: '#111827', fontSize: '24px', fontWeight: 'bold' }}>Configurações de Agendamento</h2>
          <p style={{ color: '#4b5563', fontSize: '14px' }}>Gerencie as opções de agendamento de pedidos</p>
        </div>
      </div>

      {/* Main Settings Card */}
      <Card style={{ backgroundColor: '#FFFFFF', borderColor: '#dcfce7' }}>
        <CardHeader style={{ backgroundColor: '#f0fdf4', borderBottomColor: '#dcfce7', borderBottomWidth: '1px' }}>
          <CardTitle style={{ color: '#166534' }}>Agendamento de Pedidos</CardTitle>
          <CardDescription style={{ color: '#22863a' }}>Ative ou desative o recurso de agendamento para seus clientes</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6" style={{ backgroundColor: '#FFFFFF' }}>
          {/* Enable Scheduling Toggle */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px', backgroundColor: '#f0fdf4', borderRadius: '8px', borderColor: '#dcfce7', borderWidth: '1px' }}>
            <div className="space-y-1">
              <Label style={{ fontSize: '16px', fontWeight: '600', color: '#111827' }}>Ativar Agendamento</Label>
              <p style={{ fontSize: '14px', color: '#374151' }}>Permite que clientes agendem pedidos para datas e horários futuros</p>
            </div>
            <Switch
              checked={form.enableScheduling}
              onCheckedChange={(value) => handleToggleChange('enableScheduling', value)}
              className="ml-4"
            />
          </div>

          {/* Settings - Only show if enabled */}
          {form.enableScheduling && (
            <div className="space-y-6" style={{ padding: '16px', backgroundColor: '#f9fafb', borderRadius: '8px', borderColor: '#e5e7eb', borderWidth: '1px' }}>
              {/* Min Schedule Minutes */}
              <div className="space-y-2">
                <div className="flex items-center gap-2 flex-wrap">
                  <Label htmlFor="minScheduleMinutes" style={{ fontWeight: '600', color: '#111827' }}>
                    Tempo Mínimo de Antecedência
                  </Label>
                  <span style={{ fontSize: '12px', backgroundColor: '#fef3c7', color: '#92400e', padding: '4px 8px', borderRadius: '4px', fontWeight: '500' }}>
                    Recomendado: 30-120 minutos
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <Input
                    id="minScheduleMinutes"
                    type="number"
                    min="0"
                    max="1440"
                    value={form.minScheduleMinutes}
                    onChange={(e) => handleNumberChange('minScheduleMinutes', e.target.value)}
                    className="w-32"
                    style={{ borderColor: '#d1d5db', color: '#111827' }}
                  />
                  <span style={{ fontSize: '14px', color: '#374151', fontWeight: '500' }}>minutos</span>
                  {form.minScheduleMinutes >= 60 && (
                    <span style={{ fontSize: '12px', color: '#6b7280' }}>
                      ({Math.floor(form.minScheduleMinutes / 60)}h {form.minScheduleMinutes % 60}min)
                    </span>
                  )}
                </div>
                <p style={{ fontSize: '12px', color: '#6b7280' }}>
                  Clientes não poderão agendar com menos de {form.minScheduleMinutes} minutos de antecedência
                </p>
              </div>

              {/* Max Schedule Days */}
              <div className="space-y-2">
                <div className="flex items-center gap-2 flex-wrap">
                  <Label htmlFor="maxScheduleDays" style={{ fontWeight: '600', color: '#111827' }}>
                    Máximo de Dias de Antecedência
                  </Label>
                  <span style={{ fontSize: '12px', backgroundColor: '#dcfce7', color: '#166534', padding: '4px 8px', borderRadius: '4px', fontWeight: '500' }}>
                    Recomendado: 7-30 dias
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <Input
                    id="maxScheduleDays"
                    type="number"
                    min="1"
                    max="365"
                    value={form.maxScheduleDays}
                    onChange={(e) => handleNumberChange('maxScheduleDays', e.target.value)}
                    className="w-32"
                    style={{ borderColor: '#d1d5db', color: '#111827' }}
                  />
                  <span style={{ fontSize: '14px', color: '#374151', fontWeight: '500' }}>dias</span>
                </div>
                <p style={{ fontSize: '12px', color: '#6b7280' }}>
                  Clientes poderão agendar até {form.maxScheduleDays} dia(s) no futuro
                </p>
              </div>

              {/* Allow Scheduling on Closed Days */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px', backgroundColor: '#fef3c7', borderRadius: '6px', borderColor: '#fcd34d', borderWidth: '1px' }}>
                <div className="space-y-1">
                  <Label style={{ fontWeight: '600', color: '#111827' }}>Permitir Agendamento em Dias Fechados</Label>
                  <p style={{ fontSize: '12px', color: '#374151' }}>
                    Se desativado, clientes não podem agendar para dias em que a loja está fechada
                  </p>
                </div>
                <Switch
                  checked={form.allowSchedulingOnClosedDays}
                  onCheckedChange={(value) => handleToggleChange('allowSchedulingOnClosedDays', value)}
                  className="ml-4"
                />
              </div>

              {/* Info Box */}
              <div style={{ padding: '12px', backgroundColor: '#dbeafe', borderColor: '#bfdbfe', borderWidth: '1px', borderRadius: '8px', color: '#111827', fontSize: '14px' }}>
                <p style={{ fontWeight: '500' }}>
                  <strong>💡 Dica:</strong> Para uma pizzaria típica, recomendamos:
                  <br />• Tempo mínimo: 60-120 minutos (para preparação)
                  <br />• Dias máximos: 7-15 dias (para gestão de demanda)
                  <br />• Desativar agendamento em dias fechados (a menos que ofereça combo weekend)
                </p>
              </div>
            </div>
          )}

          {/* Disabled State Message */}
          {!form.enableScheduling && (
            <div style={{ padding: '16px', backgroundColor: '#f3f4f6', borderRadius: '8px', borderColor: '#d1d5db', borderWidth: '1px', textAlign: 'center' }}>
              <p style={{ fontWeight: '500', color: '#374151' }}>
                <strong>Agendamento desativado</strong> - Ative o toggle acima para configurar as opções
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Save Button */}
      <div className="flex gap-3 pt-4">
        <Button
          onClick={handleSave}
          disabled={!hasChanges || isSaving}
          style={{ backgroundColor: '#16a34a', color: '#ffffff' }}
          onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#15803d'}
          onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#16a34a'}
        >
          {isSaving ? 'Salvando...' : 'Salvar Configurações'}
        </Button>
        {hasChanges && (
          <p style={{ fontSize: '14px', color: '#ea580c', display: 'flex', alignItems: 'center', gap: '8px', fontWeight: '500' }}>
            ⚠️ Existem mudanças não salvas
          </p>
        )}
      </div>

      {/* Summary Card */}
      <Card style={{ backgroundColor: '#FFFFFF', borderColor: '#dcfce7' }}>
        <CardHeader style={{ backgroundColor: '#f0fdf4', borderBottomColor: '#dcfce7', borderBottomWidth: '1px' }}>
          <CardTitle style={{ fontSize: '18px', color: '#166534' }}>Resumo das Configurações</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2" style={{ backgroundColor: '#FFFFFF' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ color: '#4b5563', fontWeight: '500' }}>Status:</span>
            <span style={{ fontWeight: '600', color: form.enableScheduling ? '#16a34a' : '#dc2626' }}>
              {form.enableScheduling ? '✓ Ativado' : '✗ Desativado'}
            </span>
          </div>
          {form.enableScheduling && (
            <>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ color: '#4b5563', fontWeight: '500' }}>Tempo mínimo:</span>
                <span style={{ fontWeight: '600', color: '#111827' }}>{form.minScheduleMinutes} minutos</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ color: '#4b5563', fontWeight: '500' }}>Dias máximos:</span>
                <span style={{ fontWeight: '600', color: '#111827' }}>{form.maxScheduleDays} dia(s)</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ color: '#4b5563', fontWeight: '500' }}>Agendamento em dias fechados:</span>
                <span style={{ fontWeight: '600', color: form.allowSchedulingOnClosedDays ? '#16a34a' : '#ea580c' }}>
                  {form.allowSchedulingOnClosedDays ? 'Permitido' : 'Bloqueado'}
                </span>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
