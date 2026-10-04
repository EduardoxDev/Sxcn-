import { PanelLeftClose, PanelLeftOpen, UserPlus } from 'lucide-react';
import { motion } from 'motion/react';
import { Button } from '@/components/ui/button';
import { Tooltip } from '@/components/ui/tooltip';
import { cn } from '@/lib/cn';
import { useRoom } from '@/stores/roomStore';
import { useSettings } from '@/stores/settingsStore';
import { useUi } from '@/stores/uiStore';
import { ParticipantList } from './ParticipantList';

const EXPANDED = 248;
const COLLAPSED = 60;

/** Desktop participant rail — compact, collapsible to avatars only. */
export function ParticipantsSidebar() {
  const collapsed = useSettings((s) => s.sidebarCollapsed);
  const setSettings = useSettings((s) => s.set);
  const count = useRoom((s) => Object.keys(s.participants).length);
  const max = useRoom((s) => s.maxParticipants);
  const openInvite = () => useUi.getState().set({ inviteOpen: true });
  const toggle = () => setSettings({ sidebarCollapsed: !collapsed });

  return (
    <motion.aside
      aria-label="Participantes"
      initial={false}
      animate={{ width: collapsed ? COLLAPSED : EXPANDED }}
      transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
      className="flex shrink-0 flex-col overflow-hidden border-r border-border bg-bg"
    >
      <div
        className={cn(
          'flex h-11 shrink-0 items-center',
          collapsed ? 'justify-center' : 'justify-between pl-4 pr-2',
        )}
      >
        {!collapsed && (
          <h2 className="text-[11px] font-semibold uppercase tracking-[0.08em] text-fg-muted">
            Participantes <span className="tabular text-fg-secondary">· {count}</span>
          </h2>
        )}
        <Tooltip label={collapsed ? 'Expandir lista' : 'Recolher lista'} shortcut="P" side="right">
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={toggle}
            aria-label={
              collapsed ? 'Expandir lista de participantes' : 'Recolher lista de participantes'
            }
          >
            {collapsed ? <PanelLeftOpen /> : <PanelLeftClose />}
          </Button>
        </Tooltip>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden pb-2">
        <ParticipantList collapsed={collapsed} />
      </div>

      <div
        className={cn('shrink-0 border-t border-border p-2', collapsed && 'flex justify-center')}
      >
        {collapsed ? (
          <Tooltip label="Convidar pessoas" side="right">
            <Button variant="ghost" size="icon" onClick={openInvite} aria-label="Convidar pessoas">
              <UserPlus />
            </Button>
          </Tooltip>
        ) : (
          <Button variant="ghost" size="sm" className="w-full justify-between" onClick={openInvite}>
            <span className="flex items-center gap-2">
              <UserPlus /> Convidar pessoas
            </span>
            <span className="tabular text-[11px] text-fg-muted">
              {count}/{max}
            </span>
          </Button>
        )}
      </div>
    </motion.aside>
  );
}
