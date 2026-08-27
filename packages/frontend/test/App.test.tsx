import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import App from '../src/App';
import { useAuth } from '../src/auth/AuthContext';

vi.mock('../src/auth/AuthContext', () => ({ useAuth: vi.fn() }));
vi.mock('../src/components/ProductDashboard', () => ({
  __esModule: true,
  default: () => <div>dashboard</div>,
  ProductDashboard: () => <div>dashboard</div>,
}));
vi.mock('../src/components/ui/ApiStatusBanner', () => ({
  __esModule: true,
  default: () => null,
}));

const mockedUseAuth = vi.mocked(useAuth);

describe('App', () => {
  it('oferece um skip link como primeiro foco tabulável, apontando para o conteúdo principal', () => {
    mockedUseAuth.mockReturnValue({
      user: { id: '1', email: 'a@b.c' },
      status: 'authenticated',
      login: vi.fn(),
      logout: vi.fn(),
    } as unknown as ReturnType<typeof useAuth>);

    const { container } = render(<App />);

    const skip = screen.getByRole('link', { name: /pular para o conteúdo principal/i });
    expect(skip).toHaveAttribute('href', '#main-content');

    // Deve ser o primeiro elemento focável do documento.
    const focusables = container.querySelectorAll('a[href], button, input, select, textarea');
    expect(focusables[0]).toBe(skip);

    const main = document.getElementById('main-content');
    expect(main).not.toBeNull();
    expect(main).toHaveAttribute('tabindex', '-1');
  });
});
