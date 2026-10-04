import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import { RoomHeader } from '@/components/room/RoomHeader';
import { CallControls } from '@/components/controls/CallControls';
import { ScreenStage } from '@/components/media/ScreenStage';
import { RemoteAudio } from '@/components/media/RemoteAudio';
import { ParticipantsSidebar } from '@/components/participants/ParticipantsSidebar';
import { ParticipantsDrawer } from '@/components/participants/ParticipantsDrawer';
import { InviteDialog } from '@/components/dialogs/InviteDialog';
import { SettingsDialog } from '@/components/dialogs/SettingsDialog';
import { ErrorState } from '@/components/feedback/ErrorState';
import { Button } from '@/components/ui/button';
import { Dialog, DialogBody, DialogContent, DialogFooter } from '@/components/ui/dialog';
import { useIsDesktop } from '@/hooks/useMediaQuery';
import { startSession, getSession } from '@/services/session/RoomSession';
import { signaling } from '@/services/signaling/SignalingClient';
import { microphone } from '@/services/media/microphone';
import { useRoom } from '@/stores/roomStore';
import { useUi } from '@/stores/uiStore';

export function RoomPage({ code, name }: { code: string; name: string }) {
  const navigate = useNavigate();
  const desktop = useIsDesktop();
  const status = useRoom((s) => s.status);
  const error = useRoom((s) => s.error);
  const endReason = useRoom((s) => s.endReason);
  const host = useRoom((s) => (s.selfId ? s.participants[s.selfId]?.role === 'host' : false));
  const [leaving, setLeaving] = useState(false);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    const session = startSession(code, name);
    const unload = () => {
      session.dispose();
      microphone.release();
      signaling.disconnect();
    };
    window.addEventListener('pagehide', unload);
    return () => {
      window.removeEventListener('pagehide', unload);
      unload();
      useRoom.getState().reset();
      useUi
        .getState()
        .set({ settingsOpen: false, inviteOpen: false, participantsDrawerOpen: false });
    };
  }, [code, name]);
  const leave = async () => {
    setBusy(true);
    await getSession()?.leave();
    navigate('/');
  };
  return (
    <div className="flex h-dvh flex-col overflow-hidden bg-bg">
      <RoomHeader code={code} />
      <div className="flex min-h-0 flex-1">
        {desktop && <ParticipantsSidebar />}
        <main className="min-w-0 flex-1 p-2 sm:p-3" aria-label="Transmissão">
          {status === 'error' || status === 'ended' ? (
            <div className="flex h-full items-center justify-center rounded-xl bg-stage p-6">
              <ErrorState
                kind={
                  status === 'ended'
                    ? endReason === 'kicked'
                      ? 'kicked'
                      : 'room-ended'
                    : (error ?? 'unknown')
                }
                actions={
                  <>
                    <Button onClick={() => void leave()}>Voltar ao início</Button>
                    {status === 'error' &&
                      (error === 'signaling-failed' || error === 'connection-lost') && (
                        <Button variant="primary" onClick={() => getSession()?.retry()}>
                          Tentar novamente
                        </Button>
                      )}
                  </>
                }
              />
            </div>
          ) : (
            <ScreenStage onLeave={() => setLeaving(true)} />
          )}
        </main>
      </div>
      <CallControls onLeave={() => setLeaving(true)} />
      <RemoteAudio />
      <ParticipantsDrawer />
      <InviteDialog code={code} />
      <SettingsDialog />
      <Dialog open={leaving} onOpenChange={setLeaving}>
        <DialogContent
          title="Sair da sala?"
          description="Seu microfone e compartilhamento serão encerrados."
        >
          <DialogBody>
            <p className="text-sm text-fg-secondary">
              {host
                ? 'Ao sair, outro participante assume como host. Você também pode encerrar a sala para todos.'
                : 'Você pode voltar usando o mesmo convite enquanto a sala estiver disponível.'}
            </p>
          </DialogBody>
          <DialogFooter className="flex-wrap">
            <Button variant="ghost" disabled={busy} onClick={() => setLeaving(false)}>
              Cancelar
            </Button>
            {host && (
              <Button
                variant="danger-ghost"
                disabled={busy}
                onClick={async () => {
                  setBusy(true);
                  await getSession()?.endForEveryone();
                  setBusy(false);
                  setLeaving(false);
                }}
              >
                Encerrar para todos
              </Button>
            )}
            <Button variant="danger" disabled={busy} onClick={() => void leave()}>
              {busy ? 'Saindo…' : 'Sair da sala'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
