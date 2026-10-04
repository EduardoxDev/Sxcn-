import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router';
import { ArrowRight, Plus, ArrowLeft } from 'lucide-react';
import { normalizeRoomCode } from '@scxn/shared';
import { ScxnLogo } from '@/components/brand/ScxnLogo';
import { EntryLayout } from '@/components/room/EntryLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { signaling } from '@/services/signaling/SignalingClient';
import { roomSecrets } from '@/lib/storage';
import { ERROR_COPY, kindFromServerCode, SignalingError } from '@/lib/errors';

export function HomePage({ notFound = false }: { notFound?: boolean }) {
  const navigate = useNavigate();
  const [joining, setJoining] = useState(false);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(
    notFound ? 'Página não encontrada. Crie uma sala ou use um convite.' : '',
  );
  const create = async () => {
    setBusy(true);
    setError('');
    try {
      const room = await signaling.request('room:create', {});
      roomSecrets.setHostKey(room.code, room.hostKey);
      navigate(`/room/${room.code}`);
    } catch (err) {
      setError(
        ERROR_COPY[
          err instanceof SignalingError ? kindFromServerCode(err.code) : 'signaling-failed'
        ].description,
      );
    } finally {
      setBusy(false);
    }
  };
  const join = (e: FormEvent) => {
    e.preventDefault();
    const code = normalizeRoomCode(input);
    if (!code) {
      setError('Confira o código de 8 caracteres ou cole o link de convite.');
      return;
    }
    navigate(`/room/${code}`);
  };
  return (
    <EntryLayout>
      <section className="w-full max-w-[360px] pb-10 text-center">
        <ScxnLogo variant="mark" size="xl" />
        <h1 className="mt-3 text-4xl font-semibold tracking-[-0.05em]">Scxn</h1>
        <p className="mt-3 text-sm text-fg-secondary">Private screenshare sessions.</p>
        <div className="mt-10">
          {joining ? (
            <form onSubmit={join} className="space-y-3 text-left">
              <label htmlFor="room-code" className="text-xs font-medium text-fg-secondary">
                Código ou link da sala
              </label>
              <Input
                id="room-code"
                autoFocus
                value={input}
                maxLength={512}
                onChange={(e) => setInput(e.target.value)}
                placeholder="HG3V-WPST"
                autoComplete="off"
                spellCheck={false}
                className="font-mono"
              />
              <Button type="submit" variant="primary" size="lg" className="w-full">
                Entrar <ArrowRight />
              </Button>
              <Button
                variant="ghost"
                className="w-full"
                onClick={() => {
                  setJoining(false);
                  setError('');
                }}
              >
                <ArrowLeft /> Voltar
              </Button>
            </form>
          ) : (
            <div className="space-y-3">
              <Button
                variant="primary"
                size="lg"
                className="w-full"
                disabled={busy}
                onClick={() => void create()}
              >
                <Plus /> {busy ? 'Criando sala…' : 'Criar sala'}
              </Button>
              <Button
                variant="secondary"
                size="lg"
                className="w-full"
                disabled={busy}
                onClick={() => {
                  setJoining(true);
                  setError('');
                }}
              >
                Entrar em uma sala <ArrowRight />
              </Button>
            </div>
          )}
          {error && (
            <p role="alert" className="mt-4 text-xs leading-relaxed text-warning">
              {error}
            </p>
          )}
        </div>
        <p className="mt-8 text-xs text-fg-muted">Uma sala. Um código. Sua tela em foco.</p>
      </section>
    </EntryLayout>
  );
}
