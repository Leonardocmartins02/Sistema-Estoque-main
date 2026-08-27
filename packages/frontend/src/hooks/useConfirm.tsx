import React, { useCallback, useState } from 'react';

import ConfirmDialog from '../components/ui/ConfirmDialog';

export type ConfirmOptions = {
  title: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: 'destructive' | 'primary';
};

type PendingConfirm = ConfirmOptions & { resolve: (value: boolean) => void };

/**
 * Substituto acessível de `window.confirm()`.
 *
 * ```tsx
 * const { confirm, confirmDialog } = useConfirm();
 * ...
 * if (!(await confirm({ title: 'Excluir?', description: '...' }))) return;
 * ...
 * return <>{...}{confirmDialog}</>;
 * ```
 */
export function useConfirm() {
  const [pending, setPending] = useState<PendingConfirm | null>(null);

  const confirm = useCallback(
    (options: ConfirmOptions) =>
      new Promise<boolean>((resolve) => {
        setPending({ ...options, resolve });
      }),
    [],
  );

  const settle = (value: boolean) => {
    pending?.resolve(value);
    setPending(null);
  };

  const confirmDialog: React.ReactNode = pending ? (
    <ConfirmDialog
      open
      title={pending.title}
      description={pending.description}
      confirmLabel={pending.confirmLabel}
      cancelLabel={pending.cancelLabel}
      tone={pending.tone}
      onConfirm={() => settle(true)}
      onCancel={() => settle(false)}
    />
  ) : null;

  return { confirm, confirmDialog };
}

export default useConfirm;
