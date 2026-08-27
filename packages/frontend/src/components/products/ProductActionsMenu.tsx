import { MoreHorizontal } from 'lucide-react';

import type { ProductWithBalance } from '../../api/types';
import MenuPopover, { MenuItem } from '../ui/MenuPopover';

import type { ProductActions } from './types';

type Props = {
  product: ProductWithBalance;
  actions: Pick<ProductActions, 'onEdit' | 'onHistory' | 'onZeroBalance' | 'onDelete'>;
};

/**
 * Menu "mais ações" de uma linha/card de produto.
 *
 * Antes era declarado DENTRO do corpo de `ProductDashboard` (recriado a cada
 * render, o que zerava o estado interno de abertura) e tinha `role="menu"` sem
 * nenhum comportamento de menu. Agora é um componente estável sobre
 * `MenuPopover`, que implementa o padrão WAI-ARIA completo.
 */
export function ProductActionsMenu({ product, actions }: Props) {
  return (
    <MenuPopover
      triggerLabel={`Mais ações para ${product.name}`}
      triggerContent={<MoreHorizontal className="h-4 w-4" aria-hidden="true" />}
      triggerClassName="inline-flex items-center rounded-md border bg-white p-1.5 text-gray-600 hover:bg-gray-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600"
      menuLabel={`Ações para ${product.name}`}
      width={192}
    >
      {() => (
        <>
          <MenuItem onSelect={() => actions.onEdit(product)}>Editar</MenuItem>
          <MenuItem onSelect={() => actions.onHistory(product)}>Ver Histórico</MenuItem>
          <MenuItem onSelect={() => actions.onZeroBalance(product)} disabled={product.balance <= 0}>
            Zerar Estoque
          </MenuItem>
          <MenuItem tone="destructive" onSelect={() => actions.onDelete(product)}>
            Excluir
          </MenuItem>
        </>
      )}
    </MenuPopover>
  );
}

export default ProductActionsMenu;
