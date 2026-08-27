import { useMutation, useQueryClient } from '@tanstack/react-query';

import { createMovement } from '../api/movements';
import { deleteProduct } from '../api/products';
import type { ProductWithBalance } from '../api/types';
import { useToast } from '../components/ui/ToastProvider';

type BulkResult = { succeeded: number; failed: number };

async function runBulk<T>(items: T[], op: (item: T) => Promise<unknown>): Promise<BulkResult> {
  const results = await Promise.allSettled(items.map(op));
  const failed = results.filter((r) => r.status === 'rejected').length;
  return { succeeded: results.length - failed, failed };
}

function errorMessage(error: unknown, fallback: string) {
  return error instanceof Error && error.message ? error.message : fallback;
}

/**
 * Mutações de produto centralizadas em `useMutation` — antes eram chamadas
 * soltas de `deleteProduct`/`createMovement` dentro de handlers, cada uma com
 * `invalidateQueries` manual e tratamento de erro copiado.
 */
export function useProductMutations() {
  const qc = useQueryClient();
  const { show: showToast } = useToast();
  const invalidate = () => qc.invalidateQueries({ queryKey: ['products'] });

  const removeProduct = useMutation({
    mutationFn: (product: ProductWithBalance) => deleteProduct(product.id),
    onSuccess: (_data, product) => showToast({ type: 'success', message: `Produto ${product.name} excluído.` }),
    onError: (error) => showToast({ type: 'error', message: errorMessage(error, 'Falha ao excluir produto') }),
    onSettled: invalidate,
  });

  const zeroBalance = useMutation({
    mutationFn: (product: ProductWithBalance) =>
      createMovement(product.id, { type: 'OUT', quantity: product.balance }),
    onSuccess: (_data, product) =>
      showToast({ type: 'success', message: `Saldo de ${product.name} zerado com sucesso.` }),
    onError: (error) => showToast({ type: 'error', message: errorMessage(error, 'Falha ao zerar saldo') }),
    onSettled: invalidate,
  });

  const removeProducts = useMutation({
    mutationFn: (products: ProductWithBalance[]) => runBulk(products, (p) => deleteProduct(p.id)),
    onSuccess: ({ succeeded, failed }) => {
      if (failed > 0) {
        showToast({ type: 'error', message: `Falha ao excluir ${failed} de ${succeeded + failed} produto(s).` });
      } else {
        showToast({ type: 'success', message: `${succeeded} produto(s) excluído(s).` });
      }
    },
    onError: (error) => showToast({ type: 'error', message: errorMessage(error, 'Erro ao excluir selecionados') }),
    onSettled: invalidate,
  });

  const zeroBalances = useMutation({
    mutationFn: (products: ProductWithBalance[]) =>
      runBulk(
        products.filter((p) => p.balance > 0),
        (p) => createMovement(p.id, { type: 'OUT', quantity: p.balance }),
      ),
    onSuccess: ({ succeeded, failed }) => {
      if (failed > 0) {
        showToast({ type: 'error', message: `Falha ao zerar ${failed} de ${succeeded + failed} produto(s).` });
      } else {
        showToast({ type: 'success', message: 'Saldos da página zerados com sucesso.' });
      }
    },
    onError: (error) => showToast({ type: 'error', message: errorMessage(error, 'Erro ao zerar saldos') }),
    onSettled: invalidate,
  });

  return { removeProduct, zeroBalance, removeProducts, zeroBalances, invalidateProducts: invalidate };
}
