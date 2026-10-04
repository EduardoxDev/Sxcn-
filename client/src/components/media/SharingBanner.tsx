import { Eye, EyeOff, Pause, Play, Square } from 'lucide-react';
import { motion } from 'motion/react';
import { StatusDot } from '@/components/feedback/StatusDot';
import { Button } from '@/components/ui/button';
import { Tooltip } from '@/components/ui/tooltip';
import { getSession } from '@/services/session/RoomSession';
import { useMedia } from '@/stores/mediaStore';

const SURFACE_LABEL: Record<string, string> = {
  monitor: 'Tela inteira',
  window: 'Janela',
  browser: 'Aba do navegador',
  'virtual-camera': 'Câmera virtual',
};

interface SharingBannerProps {
  previewHidden: boolean;
  onTogglePreview: () => void;
}

/**
 * Always-visible privacy indicator while *you* are sharing. Never auto-hides.
 */
export function SharingBanner({ previewHidden, onTogglePreview }: SharingBannerProps) {
  const status = useMedia((s) => s.screen.status);
  const surface = useMedia((s) => s.screen.surface);
  const paused = status === 'paused';
  const session = getSession();

  return (
    <motion.div
      role="status"
      initial={{ opacity: 0, y: -6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
      className="absolute left-1/2 top-3 z-20 flex max-w-[calc(100%_-_24px)] -translate-x-1/2 flex-col items-center gap-2 rounded-lg bg-surface-raised/95 px-3 py-2 shadow-pop ring-1 ring-brand/30 backdrop-blur sm:flex-row sm:gap-3"
    >
      <div className="flex min-w-0 items-center gap-2">
        <StatusDot tone={paused ? 'warning' : 'brand'} pulse={!paused} className="size-2" />
        <span className="whitespace-nowrap text-[11px] font-semibold uppercase tracking-[0.08em] text-fg">
          {paused ? 'Transmissão pausada' : 'Você está compartilhando'}
        </span>
        {surface && SURFACE_LABEL[surface] && (
          <span className="hidden truncate text-xs text-fg-muted md:inline">
            · {SURFACE_LABEL[surface]}
          </span>
        )}
      </div>
      <div className="flex items-center gap-1">
        <Tooltip label={previewHidden ? 'Mostrar prévia' : 'Ocultar prévia (evita efeito espelho)'}>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={previewHidden ? 'Mostrar prévia' : 'Ocultar prévia'}
            onClick={onTogglePreview}
          >
            {previewHidden ? <Eye /> : <EyeOff />}
          </Button>
        </Tooltip>
        <Tooltip label={paused ? 'Retomar transmissão' : 'Pausar transmissão'}>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={paused ? 'Retomar transmissão' : 'Pausar transmissão'}
            onClick={() => session?.togglePause()}
          >
            {paused ? <Play /> : <Pause />}
          </Button>
        </Tooltip>
        <Button
          size="sm"
          variant="danger"
          onClick={() => session?.stopScreen()}
          className="h-7 px-2.5"
        >
          <Square className="fill-current" /> Parar compartilhamento
        </Button>
      </div>
    </motion.div>
  );
}
