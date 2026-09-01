import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';

import Modal from '../src/components/ui/Modal';

function Harness({ title = 'Título A' }: { title?: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)}>
        abrir
      </button>
      <Modal open={open} onClose={() => setOpen(false)} title={title} description="Uma descrição">
        <input aria-label="campo" />
      </Modal>
    </>
  );
}

describe('Modal (primitivo único do design system)', () => {
  it('expõe role=dialog modal rotulado pelo título', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.click(screen.getByRole('button', { name: 'abrir' }));

    const dialog = await screen.findByRole('dialog');
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(dialog).toHaveAccessibleName('Título A');
    expect(dialog).toHaveAccessibleDescription('Uma descrição');
  });

  it('gera ids únicos por instância (nunca "modal-title" hardcoded)', async () => {
    render(
      <>
        <Modal open onClose={() => {}} title="Primeiro" description="Desc 1">
          conteúdo 1
        </Modal>
        <Modal open onClose={() => {}} title="Segundo" description="Desc 2">
          conteúdo 2
        </Modal>
      </>,
    );

    // Consulta direta no DOM: com dois diálogos modais montados, o de baixo fica
    // `aria-hidden` e sairia de `getAllByRole` — mas os ids precisam ser únicos
    // no documento de qualquer forma.
    await waitFor(() => expect(document.querySelectorAll('[role="dialog"]').length).toBe(2));
    const dialogs = Array.from(document.querySelectorAll('[role="dialog"]'));
    const labelIds = dialogs.map((d) => d.getAttribute('aria-labelledby'));
    const descIds = dialogs.map((d) => d.getAttribute('aria-describedby'));

    expect(labelIds[0]).toBeTruthy();
    expect(labelIds[0]).not.toBe('modal-title');
    expect(labelIds[0]).not.toBe(labelIds[1]);
    expect(descIds[0]).toBeTruthy();
    expect(descIds[0]).not.toBe('modal-desc');
    expect(descIds[0]).not.toBe(descIds[1]);
    expect(document.querySelectorAll('#modal-title, #modal-desc')).toHaveLength(0);
  });

  it('move o foco para dentro do diálogo ao abrir e o devolve ao gatilho ao fechar', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    const trigger = screen.getByRole('button', { name: 'abrir' });
    await user.click(trigger);

    const dialog = await screen.findByRole('dialog');
    await waitFor(() => expect(dialog.contains(document.activeElement)).toBe(true));

    await user.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    await waitFor(() => expect(trigger).toHaveFocus());
  });

  it('fecha ao pressionar Escape chamando onClose', async () => {
    const onClose = vi.fn();
    const user = userEvent.setup();
    render(
      <Modal open onClose={onClose} title="X">
        <button type="button">interno</button>
      </Modal>,
    );

    await user.keyboard('{Escape}');
    await waitFor(() => expect(onClose).toHaveBeenCalled());
  });

  it('o botão fechar tem nome acessível "Fechar" e conteúdo gráfico decorativo (achado REV-19: não acopla ao caractere)', async () => {
    render(
      <Modal open onClose={() => {}} title="X">
        conteúdo
      </Modal>,
    );

    const close = await screen.findByRole('button', { name: 'Fechar' });
    const glyph = close.querySelector('[aria-hidden="true"]');
    expect(glyph).not.toBeNull();
  });

  it('variante sheet preserva role=dialog, aria-modal, focus trap e retorno de foco', async () => {
    const user = userEvent.setup();
    function SheetHarness() {
      const [open, setOpen] = useState(false);
      return (
        <>
          <button type="button" onClick={() => setOpen(true)}>
            abrir sheet
          </button>
          <Modal open={open} onClose={() => setOpen(false)} title="Ordenar" variant="sheet">
            <button type="button">opção</button>
          </Modal>
        </>
      );
    }
    render(<SheetHarness />);
    const trigger = screen.getByRole('button', { name: 'abrir sheet' });
    await user.click(trigger);

    const dialog = await screen.findByRole('dialog');
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    await waitFor(() => expect(dialog.contains(document.activeElement)).toBe(true));

    await user.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    await waitFor(() => expect(trigger).toHaveFocus());
  });

  it('não renderiza nada quando open=false', () => {
    render(
      <Modal open={false} onClose={() => {}} title="X">
        conteúdo
      </Modal>,
    );
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});
