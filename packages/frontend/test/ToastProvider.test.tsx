import { act, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { ToastProvider, useToast } from '../src/components/ui/ToastProvider';

function Trigger({ type }: { type: 'success' | 'error' | 'info' }) {
  const { show } = useToast();
  return (
    <button type="button" onClick={() => show({ type, message: `mensagem ${type}` })}>
      disparar
    </button>
  );
}

describe('ToastProvider', () => {
  it('expõe uma região viva polida para toasts não-críticos', async () => {
    const user = userEvent.setup();
    render(
      <ToastProvider>
        <Trigger type="success" />
      </ToastProvider>,
    );

    const region = screen.getByRole('status');
    expect(region).toHaveAttribute('aria-live', 'polite');

    await user.click(screen.getByRole('button', { name: 'disparar' }));

    expect(region).toHaveTextContent('mensagem success');
  });

  it('anuncia toasts de erro de forma assertiva via role="alert"', async () => {
    const user = userEvent.setup();
    render(
      <ToastProvider>
        <Trigger type="error" />
      </ToastProvider>,
    );

    const alertRegion = screen.getByRole('alert');
    expect(alertRegion).toHaveAttribute('aria-live', 'assertive');

    await user.click(screen.getByRole('button', { name: 'disparar' }));

    expect(alertRegion).toHaveTextContent('mensagem error');
    // Erro NÃO deve cair também na região polida (evita anúncio duplicado)
    expect(screen.getByRole('status')).not.toHaveTextContent('mensagem error');
  });

  it('o botão de fechar do toast tem nome acessível associado à mensagem', async () => {
    const user = userEvent.setup();
    render(
      <ToastProvider>
        <Trigger type="info" />
      </ToastProvider>,
    );

    await user.click(screen.getByRole('button', { name: 'disparar' }));

    const close = screen.getByRole('button', { name: /fechar notificação/i });
    await user.click(close);

    expect(screen.getByRole('status')).not.toHaveTextContent('mensagem info');
  });

  describe('dispensa automática por tipo (A-11)', () => {
    afterEach(() => {
      vi.useRealTimers();
    });

    it('toast de erro permanece após o tempo padrão de dispensa e é dispensável manualmente', () => {
      vi.useFakeTimers();
      render(
        <ToastProvider>
          <Trigger type="error" />
        </ToastProvider>,
      );

      fireEvent.click(screen.getByRole('button', { name: 'disparar' }));
      expect(screen.getByRole('alert')).toHaveTextContent('mensagem error');

      act(() => {
        vi.advanceTimersByTime(10_000);
      });
      // Bem além do durationMs padrão (3500ms) — o erro continua visível.
      expect(screen.getByRole('alert')).toHaveTextContent('mensagem error');

      const close = screen.getByRole('button', { name: /fechar notificação/i });
      fireEvent.click(close);
      expect(screen.getByRole('alert')).not.toHaveTextContent('mensagem error');
    });

    it('toast de sucesso continua se dispensando sozinho após o tempo padrão', () => {
      vi.useFakeTimers();
      render(
        <ToastProvider>
          <Trigger type="success" />
        </ToastProvider>,
      );

      fireEvent.click(screen.getByRole('button', { name: 'disparar' }));
      expect(screen.getByRole('status')).toHaveTextContent('mensagem success');

      act(() => {
        vi.advanceTimersByTime(4000);
      });
      expect(screen.getByRole('status')).not.toHaveTextContent('mensagem success');
    });
  });
});
