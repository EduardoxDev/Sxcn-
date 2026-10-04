import { useEffect, useState, type FormEvent } from 'react';
import { Link, useParams } from 'react-router';
import { ArrowLeft, ArrowRight, LockKeyhole } from 'lucide-react';
import { normalizeRoomCode, sanitizeName } from '@scxn/shared';
import { EntryLayout } from '@/components/room/EntryLayout';
import { AudioSettings } from '@/components/media/AudioSettings';
import { ErrorState } from '@/components/feedback/ErrorState';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { signaling } from '@/services/signaling/SignalingClient';
import { microphone } from '@/services/media/microphone';
import { useSettings } from '@/stores/settingsStore';
import { isBrowserSupported } from '@/lib/browser';
import type { AppErrorKind } from '@/lib/errors';
import { RoomPage } from './RoomPage';

export function RoomEntryPage() {
  const { code: raw = '' } = useParams();
  const code = normalizeRoomCode(raw);
  return code ? (
    <RoomEntry key={code} code={code} />
  ) : (
    <EntryLayout>
      <ErrorState
        kind="invalid-code"
        actions={
          <Button asChild>
            <Link to="/">Voltar ao início</Link>
          </Button>
        }
      />
    </EntryLayout>
  );
}

function RoomEntry({ code }: { code: string }) {
  const [enteredName, setEnteredName] = useState<string | null>(null);
  const [name, setName] = useState(useSettings.getState().displayName);
  const [error, setError] = useState<AppErrorKind | null>(
    isBrowserSupported() ? null : 'browser-unsupported',
  );
  const [checking, setChecking] = useState(true);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    if (enteredName || !isBrowserSupported()) return;
    let active = true;
    void signaling
      .request('room:peek', { code })
      .then((room) => {
        if (!active) return;
        setError(room.ended ? 'room-ended' : !room.exists ? 'room-not-found' : null);
      })
      .catch(() => {
        if (active) setError('signaling-failed');
      })
      .finally(() => {
        if (active) setChecking(false);
      });
    return () => {
      active = false;
    };
  }, [code, attempt, enteredName]);
  useEffect(
    () => () => {
      microphone.release();
    },
    [],
  );
  const enter = (e: FormEvent) => {
    e.preventDefault();
    const clean = sanitizeName(name);
    if (!clean || checking || error) return;
    useSettings.getState().set({ displayName: clean });
    setEnteredName(clean);
  };
  if (enteredName) return <RoomPage code={code} name={enteredName} />;
  return (
    <EntryLayout>
      <section className="w-full max-w-[380px]">
        {error ? (
          <ErrorState
            kind={error}
            actions={
              <>
                <Button asChild variant="ghost">
                  <Link to="/">Voltar ao início</Link>
                </Button>
                {error === 'signaling-failed' && (
                  <Button
                    onClick={() => {
                      setChecking(true);
                      setError(null);
                      setAttempt((n) => n + 1);
                    }}
                  >
                    Tentar novamente
                  </Button>
                )}
              </>
            }
          />
        ) : (
          <>
            <Button asChild variant="ghost" size="sm" className="-ml-3 mb-7">
              <Link to="/">
                <ArrowLeft /> Voltar
              </Link>
            </Button>
            <h1 className="text-2xl font-semibold tracking-tight">Entre no seu espaço.</h1>
            <p className="mt-2 text-sm text-fg-secondary">
              Prepare o áudio antes de entrar na sala.
            </p>
            <div className="my-6 flex items-center justify-between border-y border-border py-3">
              <span className="flex items-center gap-2 font-mono text-sm tracking-wider">
                <LockKeyhole className="size-3.5 text-fg-muted" />
                {code}
              </span>
              <span role="status" className="text-xs text-fg-secondary">
                {checking ? 'Verificando sala…' : 'Sala disponível'}
              </span>
            </div>
            <form onSubmit={enter}>
              <label htmlFor="display-name" className="text-xs font-medium text-fg-secondary">
                Seu nome ou apelido
              </label>
              <Input
                id="display-name"
                autoFocus
                required
                maxLength={32}
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Como quer ser chamado?"
                autoComplete="nickname"
                className="mb-6 mt-2"
              />
              <AudioSettings />
              <Button
                type="submit"
                variant="primary"
                size="lg"
                className="mt-7 w-full"
                disabled={checking || !sanitizeName(name)}
              >
                Entrar na sala <ArrowRight />
              </Button>
              <p className="mt-3 text-center text-[11px] text-fg-muted">
                Sua tela só será compartilhada quando você escolher.
              </p>
            </form>
          </>
        )}
      </section>
    </EntryLayout>
  );
}
