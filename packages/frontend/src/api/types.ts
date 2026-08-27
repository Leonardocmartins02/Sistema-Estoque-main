export type Product = {
  id: string;
  name: string;
  sku: string;
  description?: string | null;
  minStock: number;
  createdAt: string;
  updatedAt: string;
};

export type ProductWithBalance = Product & { balance: number };

export type Movement = {
  id: string;
  productId: string;
  type: 'IN' | 'OUT' | 'INITIAL_STOCK' | 'ADJUSTMENT';
  quantity: number;
  date: string;
  note?: string | null;
  createdAt: string;
  // Preenchidos desde a Fase 1 de auditoria — nulos/ausentes em registros
  // anteriores a ela (degradação graciosa esperada na UI de histórico).
  previousQuantity?: number | null;
  newQuantity?: number | null;
  userEmail?: string | null;
};

export type Paged<T> = { items: T[]; total: number; page: number; pageSize: number };

export type ApiError = { message: string };
