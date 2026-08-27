import { Check, ChevronDown } from 'lucide-react';

import type { StatusKey } from '../../hooks/useProductsQuery';
import MenuPopover, { MenuItem, MenuItemCheckbox } from '../ui/MenuPopover';

const OPTIONS: Array<{ value: StatusKey; label: string; dot: string }> = [
  { value: 'OK', label: 'OK', dot: 'bg-emerald-600' },
  { value: 'ATTN', label: 'Atenção', dot: 'bg-amber-600' },
  { value: 'OUT', label: 'Em falta', dot: 'bg-rose-600' },
];

type Props = {
  selected: StatusKey[];
  onToggle: (value: StatusKey) => void;
  onClear: () => void;
};

/**
 * Cabeçalho-filtro da coluna Status.
 *
 * Antes era declarado dentro do corpo de `ProductDashboard` (recriado a cada
 * render) e usava `role="menu"` com botões comuns — leitor de tela anunciava
 * um menu que não se comportava como menu. Agora usa `MenuPopover` com
 * `role="menuitemcheckbox"` (múltipla seleção) e navegação por setas.
 */
export function StatusFilterMenu({ selected, onToggle, onClear }: Props) {
  const count = selected.length;

  return (
    <MenuPopover
      triggerLabel={count > 0 ? `Filtrar por Status (${count} ativo(s))` : 'Filtrar por Status'}
      triggerContent={
        <>
          <span>Status</span>
          {count > 0 && (
            <span className="ml-1 inline-flex items-center rounded-full bg-indigo-50 px-1.5 py-0.5 text-[10px] font-medium text-indigo-800 ring-1 ring-inset ring-indigo-300">
              {count}
            </span>
          )}
          <ChevronDown className="h-3.5 w-3.5 text-gray-600" aria-hidden="true" />
        </>
      }
      triggerClassName="inline-flex items-center gap-1.5 rounded-md border border-gray-300 bg-white px-2 py-1 text-[11px] font-semibold tracking-wide text-gray-700 shadow-sm hover:bg-gray-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600"
      menuLabel="Filtrar por status"
      width={224}
    >
      {() => (
        <>
          <p className="px-3 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-wide text-gray-600">
            Filtrar Status
          </p>
          {OPTIONS.map((opt) => (
            <MenuItemCheckbox
              key={opt.value}
              checked={selected.includes(opt.value)}
              onSelect={() => onToggle(opt.value)}
            >
              <span className="flex items-center gap-2">
                <span className={`h-2 w-2 rounded-full ${opt.dot}`} aria-hidden="true" />
                <span className="flex-1">{opt.label}</span>
                {selected.includes(opt.value) && <Check className="h-3.5 w-3.5 text-indigo-700" aria-hidden="true" />}
              </span>
            </MenuItemCheckbox>
          ))}
          <MenuItem onSelect={onClear} disabled={count === 0}>
            Limpar filtros
          </MenuItem>
        </>
      )}
    </MenuPopover>
  );
}

export default StatusFilterMenu;
