import { memo, useEffect, useRef, useState } from 'react';
import { Volume2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useRoom } from '@/stores/roomStore';
import { notify } from '@/lib/notify';
import { capabilities } from '@/lib/browser';
import { useMedia } from '@/stores/mediaStore';
import { useSettings } from '@/stores/settingsStore';

type SinkAudio = HTMLAudioElement & { setSinkId?: (id: string) => Promise<void> };

const PeerAudio = memo(function PeerAudio({
  stream,
  sinkId,
  name,
}: {
  stream: MediaStream;
  sinkId: string | null;
  name: string;
}) {
  const ref = useRef<SinkAudio>(null);
  const [blocked, setBlocked] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (el.srcObject !== stream) el.srcObject = stream;
    let active = true;
    void el
      .play()
      .then(() => {
        if (active) setBlocked(false);
      })
      .catch(() => {
        if (active) setBlocked(true);
      });
    return () => {
      active = false;
      el.pause();
      el.srcObject = null;
    };
  }, [stream]);

  useEffect(() => {
    const el = ref.current;
    if (!el || !capabilities.outputSelection || !el.setSinkId) return;
    void el.setSinkId(sinkId ?? '').catch(() => {
      notify.warning(
        'Saída de áudio indisponível',
        'Usando a saída padrão. Confira suas configurações de áudio.',
      );
      void el.setSinkId?.('').catch(() => undefined);
    });
  }, [sinkId]);

  return (
    <>
      <audio ref={ref} autoPlay playsInline className="hidden" />
      {blocked && (
        <Button
          variant="primary"
          size="sm"
          onClick={() =>
            void ref.current
              ?.play()
              .then(() => setBlocked(false))
              .catch(() =>
                notify.error(
                  'Áudio bloqueado',
                  'Permita a reprodução de áudio nas configurações do navegador.',
                ),
              )
          }
        >
          <Volume2 /> Ativar áudio de {name}
        </Button>
      )}
    </>
  );
});

/** Plays every remote voice stream on the selected output device. */
export function RemoteAudio() {
  const remote = useMedia((s) => s.remote);
  const sinkId = useSettings((s) => s.outputDeviceId);
  const participants = useRoom((s) => s.participants);
  return (
    <div className="fixed bottom-24 right-3 z-30 flex max-w-[calc(100vw-24px)] flex-col gap-2">
      {Object.entries(remote).map(([id, media]) =>
        media.audio ? (
          <PeerAudio
            key={id}
            stream={media.audio}
            sinkId={sinkId}
            name={participants[id]?.name ?? 'participante'}
          />
        ) : null,
      )}
    </div>
  );
}
