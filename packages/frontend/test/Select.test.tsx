import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import Select from '../src/components/ui/Select';

/**
 * `Select` — mesmo contrato de `Input` (Task 6): estados, contraste de
 * contorno e nome acessível obrigatório.
 */

const options = [{ label: 'Opção A', value: 'a' }];

describe('Select — estado disabled', () => {
  it('campo desabilitado é comunicado ao usuário', () => {
    render(<Select label="Categoria" options={options} disabled />);

    const select = screen.getByLabelText('Categoria');
    expect(select).toBeDisabled();
  });
});

describe('Select — erro associado ao campo (§11.0)', () => {
  it('aria-invalid e aria-describedby apontam para a mensagem, sem role="alert" por campo', () => {
    render(<Select label="Categoria" options={options} error="Selecione uma opção" />);

    const select = screen.getByLabelText('Categoria');
    expect(select).toHaveAttribute('aria-invalid', 'true');

    const describedBy = select.getAttribute('aria-describedby');
    expect(describedBy).toBeTruthy();
    const message = document.getElementById(describedBy!.split(' ')[0]);
    expect(message).toHaveTextContent('Selecione uma opção');
    expect(message).not.toHaveAttribute('role', 'alert');
  });
});

describe('Select — nome acessível (aria-label como alternativa ao label)', () => {
  it('aceita aria-label no lugar de label', () => {
    render(<Select aria-label="Categoria" options={options} />);

    expect(screen.getByLabelText('Categoria')).toBeInTheDocument();
  });
});
