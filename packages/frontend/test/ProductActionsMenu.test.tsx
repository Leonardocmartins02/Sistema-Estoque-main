import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import type { ProductWithBalance } from '../src/api/types';
import { ProductActionsMenu } from '../src/components/products/ProductActionsMenu';

function makeProduct(overrides: Partial<ProductWithBalance> = {}): ProductWithBalance {
  return {
    id: 'p1',
    name: 'Caneta Azul',
    sku: 'SKU-1',
    description: null,
    minStock: 5,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    balance: 20,
    ...overrides,
  };
}

function makeActions() {
  return {
    onEdit: vi.fn(),
    onHistory: vi.fn(),
    onAdjust: vi.fn(),
    onZeroBalance: vi.fn(),
    onDelete: vi.fn(),
  };
}

async function openMenu(product: ProductWithBalance) {
  const user = userEvent.setup();
  await user.click(screen.getByRole('button', { name: `Mais ações para ${product.name}` }));
  return user;
}

describe('ProductActionsMenu', () => {
  it('lista as ações na ordem esperada, com "Ajustar Estoque" entre "Ver Histórico" e "Zerar Estoque"', async () => {
    const product = makeProduct();
    render(<ProductActionsMenu product={product} actions={makeActions()} />);
    await openMenu(product);

    const labels = (await screen.findAllByRole('menuitem')).map((el) => el.textContent?.trim());
    expect(labels).toEqual(['Editar', 'Ver Histórico', 'Ajustar Estoque', 'Zerar Estoque', 'Excluir']);
  });

  it('acionar "Ajustar Estoque" chama actions.onAdjust com o produto', async () => {
    const product = makeProduct();
    const actions = makeActions();
    render(<ProductActionsMenu product={product} actions={actions} />);
    const user = await openMenu(product);

    await user.click(await screen.findByRole('menuitem', { name: 'Ajustar Estoque' }));

    expect(actions.onAdjust).toHaveBeenCalledTimes(1);
    expect(actions.onAdjust).toHaveBeenCalledWith(product);
  });

  it('"Ajustar Estoque" continua disponível para produto com saldo zero (ajuste serve para corrigir para cima)', async () => {
    const product = makeProduct({ balance: 0 });
    render(<ProductActionsMenu product={product} actions={makeActions()} />);
    await openMenu(product);

    expect(await screen.findByRole('menuitem', { name: 'Ajustar Estoque' })).toBeEnabled();
  });

  it('não regride as ações existentes: "Zerar Estoque" desabilitado sem saldo, "Excluir" segue destrutivo', async () => {
    const product = makeProduct({ balance: 0 });
    const actions = makeActions();
    render(<ProductActionsMenu product={product} actions={actions} />);
    const user = await openMenu(product);

    expect(await screen.findByRole('menuitem', { name: 'Zerar Estoque' })).toBeDisabled();

    await user.click(screen.getByRole('menuitem', { name: 'Excluir' }));
    expect(actions.onDelete).toHaveBeenCalledWith(product);
    expect(actions.onZeroBalance).not.toHaveBeenCalled();
  });
});
