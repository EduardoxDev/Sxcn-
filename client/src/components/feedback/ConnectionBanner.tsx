import { RefreshCw, WifiOff } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { Button } from '@/components/ui/button';
import { getSession } from '@/services/session/RoomSession';
import { useRoom } from '@/stores/roomStore';

/**
 * Floating status over the stage while the signaling link is down. Never just a spinner:
 * it says what is happening and offers a way out.
 */
export function ConnectionBanner({ onLeave }: { onLeave: () => void }) {
  const status = useRoom((s) => s.status);
  const visible = status === 'reconnecting' || status === 'disconnected';

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          role="status"
          aria-live="assertive"
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.18 }}
          className="pointer-events-auto absolute left-1/2 top-3 z-30 flex w-[min(460px,calc(100%-24px))] -translate-x-1/2 items-center gap-3 rounded-lg bg-surface-raised/95 px-3.5 py-3 shadow-pop backdrop-blur"
        >
          {status === 'reconnecting' ? (
            <>
              <RefreshCw className="size-4 shrink-0 animate-spin text-warning [animation-duration:1.6s]" />
              <div className="min-w-0 flex-1">
                <p className="text-[13px] font-medium text-fg">Reconectando…</p>
                <p className="text-xs text-fg-secondary">
                  Tentando restabelecer a conexão. A transmissão volta sozinha.
                </p>
              </div>
            </>
          ) : (
            <>
              <WifiOff className="size-4 shrink-0 text-danger" />
              <div className="min-w-0 flex-1">
                <p className="text-[13px] font-medium text-fg">Conexão perdida</p>
                <p className="text-xs text-fg-secondary">
                  Verifique sua internet. Seu lugar na sala fica reservado por alguns instantes.
                </p>
              </div>
              <div className="flex shrink-0 gap-1.5">
                <Button size="sm" variant="ghost" onClick={onLeave}>
                  Sair
                </Button>
                <Button size="sm" variant="primary" onClick={() => getSession()?.retry()}>
                  Tentar novamente
                </Button>
              </div>
            </>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
