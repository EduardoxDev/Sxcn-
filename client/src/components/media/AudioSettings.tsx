import { Mic, MicOff, Volume2 } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Select } from '@/components/ui/select';
import { MicLevelMeter } from './MicLevelMeter';
import { useMediaDevices } from '@/hooks/useMediaDevices';
import { useMedia } from '@/stores/mediaStore';
import { useSettings } from '@/stores/settingsStore';
import { microphone } from '@/services/media/microphone';
import { getSession } from '@/services/session/RoomSession';
import { capabilities } from '@/lib/browser';
import { notify } from '@/lib/notify';

const MIC_COPY: Record<string, string> = {
  idle: 'Ative o microfone para testar ou entre apenas para ouvir.',
  requesting: 'Aguardando permissão do navegador…',
  none: 'Você entrará apenas para ouvir.',
  denied: 'Microfone bloqueado. Permita o acesso nas configurações do navegador e tente novamente.',
  unavailable: 'Nenhum microfone disponível. Conecte um dispositivo ou entre para ouvir.',
  busy: 'Microfone ocupado. Feche outros aplicativos e tente novamente.',
  error: 'Não foi possível acessar o microfone. Tente novamente.',
};

export function AudioSettings() {
  const mic = useMedia((s) => s.mic);
  const settings = useSettings();
  const devices = useMediaDevices(mic.status);
  const [testing, setTesting] = useState(false);
  const toggle = async () => {
    const session = getSession();
    if (session) return session.toggleMic();
    if (mic.status !== 'ready') await microphone.acquire(settings.micDeviceId);
    if (useMedia.getState().mic.status === 'ready')
      microphone.setMuted(mic.status === 'ready' ? !mic.muted : false);
  };
  const selectInput = async (id: string) => {
    const deviceId = id === 'system' ? null : id;
    settings.set({ micDeviceId: deviceId });
    if (getSession()) await getSession()!.switchMicrophone(deviceId ?? '');
    else await microphone.acquire(deviceId);
  };
  const testOutput = async () => {
    setTesting(true);
    const ctx = new AudioContext();
    try {
      const sink = ctx as AudioContext & { setSinkId?: (id: string) => Promise<void> };
      if (settings.outputDeviceId && sink.setSinkId) await sink.setSinkId(settings.outputDeviceId);
      await ctx.resume();
      const oscillator = ctx.createOscillator();
      const gain = ctx.createGain();
      oscillator.frequency.value = 440;
      gain.gain.setValueAtTime(0, ctx.currentTime);
      gain.gain.linearRampToValueAtTime(0.08, ctx.currentTime + 0.04);
      gain.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.6);
      oscillator.connect(gain).connect(ctx.destination);
      oscillator.start();
      oscillator.stop(ctx.currentTime + 0.65);
      await new Promise<void>((resolve) => {
        oscillator.onended = () => resolve();
      });
    } catch {
      notify.error('Não foi possível reproduzir o teste', 'Verifique o dispositivo de saída.');
    } finally {
      await ctx.close();
      setTesting(false);
    }
  };
  return (
    <div className="space-y-5">
      <div className="space-y-2">
        <label htmlFor="microphone" className="text-xs font-medium text-fg-secondary">
          Microfone
        </label>
        <Select
          id="microphone"
          value={settings.micDeviceId ?? 'system'}
          onValueChange={(v) => void selectInput(v)}
          disabled={mic.status === 'requesting'}
          options={[
            { value: 'system', label: 'Padrão do sistema' },
            ...devices.inputs.map((d) => ({ value: d.deviceId, label: d.label })),
          ]}
          icon={<Mic />}
        />
        <div className="flex items-center gap-3 py-2">
          <Button
            size="sm"
            onClick={() => void toggle()}
            disabled={mic.status === 'requesting'}
            aria-label={
              mic.status === 'ready' && !mic.muted ? 'Silenciar microfone' : 'Ativar microfone'
            }
          >
            {mic.muted || mic.status !== 'ready' ? <MicOff /> : <Mic />}
            {mic.status !== 'ready' ? 'Ativar e testar' : mic.muted ? 'Ativar' : 'Silenciar'}
          </Button>
          <MicLevelMeter stream={mic.stream} enabled={!mic.muted} className="flex-1" />
        </div>
        <p role="status" className="text-xs leading-relaxed text-fg-secondary">
          {mic.status === 'ready'
            ? mic.muted
              ? 'Microfone silenciado.'
              : 'Microfone ativo. Fale para testar o nível de entrada.'
            : MIC_COPY[mic.status]}
        </p>
      </div>
      <div className="space-y-2">
        <label htmlFor="audio-output" className="text-xs font-medium text-fg-secondary">
          Saída de áudio
        </label>
        <Select
          id="audio-output"
          value={settings.outputDeviceId ?? 'system'}
          disabled={!capabilities.outputSelection}
          onValueChange={(v) => settings.set({ outputDeviceId: v === 'system' ? null : v })}
          options={[
            { value: 'system', label: 'Padrão do sistema' },
            ...devices.outputs.map((d) => ({ value: d.deviceId, label: d.label })),
          ]}
          icon={<Volume2 />}
        />
        {!capabilities.outputSelection && (
          <p className="text-xs text-fg-muted">
            Neste navegador, altere a saída nas configurações do sistema.
          </p>
        )}
        <Button variant="ghost" size="sm" disabled={testing} onClick={() => void testOutput()}>
          <Volume2 /> {testing ? 'Reproduzindo…' : 'Testar saída de áudio'}
        </Button>
      </div>
    </div>
  );
}
