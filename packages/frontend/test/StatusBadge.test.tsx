import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { STATUS_LABEL, StatusBadge } from '../src/components/ui/StatusBadge';

/**
 * `StatusBadge` — estado de estoque com vocabulário fechado, sempre cor +
 * palavra + ponto (P5 da refatoração visual; WCAG 1.4.1: a cor nunca é o único
 * portador). A regra que decide o estado continua em `productStatus()` (PS-1);
 * aqui é só a tradução em tela.
 */
describe('StatusBadge', () => {
  it.each([
    ['OK', 'Em estoque', 'bg-success-subtle', 'bg-success-fill'],
    ['ATTN', 'Estoque baixo', 'bg-warning-subtle', 'bg-warning-fill'],
    ['OUT', 'Sem estoque', 'bg-danger-subtle', 'bg-danger-fill'],
  ] as const)('%s → "%s", com fundo e ponto do estado', (status, word, background, dot) => {
    render(<StatusBadge status={status} />);

    const badge = screen.getByText(word);
    expect(badge).toHaveClass(background, 'rounded-pill');
    // O ponto é decorativo: o leitor de tela ouve só a palavra.
    const marker = badge.querySelector('[aria-hidden="true"]');
    expect(marker).toHaveClass(dot);
    expect(badge).toHaveTextContent(new RegExp(`^${word}$`));
  });

  it('o vocabulário é exatamente o da Fase 4 — um nome por estado no produto inteiro', () => {
    expect(STATUS_LABEL).toEqual({ OK: 'Em estoque', ATTN: 'Estoque baixo', OUT: 'Sem estoque' });
  });
});
