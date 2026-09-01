import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ApiRequestError } from '../src/api/httpClient';
import { useAuth } from '../src/auth/AuthContext';
import { LoginPage } from '../src/components/LoginPage';

vi.mock('../src/auth/AuthContext', () => ({
  useAuth: vi.fn(),
}));

const mockedUseAuth = vi.mocked(useAuth);

describe('LoginPage', () => {
  beforeEach(() => {
    mockedUseAuth.mockReset();
  });

  it('mostra erros de validação quando o formulário é enviado vazio', async () => {
    mockedUseAuth.mockReturnValue({ user: null, status: 'unauthenticated', login: vi.fn(), logout: vi.fn() });
    const user = userEvent.setup();
    render(<LoginPage />);

    await user.click(screen.getByRole('button', { name: 'Entrar' }));

    expect(await screen.findByText('Informe o e-mail')).toBeInTheDocument();
    expect(await screen.findByText('Informe a senha')).toBeInTheDocument();
  });

  it('chama login com e-mail e senha informados', async () => {
    const login = vi.fn().mockResolvedValue(undefined);
    mockedUseAuth.mockReturnValue({ user: null, status: 'unauthenticated', login, logout: vi.fn() });
    const user = userEvent.setup();
    render(<LoginPage />);

    await user.type(screen.getByLabelText('E-mail'), 'admin@simplestock.local');
    await user.type(screen.getByLabelText('Senha'), 'senha-123');
    await user.click(screen.getByRole('button', { name: 'Entrar' }));

    await waitFor(() => expect(login).toHaveBeenCalledWith('admin@simplestock.local', 'senha-123'));
  });

  it('mostra a mensagem de erro do servidor quando o login falha', async () => {
    const login = vi.fn().mockRejectedValue(new ApiRequestError(401, 'E-mail ou senha inválidos.'));
    mockedUseAuth.mockReturnValue({ user: null, status: 'unauthenticated', login, logout: vi.fn() });
    const user = userEvent.setup();
    render(<LoginPage />);

    await user.type(screen.getByLabelText('E-mail'), 'admin@simplestock.local');
    await user.type(screen.getByLabelText('Senha'), 'senha-errada');
    await user.click(screen.getByRole('button', { name: 'Entrar' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('E-mail ou senha inválidos.');
  });

  it('durante o envio, o botão "Entrar" fica aria-disabled/aria-busy mas continua focável, e uma segunda ativação não gera uma segunda chamada a login (Task 5)', async () => {
    let resolveLogin: () => void = () => {};
    const login = vi.fn().mockImplementation(
      () => new Promise<void>((resolve) => { resolveLogin = resolve; }),
    );
    mockedUseAuth.mockReturnValue({ user: null, status: 'unauthenticated', login, logout: vi.fn() });
    const user = userEvent.setup();
    render(<LoginPage />);

    await user.type(screen.getByLabelText('E-mail'), 'admin@simplestock.local');
    await user.type(screen.getByLabelText('Senha'), 'senha-123');
    await user.click(screen.getByRole('button', { name: 'Entrar' }));

    await waitFor(() => expect(login).toHaveBeenCalledTimes(1));

    const button = screen.getByRole('button', { name: 'Entrar' });
    expect(button).toHaveAttribute('aria-disabled', 'true');
    expect(button).toHaveAttribute('aria-busy', 'true');
    // `isSubmitting` é estado pendente do react-hook-form, não invalidez —
    // não deve usar o atributo `disabled` nativo (design-system.md §11.2):
    // isso tiraria o foco do botão recém-acionado.
    expect(button).not.toBeDisabled();
    button.focus();
    expect(button).toHaveFocus();

    // Uma segunda ativação durante o envio não deve gerar uma segunda chamada.
    await user.click(button);
    expect(login).toHaveBeenCalledTimes(1);

    resolveLogin();
    await waitFor(() => expect(button).not.toHaveAttribute('aria-busy', 'true'));
  });
});
