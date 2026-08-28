import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { apiFetch } from '../src/api/httpClient';
import { AuthProvider, useAuth } from '../src/auth/AuthContext';
import { ToastProvider } from '../src/components/ui/ToastProvider';

const TOKEN_STORAGE_KEY = 'simplestock.auth.token';

function jsonResponse(status: number, body: unknown) {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
}

/**
 * Simula uma ação em andamento (ex.: submit de um formulário/modal aberto)
 * que faz uma chamada de API — é essa chamada que pode voltar 401.
 */
function ActionProbe() {
  const { status } = useAuth();
  const run = async (path = '/quick-out') => {
    try {
      await apiFetch(path, { method: 'POST', body: '{}' });
    } catch {
      // A tela que dispara a ação real já mostra seu próprio erro (F-07);
      // aqui só precisamos que a chamada aconteça.
    }
  };
  return (
    <div>
      <span data-testid="auth-status">{status}</span>
      <button type="button" onClick={() => run('/quick-out')}>
        Disparar ação (401)
      </button>
      <button type="button" onClick={() => run('/other-401')}>
        Disparar outra ação (401)
      </button>
      <button type="button" onClick={() => run('/broken')}>
        Disparar ação (500)
      </button>
    </div>
  );
}

function renderApp() {
  return render(
    <ToastProvider>
      <AuthProvider>
        <ActionProbe />
      </AuthProvider>
    </ToastProvider>,
  );
}

describe('AuthContext — expiração de sessão avisa o usuário (UF-04)', () => {
  beforeEach(() => {
    localStorage.setItem(TOKEN_STORAGE_KEY, 'token-válido-no-boot');
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    localStorage.clear();
  });

  it('desloga e avisa quando uma ação em andamento recebe 401', async () => {
    const fetchMock = vi.fn().mockImplementation((url: string) => {
      if (url.endsWith('/auth/me')) {
        return Promise.resolve(jsonResponse(200, { user: { id: 'u1', email: 'a@b.com' } }));
      }
      return Promise.resolve(jsonResponse(401, { message: 'Token inválido ou expirado.' }));
    });
    vi.stubGlobal('fetch', fetchMock);

    const user = userEvent.setup();
    renderApp();

    await waitFor(() => expect(screen.getByTestId('auth-status')).toHaveTextContent('authenticated'));

    await user.click(screen.getByRole('button', { name: 'Disparar ação (401)' }));

    // Comportamento de segurança que já existe hoje e precisa continuar:
    // a sessão é derrubada.
    await waitFor(() => expect(screen.getByTestId('auth-status')).toHaveTextContent('unauthenticated'));

    // O que falta hoje: uma mensagem explícita de expiração, não silêncio.
    expect(await screen.findByRole('alert')).toHaveTextContent(/sessão expirou/i);
  });

  it('não mostra "sessão expirou" para um erro que não é 401', async () => {
    const fetchMock = vi.fn().mockImplementation((url: string) => {
      if (url.endsWith('/auth/me')) {
        return Promise.resolve(jsonResponse(200, { user: { id: 'u1', email: 'a@b.com' } }));
      }
      return Promise.resolve(jsonResponse(500, { message: 'Erro interno do servidor.' }));
    });
    vi.stubGlobal('fetch', fetchMock);

    const user = userEvent.setup();
    renderApp();

    await waitFor(() => expect(screen.getByTestId('auth-status')).toHaveTextContent('authenticated'));

    await user.click(screen.getByRole('button', { name: 'Disparar ação (500)' }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    expect(screen.getByTestId('auth-status')).toHaveTextContent('authenticated');
    expect(screen.queryByText(/sessão expirou/i)).not.toBeInTheDocument();
  });

  it('não duplica o aviso quando duas chamadas em voo recebem 401 quase juntas', async () => {
    const fetchMock = vi.fn().mockImplementation((url: string) => {
      if (url.endsWith('/auth/me')) {
        return Promise.resolve(jsonResponse(200, { user: { id: 'u1', email: 'a@b.com' } }));
      }
      return Promise.resolve(jsonResponse(401, { message: 'Token inválido ou expirado.' }));
    });
    vi.stubGlobal('fetch', fetchMock);

    const user = userEvent.setup();
    renderApp();

    await waitFor(() => expect(screen.getByTestId('auth-status')).toHaveTextContent('authenticated'));

    await user.click(screen.getByRole('button', { name: 'Disparar ação (401)' }));
    await user.click(screen.getByRole('button', { name: 'Disparar outra ação (401)' }));

    await waitFor(() => expect(screen.getByTestId('auth-status')).toHaveTextContent('unauthenticated'));
    await screen.findByRole('alert');

    expect(screen.getAllByText(/sessão expirou/i)).toHaveLength(1);
  });
});
