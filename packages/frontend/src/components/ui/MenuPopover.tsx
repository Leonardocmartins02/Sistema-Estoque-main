import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

const ITEM_SELECTOR = '[role="menuitem"],[role="menuitemcheckbox"],[role="menuitemradio"]';

type MenuItemBaseProps = {
  children: React.ReactNode;
  onSelect: () => void;
  disabled?: boolean;
  tone?: 'default' | 'destructive';
  className?: string;
};

const itemClass = (tone: 'default' | 'destructive', className: string) =>
  `block w-full rounded-md px-3 py-2.5 text-left text-sm disabled:cursor-not-allowed disabled:opacity-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600 ${
    tone === 'destructive' ? 'text-red-700 hover:bg-red-50' : 'text-gray-800 hover:bg-gray-50'
  } ${className}`;

/** Item de menu que executa uma ação e fecha o menu. */
export function MenuItem({ children, onSelect, disabled, tone = 'default', className = '' }: MenuItemBaseProps) {
  return (
    <button type="button" role="menuitem" tabIndex={-1} disabled={disabled} onClick={onSelect} className={itemClass(tone, className)}>
      {children}
    </button>
  );
}

/** Item de menu de múltipla escolha — alterna um estado e mantém o menu aberto. */
export function MenuItemCheckbox({
  children,
  onSelect,
  checked,
  disabled,
  className = '',
}: MenuItemBaseProps & { checked: boolean }) {
  return (
    <button
      type="button"
      role="menuitemcheckbox"
      aria-checked={checked}
      tabIndex={-1}
      disabled={disabled}
      data-keep-open="true"
      onClick={onSelect}
      className={itemClass('default', className)}
    >
      {children}
    </button>
  );
}

export type MenuPopoverProps = {
  /** Nome acessível do botão que abre o menu. */
  triggerLabel: string;
  triggerContent: React.ReactNode;
  triggerClassName?: string;
  /** Nome acessível do próprio menu. */
  menuLabel: string;
  /** Largura estimada do menu, usada para posicionar em relação ao gatilho. */
  width?: number;
  menuClassName?: string;
  children: (api: { close: () => void }) => React.ReactNode;
};

/**
 * Menu em portal que implementa o padrão WAI-ARIA de `menu button`:
 * gatilho com `aria-haspopup="menu"`/`aria-expanded`, itens com
 * `role="menuitem"`/`menuitemcheckbox`, navegação por setas/Home/End com foco
 * roving, Enter/Espaço para acionar, Escape para fechar devolvendo o foco ao
 * gatilho, e fechamento ao clicar fora ou rolar a página.
 *
 * O portal com posição fixa existe para o menu não ser cortado pelo
 * `overflow` da tabela (motivo original do `createPortal` no dashboard).
 */
export function MenuPopover({
  triggerLabel,
  triggerContent,
  triggerClassName = '',
  menuLabel,
  width = 192,
  menuClassName = '',
  children,
}: MenuPopoverProps) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ top?: number; bottom?: number; left: number } | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const items = useCallback(
    () =>
      Array.from(menuRef.current?.querySelectorAll<HTMLElement>(ITEM_SELECTOR) ?? []).filter(
        (el) => !el.hasAttribute('disabled') && el.getAttribute('aria-disabled') !== 'true',
      ),
    [],
  );

  const place = useCallback(() => {
    const rect = triggerRef.current?.getBoundingClientRect();
    if (!rect) return;
    const preferredTop = rect.bottom + 8;
    const estimatedHeight = 240;
    const overflowsBottom = preferredTop + estimatedHeight > window.innerHeight;
    setPos({
      top: overflowsBottom ? undefined : preferredTop,
      bottom: overflowsBottom ? window.innerHeight - rect.top + 8 : undefined,
      left: Math.max(8, rect.right - width),
    });
  }, [width]);

  const openMenu = useCallback(() => {
    place();
    setOpen(true);
  }, [place]);

  const closeMenu = useCallback(
    (returnFocus = true) => {
      setOpen(false);
      if (returnFocus) triggerRef.current?.focus();
    },
    [],
  );

  // Foco no primeiro item assim que o menu aparece (padrão de menu button).
  useLayoutEffect(() => {
    if (!open) return;
    items()[0]?.focus();
  }, [open, items]);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: MouseEvent) => {
      const target = event.target as Node;
      if (menuRef.current?.contains(target) || triggerRef.current?.contains(target)) return;
      closeMenu(false);
    };
    const onScrollOrResize = () => closeMenu(false);
    window.addEventListener('mousedown', onPointerDown);
    window.addEventListener('resize', onScrollOrResize);
    window.addEventListener('scroll', onScrollOrResize, true);
    return () => {
      window.removeEventListener('mousedown', onPointerDown);
      window.removeEventListener('resize', onScrollOrResize);
      window.removeEventListener('scroll', onScrollOrResize, true);
    };
  }, [open, closeMenu]);

  const moveFocus = (delta: number) => {
    const list = items();
    if (list.length === 0) return;
    const current = list.indexOf(document.activeElement as HTMLElement);
    const next = (current + delta + list.length) % list.length;
    list[next]?.focus();
  };

  const onMenuKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault();
        moveFocus(1);
        break;
      case 'ArrowUp':
        event.preventDefault();
        moveFocus(-1);
        break;
      case 'Home':
        event.preventDefault();
        items()[0]?.focus();
        break;
      case 'End': {
        event.preventDefault();
        const list = items();
        list[list.length - 1]?.focus();
        break;
      }
      case 'Escape':
        event.preventDefault();
        closeMenu();
        break;
      case 'Tab':
        // Tab sai do menu: fecha (o menu não é um container de tab stops).
        closeMenu();
        break;
      default:
        break;
    }
  };

  // Enter/Espaço acionam o botão nativo; aqui só decidimos se o menu fecha.
  const onMenuClick = (event: React.MouseEvent<HTMLDivElement>) => {
    const target = (event.target as HTMLElement).closest<HTMLElement>(ITEM_SELECTOR);
    if (!target) return;
    if (target.dataset.keepOpen === 'true') return;
    closeMenu();
  };

  const onTriggerKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>) => {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      openMenu();
    }
  };

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        aria-label={triggerLabel}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={(event) => {
          event.stopPropagation();
          if (open) closeMenu();
          else openMenu();
        }}
        onKeyDown={onTriggerKeyDown}
        className={triggerClassName}
      >
        {triggerContent}
      </button>
      {open &&
        pos &&
        createPortal(
          <div
            ref={menuRef}
            role="menu"
            aria-label={menuLabel}
            onKeyDown={onMenuKeyDown}
            onClick={onMenuClick}
            onMouseDown={(event) => event.stopPropagation()}
            style={{ position: 'fixed', top: pos.top, bottom: pos.bottom, left: pos.left, width }}
            className={`z-[10000] rounded-xl border border-gray-200 bg-white p-1 text-sm shadow-xl ring-1 ring-black/5 ${menuClassName}`}
          >
            {children({ close: closeMenu })}
          </div>,
          document.body,
        )}
    </>
  );
}

export default MenuPopover;
