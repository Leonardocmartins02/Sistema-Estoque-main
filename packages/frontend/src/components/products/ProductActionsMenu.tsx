import { MoreHorizontal } from 'lucide-react';

import type { ProductWithBalance } from '../../api/types';
import MenuPopover, { MenuItem, MenuSeparator } from '../ui/MenuPopover';

import type { ProductActions } from './types';

type Props = {
  product: ProductWithBalance;
  /**
   * `onQuickOut` é OPCIONAL por decisão de superfície (Task 15, P-1): o item
   * de baixa rápida só aparece onde a ação é passada — na lista de cards. No
   * desktop ele duplicaria o atalho que já existe na própria linha.
   */
  actions: Pick<ProductActions, 'onEdit' | 'onHistory' | 'onAdjust' | 'onZeroBalance' | 'onDelete'> &
    Partial<Pick<ProductActions, 'onQuickOut'>>;
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
      // Alvo de toque de 44×44 no mobile (design-system.md §15.2 regra 4); a
      // partir de `md` — onde só a tabela é renderizada — volta à densidade da
      // região de dados (D5). Mesmo componente, duas superfícies.
      triggerClassName="inline-flex h-11 w-11 items-center justify-center rounded-md border bg-white text-gray-600 hover:bg-gray-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-surface md:h-auto md:w-auto md:p-1.5"
      menuLabel={`Ações para ${product.name}`}
      width={192}
    >
      {() => (
        <>
          <MenuItem onSelect={() => actions.onEdit(product)}>Editar</MenuItem>
          <MenuItem onSelect={() => actions.onHistory(product)}>Ver Histórico</MenuItem>
          <MenuItem onSelect={() => actions.onAdjust(product)}>Ajustar Estoque</MenuItem>
          {/* P-1: baixa rápida vive no overflow no mobile. Fica ANTES do
              separador porque é atalho de operação, não ação destrutiva. */}
          {actions.onQuickOut && (
            <MenuItem onSelect={() => actions.onQuickOut?.(product)}>Baixa rápida</MenuItem>
          )}
          {/* UF-16: bloco destrutivo separado — "Zerar Estoque" e "Excluir"
              não ficam à mesma distância do cursor que as ações banais. */}
          <MenuSeparator />
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
