import { Check, Copy, Settings, UserPlus, Users } from 'lucide-react';
import { ScxnLogo } from '@/components/brand/ScxnLogo';
import { Button } from '@/components/ui/button';
import { Tooltip } from '@/components/ui/tooltip';
import { useCopy } from '@/hooks/useCopy';
import { useRoom } from '@/stores/roomStore';
import { useUi } from '@/stores/uiStore';
import { notify } from '@/lib/notify';

export function RoomHeader({ code }: { code: string }) {
  const { copy, copied } = useCopy();
  const count = useRoom((s) => Object.keys(s.participants).length);
  const status = useRoom((s) => s.status);
  return (
    <header className="flex h-14 shrink-0 items-center justify-between gap-2 border-b border-border px-3 sm:px-5">
      <div className="flex min-w-0 items-center gap-3 sm:gap-5">
        <ScxnLogo />
        <span className="h-4 w-px bg-border-strong" />
        <Tooltip label="Copiar código">
          <Button
            size="sm"
            variant="ghost"
            onClick={() =>
              void copy(code).then((ok) =>
                ok ? notify.success('Código copiado') : notify.error('Não foi possível copiar'),
              )
            }
            aria-label="Copiar código da sala"
          >
            <span className="font-mono text-xs tracking-wider">{code}</span>
            {copied ? <Check className="text-brand" /> : <Copy />}
          </Button>
        </Tooltip>
      </div>
      <div className="flex items-center gap-2 sm:gap-4">
        <span className="hidden items-center gap-1.5 text-xs text-fg-secondary sm:flex">
          <Users className="size-3.5" />
          {count} {count === 1 ? 'pessoa' : 'pessoas'}
        </span>
        <span role="status" className="hidden items-center gap-2 text-xs text-fg-secondary md:flex">
          <span
            className={`size-1.5 rounded-full ${status === 'joined' ? 'bg-success' : 'bg-warning'}`}
          />
          {status === 'joined'
            ? 'Conectado'
            : status === 'joining'
              ? 'Conectando…'
              : 'Reconectando…'}
        </span>
        <Tooltip label="Convidar pessoas">
          <Button
            variant="secondary"
            size="sm"
            aria-label="Convidar pessoas"
            onClick={() => useUi.getState().set({ inviteOpen: true })}
          >
            <UserPlus />
            <span className="hidden sm:inline">Convidar</span>
          </Button>
        </Tooltip>
        <Tooltip label="Configurações">
          <Button
            variant="ghost"
            size="icon"
            aria-label="Configurações"
            onClick={() => useUi.getState().openSettings()}
          >
            <Settings />
          </Button>
        </Tooltip>
      </div>
    </header>
  );
}
