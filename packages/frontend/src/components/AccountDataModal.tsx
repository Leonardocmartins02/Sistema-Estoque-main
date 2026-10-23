import { useMutation } from '@tanstack/react-query';
import { useState } from 'react';

import { deleteMyAccount, fetchMyData } from '../api/account';
import { ApiRequestError } from '../api/httpClient';

import { Button } from './ui/Button';
import { Input } from './ui/Input';
import { Modal } from './ui/Modal';

interface AccountDataModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Chamado após a conta ser excluída — o pai encerra a sessão local. */
  onAccountDeleted: () => void;
}

function downloadJson(data: unknown, filename: string) {
  const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

/** Direitos do titular (LGPD art. 18): ver/baixar os dados e excluir a conta. */
export function AccountDataModal({ open, onOpenChange, onAccountDeleted }: AccountDataModalProps) {
  const [password, setPassword] = useState('');

  const exportMutation = useMutation({
    mutationFn: fetchMyData,
    onSuccess: (data) => downloadJson(data, 'simplestock-meus-dados.json'),
  });

  const deleteMutation = useMutation({
    mutationFn: () => deleteMyAccount(password),
    onSuccess: onAccountDeleted,
  });

  const errorMessage = (err: unknown) =>
    err instanceof ApiRequestError ? err.message : 'Não foi possível concluir. Tente novamente.';

  return (
    <Modal
      open={open}
      onClose={() => onOpenChange(false)}
      title="Meus dados"
      description="Guardamos seu e-mail, a senha (apenas como hash) e quais movimentações de estoque você registrou. Os servidores também registram seu IP por segurança."
      size="md"
    >
      <div className="space-y-6">
        <section className="space-y-2">
          <h3 className="text-sm font-semibold text-text-primary">Baixar uma cópia</h3>
          <Button
            type="button"
            variant="secondary"
            onClick={() => exportMutation.mutate()}
            isLoading={exportMutation.isPending}
          >
            Baixar meus dados
          </Button>
          {exportMutation.isError && (
            <p role="alert" className="text-sm text-danger">
              {errorMessage(exportMutation.error)}
            </p>
          )}
        </section>

        <section className="space-y-3">
          <h3 className="text-sm font-semibold text-text-primary">Excluir minha conta</h3>
          <p className="text-sm text-text-secondary">
            Seu e-mail e sua senha serão apagados. O histórico de estoque é mantido, sem identificar você. Esta ação
            não pode ser desfeita.
          </p>
          <Input
            label="Confirme sua senha"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
          {deleteMutation.isError && (
            <p role="alert" className="text-sm text-danger">
              {errorMessage(deleteMutation.error)}
            </p>
          )}
          <Button
            type="button"
            variant="destructive"
            disabled={!password}
            onClick={() => deleteMutation.mutate()}
            isLoading={deleteMutation.isPending}
          >
            Excluir minha conta
          </Button>
        </section>
      </div>
    </Modal>
  );
}
