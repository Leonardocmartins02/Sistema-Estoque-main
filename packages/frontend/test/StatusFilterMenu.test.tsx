import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import StatusFilterMenu from '../src/components/products/StatusFilterMenu';
import type { StatusKey } from '../src/hooks/useProductsQuery';

/**
 * Characterization tests do `StatusFilterMenu` (`characterization-plan.md` §9).
 *
 * Filtrar é capacidade central. No mobile este menu vira uma **sheet**
 * (§15.1 do Design System) e precisa continuar valendo — por isso os testes
 * afirmam o contrato de filtro, nunca o fato de ser um popover de cabeçalho.
 *
 * O comportamento de teclado do menu (setas, Home/End, Escape) NÃO é testado
 * aqui: já está em `MenuPopover.test.tsx`.
 *
 * NÃO congelado: o vocabulário "OK / Atenção / Em falta" é um **terceiro**
 * vocabulário para os mesmos três estados, divergente da tabela ("Em Estoque /
 * Estoque Baixo / Fora de Estoque"). É bug conhecido (§12) — as asserções
 * localizam as opções pelo texto atual porque é a única forma de acioná-las
 * hoje, mas nenhum teste afirma que esse vocabulário deve permanecer.
 */

function renderMenu(selected: StatusKey[] = []) {
  const onToggle = vi.fn();
  const onClear = vi.fn();
  render(<StatusFilterMenu selected={selected} onToggle={onToggle} onClear={onClear} />);
  return { onToggle, onClear };
}

async function openMenu(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole('button', { name: /Filtrar por Status/i }));
  return screen.findByRole('menu');
}

describe('StatusFilterMenu — seleção múltipla de status (SFM-1)', () => {
  it('SFM-1 · oferece os três estados de estoque como opções marcáveis', async () => {
    const user = userEvent.setup();
    renderMenu();

    await openMenu(user);

    // `menuitemcheckbox` (e não `menuitemradio`) é o que torna a seleção
    // múltipla: filtrar por "sem estoque" E "estoque baixo" ao mesmo tempo.
    expect(screen.getAllByRole('menuitemcheckbox')).toHaveLength(3);
  });

  it('SFM-1 · marcar duas opções dispara onToggle com cada valor sem fechar o menu entre elas', async () => {
    const user = userEvent.setup();
    const { onToggle } = renderMenu();

    await openMenu(user);

    // O menu permanece aberto a cada marcação — é isso que torna a seleção
    // múltipla praticável. Fechar a cada clique obrigaria a reabrir o menu
    // uma vez por status, e a sheet mobile (§15.1) herda esse contrato.
    await user.click(screen.getByRole('menuitemcheckbox', { name: /Atenção/i }));
    await user.click(screen.getByRole('menuitemcheckbox', { name: /Em falta/i }));

    expect(onToggle).toHaveBeenCalledWith('ATTN');
    expect(onToggle).toHaveBeenCalledWith('OUT');
    expect(screen.getByRole('menu')).toBeInTheDocument();
  });

  it('SFM-1 · aria-checked reflete quais status estão selecionados', async () => {
    const user = userEvent.setup();
    renderMenu(['ATTN', 'OUT']);

    await openMenu(user);

    expect(screen.getByRole('menuitemcheckbox', { name: /Atenção/i })).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByRole('menuitemcheckbox', { name: /Em falta/i })).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByRole('menuitemcheckbox', { name: /OK/i })).toHaveAttribute('aria-checked', 'false');
  });
});

describe('StatusFilterMenu — limpar filtros (SFM-2, SFM-3)', () => {
  /**
   * SFM-2 é **a saída do beco sem saída** do UF-07: hoje o `LowStockBanner`
   * aplica um filtro e "Limpar filtros" é a única forma de sair dele. Precisa
   * existir depois da migração, em qualquer largura de tela.
   */
  it('SFM-2 · "Limpar filtros" dispara onClear quando há filtro ativo', async () => {
    const user = userEvent.setup();
    const { onClear } = renderMenu(['ATTN']);

    await openMenu(user);
    await user.click(screen.getByRole('menuitem', { name: /Limpar filtros/i }));

    expect(onClear).toHaveBeenCalledTimes(1);
  });

  it('SFM-3 · "Limpar filtros" fica desabilitado quando não há nada a limpar', async () => {
    const user = userEvent.setup();
    renderMenu([]);

    await openMenu(user);

    expect(screen.getByRole('menuitem', { name: /Limpar filtros/i })).toBeDisabled();
  });
});

describe('StatusFilterMenu — contador de filtros ativos no gatilho (SFM-4)', () => {
  /**
   * A sheet mobile depende deste contador (§15.1): quando o filtro deixa de
   * viver no cabeçalho da tabela, o gatilho passa a ser a única pista de que
   * existe filtro aplicado.
   */
  it('SFM-4 · o nome acessível do gatilho anuncia quantos filtros estão ativos', () => {
    renderMenu(['ATTN', 'OUT']);

    expect(screen.getByRole('button', { name: 'Filtrar por Status (2 ativo(s))' })).toBeInTheDocument();
  });

  it('SFM-4 · sem filtro ativo o gatilho não anuncia contagem', () => {
    renderMenu([]);

    expect(screen.getByRole('button', { name: 'Filtrar por Status' })).toBeInTheDocument();
  });
});
