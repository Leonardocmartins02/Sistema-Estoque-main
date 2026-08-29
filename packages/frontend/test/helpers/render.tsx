import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render } from '@testing-library/react';
import type { ReactNode } from 'react';
import { vi } from 'vitest';

import { ToastProvider } from '../../src/components/ui/ToastProvider';

/**
 * Providers reais usados pela aplicação (`main.tsx`): React Query + Toast.
 *
 * `retry: false` porque um teste que espera um erro não deve pagar o backoff
 * do React Query; o resto do comportamento é o de produção.
 */
export function renderWithProviders(ui: ReactNode) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });

  const result = render(
    <QueryClientProvider client={client}>
      <ToastProvider>{ui}</ToastProvider>
    </QueryClientProvider>,
  );

  return { ...result, client };
}

/**
 * As sete ações que a tabela e os cards disparam no container, todas
 * espionadas. Os testes de apresentação afirmam *qual* callback recebeu *qual*
 * produto — a fiação é o que a migração visual quebra em silêncio.
 */
export function makeSpyActions() {
  return {
    onMove: vi.fn(),
    onQuickOut: vi.fn(),
    onEdit: vi.fn(),
    onHistory: vi.fn(),
    onAdjust: vi.fn(),
    onZeroBalance: vi.fn(),
    onDelete: vi.fn(),
  };
}
