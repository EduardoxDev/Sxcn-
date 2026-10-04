import { Mic, MicOff, MonitorUp, Settings, PhoneOff, Users, Square } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tooltip } from '@/components/ui/tooltip';
import { useHotkeys } from '@/hooks/useHotkeys';
import { useMediaQuery } from '@/hooks/useMediaQuery';
import { getSession } from '@/services/session/RoomSession';
import { useMedia } from '@/stores/mediaStore';
import { useRoom } from '@/stores/roomStore';
import { useSettings } from '@/stores/settingsStore';
import { useUi } from '@/stores/uiStore';

export function CallControls({ onLeave }: { onLeave: () => void }) {
  const mic = useMedia((s) => s.mic);
  const screen = useMedia((s) => s.screen.status);
  const joined = useRoom((s) => s.status === 'joined');
  const desktop = useMediaQuery('(min-width: 1024px)');
  const sharing = screen === 'sharing' || screen === 'paused';
  const muted = mic.muted || mic.status !== 'ready';
  const toggleMic = () => {
    if (joined) void getSession()?.toggleMic();
  };
  const toggleScreen = () => {
    if (sharing) getSession()?.stopScreen();
    else if (joined) void getSession()?.startScreen();
  };
  const toggleParticipants = () => {
    if (desktop)
      useSettings.getState().set({ sidebarCollapsed: !useSettings.getState().sidebarCollapsed });
    else useUi.getState().set({ participantsDrawerOpen: !useUi.getState().participantsDrawerOpen });
  };
  useHotkeys({ m: toggleMic, s: toggleScreen, p: toggleParticipants });
  return (
    <footer className="flex shrink-0 justify-center px-3 py-4">
      <div
        role="toolbar"
        aria-label="Controles da chamada"
        className="flex items-center gap-1.5 rounded-xl bg-surface p-2 shadow-float ring-1 ring-border"
      >
        <Tooltip label={muted ? 'Ativar microfone' : 'Silenciar microfone'} shortcut="M">
          <Button
            size="icon"
            aria-label={muted ? 'Ativar microfone' : 'Silenciar microfone'}
            aria-pressed={!muted}
            disabled={!joined || mic.status === 'requesting'}
            variant="ghost"
            onClick={toggleMic}
          >
            {muted ? <MicOff /> : <Mic />}
          </Button>
        </Tooltip>
        <Tooltip label={sharing ? 'Parar compartilhamento' : 'Compartilhar tela'} shortcut="S">
          <Button
            variant={sharing ? 'primary' : 'secondary'}
            disabled={!sharing && (!joined || screen === 'requesting')}
            aria-label={sharing ? 'Parar compartilhamento' : 'Compartilhar tela'}
            aria-pressed={sharing}
            onClick={toggleScreen}
          >
            {sharing ? <Square /> : <MonitorUp />}
            <span className="hidden sm:inline">
              {sharing
                ? 'Parar tela'
                : screen === 'requesting'
                  ? 'Escolha uma tela…'
                  : 'Compartilhar tela'}
            </span>
          </Button>
        </Tooltip>
        <span className="mx-1 h-5 w-px bg-border" />
        <Tooltip label="Participantes" shortcut="P">
          <Button
            variant="ghost"
            size="icon"
            aria-label="Participantes"
            onClick={toggleParticipants}
          >
            <Users />
          </Button>
        </Tooltip>
        <Tooltip label="Configurações">
          <Button
            variant="ghost"
            size="icon"
            aria-label="Configurações da chamada"
            onClick={() => useUi.getState().openSettings()}
          >
            <Settings />
          </Button>
        </Tooltip>
        <Tooltip label="Sair da sala">
          <Button variant="danger-ghost" size="icon" aria-label="Sair da sala" onClick={onLeave}>
            <PhoneOff />
          </Button>
        </Tooltip>
      </div>
    </footer>
  );
}
