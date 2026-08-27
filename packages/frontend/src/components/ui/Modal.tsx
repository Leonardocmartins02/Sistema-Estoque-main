import * as Dialog from '@radix-ui/react-dialog';
import React from 'react';

export type ModalSize = 'sm' | 'md' | 'lg' | 'xl' | '2xl' | '3xl' | '4xl';

export interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children?: React.ReactNode;
  footer?: React.ReactNode;
  /** Largura máxima do diálogo. Default `lg` (a largura histórica do Modal custom). */
  size?: ModalSize;
  /** Ações extras renderizadas no cabeçalho, à esquerda do botão de fechar. */
  headerActions?: React.ReactNode;
  /** Classe do corpo do diálogo (para padding customizado). */
  bodyClassName?: string;
}

const sizeClass: Record<ModalSize, string> = {
  sm: 'max-w-sm',
  md: 'max-w-md',
  lg: 'max-w-lg',
  xl: 'max-w-xl',
  '2xl': 'max-w-2xl',
  '3xl': 'max-w-3xl',
  '4xl': 'max-w-4xl',
};

/**
 * Primitivo ÚNICO de diálogo do projeto — wrapper fino sobre `@radix-ui/react-dialog`.
 *
 * A API pública é a mesma do antigo `Modal` custom (`open`/`onClose`/`title`/
 * `description`/`children`/`footer`), mas focus trap, Escape, `aria-modal`,
 * bloqueio de scroll e ocultação do resto da página para AT passam a vir do
 * Radix em vez de uma implementação manual. Nenhum outro sistema de diálogo
 * deve ser introduzido no projeto (ver CLAUDE.md).
 *
 * Ids de `aria-labelledby`/`aria-describedby`: gerados por instância pelo
 * Radix (`@radix-ui/react-id`, que usa `React.useId`) através de
 * `Dialog.Title`/`Dialog.Description` — nunca strings fixas como o antigo
 * `id="modal-title"`, que colidia quando dois modais montavam juntos.
 */
export const Modal: React.FC<ModalProps> = ({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  size = 'lg',
  headerActions,
  bodyClassName = 'px-4 py-3',
}) => {
  // O Radix devolve o foco para `Dialog.Trigger`, mas neste projeto `open` é
  // sempre controlado por estado (não existe Trigger). Guardamos o elemento
  // focado no momento da abertura e o restauramos ao fechar — sem isso o foco
  // cai no `<body>` e o usuário de teclado perde o lugar na página.
  const lastActiveRef = React.useRef<HTMLElement | null>(null);
  React.useEffect(() => {
    if (open) lastActiveRef.current = document.activeElement as HTMLElement | null;
  }, [open]);

  return (
    <Dialog.Root
      open={open}
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
    >
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-[1000] bg-black/40 backdrop-blur-sm" />
        <Dialog.Content
          aria-modal="true"
          // Sem descrição, o Radix apontaria `aria-describedby` para um id
          // inexistente; `undefined` explícito é o contrato dele para isso.
          {...(description ? {} : { 'aria-describedby': undefined })}
          onCloseAutoFocus={(event) => {
            event.preventDefault();
            lastActiveRef.current?.focus?.();
          }}
          className={`fixed left-1/2 top-1/2 z-[1001] flex max-h-[90vh] w-[95vw] ${sizeClass[size]} -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-lg border border-gray-200 bg-white shadow-xl focus:outline-none`}
        >
          <div className="flex shrink-0 items-start justify-between gap-4 border-b px-4 py-3">
            <div>
              <Dialog.Title className="text-lg font-semibold text-gray-900">{title}</Dialog.Title>
              {description && (
                <Dialog.Description className="text-sm text-gray-600">{description}</Dialog.Description>
              )}
            </div>
            <div className="flex shrink-0 items-center gap-2">
              {headerActions}
              <Dialog.Close asChild>
                <button
                  type="button"
                  className="rounded-md p-1 text-gray-600 hover:bg-gray-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
                  aria-label="Fechar"
                >
                  <span aria-hidden="true">✕</span>
                </button>
              </Dialog.Close>
            </div>
          </div>
          <div className={`overflow-y-auto ${bodyClassName}`}>{children}</div>
          {footer && <div className="shrink-0 border-t px-4 py-3">{footer}</div>}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
};

export default Modal;
