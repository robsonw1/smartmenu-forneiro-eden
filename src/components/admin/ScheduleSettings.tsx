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
    <div className="space-y-6 p-6 bg-slate-950 dark:bg-slate-950 text-white">
      {/* Header */}
      <div className="flex items-center gap-2">
        <Clock className="w-6 h-6 text-green-400" />
        <div>
          <h2 className="text-2xl font-bold text-white">Configurações de Agendamento</h2>
          <p className="text-sm text-gray-300">Gerencie as opções de agendamento de pedidos</p>
        </div>
      </div>

      {/* Main Settings Card */}
      <Card className="bg-slate-900 border-green-700">
        <CardHeader className="bg-green-900 border-b border-green-700">
          <CardTitle className="text-green-100">Agendamento de Pedidos</CardTitle>
          <CardDescription className="text-green-300">Ative ou desative o recurso de agendamento para seus clientes</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6 bg-slate-900 text-white">
          {/* Enable Scheduling Toggle */}
          <div className="flex items-center justify-between p-4 bg-green-900 rounded-lg border border-green-700">
            <div className="space-y-1">
              <Label className="text-base font-semibold text-green-100">Ativar Agendamento</Label>
              <p className="text-sm text-green-200">Permite que clientes agendem pedidos para datas e horários futuros</p>
            </div>
            <Switch
              checked={form.enableScheduling}
              onCheckedChange={(value) => handleToggleChange('enableScheduling', value)}
              className="ml-4"
            />
          </div>

          {/* Settings - Only show if enabled */}
          {form.enableScheduling && (
            <div className="space-y-6 p-4 bg-slate-800 rounded-lg border border-slate-700">
              {/* Min Schedule Minutes */}
              <div className="space-y-2">
                <div className="flex items-center gap-2 flex-wrap">
                  <Label htmlFor="minScheduleMinutes" className="font-semibold text-white">
                    Tempo Mínimo de Antecedência
                  </Label>
                  <span className="text-xs bg-yellow-900 text-yellow-100 px-2 py-1 rounded font-medium">
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
                    className="w-32 bg-slate-700 text-white border-slate-600"
                  />
                  <span className="text-sm text-gray-200 font-medium">minutos</span>
                  {form.minScheduleMinutes >= 60 && (
                    <span className="text-xs text-gray-400">
                      ({Math.floor(form.minScheduleMinutes / 60)}h {form.minScheduleMinutes % 60}min)
                    </span>
                  )}
                </div>
                <p className="text-xs text-gray-400">
                  Clientes não poderão agendar com menos de {form.minScheduleMinutes} minutos de antecedência
                </p>
              </div>

              {/* Max Schedule Days */}
              <div className="space-y-2">
                <div className="flex items-center gap-2 flex-wrap">
                  <Label htmlFor="maxScheduleDays" className="font-semibold text-white">
                    Máximo de Dias de Antecedência
                  </Label>
                  <span className="text-xs bg-green-900 text-green-100 px-2 py-1 rounded font-medium">
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
                    className="w-32 bg-slate-700 text-white border-slate-600"
                  />
                  <span className="text-sm text-gray-200 font-medium">dias</span>
                </div>
                <p className="text-xs text-gray-400">
                  Clientes poderão agendar até {form.maxScheduleDays} dia(s) no futuro
                </p>
              </div>

              {/* Allow Scheduling on Closed Days */}
              <div className="flex items-center justify-between p-3 bg-orange-900 rounded border border-orange-700">
                <div className="space-y-1">
                  <Label className="font-semibold text-orange-100">Permitir Agendamento em Dias Fechados</Label>
                  <p className="text-xs text-orange-200">
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
              <div className="p-3 bg-blue-900 border border-blue-700 rounded-lg text-blue-100">
                <p className="text-sm font-medium">
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
            <div className="p-4 bg-slate-800 rounded-lg border border-slate-700 text-center">
              <p className="font-medium text-gray-200">
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
          className="bg-green-600 hover:bg-green-700 text-white"
        >
          {isSaving ? 'Salvando...' : 'Salvar Configurações'}
        </Button>
        {hasChanges && (
          <p className="text-sm text-yellow-400 flex items-center gap-2 font-medium">
            ⚠️ Existem mudanças não salvas
          </p>
        )}
      </div>

      {/* Summary Card */}
      <Card className="bg-slate-900 border-green-700">
        <CardHeader className="bg-green-900 border-b border-green-700">
          <CardTitle className="text-lg text-green-100">Resumo das Configurações</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 bg-slate-900 text-white">
          <div className="flex items-center justify-between">
            <span className="text-gray-300 font-medium">Status:</span>
            <span className={`font-semibold ${form.enableScheduling ? 'text-green-400' : 'text-red-400'}`}>
              {form.enableScheduling ? '✓ Ativado' : '✗ Desativado'}
            </span>
          </div>
          {form.enableScheduling && (
            <>
              <div className="flex items-center justify-between">
                <span className="text-gray-300 font-medium">Tempo mínimo:</span>
                <span className="font-semibold text-gray-100">{form.minScheduleMinutes} minutos</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-300 font-medium">Dias máximos:</span>
                <span className="font-semibold text-gray-100">{form.maxScheduleDays} dia(s)</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-300 font-medium">Agendamento em dias fechados:</span>
                <span className={`font-semibold ${form.allowSchedulingOnClosedDays ? 'text-green-400' : 'text-yellow-400'}`}>
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
