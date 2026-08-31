import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import Button from '../src/components/ui/Button';

/**
 * `Button` — níveis de ação, dois tamanhos e `loading` acessível
 * (`implementation-plan.md`, Task 5; `design-system.md` §9, §10, §11.2).
 */

describe('Button — estado loading (design-system.md §11.2)', () => {
  it('expõe aria-busy e continua focável, sem usar o atributo disabled', async () => {
    render(<Button isLoading>Lançar</Button>);

    const button = screen.getByRole('button', { name: 'Lançar' });
    expect(button).toHaveAttribute('aria-busy', 'true');
    expect(button).toHaveAttribute('aria-disabled', 'true');
    expect(button).not.toBeDisabled();

    button.focus();
    expect(button).toHaveFocus();
  });

  it('não dispara onClick por clique enquanto carrega', async () => {
    const onClick = vi.fn();
    const user = userEvent.setup();
    render(
      <Button isLoading onClick={onClick}>
        Lançar
      </Button>,
    );

    await user.click(screen.getByRole('button', { name: 'Lançar' }));

    expect(onClick).not.toHaveBeenCalled();
  });

  it('nem clique nem Enter disparam uma segunda ativação durante o envio', async () => {
    const onClick = vi.fn();
    const user = userEvent.setup();
    render(
      <Button isLoading onClick={onClick}>
        Lançar
      </Button>,
    );

    const button = screen.getByRole('button', { name: 'Lançar' });
    await user.click(button);
    button.focus();
    await user.keyboard('{Enter}');
    await user.click(button);

    expect(onClick).not.toHaveBeenCalled();
  });
});

describe('Button — disabled (motivo "inválido")', () => {
  it('não é focável', () => {
    render(<Button disabled>Confirmar</Button>);

    const button = screen.getByRole('button', { name: 'Confirmar' });
    button.focus();
    expect(button).not.toHaveFocus();
  });

  it('não dispara onClick', async () => {
    const onClick = vi.fn();
    const user = userEvent.setup();
    render(
      <Button disabled onClick={onClick}>
        Confirmar
      </Button>,
    );

    await user.click(screen.getByRole('button', { name: 'Confirmar' }));

    expect(onClick).not.toHaveBeenCalled();
  });
});

describe('Button — tamanhos (design-system.md §10.3)', () => {
  it('aceita exatamente dois tamanhos: sm e md', () => {
    render(
      <>
        <Button size="sm">Pequeno</Button>
        <Button size="md">Médio</Button>
      </>,
    );

    expect(screen.getByRole('button', { name: 'Pequeno' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Médio' })).toBeInTheDocument();
  });
});

describe('Button — variantes (design-system.md §10.1)', () => {
  it('aceita ghost como alias de tertiary sem quebrar a renderização', () => {
    render(
      <>
        <Button variant="tertiary">Tertiary</Button>
        <Button variant="ghost">Ghost</Button>
      </>,
    );

    expect(screen.getByRole('button', { name: 'Tertiary' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Ghost' })).toBeInTheDocument();
  });

  it('aceita a variante shortcut (SPECIALIZED SHORTCUT)', () => {
    render(<Button variant="shortcut">Baixa rápida</Button>);

    expect(screen.getByRole('button', { name: 'Baixa rápida' })).toBeInTheDocument();
  });
});
