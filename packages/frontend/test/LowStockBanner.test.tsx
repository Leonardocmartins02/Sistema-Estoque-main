import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import LowStockBanner from '../src/components/ui/LowStockBanner';

describe('LowStockBanner', () => {
  it('mantém a região viva montada mas sem aviso quando não há produtos em atenção/sem estoque', () => {
    render(<LowStockBanner summary={{ ok: 5, attn: 0, out: 0 }} onShowLowStock={vi.fn()} />);

    expect(screen.getByRole('status')).toBeEmptyDOMElement();
  });

  it('mantém a região viva montada mas sem aviso enquanto o resumo ainda não chegou', () => {
    render(<LowStockBanner summary={undefined} onShowLowStock={vi.fn()} />);

    expect(screen.getByRole('status')).toBeEmptyDOMElement();
  });

  it('avisa em uma região viva quantos produtos estão em atenção ou sem estoque', () => {
    render(<LowStockBanner summary={{ ok: 5, attn: 2, out: 1 }} onShowLowStock={vi.fn()} />);

    const region = screen.getByRole('status');
    expect(region).toHaveAttribute('aria-live', 'polite');
    expect(region).toHaveTextContent(/3 produtos/);
    expect(region).toHaveTextContent(/2 em atenção/);
    expect(region).toHaveTextContent(/1 sem estoque/);
  });

  it('aciona o filtro de estoque baixo ao clicar no botão', async () => {
    const onShowLowStock = vi.fn();
    render(<LowStockBanner summary={{ ok: 0, attn: 1, out: 0 }} onShowLowStock={onShowLowStock} />);

    await userEvent.click(screen.getByRole('button', { name: /ver produtos/i }));

    expect(onShowLowStock).toHaveBeenCalledTimes(1);
  });
});
