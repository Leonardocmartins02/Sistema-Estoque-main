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
  /** Classe extra no corpo do diálogo (padding customizado, etc.). */
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
 * `description`/`children`/`footer`), mas focus trap, retorno de foco, Escape,
 * `aria-modal` e o bloqueio de scroll passam a vir do Radix em vez de uma
 * implementação manual. Nenhum outro sistema de diálogo deve ser introduzido
 * (ver CLAUDE.md).
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
  // Ids únicos por instância: dois modais montados juntos não podem colidir
  // (o antigo `id="modal-title"` hardcoded quebrava a associação). Mesmo padrão
  // já usado em `Input.tsx`/`Select.tsx`.
  const titleId = React.useId();
  const descId = React.useId();

  // O Radix devolve o foco para `Dialog.Trigger`, mas neste projeto o `open` é
  // sempre controlado por estado (não há Trigger). Guardamos o elemento focado
  // no momento da abertura e o restauramos no fechamento — sem isso o foco cai
  // no `<body>` e o usuário de teclado perde o lugar.
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
          aria-labelledby={titleId}
          aria-describedby={description ? descId : undefined}
          onCloseAutoFocus={(event) => {
            event.preventDefault();
            lastActiveRef.current?.focus?.();
          }}
          className={`fixed left-1/2 top-1/2 z-[1001] max-h-[90vh] w-[95vw] ${sizeClass[size]} -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-lg border border-gray-200 bg-white shadow-xl focus:outline-none`}
        >
          <div className="flex items-start justify-between gap-4 border-b px-4 py-3">
            <div>
              <Dialog.Title id={titleId} className="text-lg font-semibold text-gray-900">
                {title}
              </Dialog.Title>
              {description && (
                <Dialog.Description id={descId} className="text-sm text-gray-600">
                  {description}
                </Dialog.Description>
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
          <div className={bodyClassName}>{children}</div>
          {footer && <div className="border-t px-4 py-3">{footer}</div>}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
};

export default Modal;
