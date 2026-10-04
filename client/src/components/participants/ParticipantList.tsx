import { AnimatePresence } from 'motion/react';
import { useCallback, useMemo } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { Skeleton } from '@/components/ui/skeleton';
import { getSession } from '@/services/session/RoomSession';
import { useMedia } from '@/stores/mediaStore';
import { sortParticipants, useRoom } from '@/stores/roomStore';
import { ParticipantRow } from './ParticipantRow';

export function ParticipantList({ collapsed = false }: { collapsed?: boolean }) {
  const { participants, selfId, status } = useRoom(
    useShallow((s) => ({ participants: s.participants, selfId: s.selfId, status: s.status })),
  );
  const speaking = useMedia((s) => s.speaking);
  const list = useMemo(
    () => sortParticipants(Object.values(participants), selfId),
    [participants, selfId],
  );
  const canManage = selfId ? participants[selfId]?.role === 'host' : false;
  const onKick = useCallback((id: string) => void getSession()?.kick(id), []);

  if (status === 'joining' && list.length === 0) {
    return (
      <div className="space-y-1 px-2" aria-hidden>
        {[0, 1, 2].map((i) => (
          <div key={i} className="flex h-12 items-center gap-2.5 px-2">
            <Skeleton className="size-7 rounded-full" />
            {!collapsed && (
              <div className="flex-1 space-y-1.5">
                <Skeleton className="h-2.5 w-20" />
                <Skeleton className="h-2 w-12" />
              </div>
            )}
          </div>
        ))}
      </div>
    );
  }

  return (
    <ul className={collapsed ? 'space-y-1.5 px-1' : 'space-y-0.5 px-2'} aria-label="Participantes">
      <AnimatePresence initial={false}>
        {list.map((p) => (
          <ParticipantRow
            key={p.id}
            participant={p}
            isSelf={p.id === selfId}
            speaking={Boolean(speaking[p.id]) && !p.micMuted}
            canManage={canManage}
            collapsed={collapsed}
            onKick={onKick}
          />
        ))}
      </AnimatePresence>
    </ul>
  );
}
