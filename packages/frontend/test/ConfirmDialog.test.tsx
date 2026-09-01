import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import ConfirmDialog from '../src/components/ui/ConfirmDialog';
import { useConfirm } from '../src/hooks/useConfirm';

describe('ConfirmDialog', () => {
  it('é um diálogo acessível com título, descrição e ações rotuladas', async () => {
    render(
      <ConfirmDialog
        open
        title="Excluir produto Caneta?"
        description="Esta ação não pode ser desfeita."
        confirmLabel="Excluir"
        onConfirm={() => {}}
        onCancel={() => {}}
      />,
    );

    const dialog = await screen.findByRole('dialog');
    expect(dialog).toHaveAccessibleName('Excluir produto Caneta?');
    expect(dialog).toHaveAccessibleDescription('Esta ação não pode ser desfeita.');
    expect(screen.getByRole('button', { name: 'Excluir' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Cancelar' })).toBeInTheDocument();
  });

  it('não repete uma frase genérica no corpo (M-14)', async () => {
    render(
      <ConfirmDialog
        open
        title="Excluir produto Caneta?"
        description="Esta ação não pode ser desfeita."
        confirmLabel="Excluir"
        onConfirm={() => {}}
        onCancel={() => {}}
      />,
    );

    await screen.findByRole('dialog');
    expect(
      screen.queryByText('Confirme para continuar. Esta ação afeta os dados do estoque.'),
    ).not.toBeInTheDocument();
  });

  it('chama onConfirm ao confirmar e onCancel ao cancelar', async () => {
    const onConfirm = vi.fn();
    const onCancel = vi.fn();
    const user = userEvent.setup();

    const { rerender } = render(
      <ConfirmDialog open title="T" description="D" onConfirm={onConfirm} onCancel={onCancel} />,
    );
    await user.click(await screen.findByRole('button', { name: 'Confirmar' }));
    expect(onConfirm).toHaveBeenCalledTimes(1);

    rerender(<ConfirmDialog open title="T" description="D" onConfirm={onConfirm} onCancel={onCancel} />);
    await user.click(screen.getByRole('button', { name: 'Cancelar' }));
    expect(onCancel).toHaveBeenCalledTimes(1);
  });
});

function Harness() {
  const { confirm, confirmDialog } = useConfirm();
  return (
    <>
      <button
        type="button"
        onClick={async () => {
          const ok = await confirm({ title: 'Zerar saldo?', description: 'Lança uma saída.', confirmLabel: 'Zerar' });
          if (ok) document.title = 'confirmado';
          else document.title = 'cancelado';
        }}
      >
        acionar
      </button>
      {confirmDialog}
    </>
  );
}

describe('useConfirm', () => {
  it('resolve true ao confirmar (substitui window.confirm)', async () => {
    const user = userEvent.setup();
    render(<Harness />);

    await user.click(screen.getByRole('button', { name: 'acionar' }));
    await user.click(await screen.findByRole('button', { name: 'Zerar' }));

    await waitFor(() => expect(document.title).toBe('confirmado'));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  });

  it('resolve false ao cancelar', async () => {
    const user = userEvent.setup();
    render(<Harness />);

    await user.click(screen.getByRole('button', { name: 'acionar' }));
    await user.click(await screen.findByRole('button', { name: 'Cancelar' }));

    await waitFor(() => expect(document.title).toBe('cancelado'));
  });

  it('resolve false ao fechar com Escape', async () => {
    const user = userEvent.setup();
    render(<Harness />);

    await user.click(screen.getByRole('button', { name: 'acionar' }));
    await screen.findByRole('dialog');
    await user.keyboard('{Escape}');

    await waitFor(() => expect(document.title).toBe('cancelado'));
  });
});
