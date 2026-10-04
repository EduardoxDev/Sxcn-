import { APP_VERSION } from '@scxn/shared';
import { Dialog, DialogBody, DialogContent } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { AudioSettings } from '@/components/media/AudioSettings';
import { useUi } from '@/stores/uiStore';
import { useSettings } from '@/stores/settingsStore';
import { useRoom } from '@/stores/roomStore';
import { getSession } from '@/services/session/RoomSession';
import type { FrameRate, Optimization, QualityPreset } from '@/lib/quality';

export function SettingsDialog() {
  const open = useUi((s) => s.settingsOpen);
  const tab = useUi((s) => s.settingsTab);
  const settings = useSettings();
  const status = useRoom((s) => s.status);
  const updateStream = (patch: {
    quality?: QualityPreset;
    fps?: FrameRate;
    optimization?: Optimization;
  }) => {
    settings.set(patch);
    void getSession()?.applyScreenSettings();
  };
  return (
    <Dialog open={open} onOpenChange={(settingsOpen) => useUi.getState().set({ settingsOpen })}>
      <DialogContent title="Configurações" description="Ajuste sua experiência nesta sessão.">
        <Tabs
          value={tab}
          onValueChange={(v) => useUi.getState().set({ settingsTab: v as typeof tab })}
          className="mt-3 min-h-0 overflow-y-auto"
        >
          <TabsList>
            <TabsTrigger value="audio">Áudio</TabsTrigger>
            <TabsTrigger value="stream">Transmissão</TabsTrigger>
            <TabsTrigger value="interface">Interface</TabsTrigger>
            <TabsTrigger value="about">Sobre</TabsTrigger>
          </TabsList>
          <DialogBody>
            <TabsContent value="audio">
              <AudioSettings />
            </TabsContent>
            <TabsContent value="stream" className="space-y-5">
              <div className="space-y-2">
                <label htmlFor="quality" className="text-xs text-fg-secondary">
                  Qualidade
                </label>
                <Select
                  id="quality"
                  value={settings.quality}
                  onValueChange={(v) => updateStream({ quality: v as QualityPreset })}
                  options={[
                    { value: 'auto', label: 'Automática (recomendado)' },
                    { value: '1080p', label: '1080p' },
                    { value: '720p', label: '720p' },
                  ]}
                />
              </div>
              <div className="space-y-2">
                <label htmlFor="fps" className="text-xs text-fg-secondary">
                  Quadros por segundo
                </label>
                <Select
                  id="fps"
                  value={String(settings.fps)}
                  onValueChange={(v) => updateStream({ fps: Number(v) as FrameRate })}
                  options={[
                    { value: '30', label: '30 FPS' },
                    { value: '60', label: '60 FPS (quando suportado)' },
                  ]}
                />
              </div>
              <div className="space-y-2">
                <label htmlFor="optimization" className="text-xs text-fg-secondary">
                  Otimização
                </label>
                <Select
                  id="optimization"
                  value={settings.optimization}
                  onValueChange={(v) => updateStream({ optimization: v as Optimization })}
                  options={[
                    { value: 'detail', label: 'Nitidez de texto' },
                    { value: 'motion', label: 'Fluidez de movimento' },
                  ]}
                />
              </div>
              <p className="text-xs leading-relaxed text-fg-muted">
                Aplicado à tela que você transmite. A qualidade efetiva depende da conexão, do
                dispositivo e do navegador.
              </p>
            </TabsContent>
            <TabsContent value="interface" className="space-y-5">
              <div className="flex items-center justify-between gap-4">
                <label htmlFor="reduced-motion" className="text-sm">
                  Reduzir animações
                </label>
                <Switch
                  id="reduced-motion"
                  checked={settings.reducedMotion}
                  onCheckedChange={(reducedMotion) => settings.set({ reducedMotion })}
                />
              </div>
              <p className="text-xs text-fg-muted">
                A preferência de redução de movimento do sistema também é respeitada.
              </p>
              <p className="text-xs leading-6 text-fg-secondary">
                M — microfone · S — compartilhar tela
                <br />F — tela cheia · P — participantes
                <br />
                Esc — fechar janela ou sair da tela cheia
              </p>
            </TabsContent>
            <TabsContent value="about" className="space-y-4 text-sm text-fg-secondary">
              <p className="font-medium text-fg">Scxn {APP_VERSION}</p>
              <p>Private screenshare sessions.</p>
              <p>
                Conexão:{' '}
                {status === 'joined'
                  ? 'conectada'
                  : status === 'reconnecting'
                    ? 'reconectando'
                    : 'aguardando conexão'}
                .
              </p>
              <p className="text-xs leading-relaxed">
                Áudio e tela são transmitidos por WebRTC. A aplicação não grava nem armazena sua
                mídia. Compartilhe o convite apenas com pessoas de confiança.
              </p>
            </TabsContent>
          </DialogBody>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
