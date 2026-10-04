import { MonitorUp, RotateCcw, Video } from 'lucide-react';
import { motion } from 'motion/react';
import { ScxnMark } from '@/components/brand/ScxnMark';
import { ErrorState } from '@/components/feedback/ErrorState';
import { Button } from '@/components/ui/button';
import { Kbd } from '@/components/ui/kbd';
import { capabilities } from '@/lib/browser';
import type { AppErrorKind } from '@/lib/errors';
import { useMedia, type ScreenSource } from '@/stores/mediaStore';

interface StageEmptyProps {
  onShare: (source: ScreenSource) => void;
  onDismissError: () => void;
}

const SUGGEST_VIRTUAL_CAMERA: AppErrorKind[] = [
  'screen-blocked',
  'screen-unsupported',
  'screen-interrupted',
];

/** Nobody is sharing. Calm, branded, one clear action. */
export function StageEmpty({ onShare, onDismissError }: StageEmptyProps) {
  const status = useMedia((s) => s.screen.status);
  const error = useMedia((s) => s.screen.error);
  const source = useMedia((s) => s.screen.source);

  if (status === 'error' && error) {
    const suggestVirtualCamera = capabilities.camera && SUGGEST_VIRTUAL_CAMERA.includes(error);
    const canRetry = error !== 'screen-unsupported';
    return (
      <div className="flex size-full items-center justify-center p-6">
        <ErrorState
          kind={error}
          actions={
            <>
              <Button variant="ghost" onClick={onDismissError}>
                Fechar
              </Button>
              {canRetry && (
                <Button
                  variant={suggestVirtualCamera ? 'secondary' : 'primary'}
                  onClick={() => onShare(source)}
                >
                  <RotateCcw /> Tentar novamente
                </Button>
              )}
              {suggestVirtualCamera && (
                <Button variant="primary" onClick={() => onShare('virtual-camera')}>
                  <Video /> Usar câmera virtual do OBS
                </Button>
              )}
            </>
          }
        />
      </div>
    );
  }

  const requesting = status === 'requesting';
  const viaCamera = source === 'virtual-camera';

  return (
    <div className="scxn-grain flex size-full flex-col items-center justify-center p-6 text-center">
      <motion.div
        initial={{ opacity: 0, y: 4 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
        className="flex flex-col items-center"
      >
        <ScxnMark size={52} blink={requesting} className="opacity-90" />
        {requesting ? (
          <>
            <p className="mt-6 text-[15px] font-medium text-fg">
              {viaCamera ? 'Conectando à câmera virtual' : 'Escolha o que compartilhar'}
            </p>
            <p className="mt-1.5 max-w-xs text-[13px] text-fg-secondary">
              {viaCamera
                ? 'Permita o acesso à câmera se o navegador pedir. A câmera virtual do OBS precisa estar iniciada.'
                : 'Selecione uma tela, janela ou aba na janela do navegador.'}
            </p>
          </>
        ) : (
          <>
            <p className="mt-6 text-[15px] font-medium text-fg">Ninguém está compartilhando</p>
            <p className="mt-1.5 max-w-xs text-[13px] text-fg-secondary">
              Quando alguém compartilhar a tela, ela aparece aqui em tempo real.
            </p>
            <Button
              variant="primary"
              size="lg"
              className="mt-7"
              onClick={() => onShare('display')}
              disabled={!capabilities.screenShare || status === 'ended'}
            >
              <MonitorUp /> Compartilhar minha tela
              <Kbd className="ml-1 border-brand-fg/20 bg-brand-fg/10 text-brand-fg/70">S</Kbd>
            </Button>
            {capabilities.camera && (
              <Button
                variant="ghost"
                size="sm"
                className="mt-2"
                onClick={() => onShare('virtual-camera')}
                disabled={status === 'ended'}
              >
                <Video /> Usar câmera virtual do OBS
              </Button>
            )}
            {!capabilities.screenShare && (
              <p className="mt-3 text-xs text-fg-muted">
                Este navegador não permite compartilhar a tela.
              </p>
            )}
          </>
        )}
      </motion.div>
    </div>
  );
}
