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
  type: 'IN' | 'OUT';
  quantity: number;
  date: string;
  note?: string | null;
  createdAt: string;
};

export type Paged<T> = { items: T[]; total: number; page: number; pageSize: number };

export type ApiError = { message: string };
