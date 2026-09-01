import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import type { ProductWithBalance } from '../src/api/types';
import ProductCardList from '../src/components/products/ProductCardList';

import { makeProduct } from './helpers/factories';
import { makeSpyActions } from './helpers/render';

/**
 * Characterization tests do `ProductCardList` (`characterization-plan.md` §7).
 *
 * É a superfície onde a migração mais **adiciona**. Por isso nenhum teste aqui
 * afirma a *ausência* de nada: a falta de baixa rápida e de estoque mínimo no
 * card é o bug C-5, e um teste de "não há baixa rápida no mobile" seria o pior
 * congelamento possível deste plano (§7 e §12).
 *
 * PCL-1..5 + PT-1..8 formam a base contra a qual a tabela de paridade assinada
 * (§15.1 do Design System) será verificada na Fase 8.
 */

function renderCards(items: ProductWithBalance[], overrides: { isLoading?: boolean; error?: string | null } = {}) {
  const actions = makeSpyActions();
  render(
    <ProductCardList
      items={items}
      isLoading={overrides.isLoading ?? false}
      error={overrides.error ?? null}
      actions={actions}
    />,
  );
  return { actions };
}

describe('ProductCardList — dados do card (PCL-1, PCL-2)', () => {
  it('PCL-1 · expõe nome, SKU, saldo e status de cada produto', () => {
    renderCards([makeProduct({ name: 'Caneta Azul', sku: 'CAN-001', balance: 20, minStock: 5 })]);

    expect(screen.getByText('Caneta Azul')).toBeInTheDocument();
    expect(screen.getByText(/CAN-001/)).toBeInTheDocument();
    expect(screen.getByText(/20/)).toBeInTheDocument();
    expect(screen.getByText('Em estoque')).toBeInTheDocument();
  });

  it('PCL-2 · o status do card usa o mesmo vocabulário da tabela', () => {
    // Um caso representativo basta: os três ramos da regra já estão em PS-1.
    // O que se protege aqui é desktop e mobile não divergirem — divergir seria
    // pior que a ausência. Vocabulário unificado na Task 14 ("Em estoque /
    // Estoque baixo / Sem estoque"), igual em tabela, card e filtro.
    renderCards([makeProduct({ balance: 2, minStock: 5 })]);

    expect(screen.getByText('Estoque baixo')).toBeInTheDocument();
  });

  it('PCL-2 · saldo zero é comunicado como sem estoque', () => {
    renderCards([makeProduct({ balance: 0, minStock: 5 })]);

    expect(screen.getByText('Sem estoque')).toBeInTheDocument();
  });
});

describe('ProductCardList — ações do card (PCL-3, PCL-4)', () => {
  it('PCL-3 · "Movimentar" dispara onMove com o produto', async () => {
    const user = userEvent.setup();
    const product = makeProduct({ id: 'p1', name: 'Caneta Azul' });
    const { actions } = renderCards([product]);

    await user.click(screen.getByRole('button', { name: 'Movimentar' }));

    expect(actions.onMove).toHaveBeenCalledWith(product);
  });

  it('PCL-4 · o menu de ações está integrado ao card e é localizável pelo produto', async () => {
    const user = userEvent.setup();
    const { actions } = renderCards([makeProduct({ id: 'p1', name: 'Caneta Azul' })]);

    // Os callbacks internos do menu pertencem a `ProductActionsMenu.test.tsx`.
    // Aqui só se protege que o card *tem* o menu, nomeado pelo produto.
    await user.click(screen.getByRole('button', { name: 'Mais ações para Caneta Azul' }));

    expect(await screen.findByRole('menu', { name: 'Ações para Caneta Azul' })).toBeInTheDocument();
    expect(actions.onEdit).not.toHaveBeenCalled();
  });

  it('PCL-4 · cada produto da lista tem seu próprio menu nomeado', () => {
    renderCards([
      makeProduct({ id: 'p1', name: 'Caneta Azul' }),
      makeProduct({ id: 'p2', name: 'Borracha Branca' }),
    ]);

    expect(screen.getByRole('button', { name: 'Mais ações para Caneta Azul' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Mais ações para Borracha Branca' })).toBeInTheDocument();
  });
});

describe('ProductCardList — estados de carga e erro (PCL-5)', () => {
  it('PCL-5 · o carregamento é anunciado com role="status"', () => {
    renderCards([], { isLoading: true });

    expect(screen.getByRole('status')).toHaveTextContent(/Carregando/i);
  });

  it('PCL-5 · o erro é anunciado com role="alert" e mostra a mensagem recebida', () => {
    renderCards([], { error: 'Erro ao carregar produtos' });

    expect(screen.getByRole('alert')).toHaveTextContent('Erro ao carregar produtos');
  });

  /**
   * O estado vazio existe, mas — ao contrário de erro e carregando — é um card
   * mudo, sem `role` de anúncio (A-12ʳ). Este teste afirma apenas que a
   * mensagem existe; **não** afirma que ela não é anunciada, porque passar a
   * anunciá-la é correção esperada, não regressão. O texto em si é ALTERAR
   * INTENCIONALMENTE (A-10), por isso a asserção é frouxa.
   */
  it('PCL-5 · lista vazia renderiza um estado vazio legível', () => {
    renderCards([]);

    expect(screen.getByText(/Nenhum produto/i)).toBeInTheDocument();
  });
});
