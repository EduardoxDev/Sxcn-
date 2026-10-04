import type { ReactNode } from 'react';
import { Link } from 'react-router';
import { LockKeyhole } from 'lucide-react';
import { ScxnLogo } from '@/components/brand/ScxnLogo';

export function EntryLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex h-dvh flex-col overflow-y-auto bg-bg">
      <header className="flex h-16 shrink-0 items-center justify-between px-6 sm:px-10">
        <Link to="/" aria-label="Scxn — início">
          <ScxnLogo />
        </Link>
        <span className="flex items-center gap-2 text-xs text-fg-muted">
          <LockKeyhole className="size-3" /> Sessões privadas
        </span>
      </header>
      <main className="flex flex-1 items-center justify-center px-6 py-10">{children}</main>
      <footer className="flex shrink-0 flex-wrap justify-between gap-2 px-6 py-5 text-[11px] text-fg-muted sm:px-10">
        <span>Tela e voz. Sem distrações.</span>
        <span>Sem gravação de áudio ou vídeo.</span>
      </footer>
    </div>
  );
}
