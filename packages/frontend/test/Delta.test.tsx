import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { BalanceFlow } from '../src/components/ui/BalanceFlow';
import { Delta } from '../src/components/ui/Delta';

/**
 * `Delta` e `BalanceFlow` — a gramática de número da refatoração visual
 * (P4: variação com sinal, seta e palavra; "o que é nosso": `antes → depois`
 * com diferença assinada em todo lugar). O sinal é sempre texto (`+`/`−`
 * tipográfico, via `formatDelta`); cor e seta só reforçam (WCAG 1.4.1).
 */
describe('Delta', () => {
  it.each([
    [12, '+12 un.', 'text-success'],
    [-5, '−5 un.', 'text-danger'],
    [0, '0 un.', 'text-text-secondary'],
  ])('%i → "%s"', (value, text, color) => {
    render(<Delta value={value} />);

    expect(screen.getByText(text)).toHaveClass(color, 'tabular-nums');
  });

  it('usa o sinal de menos tipográfico (U+2212), nunca o hífen', () => {
    render(<Delta value={-1250} />);

    expect(screen.getByText('−1.250 un.').textContent).not.toContain('-');
  });

  it('omite a unidade quando pedido (KPI)', () => {
    render(<Delta value={124} unit={false} />);

    expect(screen.getByText('+124')).toBeInTheDocument();
  });

  it('com tendência, mostra a seta como reforço decorativo', () => {
    const { container } = render(<Delta value={124} unit={false} trend />);

    const arrow = container.querySelector('[aria-hidden="true"]');
    expect(arrow).toHaveTextContent('↗');
    expect(container).toHaveTextContent('+124');
  });

  it('sem valor (ajuste legado sem antes/depois) mostra "—", nunca um zero inventado', () => {
    render(<Delta value={null} />);

    expect(screen.getByText('—')).toBeInTheDocument();
    expect(screen.getByText('variação não registrada')).toHaveClass('sr-only');
  });
});

describe('BalanceFlow', () => {
  it('mostra "antes → depois" e diz a transição em palavras para o leitor de tela', () => {
    const { container } = render(<BalanceFlow previous={20} next={15} />);

    expect(container.querySelector('[aria-hidden="true"]')).toHaveTextContent('20 → 15');
    expect(screen.getByText('de 20 para 15')).toHaveClass('sr-only');
  });

  it('sem saldo anterior (estoque inicial) mostra "—", não zero', () => {
    const { container } = render(<BalanceFlow previous={null} next={50} />);

    expect(container.querySelector('[aria-hidden="true"]')).toHaveTextContent('— → 50');
    expect(screen.getByText('sem saldo anterior, saldo final 50')).toHaveClass('sr-only');
  });

  it('sem saldo final (legado) mostra "—" nos dois lados', () => {
    const { container } = render(<BalanceFlow previous={null} next={null} />);

    expect(container).toHaveTextContent('—');
    expect(screen.getByText('saldos não registrados')).toHaveClass('sr-only');
  });
});
