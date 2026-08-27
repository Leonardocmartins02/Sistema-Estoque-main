import type { ProductWithBalance } from '../../api/types';
import Badge from '../ui/Badge';
import Card from '../ui/Card';

import ProductActionsMenu from './ProductActionsMenu';
import { productStatus, type ProductActions } from './types';

type Props = {
  items: ProductWithBalance[];
  isLoading: boolean;
  error: string | null;
  actions: ProductActions;
};

/** Lista de produtos em cards (mobile). Extraída de `ProductDashboard`. */
export function ProductCardList({ items, isLoading, error, actions }: Props) {
  if (isLoading) {
    return (
      <Card className="text-sm text-gray-600" role="status">
        Carregando...
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="text-sm text-red-800" role="alert">
        {error}
      </Card>
    );
  }

  if (items.length === 0) {
    return <Card className="text-sm text-gray-600">Nenhum produto encontrado.</Card>;
  }

  return (
    <ul className="space-y-3">
      {items.map((p) => {
        const status = productStatus(p);
        return (
          <li key={p.id}>
            <Card>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-base font-medium text-gray-900">{p.name}</div>
                  <div className="text-xs text-gray-600">SKU: {p.sku}</div>
                </div>
                <div className="text-right">
                  <div className="text-sm font-semibold text-gray-900">Saldo: {p.balance}</div>
                  <div className="mt-1">
                    {status === 'OK' && <Badge variant="success">Em Estoque</Badge>}
                    {status === 'ATTN' && <Badge variant="warning">Estoque Baixo</Badge>}
                    {status === 'OUT' && <Badge variant="danger">Fora de Estoque</Badge>}
                  </div>
                </div>
              </div>
              <div className="mt-3 flex items-center gap-2">
                <button
                  type="button"
                  className="rounded-full border px-3.5 py-1.5 text-sm hover:bg-gray-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600"
                  onClick={() => actions.onMove(p)}
                >
                  Movimentar
                </button>
                <ProductActionsMenu product={p} actions={actions} />
              </div>
            </Card>
          </li>
        );
      })}
    </ul>
  );
}

export default ProductCardList;
