/**
 * Erro HTTP intencional (mensagem segura para expor ao cliente).
 * Qualquer erro que NÃO seja uma instância desta classe (nem ZodError) é
 * tratado pelo handler global como falha interna: logado com detalhe no
 * servidor, mas respondido ao cliente com uma mensagem genérica — nunca
 * `err.message` cru, que pode vazar detalhe interno (stack, driver de banco).
 */
export class HttpError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = 'HttpError';
    this.status = status;
  }
}
