import type { Participant } from '@scxn/shared';
import { MicOff, MonitorUp, MoreHorizontal, UserX, WifiOff } from 'lucide-react';
import { motion } from 'motion/react';
import { memo } from 'react';
import { SignalBars } from '@/components/feedback/SignalBars';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Tooltip } from '@/components/ui/tooltip';
import { cn } from '@/lib/cn';
import { ParticipantAvatar } from './ParticipantAvatar';

interface ParticipantRowProps {
  participant: Participant;
  isSelf: boolean;
  speaking: boolean;
  canManage: boolean;
  collapsed: boolean;
  onKick: (id: string) => void;
}

function statusLine(
  p: Participant,
  isSelf: boolean,
): { text: string; tone: 'brand' | 'warning' | 'muted' } {
  if (p.presence === 'reconnecting') return { text: 'Reconectando…', tone: 'warning' };
  if (p.screen === 'sharing') return { text: 'Compartilhando', tone: 'brand' };
  if (p.screen === 'paused') return { text: 'Transmissão pausada', tone: 'muted' };
  if (isSelf) return { text: p.role === 'host' ? 'Você · Host' : 'Você', tone: 'muted' };
  if (p.role === 'host') return { text: 'Host', tone: 'muted' };
  return { text: 'Participante', tone: 'muted' };
}

export const ParticipantRow = memo(function ParticipantRow({
  participant: p,
  isSelf,
  speaking,
  canManage,
  collapsed,
  onKick,
}: ParticipantRowProps) {
  const status = statusLine(p, isSelf);
  const reconnecting = p.presence === 'reconnecting';
  const a11y = [
    p.name,
    isSelf && 'você',
    p.role === 'host' && 'host',
    p.screen !== 'none' && 'compartilhando tela',
    p.micMuted && 'microfone desligado',
    speaking && 'falando',
    reconnecting && 'reconectando',
  ]
    .filter(Boolean)
    .join(', ');

  if (collapsed) {
    return (
      <motion.li
        layout="position"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
      >
        <Tooltip label={`${p.name} · ${status.text}`} side="right">
          <div
            tabIndex={0}
            aria-label={a11y}
            className="relative mx-auto flex w-fit rounded-full p-1 outline-none"
          >
            <ParticipantAvatar name={p.name} speaking={speaking} dimmed={reconnecting} size={30} />
            {p.screen !== 'none' && (
              <span className="absolute -bottom-0.5 -right-0.5 flex size-4 items-center justify-center rounded-full bg-brand text-brand-fg ring-2 ring-surface">
                <MonitorUp className="size-2.5" strokeWidth={2.5} />
              </span>
            )}
            {p.micMuted && p.screen === 'none' && (
              <span className="absolute -bottom-0.5 -right-0.5 flex size-4 items-center justify-center rounded-full bg-surface-hover text-fg-muted ring-2 ring-surface">
                <MicOff className="size-2.5" strokeWidth={2.5} />
              </span>
            )}
          </div>
        </Tooltip>
      </motion.li>
    );
  }

  return (
    <motion.li
      layout="position"
      initial={{ opacity: 0, x: -6 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -6 }}
      transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
      aria-label={a11y}
      className={cn(
        'group relative flex h-12 items-center gap-2.5 rounded-lg px-2 transition-colors duration-200',
        speaking ? 'bg-brand-muted/60' : 'hover:bg-surface-hover/60',
      )}
    >
      <ParticipantAvatar name={p.name} speaking={speaking} dimmed={reconnecting} />
      <div className="min-w-0 flex-1">
        <p
          className={cn(
            'truncate text-[13px] font-medium leading-tight',
            reconnecting ? 'text-fg-muted' : 'text-fg',
          )}
        >
          {p.name}
        </p>
        <p
          className={cn(
            'mt-0.5 truncate text-[11px] leading-tight',
            status.tone === 'brand' && 'text-brand',
            status.tone === 'warning' && 'text-warning',
            status.tone === 'muted' && 'text-fg-muted',
          )}
        >
          {status.text}
        </p>
      </div>
      <div className="flex shrink-0 items-center gap-1.5 text-fg-muted">
        {reconnecting && <WifiOff className="size-3.5 text-warning" aria-hidden />}
        {!reconnecting && (p.quality === 'poor' || p.quality === 'fair') && (
          <Tooltip label={p.quality === 'poor' ? 'Conexão ruim' : 'Conexão instável'}>
            <span tabIndex={-1}>
              <SignalBars quality={p.quality} />
            </span>
          </Tooltip>
        )}
        {p.screen !== 'none' && <MonitorUp className="size-3.5 text-brand" aria-hidden />}
        {p.micMuted && <MicOff className="size-3.5" aria-hidden />}
        {canManage && !isSelf && (
          <DropdownMenu>
            <DropdownMenuTrigger
              aria-label={`Ações para ${p.name}`}
              className="-mr-1 rounded-md p-1 opacity-0 transition-opacity hover:bg-surface-hover hover:text-fg focus-visible:opacity-100 group-hover:opacity-100 data-[state=open]:opacity-100"
            >
              <MoreHorizontal className="size-3.5" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem destructive onSelect={() => onKick(p.id)}>
                <UserX /> Remover da sala
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>
    </motion.li>
  );
});
