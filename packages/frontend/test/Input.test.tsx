import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import Input from '../src/components/ui/Input';

/**
 * `Input` — estados, contraste de contorno e nome acessível obrigatório
 * (`implementation-plan.md`, Task 6; `design-system.md` §3.4, §11, §11.0, §11.1).
 */

describe('Input — estado disabled (M-9)', () => {
  it('campo desabilitado é comunicado ao usuário', () => {
    render(<Input label="Nome" disabled />);

    const input = screen.getByLabelText('Nome');
    expect(input).toBeDisabled();
  });
});

describe('Input — erro associado ao campo (§11.0 / dívida A6)', () => {
  it('aria-invalid e aria-describedby apontam para a mensagem, sem role="alert" por campo', () => {
    render(<Input label="E-mail" error="E-mail inválido" />);

    const input = screen.getByLabelText('E-mail');
    expect(input).toHaveAttribute('aria-invalid', 'true');

    const describedBy = input.getAttribute('aria-describedby');
    expect(describedBy).toBeTruthy();
    const message = document.getElementById(describedBy!.split(' ')[0]);
    expect(message).toHaveTextContent('E-mail inválido');
    expect(message).not.toHaveAttribute('role', 'alert');
  });
});

describe('Input — nome acessível (aria-label como alternativa ao label)', () => {
  it('aceita aria-label no lugar de label', () => {
    render(<Input aria-label="Quantidade" />);

    expect(screen.getByLabelText('Quantidade')).toBeInTheDocument();
  });
});
