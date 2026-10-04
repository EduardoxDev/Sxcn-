import { Pause, RotateCcw, WifiOff } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { ScxnLoader } from '@/components/brand/ScxnLoader';
import { ConnectionBanner } from '@/components/feedback/ConnectionBanner';
import { ParticipantAvatar } from '@/components/participants/ParticipantAvatar';
import { Button } from '@/components/ui/button';
import { useFullscreen } from '@/hooks/useFullscreen';
import { useHotkeys } from '@/hooks/useHotkeys';
import { cn } from '@/lib/cn';
import { getSession } from '@/services/session/RoomSession';
import { useMedia } from '@/stores/mediaStore';
import { useRoom } from '@/stores/roomStore';
import { SharingBanner } from './SharingBanner';
import { StageEmpty } from './StageEmpty';
import { StageToolbar } from './StageToolbar';
import { StatsOverlay } from './StatsOverlay';
import { VideoSurface } from './VideoSurface';
import { useUi } from '@/stores/uiStore';

/** How long a viewer waits for the first frame before we offer a manual reconnect. */
const STREAM_TIMEOUT_MS = 15_000;
const CHROME_IDLE_MS = 2600;

function useIdle(ms: number) {
  const [idle, setIdle] = useState(false);
  const timer = useRef<number | undefined>(undefined);
  const poke = useCallback(() => {
    setIdle(false);
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setIdle(true), ms);
  }, [ms]);
  useEffect(() => {
    timer.current = window.setTimeout(() => setIdle(true), ms);
    return () => window.clearTimeout(timer.current);
  }, [ms]);
  return { idle, poke };
}

function CenterNotice({ children }: { children: ReactNode }) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="absolute inset-0 z-10 flex items-center justify-center bg-stage/70 p-6 backdrop-blur-sm"
    >
      {children}
    </motion.div>
  );
}

/**
 * The stage. Everything else in the room exists to serve this surface, so chrome stays out of
 * the way: overlays fade when the cursor rests, and the background is true black.
 */
export function ScreenStage({ onLeave }: { onLeave: () => void }) {
  const stageRef = useRef<HTMLDivElement>(null);
  const {
    isFullscreen,
    toggle: toggleFullscreen,
    supported: fullscreenSupported,
  } = useFullscreen(stageRef);
  const { idle, poke } = useIdle(CHROME_IDLE_MS);
  const [previewHidden, setPreviewHidden] = useState(false);
  const [toolbarFocused, setToolbarFocused] = useState(false);

  const status = useRoom((s) => s.status);
  const selfId = useRoom((s) => s.selfId);
  const sharerId = useRoom((s) => s.sharerId);
  const sharer = useRoom((s) => (s.sharerId ? s.participants[s.sharerId] : undefined));
  const localStream = useMedia((s) => s.screen.stream);
  const remoteStream = useMedia((s) => (sharerId ? (s.remote[sharerId]?.screen ?? null) : null));
  const peerState = useMedia((s) => (sharerId ? s.peerStates[sharerId] : undefined));
  const stats = useMedia((s) =>
    sharerId && sharerId !== selfId ? (s.stats[sharerId] ?? null) : null,
  );
  const outboundStats = useMedia((s) => Object.values(s.stats).find((x) => x.outbound) ?? null);
  const viewers = useMedia((s) => Object.keys(s.peerStates).length);
  const showStats = useUi((s) => s.stage.showStats);

  const isSelfSharing = Boolean(sharerId && sharerId === selfId && localStream);
  const isRemote = Boolean(sharerId && sharerId !== selfId);
  const stream = isSelfSharing ? localStream : isRemote ? remoteStream : null;

  // Viewer: track first frame; offer a manual retry if it never arrives.
  const [playingStream, setPlayingStream] = useState<MediaStream | null>(null);
  const [timedOutFor, setTimedOutFor] = useState<string | null>(null);
  const playing = stream !== null && playingStream === stream;
  useEffect(() => {
    if (!isRemote || !sharerId || playing) return;
    const t = window.setTimeout(() => setTimedOutFor(sharerId), STREAM_TIMEOUT_MS);
    return () => window.clearTimeout(t);
  }, [isRemote, sharerId, playing, stream, timedOutFor]);
  const timedOut = isRemote && !playing && timedOutFor === sharerId;

  const share = () => void getSession()?.startScreen();
  useHotkeys({ f: () => (stream ? void toggleFullscreen() : undefined) });

  const chromeVisible = !idle || toolbarFocused || showStats;

  let content: ReactNode;
  if (status === 'joining') {
    content = (
      <div className="flex size-full items-center justify-center">
        <ScxnLoader
          title="Entrando na sala…"
          description="Conectando ao servidor e preparando o áudio."
        />
      </div>
    );
  } else if (!sharerId || (sharerId === selfId && !localStream)) {
    content = (
      <StageEmpty
        onShare={share}
        onDismissError={() => getSession()?.stopScreen({ silent: true })}
      />
    );
  } else if (stream) {
    content = (
      <>
        {!(isSelfSharing && previewHidden) && (
          <VideoSurface
            key={stream.id}
            stream={stream}
            label={
              isSelfSharing ? 'Prévia da sua tela' : `Tela de ${sharer?.name ?? 'participante'}`
            }
            onPlaying={() => setPlayingStream(stream)}
          />
        )}
        {isSelfSharing && previewHidden && (
          <div className="flex size-full items-center justify-center">
            <p className="text-[13px] text-fg-muted">
              Prévia oculta — sua tela continua sendo transmitida.
            </p>
          </div>
        )}
      </>
    );
  } else {
    content = null; // remote stream not attached yet — handled by the notice below
  }

  const waitingForStream = isRemote && !playing && status !== 'joining';
  const remotePaused = isRemote && sharer?.screen === 'paused';
  const recovering = isRemote && (peerState === 'recovering' || peerState === 'failed') && playing;

  return (
    <div
      ref={stageRef}
      onPointerMove={poke}
      onPointerDown={poke}
      className={cn(
        'relative size-full overflow-hidden bg-stage',
        !isFullscreen && 'rounded-xl ring-1 ring-border',
        stream && idle && !toolbarFocused && 'cursor-none',
      )}
    >
      {content}

      <AnimatePresence>
        {waitingForStream && !timedOut && (
          <CenterNotice key="waiting">
            <ScxnLoader
              title={`Conectando à transmissão de ${sharer?.name ?? 'participante'}…`}
              description="Estabelecendo a conexão direta. Isso leva alguns segundos."
            />
          </CenterNotice>
        )}
        {timedOut && sharerId && (
          <CenterNotice key="timeout">
            <div className="flex flex-col items-center text-center">
              <WifiOff className="size-5 text-fg-secondary" />
              <p className="mt-4 text-sm font-medium text-fg">A transmissão não chegou</p>
              <p className="mt-1 max-w-xs text-[13px] text-fg-secondary">
                A conexão direta com {sharer?.name ?? 'o participante'} não foi estabelecida. Redes
                restritas podem bloquear WebRTC.
              </p>
              <Button
                variant="primary"
                className="mt-5"
                onClick={() => {
                  setTimedOutFor(null);
                  getSession()?.reconnectPeer(sharerId);
                }}
              >
                <RotateCcw /> Tentar novamente
              </Button>
            </div>
          </CenterNotice>
        )}
        {remotePaused && playing && (
          <CenterNotice key="paused">
            <div className="flex flex-col items-center text-center">
              <Pause className="size-5 text-fg-secondary" />
              <p className="mt-3 text-sm font-medium text-fg">
                {sharer?.name} pausou a transmissão
              </p>
              <p className="mt-1 text-[13px] text-fg-secondary">
                A imagem volta assim que for retomada.
              </p>
            </div>
          </CenterNotice>
        )}
      </AnimatePresence>

      {recovering && (
        <div className="absolute left-3 top-3 z-20 flex items-center gap-2 rounded-md bg-overlay px-2.5 py-1.5 text-xs text-warning backdrop-blur">
          <WifiOff className="size-3.5" /> Conexão instável — recuperando…
        </div>
      )}

      {/* Who is sharing — discreet, fades with the cursor. */}
      <AnimatePresence>
        {isRemote && sharer && playing && chromeVisible && !recovering && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="pointer-events-none absolute left-3 top-3 z-20 flex items-center gap-2.5 rounded-lg bg-overlay py-1.5 pl-1.5 pr-3 backdrop-blur-md"
          >
            <ParticipantAvatar name={sharer.name} size={26} />
            <div className="leading-tight">
              <p className="text-[13px] font-medium text-fg">{sharer.name}</p>
              <p className="text-[11px] text-fg-secondary">Compartilhando tela</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {isSelfSharing && (
        <SharingBanner
          previewHidden={previewHidden}
          onTogglePreview={() => setPreviewHidden((v) => !v)}
        />
      )}

      {stream && (
        <AnimatePresence>
          {chromeVisible && (
            <motion.div
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 4 }}
              transition={{ duration: 0.18 }}
              className="absolute bottom-3 right-3 z-20 max-w-[calc(100%_-_24px)]"
              onFocusCapture={() => setToolbarFocused(true)}
              onBlurCapture={() => setToolbarFocused(false)}
            >
              <StageToolbar
                isSharer={isSelfSharing}
                isFullscreen={isFullscreen}
                onToggleFullscreen={() => void toggleFullscreen()}
                fullscreenSupported={fullscreenSupported}
                inboundVideo={stats?.video ?? null}
              />
            </motion.div>
          )}
        </AnimatePresence>
      )}

      <AnimatePresence>
        {stream && showStats && (
          <StatsOverlay
            stats={isSelfSharing ? outboundStats : stats}
            mode={isSelfSharing ? 'outbound' : 'inbound'}
            viewers={viewers}
          />
        )}
      </AnimatePresence>

      <ConnectionBanner onLeave={onLeave} />
    </div>
  );
}
