import { motion } from 'motion/react';
import { formatBitrate, formatMs, formatPercent } from '@/lib/format';
import type { PeerStats } from '@/stores/mediaStore';

interface StatsOverlayProps {
  stats: PeerStats | null;
  mode: 'inbound' | 'outbound';
  viewers?: number;
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-6">
      <dt className="text-fg-muted">{label}</dt>
      <dd className="tabular text-fg">{value}</dd>
    </div>
  );
}

const LIMITATION: Record<string, string> = {
  bandwidth: 'banda',
  cpu: 'CPU',
  other: 'outro',
};

/** Technical readout — opt-in, for people who want to know why it looks the way it does. */
export function StatsOverlay({ stats, mode, viewers }: StatsOverlayProps) {
  const v = mode === 'inbound' ? stats?.video : stats?.outbound;
  return (
    <motion.dl
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 4 }}
      transition={{ duration: 0.15 }}
      aria-label="Estatísticas da conexão"
      className="absolute bottom-14 right-3 z-20 w-56 space-y-1 rounded-lg bg-overlay p-3 font-mono text-[11px] shadow-pop backdrop-blur"
    >
      <Row label="Resolução" value={v && v.width ? `${v.width}×${v.height}` : '—'} />
      <Row label="FPS" value={v ? String(Math.round(v.fps)) : '—'} />
      <Row label="Bitrate" value={formatBitrate(v?.bitrate)} />
      {mode === 'inbound' && <Row label="Codec" value={stats?.video?.codec ?? '—'} />}
      {mode === 'outbound' && (
        <>
          <Row label="Espectadores" value={String(viewers ?? 0)} />
          <Row
            label="Limitado por"
            value={
              stats?.outbound?.limitation
                ? (LIMITATION[stats.outbound.limitation] ?? stats.outbound.limitation)
                : '—'
            }
          />
        </>
      )}
      <Row label="Latência (RTT)" value={formatMs(stats?.rttMs)} />
      <Row label="Perda de pacotes" value={formatPercent(stats?.lossPct)} />
    </motion.dl>
  );
}
