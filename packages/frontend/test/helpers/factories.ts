import type { QuickOutHistoryItem } from '../../src/api/quickOut';
import type { Movement, Paged, ProductWithBalance } from '../../src/api/types';

/**
 * Fábricas dos characterization tests (Task 0, Passo 0 do
 * `docs/ui-ux/characterization-plan.md` §15).
 *
 * Escopo deliberado: servir os testes NOVOS. Os `makeProduct`/`makeMovement`
 * que já existem em `ProductDashboard.test.tsx` e `MovementHistoryModal.test.tsx`
 * continuam onde estão — reescrevê-los seria oportunismo, não pré-requisito
 * (§14, "Aceitos com ajuste").
 */

/**
 * Datas das fixtures: instante inequívoco quanto ao fuso.
 *
 * 12:00Z cai no mesmo dia do calendário em qualquer fuso entre UTC−11 e UTC+11,
 * então asserções sobre dia/mês/ano não dependem do TZ da máquina que roda a
 * suíte — regra 8 dos padrões proibidos (§12).
 */
export const FIXTURE_DATE_ISO = '2026-08-14T12:00:00.000Z';

export function makeProduct(overrides: Partial<ProductWithBalance> = {}): ProductWithBalance {
  return {
    id: 'p1',
    name: 'Caneta Azul',
    sku: 'CAN-001',
    description: null,
    minStock: 5,
    balance: 20,
    createdAt: FIXTURE_DATE_ISO,
    updatedAt: FIXTURE_DATE_ISO,
    ...overrides,
  };
}

export function makeMovement(overrides: Partial<Movement> = {}): Movement {
  return {
    id: 'm1',
    productId: 'p1',
    type: 'IN',
    quantity: 5,
    date: FIXTURE_DATE_ISO,
    note: null,
    createdAt: FIXTURE_DATE_ISO,
    ...overrides,
  };
}

export function makeQuickOutHistoryItem(overrides: Partial<QuickOutHistoryItem> = {}): QuickOutHistoryItem {
  return {
    id: 'h1',
    productId: 'p1',
    productName: 'Caneta Azul',
    productSku: 'CAN-001',
    quantity: 3,
    date: FIXTURE_DATE_ISO,
    note: null,
    ...overrides,
  };
}

/** Envelope paginado da API. `total` é sobrescrevível: vários testes checam o contador. */
export function paged<T>(items: T[], overrides: Partial<Paged<T>> = {}): Paged<T> {
  return { items, total: items.length, page: 1, pageSize: 10, ...overrides };
}
