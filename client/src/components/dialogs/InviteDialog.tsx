import { Check, Copy, Link as LinkIcon } from 'lucide-react';
import { Dialog, DialogBody, DialogContent } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useUi } from '@/stores/uiStore';
import { useCopy } from '@/hooks/useCopy';
import { inviteLink } from '@/lib/format';
import { notify } from '@/lib/notify';

export function InviteDialog({ code }: { code: string }) {
  const open = useUi((s) => s.inviteOpen);
  const { copy, copied } = useCopy();
  const link = inviteLink(code);
  const copyValue = async (value: string, title: string) => {
    if (await copy(value)) notify.success(title);
    else notify.error('Não foi possível copiar', 'Selecione o texto e copie manualmente.');
  };
  return (
    <Dialog open={open} onOpenChange={(inviteOpen) => useUi.getState().set({ inviteOpen })}>
      <DialogContent
        title="Convide para a sala"
        description="Envie o link ou compartilhe o código com quem você quer aqui."
      >
        <DialogBody>
          <div className="mb-4 flex items-center justify-between rounded-lg bg-bg p-4 ring-1 ring-border">
            <span className="select-all font-mono text-xl tracking-widest">{code}</span>
            <Button
              size="icon"
              variant="ghost"
              aria-label="Copiar código"
              onClick={() => void copyValue(code, 'Código copiado')}
            >
              {copied ? <Check /> : <Copy />}
            </Button>
          </div>
          <p className="select-all break-all text-xs text-fg-secondary">{link}</p>
          <Button
            variant="primary"
            className="mt-4 w-full"
            onClick={() => void copyValue(link, 'Link copiado')}
          >
            <LinkIcon /> Copiar link de convite
          </Button>
          <p className="mt-4 text-xs text-fg-muted">
            Qualquer pessoa com o código pode entrar, enquanto houver lugar na sala.
          </p>
        </DialogBody>
      </DialogContent>
    </Dialog>
  );
}
