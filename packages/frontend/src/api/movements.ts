import type { Movement, Paged } from './types';

const API_PREFIX = '/api';

export async function fetchMovements(
  productId: string,
  page = 1,
  pageSize = 20,
  filters?: { type?: 'IN' | 'OUT' | ''; from?: string; to?: string; q?: string },
): Promise<Paged<Movement>> {
  const params = new URLSearchParams({ page: String(page), pageSize: String(pageSize) });
  if (filters?.type) params.set('type', filters.type);
  if (filters?.from) params.set('from', filters.from);
  if (filters?.to) params.set('to', filters.to);
  if (filters?.q) params.set('q', filters.q);
  
  const url = `${API_PREFIX}/products/${productId}/movements?${params.toString()}`;
  console.log('Fetching movements:', url);
  
  try {
    const res = await fetch(url);
    console.log('Response status:', res.status);
    
    if (!res.ok) {
      const errorText = await res.text();
      console.error('Error response:', errorText);
      throw new Error('Falha ao carregar movimentações');
    }
    
    const data = await res.json();
    console.log('Movements data:', data);
    return data;
  } catch (error) {
    console.error('Error in fetchMovements:', error);
    throw error;
  }
}

export async function createMovement(
  productId: string,
  data: { type: 'IN' | 'OUT'; quantity: number; date?: string; note?: string },
): Promise<Movement> {
  const url = `${API_PREFIX}/products/${productId}/movements`;
  console.log('Creating movement:', url, data);
  
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      credentials: 'include',
      body: JSON.stringify(data),
    });
    
    console.log('Create movement response status:', res.status);
    
    if (!res.ok) {
      let errorMessage = 'Falha ao registrar movimentação';
      try {
        const errorData = await res.json();
        console.error('Error details:', errorData);
        errorMessage = errorData?.message || errorMessage;
      } catch (e) {
        const text = await res.text();
        console.error('Failed to parse error response:', text);
      }
      throw new Error(errorMessage);
    }
    
    const result = await res.json();
    console.log('Movement created successfully:', result);
    return result;
  } catch (error) {
    console.error('Error in createMovement:', error);
    throw error;
  }
}
