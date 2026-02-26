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
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center gap-2">
        <Clock className="w-6 h-6 text-blue-600 dark:text-blue-400" />
        <div>
          <h2 className="text-2xl font-bold text-foreground">Configurações de Agendamento</h2>
          <p className="text-sm text-muted-foreground">Gerencie as opções de agendamento de pedidos</p>
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
          <div className="flex items-center justify-between p-4 bg-blue-100 dark:bg-blue-900 rounded-lg border border-blue-400 dark:border-blue-700 text-blue-900 dark:text-blue-100">
            <div className="space-y-1">
              <Label className="text-base font-semibold text-blue-900 dark:text-blue-100">Ativar Agendamento</Label>
              <p className="text-sm text-blue-800 dark:text-blue-200">Permite que clientes agendem pedidos para datas e horários futuros</p>
            </div>
            <Switch
              checked={form.enableScheduling}
              onCheckedChange={(value) => handleToggleChange('enableScheduling', value)}
              className="ml-4"
            />
          </div>

          {/* Settings - Only show if enabled */}
          {form.enableScheduling && (
            <div className="space-y-6 p-4 bg-slate-50 dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-800">
              {/* Min Schedule Minutes */}
              <div className="space-y-2">
                <div className="flex items-center gap-2 flex-wrap">
                  <Label htmlFor="minScheduleMinutes" className="font-semibold text-gray-900 dark:text-slate-100">
                    Tempo Mínimo de Antecedência
                  </Label>
                  <span className="text-xs bg-yellow-200 dark:bg-yellow-800 text-yellow-900 dark:text-yellow-100 px-2 py-1 rounded font-medium">
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
                  <span className="text-sm text-gray-900 dark:text-slate-100 font-medium">minutos</span>
                  {form.minScheduleMinutes >= 60 && (
                    <span className="text-xs text-gray-600 dark:text-slate-400">
                      ({Math.floor(form.minScheduleMinutes / 60)}h {form.minScheduleMinutes % 60}min)
                    </span>
                  )}
                </div>
                <p className="text-xs text-gray-600 dark:text-slate-400">
                  Clientes não poderão agendar com menos de {form.minScheduleMinutes} minutos de antecedência
                </p>
              </div>

              {/* Max Schedule Days */}
              <div className="space-y-2">
                <div className="flex items-center gap-2 flex-wrap">
                  <Label htmlFor="maxScheduleDays" className="font-semibold text-gray-900 dark:text-slate-100">
                    Máximo de Dias de Antecedência
                  </Label>
                  <span className="text-xs bg-green-200 dark:bg-green-800 text-green-900 dark:text-green-100 px-2 py-1 rounded font-medium">
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
                  <span className="text-sm text-gray-900 dark:text-slate-100 font-medium">dias</span>
                </div>
                <p className="text-xs text-gray-600 dark:text-slate-400">
                  Clientes poderão agendar até {form.maxScheduleDays} dia(s) no futuro
                </p>
              </div>

              {/* Allow Scheduling on Closed Days */}
              <div className="flex items-center justify-between p-3 bg-orange-100 dark:bg-orange-900 rounded border border-orange-400 dark:border-orange-700 text-orange-900 dark:text-orange-100">
                <div className="space-y-1">
                  <Label className="font-semibold text-orange-900 dark:text-orange-100">Permitir Agendamento em Dias Fechados</Label>
                  <p className="text-xs text-orange-800 dark:text-orange-200">
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
              <div className="p-3 bg-blue-100 dark:bg-blue-900 border border-blue-400 dark:border-blue-700 rounded-lg text-blue-900 dark:text-blue-100">
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
            <div className="p-4 bg-slate-200 dark:bg-slate-800 rounded-lg border border-slate-400 dark:border-slate-700 text-center">
              <p className="font-medium text-gray-900 dark:text-slate-100">
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
          className="bg-blue-600 hover:bg-blue-700 dark:bg-blue-700 dark:hover:bg-blue-600"
        >
          {isSaving ? 'Salvando...' : 'Salvar Configurações'}
        </Button>
        {hasChanges && (
          <p className="text-sm text-orange-600 dark:text-orange-400 flex items-center gap-2 font-medium">
            ⚠️ Existem mudanças não salvas
          </p>
        )}
      </div>

      {/* Summary Card */}
      <Card className="bg-gradient-to-r from-blue-100 to-purple-100 dark:from-blue-900 dark:to-purple-900 border-blue-300 dark:border-blue-700">
        <CardHeader>
          <CardTitle className="text-lg text-foreground">Resumo das Configurações</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-foreground font-medium">Status:</span>
            <span className={`font-semibold ${form.enableScheduling ? 'text-green-700 dark:text-green-300' : 'text-red-700 dark:text-red-300'}`}>
              {form.enableScheduling ? '✓ Ativado' : '✗ Desativado'}
            </span>
          </div>
          {form.enableScheduling && (
            <>
              <div className="flex items-center justify-between">
                <span className="text-foreground font-medium">Tempo mínimo:</span>
                <span className="font-semibold">{form.minScheduleMinutes} minutos</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-foreground font-medium">Dias máximos:</span>
                <span className="font-semibold">{form.maxScheduleDays} dia(s)</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-foreground font-medium">Agendamento em dias fechados:</span>
                <span className={`font-semibold ${form.allowSchedulingOnClosedDays ? 'text-green-700 dark:text-green-300' : 'text-orange-700 dark:text-orange-300'}`}>
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
