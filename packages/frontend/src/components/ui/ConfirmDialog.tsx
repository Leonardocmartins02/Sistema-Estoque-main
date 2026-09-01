import React from 'react';

import Button from './Button';
import Modal from './Modal';

export interface ConfirmDialogProps {
  open: boolean;
  title: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  /** `destructive` (default) pinta o botão de confirmação de vermelho. */
  tone?: 'destructive' | 'primary';
  isPending?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

/**
 * Diálogo de confirmação acessível do design system — substitui
 * `window.confirm()` em ações destrutivas (excluir produto, zerar estoque,
 * exclusão em massa). Construído sobre o primitivo único `Modal` (Radix),
 * então herda focus trap, Escape e retorno de foco.
 *
 * Para o caso comum ("pergunte e siga conforme a resposta"), prefira o hook
 * `useConfirm`, que embrulha este componente em uma API de Promise.
 */
export const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
  open,
  title,
  description,
  confirmLabel = 'Confirmar',
  cancelLabel = 'Cancelar',
  tone = 'destructive',
  isPending = false,
  onConfirm,
  onCancel,
}) => (
  <Modal
    open={open}
    onClose={onCancel}
    title={title}
    description={description}
    size="md"
    footer={
      <div className="flex items-center justify-end gap-2">
        <Button type="button" variant="secondary" onClick={onCancel} disabled={isPending}>
          {cancelLabel}
        </Button>
        <Button
          type="button"
          variant={tone === 'destructive' ? 'destructive' : 'primary'}
          onClick={onConfirm}
          isLoading={isPending}
        >
          {confirmLabel}
        </Button>
      </div>
    }
  />
);

export default ConfirmDialog;
