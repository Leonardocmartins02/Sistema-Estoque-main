import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import MenuPopover, { MenuItem, MenuItemCheckbox } from '../src/components/ui/MenuPopover';

function Harness({ onEdit = vi.fn(), onDelete = vi.fn() }: { onEdit?: () => void; onDelete?: () => void }) {
  return (
    <MenuPopover triggerLabel="Mais ações" triggerContent={<span aria-hidden="true">…</span>} menuLabel="Ações">
      {() => (
        <>
          <MenuItem onSelect={onEdit}>Editar</MenuItem>
          <MenuItem onSelect={onDelete} disabled>
            Excluir
          </MenuItem>
          <MenuItem onSelect={() => {}}>Ver Histórico</MenuItem>
        </>
      )}
    </MenuPopover>
  );
}

describe('MenuPopover (padrão WAI-ARIA de menu)', () => {
  it('o gatilho declara aria-haspopup e reflete aria-expanded', async () => {
    const user = userEvent.setup();
    render(<Harness />);

    const trigger = screen.getByRole('button', { name: 'Mais ações' });
    expect(trigger).toHaveAttribute('aria-haspopup', 'menu');
    expect(trigger).toHaveAttribute('aria-expanded', 'false');

    await user.click(trigger);
    expect(trigger).toHaveAttribute('aria-expanded', 'true');
  });

  it('os itens têm role=menuitem e o primeiro habilitado recebe foco ao abrir', async () => {
    const user = userEvent.setup();
    render(<Harness />);

    await user.click(screen.getByRole('button', { name: 'Mais ações' }));

    const menu = await screen.findByRole('menu', { name: 'Ações' });
    const items = screen.getAllByRole('menuitem');
    expect(items).toHaveLength(3);
    expect(menu).toContainElement(items[0]);
    await waitFor(() => expect(items[0]).toHaveFocus());
  });

  it('navega entre itens com as setas, pulando desabilitados, e faz wrap', async () => {
    const user = userEvent.setup();
    render(<Harness />);

    await user.click(screen.getByRole('button', { name: 'Mais ações' }));
    const items = await screen.findAllByRole('menuitem');
    await waitFor(() => expect(items[0]).toHaveFocus());

    await user.keyboard('{ArrowDown}');
    expect(items[2]).toHaveFocus(); // item 1 está desabilitado

    await user.keyboard('{ArrowDown}');
    expect(items[0]).toHaveFocus(); // wrap

    await user.keyboard('{ArrowUp}');
    expect(items[2]).toHaveFocus();

    await user.keyboard('{Home}');
    expect(items[0]).toHaveFocus();

    await user.keyboard('{End}');
    expect(items[2]).toHaveFocus();
  });

  it('aciona o item com Enter e fecha o menu', async () => {
    const onEdit = vi.fn();
    const user = userEvent.setup();
    render(<Harness onEdit={onEdit} />);

    await user.click(screen.getByRole('button', { name: 'Mais ações' }));
    await screen.findByRole('menu');
    await user.keyboard('{Enter}');

    expect(onEdit).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(screen.queryByRole('menu')).not.toBeInTheDocument());
  });

  it('fecha com Escape e devolve o foco ao gatilho', async () => {
    const user = userEvent.setup();
    render(<Harness />);

    const trigger = screen.getByRole('button', { name: 'Mais ações' });
    await user.click(trigger);
    await screen.findByRole('menu');

    await user.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByRole('menu')).not.toBeInTheDocument());
    await waitFor(() => expect(trigger).toHaveFocus());
  });

  it('abre pelo teclado com ArrowDown no gatilho', async () => {
    const user = userEvent.setup();
    render(<Harness />);

    screen.getByRole('button', { name: 'Mais ações' }).focus();
    await user.keyboard('{ArrowDown}');

    expect(await screen.findByRole('menu')).toBeInTheDocument();
  });

  it('suporta itens de múltipla escolha com role=menuitemcheckbox e aria-checked', async () => {
    const onToggle = vi.fn();
    const user = userEvent.setup();
    render(
      <MenuPopover triggerLabel="Status" triggerContent="Status" menuLabel="Filtrar status">
        {() => (
          <>
            <MenuItemCheckbox checked onSelect={onToggle}>
              OK
            </MenuItemCheckbox>
            <MenuItemCheckbox checked={false} onSelect={onToggle}>
              Em falta
            </MenuItemCheckbox>
          </>
        )}
      </MenuPopover>,
    );

    await user.click(screen.getByRole('button', { name: 'Status' }));
    const boxes = await screen.findAllByRole('menuitemcheckbox');
    expect(boxes[0]).toHaveAttribute('aria-checked', 'true');
    expect(boxes[1]).toHaveAttribute('aria-checked', 'false');

    await user.keyboard('{ }');
    expect(onToggle).toHaveBeenCalled();
    // Itens de checkbox NÃO fecham o menu (permite múltipla seleção)
    expect(screen.getByRole('menu')).toBeInTheDocument();
  });
});
