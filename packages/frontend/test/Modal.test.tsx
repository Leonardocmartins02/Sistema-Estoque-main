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

/**
 * Empilhamento — a pilha de diálogos abertos do primitivo.
 *
 * O primitivo mantém uma pilha module-level e aplica `aria-hidden` na camada
 * que não é o topo. Ela existe porque o `hideOthers()` que o Radix usa
 * (pacote `aria-hidden`) **preserva de propósito** todo nó `[aria-live]` e
 * seus ancestrais: um diálogo que contenha live region montada nunca é
 * ocultado pelo que abre por cima, e sobram dois `aria-modal` expostos.
 *
 * **Por que alguns casos aqui usam live region e outros não.** Sem
 * `[aria-live]` o Radix já oculta a camada de baixo sozinho — um teste de
 * empilhamento com modais "pelados" passaria com ou sem a pilha, e não
 * protegeria o código que a introduziu. Por isso o caso dos três modais liga
 * `live`: ali o `hideOthers()` preserva os três e **só a pilha** governa a
 * exposição. Os casos de lifecycle fazem o contrário — caçam `aria-hidden`
 * indevido vindo de pilha suja, que é justamente o risco que a pilha traz.
 */
function StackHarness({
  a = false,
  b = false,
  c = false,
  mountA = true,
  mountB = true,
  live = false,
}: {
  a?: boolean;
  b?: boolean;
  c?: boolean;
  mountA?: boolean;
  mountB?: boolean;
  live?: boolean;
}) {
  const corpo = (id: string) => (
    <>
      conteúdo {id}
      {/* Réplica do que 5 dos 9 consumidores reais de `ui/Modal` têm dentro. */}
      {live && <div role="status" aria-live="polite" data-testid={`live-${id}`} />}
    </>
  );
  return (
    <>
      {mountA && (
        <Modal open={a} onClose={() => {}} title="A">
          {corpo('A')}
        </Modal>
      )}
      {mountB && (
        <Modal open={b} onClose={() => {}} title="B">
          {corpo('B')}
        </Modal>
      )}
      <Modal open={c} onClose={() => {}} title="C">
        {corpo('C')}
      </Modal>
    </>
  );
}

/**
 * O diálogo coberto sai das queries por papel — que é exatamente o efeito sob
 * teste. A busca aqui é no DOM cru, casando pelo nó de `aria-labelledby`.
 */
function dialogoPorTitulo(titulo: string): HTMLElement {
  const encontrado = Array.from(
    document.querySelectorAll<HTMLElement>('[role="dialog"]'),
  ).find((d) => {
    const id = d.getAttribute('aria-labelledby');
    return (id ? document.getElementById(id)?.textContent?.trim() : null) === titulo;
  });
  if (!encontrado) throw new Error(`Diálogo "${titulo}" não está montado no DOM`);
  return encontrado;
}

function estaMontado(titulo: string): boolean {
  try {
    dialogoPorTitulo(titulo);
    return true;
  } catch {
    return false;
  }
}

/** Nomes acessíveis dos diálogos que sobrevivem à árvore de acessibilidade. */
function expostos(): string[] {
  return screen.queryAllByRole('dialog').map((d) => {
    const id = d.getAttribute('aria-labelledby');
    return (id ? document.getElementById(id)?.textContent?.trim() : '') ?? '';
  });
}

describe('Modal — pilha de diálogos empilhados', () => {
  it('desmontar um Modal ainda aberto não deixa entrada fantasma na pilha', async () => {
    // `ProductDashboard` monta quatro diálogos como `{produto && <Modal open …/>}`:
    // eles somem com `open` ainda `true` e a prop nunca transiciona para `false`.
    //
    // Uma entrada vazada só é observável numa configuração — a de cima some sem
    // fechar enquanto a de baixo continua aberta —, porque `push` sempre
    // acrescenta no fim e um órfão fica ABAIXO dos modais seguintes. Por isso o
    // caso principal aqui é esse, e não o modal solitário.
    // Os diálogos são abertos em commits SEPARADOS, como no app. Montar dois
    // modais já abertos no mesmo commit faz os dois `hideOthers()` rodarem
    // juntos e cada um ocultar o outro — artefato pré-existente do Radix para
    // diálogos sem live region, alheio à pilha (ela nunca oculta o topo).
    const { rerender, unmount } = render(<StackHarness a />);
    await waitFor(() => expect(expostos()).toEqual(['A']));
    rerender(<StackHarness a b />);
    await waitFor(() => expect(expostos()).toEqual(['B']));

    rerender(<StackHarness a mountB={false} />);

    // Se o cleanup não drenasse a pilha, A continuaria `aria-hidden` — visível
    // na tela e invisível para tecnologia assistiva, sem nenhum sintoma.
    await waitFor(() => expect(expostos()).toEqual(['A']));
    expect(dialogoPorTitulo('A')).not.toHaveAttribute('aria-hidden');

    // E o caso do modal solitário: desmontar tudo e abrir outro do zero.
    unmount();
    render(<StackHarness c />);

    await waitFor(() => expect(expostos()).toEqual(['C']));
    expect(dialogoPorTitulo('C')).not.toHaveAttribute('aria-hidden');
  });

  it('fechar e reabrir o mesmo Modal não corrompe seu registro na pilha', async () => {
    const { rerender } = render(<StackHarness a />);
    await waitFor(() => expect(expostos()).toEqual(['A']));

    rerender(<StackHarness a={false} />);
    await waitFor(() => expect(estaMontado('A')).toBe(false));
    rerender(<StackHarness a />);
    await waitFor(() => expect(expostos()).toEqual(['A']));

    rerender(<StackHarness a b />);
    await waitFor(() => expect(expostos()).toEqual(['B']));

    rerender(<StackHarness a />);

    // O contrato observável: A volta a ser o único exposto depois do ciclo
    // fechar → reabrir → empilhar → desempilhar.
    await waitFor(() => expect(expostos()).toEqual(['A']));
    expect(dialogoPorTitulo('A')).not.toHaveAttribute('aria-hidden');
  });

  it('fechar a camada de baixo fora de ordem não afeta a de cima', async () => {
    // Abertura sequencial, pelo mesmo motivo do caso anterior.
    const { rerender } = render(<StackHarness a />);
    await waitFor(() => expect(expostos()).toEqual(['A']));
    rerender(<StackHarness a b />);
    await waitFor(() => expect(expostos()).toEqual(['B']));

    // Desmonta A — o de BAIXO — com B ainda aberto. A remoção é por identidade
    // (`indexOf`/`splice`), não por posição, então B continua sendo o topo.
    rerender(<StackHarness mountA={false} b />);

    await waitFor(() => expect(estaMontado('A')).toBe(false));
    expect(expostos()).toEqual(['B']);
    expect(dialogoPorTitulo('B')).not.toHaveAttribute('aria-hidden');

    // Fecha B e abre um terceiro isolado: sem vazamento da pilha anterior.
    rerender(<StackHarness mountA={false} b={false} c />);

    await waitFor(() => expect(expostos()).toEqual(['C']));
    expect(dialogoPorTitulo('C')).not.toHaveAttribute('aria-hidden');
  });

  it('um Modal isolado nunca recebe aria-hidden (não-regressão da pilha)', async () => {
    render(<StackHarness a />);

    await waitFor(() => expect(estaMontado('A')).toBe(true));
    const dialogo = dialogoPorTitulo('A');
    expect(dialogo).toHaveAttribute('aria-modal', 'true');
    expect(dialogo).not.toHaveAttribute('aria-hidden');
    expect(screen.getByRole('dialog')).toHaveAccessibleName('A');
  });

  it('com três Modals empilhados, só o topo fica exposto — e a pilha desempilha na ordem', async () => {
    // `live` ligado: com `[aria-live]` nos três, o `hideOthers()` do Radix
    // preserva todos e não oculta nada. O que este caso mede é a pilha, não a
    // biblioteca — sem isso ele passaria mesmo se a pilha fosse removida.
    const { rerender } = render(<StackHarness live a b c />);

    await waitFor(() => expect(expostos()).toEqual(['C']));
    expect(document.querySelectorAll('[role="dialog"]')).toHaveLength(3);
    expect(dialogoPorTitulo('A')).toHaveAttribute('aria-hidden', 'true');
    expect(dialogoPorTitulo('B')).toHaveAttribute('aria-hidden', 'true');

    rerender(<StackHarness live a b />);
    await waitFor(() => expect(expostos()).toEqual(['B']));
    expect(dialogoPorTitulo('A')).toHaveAttribute('aria-hidden', 'true');
    expect(dialogoPorTitulo('B')).not.toHaveAttribute('aria-hidden');

    rerender(<StackHarness live a />);
    await waitFor(() => expect(expostos()).toEqual(['A']));
    expect(dialogoPorTitulo('A')).not.toHaveAttribute('aria-hidden');
  });
});
