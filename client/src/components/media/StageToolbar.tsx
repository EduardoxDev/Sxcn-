import {
  Activity,
  Check,
  Expand,
  Maximize,
  Minimize,
  Minus,
  Plus,
  RotateCcw,
  Settings2,
  Shrink,
} from 'lucide-react';
import type { ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Tooltip } from '@/components/ui/tooltip';
import { cn } from '@/lib/cn';
import { QUALITY_LABELS, type FrameRate, type QualityPreset } from '@/lib/quality';
import { getSession } from '@/services/session/RoomSession';
import type { PeerStats } from '@/stores/mediaStore';
import { useSettings } from '@/stores/settingsStore';
import { MAX_ZOOM, MIN_ZOOM, useUi } from '@/stores/uiStore';

interface StageToolbarProps {
  isSharer: boolean;
  isFullscreen: boolean;
  onToggleFullscreen: () => void;
  fullscreenSupported: boolean;
  inboundVideo: PeerStats['video'];
  className?: string;
}

function ToolButton({
  label,
  shortcut,
  children,
  active,
  ...props
}: {
  label: string;
  shortcut?: string;
  active?: boolean;
  children: ReactNode;
  onClick?: () => void;
  disabled?: boolean;
}) {
  return (
    <Tooltip label={label} shortcut={shortcut}>
      <Button
        variant="ghost"
        size="icon-sm"
        aria-label={label}
        aria-pressed={active}
        className={cn('size-8 text-fg-secondary', active && 'bg-surface-hover text-fg')}
        {...props}
      >
        {children}
      </Button>
    </Tooltip>
  );
}

/** Viewer controls: fit/fill, zoom, quality, stats, fullscreen. Auto-hides with the cursor. */
export function StageToolbar({
  isSharer,
  isFullscreen,
  onToggleFullscreen,
  fullscreenSupported,
  inboundVideo,
  className,
}: StageToolbarProps) {
  const stage = useUi((s) => s.stage);
  const setStage = useUi((s) => s.setStage);
  const resetView = useUi((s) => s.resetView);
  const quality = useSettings((s) => s.quality);
  const fps = useSettings((s) => s.fps);
  const setSettings = useSettings((s) => s.set);

  const zoomBy = (factor: number) => {
    const next = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, Math.round(stage.zoom * factor * 4) / 4));
    setStage(next === 1 ? { zoom: 1, panX: 0, panY: 0 } : { zoom: next });
  };

  const changeQuality = (patch: { quality?: QualityPreset; fps?: FrameRate }) => {
    setSettings(patch);
    void getSession()?.applyScreenSettings();
  };

  return (
    <div
      role="toolbar"
      aria-label="Controles da transmissão"
      className={cn(
        'flex max-w-full flex-wrap items-center justify-end gap-0.5 rounded-lg bg-overlay p-1 shadow-float backdrop-blur-md',
        className,
      )}
    >
      <ToolButton
        label={
          stage.fit === 'contain' ? 'Preencher (cortar bordas)' : 'Ajustar (tela inteira visível)'
        }
        onClick={() => setStage({ fit: stage.fit === 'contain' ? 'cover' : 'contain' })}
      >
        {stage.fit === 'contain' ? <Expand /> : <Shrink />}
      </ToolButton>

      <div className="mx-1 h-4 w-px bg-border-strong" aria-hidden />

      <ToolButton
        label="Diminuir zoom"
        onClick={() => zoomBy(1 / 1.25)}
        disabled={stage.zoom <= MIN_ZOOM}
      >
        <Minus />
      </ToolButton>
      <span
        className="tabular w-11 text-center text-xs font-medium text-fg-secondary"
        aria-live="polite"
      >
        {Math.round(stage.zoom * 100)}%
      </span>
      <ToolButton
        label="Aumentar zoom (Ctrl + roda)"
        onClick={() => zoomBy(1.25)}
        disabled={stage.zoom >= MAX_ZOOM}
      >
        <Plus />
      </ToolButton>
      <ToolButton label="Redefinir zoom" onClick={resetView} disabled={stage.zoom === 1}>
        <RotateCcw />
      </ToolButton>

      <div className="mx-1 h-4 w-px bg-border-strong" aria-hidden />

      <DropdownMenu>
        <Tooltip label="Qualidade">
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className="h-8 gap-1.5 px-2 text-xs text-fg-secondary"
              aria-label="Qualidade"
            >
              <Settings2 />
              <span className="tabular">
                {isSharer
                  ? `${QUALITY_LABELS[quality] === 'Automática' ? 'Auto' : QUALITY_LABELS[quality]} · ${fps}`
                  : inboundVideo?.height
                    ? `${inboundVideo.height}p`
                    : 'Auto'}
              </span>
            </Button>
          </DropdownMenuTrigger>
        </Tooltip>
        <DropdownMenuContent align="end" side="top" className="w-56">
          {isSharer ? (
            <>
              <p className="px-2.5 pb-1 pt-1.5 text-[11px] font-medium uppercase tracking-wider text-fg-muted">
                Resolução
              </p>
              {(['auto', '1080p', '720p'] as const).map((q) => (
                <DropdownMenuItem key={q} onSelect={() => changeQuality({ quality: q })}>
                  <Check className={cn(quality === q ? 'text-brand' : 'invisible')} />
                  {QUALITY_LABELS[q]}
                </DropdownMenuItem>
              ))}
              <DropdownMenuSeparator />
              <p className="px-2.5 pb-1 pt-1.5 text-[11px] font-medium uppercase tracking-wider text-fg-muted">
                Taxa de quadros
              </p>
              {([30, 60] as const).map((f) => (
                <DropdownMenuItem key={f} onSelect={() => changeQuality({ fps: f })}>
                  <Check className={cn(fps === f ? 'text-brand' : 'invisible')} />
                  {f} FPS
                  {f === 60 && (
                    <span className="ml-auto text-[11px] text-fg-muted">mais banda</span>
                  )}
                </DropdownMenuItem>
              ))}
            </>
          ) : (
            <div className="space-y-1 px-2.5 py-2 text-xs">
              <p className="font-medium text-fg">
                Recebendo{' '}
                {inboundVideo?.height ? `${inboundVideo.width}×${inboundVideo.height}` : '—'}
                {inboundVideo?.fps ? ` · ${Math.round(inboundVideo.fps)} fps` : ''}
              </p>
              <p className="text-fg-muted">
                A qualidade é definida por quem compartilha e se adapta automaticamente à sua
                conexão.
              </p>
            </div>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      <ToolButton
        label="Estatísticas da conexão"
        active={stage.showStats}
        onClick={() => setStage({ showStats: !stage.showStats })}
      >
        <Activity />
      </ToolButton>

      {fullscreenSupported && (
        <ToolButton
          label={isFullscreen ? 'Sair da tela cheia' : 'Tela cheia'}
          shortcut="F"
          onClick={onToggleFullscreen}
        >
          {isFullscreen ? <Minimize /> : <Maximize />}
        </ToolButton>
      )}
    </div>
  );
}
