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

export function SchedulingSettings() {
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
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center gap-2">
        <Clock className="w-6 h-6 text-blue-600" />
        <div>
          <h2 className="text-2xl font-bold">Configurações de Agendamento</h2>
          <p className="text-sm text-gray-500">Gerencie as opções de agendamento de pedidos</p>
        </div>
      </div>

      {/* Main Settings Card */}
      <Card>
        <CardHeader>
          <CardTitle>Agendamento de Pedidos</CardTitle>
          <CardDescription>Ative ou desative o recurso de agendamento para seus clientes</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Enable Scheduling Toggle */}
          <div className="flex items-center justify-between p-4 bg-blue-50 rounded-lg border border-blue-200">
            <div className="space-y-1">
              <Label className="text-base font-semibold">Ativar Agendamento</Label>
              <p className="text-sm text-gray-600">Permite que clientes agendem pedidos para datas e horários futuros</p>
            </div>
            <Switch
              checked={form.enableScheduling}
              onCheckedChange={(value) => handleToggleChange('enableScheduling', value)}
              className="ml-4"
            />
          </div>

          {/* Settings - Only show if enabled */}
          {form.enableScheduling && (
            <div className="space-y-6 p-4 bg-gray-50 rounded-lg border border-gray-200">
              {/* Min Schedule Minutes */}
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Label htmlFor="minScheduleMinutes" className="font-semibold">
                    Tempo Mínimo de Antecedência
                  </Label>
                  <span className="text-xs bg-yellow-100 text-yellow-800 px-2 py-1 rounded">
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
                  />
                  <span className="text-sm text-gray-600">minutos</span>
                  {form.minScheduleMinutes >= 60 && (
                    <span className="text-xs text-gray-500">
                      ({Math.floor(form.minScheduleMinutes / 60)}h {form.minScheduleMinutes % 60}min)
                    </span>
                  )}
                </div>
                <p className="text-xs text-gray-500">
                  Clientes não poderão agendar com menos de {form.minScheduleMinutes} minutos de antecedência
                </p>
              </div>

              {/* Max Schedule Days */}
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Label htmlFor="maxScheduleDays" className="font-semibold">
                    Máximo de Dias de Antecedência
                  </Label>
                  <span className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded">
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
                  />
                  <span className="text-sm text-gray-600">dias</span>
                </div>
                <p className="text-xs text-gray-500">
                  Clientes poderão agendar até {form.maxScheduleDays} dia(s) no futuro
                </p>
              </div>

              {/* Allow Scheduling on Closed Days */}
              <div className="flex items-center justify-between p-3 bg-orange-50 rounded border border-orange-200">
                <div className="space-y-1">
                  <Label className="font-semibold">Permitir Agendamento em Dias Fechados</Label>
                  <p className="text-xs text-gray-600">
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
              <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                <p className="text-sm text-blue-900">
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
            <div className="p-4 bg-gray-100 rounded-lg border border-gray-300 text-center">
              <p className="text-gray-600">
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
          className="bg-blue-600 hover:bg-blue-700"
        >
          {isSaving ? 'Salvando...' : 'Salvar Configurações'}
        </Button>
        {hasChanges && (
          <p className="text-sm text-orange-600 flex items-center gap-2">
            ⚠️ Existem mudanças não salvas
          </p>
        )}
      </div>

      {/* Summary Card */}
      <Card className="bg-gradient-to-r from-blue-50 to-purple-50">
        <CardHeader>
          <CardTitle className="text-lg">Resumo das Configurações</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-gray-700">Status:</span>
            <span className={`font-semibold ${form.enableScheduling ? 'text-green-600' : 'text-red-600'}`}>
              {form.enableScheduling ? '✓ Ativado' : '✗ Desativado'}
            </span>
          </div>
          {form.enableScheduling && (
            <>
              <div className="flex items-center justify-between">
                <span className="text-gray-700">Tempo mínimo:</span>
                <span className="font-semibold">{form.minScheduleMinutes} minutos</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-700">Dias máximos:</span>
                <span className="font-semibold">{form.maxScheduleDays} dia(s)</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-700">Agendamento em dias fechados:</span>
                <span className={`font-semibold ${form.allowSchedulingOnClosedDays ? 'text-green-600' : 'text-orange-600'}`}>
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
