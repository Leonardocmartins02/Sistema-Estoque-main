import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { MOVEMENT_TYPE_LABEL, MovementTypeLabel } from '../src/components/ui/MovementTypeLabel';

/**
 * `MovementTypeLabel` — tipo de movimentação como ícone + palavra, forma única
 * (design-system.md §14.1; P5 da refatoração visual). `INITIAL_STOCK` nunca
 * vaza cru (UF-34) e a direção é legível em texto, não só pela cor do ícone.
 */
describe('MovementTypeLabel', () => {
  it.each([
    ['IN', 'Entrada', 'text-success'],
    ['OUT', 'Saída', 'text-danger'],
    ['ADJUSTMENT', 'Ajuste', 'text-info'],
    ['INITIAL_STOCK', 'Estoque inicial', 'text-text-secondary'],
  ] as const)('%s → "%s", com ícone decorativo', (type, word, iconColor) => {
    const { container } = render(<MovementTypeLabel type={type} />);

    const label = screen.getByText(word);
    expect(label).toBeInTheDocument();
    const icon = container.querySelector('[aria-hidden="true"]');
    expect(icon).toHaveClass(iconColor);
    expect(container).toHaveTextContent(new RegExp(`^${word}$`));
  });

  it('o vocabulário cobre os quatro tipos do backend', () => {
    expect(MOVEMENT_TYPE_LABEL).toEqual({
      IN: 'Entrada',
      OUT: 'Saída',
      ADJUSTMENT: 'Ajuste',
      INITIAL_STOCK: 'Estoque inicial',
    });
  });
});
