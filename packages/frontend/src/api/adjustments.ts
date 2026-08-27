import { apiFetch } from './httpClient';
import type { Movement } from './types';

export async function createAdjustment(
  productId: string,
  data: { targetQuantity: number; expectedPreviousQuantity: number; reason: string },
): Promise<Movement> {
  return apiFetch(`/products/${productId}/adjustments`, { method: 'POST', body: JSON.stringify(data) });
}
