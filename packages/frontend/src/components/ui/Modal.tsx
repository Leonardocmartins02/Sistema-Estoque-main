import * as Dialog from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
import React from 'react';

export type ModalSize = 'sm' | 'md' | 'lg' | 'xl' | '2xl' | '3xl' | '4xl';

/** `dialog` = centralizado (default). `sheet` = ancorada na base — variante do mesmo primitivo (design-system.md §12, §15). */
export type ModalVariant = 'dialog' | 'sheet';

export interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children?: React.ReactNode;
  footer?: React.ReactNode;
  /** Largura máxima do diálogo. Default `lg` (a largura histórica do Modal custom). */
  size?: ModalSize;
  /** `dialog` (default) ou `sheet` — mesmo Radix, mesma semântica, mesmo focus trap; só a caixa muda. */
  variant?: ModalVariant;
  /** Ações extras renderizadas no cabeçalho, à esquerda do botão de fechar. */
  headerActions?: React.ReactNode;
  /** Classe do corpo do diálogo (para padding customizado). */
  bodyClassName?: string;
  /**
   * Ref opcional para o heading real (`Dialog.Title`) — SD-5
   * (`implementation-plan.md` §9.3.3). Aditiva: quando ausente, nada muda no
   * comportamento existente. Quando presente, o heading recebe `tabIndex={-1}`
   * para ficar programaticamente focável (ex.: devolver o foco a ele após uma
   * ação assíncrona), sem entrar na ordem natural de tabulação.
   */
  titleRef?: React.Ref<HTMLHeadingElement>;
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

// O teto de largura do shell (D-B, design-system.md §4.4) não se aplica a
// diálogos — cada variante só controla posição/altura; a largura continua
// vindo de `size`.
const variantClass: Record<ModalVariant, string> = {
  dialog: 'left-1/2 top-1/2 max-h-[90vh] w-[95vw] -translate-x-1/2 -translate-y-1/2 rounded-surface',
  sheet: 'left-1/2 bottom-0 max-h-[85vh] w-full -translate-x-1/2 rounded-t-surface',
};

/**
 * Pilha de diálogos abertos, compartilhada por todas as instâncias do
 * primitivo — a peça que faz o empilhamento ter **um** diálogo exposto.
 *
 * O Radix já resolve trap e Escape empilhados sozinho (`FocusScope` mantém
 * uma pilha e pausa o escopo de baixo; `DismissableLayer` só entrega Escape à
 * camada do topo). O que ele NÃO resolve aqui é a ocultação para tecnologia
 * assistiva: `DialogContentModal` chama `hideOthers()` do pacote
 * `aria-hidden`, e essa função **preserva deliberadamente** todo nó
 * `[aria-live]` da página e, com ele, todos os seus ancestrais
 * (`aria-hidden/src/index.ts`: `targets.push(...parent.querySelectorAll('[aria-live], script'))`).
 *
 * Consequência medida: um diálogo que contenha uma live region montada — como
 * as de `QuickOutListModal` (`role="status"` + `role="alert"`, montadas
 * sempre, por regra do `CLAUDE.md`) — **nunca** é ocultado pelo diálogo que
 * abre por cima dele. Ficam dois `aria-modal="true"` expostos: exatamente o
 * cenário que ORD-01/REV-15 mandaram evitar.
 *
 * Por isso a camada que não é o topo recebe `aria-hidden` aqui, no primitivo:
 * é a única instância que sabe que existe uma camada acima. Não se usa
 * `inert` — o trap do Radix já impede o teclado de chegar lá, e `inert` no
 * caminho da restauração de foco é risco sem ganho.
 */
const openStack: symbol[] = [];
const stackListeners = new Set<() => void>();

function emitStackChange() {
  stackListeners.forEach((listener) => listener());
}

function subscribeToStack(listener: () => void) {
  stackListeners.add(listener);
  return () => {
    stackListeners.delete(listener);
  };
}

function topOfStack() {
  return openStack[openStack.length - 1];
}

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
  variant = 'dialog',
  headerActions,
  bodyClassName = 'px-4 py-3',
  titleRef,
}) => {
  // O Radix devolve o foco para `Dialog.Trigger`, mas neste projeto `open` é
  // sempre controlado por estado (não existe Trigger). Guardamos o elemento
  // focado no momento da abertura e o restauramos ao fechar — sem isso o foco
  // cai no `<body>` e o usuário de teclado perde o lugar na página.
  const lastActiveRef = React.useRef<HTMLElement | null>(null);
  React.useEffect(() => {
    if (open) lastActiveRef.current = document.activeElement as HTMLElement | null;
  }, [open]);

  // Identidade estável desta instância dentro da pilha de diálogos abertos.
  const tokenRef = React.useRef<symbol>();
  if (!tokenRef.current) tokenRef.current = Symbol('modal');
  const token = tokenRef.current;

  React.useEffect(() => {
    if (!open) return;
    openStack.push(token);
    emitStackChange();
    return () => {
      const index = openStack.indexOf(token);
      if (index >= 0) openStack.splice(index, 1);
      emitStackChange();
    };
  }, [open, token]);

  const top = React.useSyncExternalStore(subscribeToStack, topOfStack, topOfStack);
  const isTop = !open || top === undefined || top === token;

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
          // Só o topo é exposto à tecnologia assistiva; ver a nota da pilha
          // acima para o motivo de o `hideOthers()` do Radix não bastar.
          aria-hidden={isTop ? undefined : true}
          // Sem descrição, o Radix apontaria `aria-describedby` para um id
          // inexistente; `undefined` explícito é o contrato dele para isso.
          {...(description ? {} : { 'aria-describedby': undefined })}
          onCloseAutoFocus={(event) => {
            event.preventDefault();
            lastActiveRef.current?.focus?.();
          }}
          className={`fixed z-[1001] flex ${variantClass[variant]} ${sizeClass[size]} flex-col overflow-hidden border border-gray-200 bg-white shadow-overlay focus:outline-none`}
        >
          <div className="flex shrink-0 items-start justify-between gap-4 border-b px-4 py-3">
            <div>
              <Dialog.Title
                ref={titleRef}
                tabIndex={titleRef ? -1 : undefined}
                className="text-lg font-semibold text-gray-900"
              >
                {title}
              </Dialog.Title>
              {description && (
                <Dialog.Description className="text-sm text-gray-600">{description}</Dialog.Description>
              )}
            </div>
            <div className="flex shrink-0 items-center gap-2">
              {headerActions}
              <Dialog.Close asChild>
                <button
                  type="button"
                  className="rounded-md p-1 text-gray-600 hover:bg-gray-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-surface"
                  aria-label="Fechar"
                >
                  <X className="h-4 w-4" aria-hidden="true" />
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
