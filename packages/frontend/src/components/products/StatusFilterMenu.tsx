import { Check, ChevronDown } from 'lucide-react';

import type { StatusKey } from '../../hooks/useProductsQuery';
import Badge from '../ui/Badge';
import MenuPopover, { MenuItem, MenuItemCheckbox } from '../ui/MenuPopover';

// Vocabulário único (Task 14): as mesmas três palavras da tabela e do card —
// o filtro tinha um TERCEIRO conjunto de rótulos ("OK / Atenção / Em falta"),
// enquanto backend, tabela e card já usavam vocabulários diferentes entre si.
const OPTIONS: Array<{ value: StatusKey; label: string; dot: string }> = [
  { value: 'OK', label: 'Em estoque', dot: 'bg-emerald-600' },
  { value: 'ATTN', label: 'Estoque baixo', dot: 'bg-amber-600' },
  { value: 'OUT', label: 'Sem estoque', dot: 'bg-rose-600' },
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
          <span className="text-caption">Status</span>
          {/* M-3: contador legível — 10px arbitrário vira o token caption
              (12px), reaproveitando o primitivo Badge (radius-control, cores
              semânticas) no lugar de uma pílula desenhada à mão. */}
          {count > 0 && <Badge variant="info">{count}</Badge>}
          <ChevronDown className="h-3.5 w-3.5 text-gray-600" aria-hidden="true" />
        </>
      }
      triggerClassName="inline-flex items-center gap-1.5 rounded-control border border-border-strong bg-white px-2 py-1 text-caption font-semibold tracking-wide text-gray-700 hover:bg-gray-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-surface"
      menuLabel="Filtrar por status"
      width={224}
    >
      {() => (
        <>
          <p className="px-3 pb-1 pt-2 text-table-header uppercase tracking-wide text-gray-600">
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
