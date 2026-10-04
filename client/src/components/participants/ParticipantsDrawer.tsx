import { UserPlus, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Sheet } from '@/components/ui/sheet';
import { useRoom } from '@/stores/roomStore';
import { useUi } from '@/stores/uiStore';
import { ParticipantList } from './ParticipantList';

/** Narrow-screen variant of the sidebar. */
export function ParticipantsDrawer() {
  const open = useUi((s) => s.participantsDrawerOpen);
  const set = useUi((s) => s.set);
  const count = useRoom((s) => Object.keys(s.participants).length);

  return (
    <Sheet
      open={open}
      onOpenChange={(o) => set({ participantsDrawerOpen: o })}
      title="Participantes"
    >
      <div className="flex h-12 shrink-0 items-center justify-between border-b border-border pl-4 pr-2">
        <h2 className="text-[11px] font-semibold uppercase tracking-[0.08em] text-fg-muted">
          Participantes <span className="tabular text-fg-secondary">· {count}</span>
        </h2>
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label="Fechar"
          onClick={() => set({ participantsDrawerOpen: false })}
        >
          <X />
        </Button>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto py-2">
        <ParticipantList />
      </div>
      <div className="border-t border-border p-2">
        <Button
          variant="ghost"
          size="sm"
          className="w-full justify-start"
          onClick={() => set({ participantsDrawerOpen: false, inviteOpen: true })}
        >
          <UserPlus /> Convidar pessoas
        </Button>
      </div>
    </Sheet>
  );
}
