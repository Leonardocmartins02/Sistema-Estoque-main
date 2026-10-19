export type ApiError = { message: string };

export type ProductStockSummary = { ok: number; attn: number; out: number };

// Extensão `.js` explícita: este pacote agora exporta código de runtime
// (`deriveStockStatus`), não só tipos — o `dist` precisa ser ESM válido
// para o Node, que não resolve import relativo sem extensão.
export * from './stock.js';
export * from './webhooks.js';
