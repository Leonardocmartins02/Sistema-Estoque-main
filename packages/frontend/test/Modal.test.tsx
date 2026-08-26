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
    // O Radix aplica `pointer-events: none` no body enquanto um modal está
    // aberto; em jsdom isso bloqueia o clique simulado no segundo gatilho.
    const user = userEvent.setup({ pointerEventsCheck: 0 });
    render(
      <>
        <Harness title="Primeiro" />
        <Harness title="Segundo" />
      </>,
    );

    const [abrirA, abrirB] = screen.getAllByRole('button', { name: 'abrir' });
    await user.click(abrirA);
    await user.click(abrirB);

    // Consulta direta no DOM: com dois diálogos modais montados, o de baixo fica
    // `aria-hidden` e sairia de `getAllByRole` — mas os ids precisam ser únicos
    // no documento de qualquer forma.
    await waitFor(() => expect(document.querySelectorAll('[role="dialog"]').length).toBe(2));
    const dialogs = Array.from(document.querySelectorAll('[role="dialog"]'));
    const ids = dialogs.map((d) => d.getAttribute('aria-labelledby'));
    expect(ids[0]).toBeTruthy();
    expect(ids[0]).not.toBe('modal-title');
    expect(ids[0]).not.toBe(ids[1]);
    expect(document.querySelectorAll('#modal-title').length).toBe(0);
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

  it('o glifo do botão fechar é decorativo (aria-hidden) e o botão tem nome acessível', async () => {
    render(
      <Modal open onClose={() => {}} title="X">
        conteúdo
      </Modal>,
    );

    const close = await screen.findByRole('button', { name: 'Fechar' });
    const glyph = close.querySelector('[aria-hidden="true"]');
    expect(glyph).not.toBeNull();
    expect(glyph?.textContent).toBe('✕');
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
