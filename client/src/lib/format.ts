export function formatBitrate(bps: number | null | undefined): string {
  if (!bps || bps <= 0) return '—';
  if (bps >= 1_000_000) return `${(bps / 1_000_000).toFixed(1)} Mbps`;
  return `${Math.round(bps / 1000)} kbps`;
}

export function formatMs(ms: number | null | undefined): string {
  return ms == null ? '—' : `${Math.round(ms)} ms`;
}

export function formatPercent(v: number | null | undefined): string {
  return v == null ? '—' : `${v.toFixed(v < 1 ? 1 : 0)}%`;
}

export function inviteLink(code: string): string {
  return `${window.location.origin}/room/${code}`;
}

export function pluralPeople(n: number): string {
  return n === 1 ? '1 pessoa' : `${n} pessoas`;
}
