import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation } from '@tanstack/react-query';
import { useId, useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';

import { createMovement } from '../api/movements';
import { formatBalanceTransition, formatDelta, formatQuantity } from '../lib/formatNumber';

import { Button } from './ui/Button';
import { Input } from './ui/Input';
import { Modal } from './ui/Modal';
import { useToast } from './ui/ToastProvider';

export const movementSchema = z.object({
  type: z.enum(['IN', 'OUT'], { required_error: 'Selecione o tipo' }),
  quantity: z.coerce.number().int().positive('Quantidade deve ser > 0'),
  // O input é `datetime-local`, que produz "2027-05-10T15:31" — sem segundos e
  // sem offset. `z.string().datetime()` exige ISO-8601 completo em UTC, então
  // rejeitava TODO valor preenchido com o erro cru "Invalid datetime", deixando
  // um campo "opcional" impossível de usar. Aqui validamos que é uma data
  // reconhecível (mensagem em pt-BR) e convertemos para ISO no envio — o
  // backend continua estrito em ISO, como deve ser.
  date: z
    .string()
    .optional()
    .refine((value) => !value || !Number.isNaN(new Date(value).getTime()), 'Data inválida'),
  note: z.string().optional().or(z.literal('')),
});

export type MovementFormValues = z.infer<typeof movementSchema>;

/**
 * Teto de saída (Task 18 / D-F): em `OUT`, a quantidade não pode exceder o
 * saldo disponível; em `IN`, nada muda — entrada não tem teto.
 *
 * Vive **fora** de `movementSchema` de propósito. O schema base não conhece
 * saldo nenhum e continua sendo o contrato validável fora da UI (autofill,
 * extensão, teste); o teto só existe onde há um produto com saldo em mãos.
 *
 * Isto **previne** o erro do usuário — não é a autoridade da regra. Quem
 * decide continua sendo o backend, dentro da transação com lock de linha
 * (`stockService.recordMovementInTx`): entre abrir o formulário e enviá-lo o
 * saldo pode ter mudado, e nesse caso o 422 é a resposta correta.
 */
export function movementSchemaForBalance(balance: number) {
  return movementSchema.refine((values) => values.type !== 'OUT' || values.quantity <= balance, {
    path: ['quantity'],
    message: overBalanceMessage(balance),
  });
}

/** Nomeia o impedimento e informa o saldo disponível — nunca só "não pode". */
function overBalanceMessage(balance: number): string {
  return `Quantidade acima do saldo disponível (${formatQuantity(balance)} un.).`;
}

export type MovementProduct = {
  id: string;
  name: string;
  sku: string;
  balance: number;
  minStock: number;
};

type Props = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  /**
   * O produto **inteiro**, não só o id (Task 17): sem nome, SKU e saldo o
   * diálogo não conseguia dar contexto nem calcular o preview.
   */
  product: MovementProduct;
  onSuccess?: () => void;
};

/** Rótulos sem parêntese técnico (UF-20): "Entrada (IN)" virou "Entrada". */
const INTENTS = [
  { value: 'IN' as const, label: 'Entrada' },
  { value: 'OUT' as const, label: 'Saída' },
];

/**
 * Diálogo de movimentação com **gramática de operação** (D1/D2, UF-20/UF-21).
 *
 * O risco que esta tela carrega é o maior do sistema: uma ENTRADA lançada no
 * lugar de uma SAÍDA não é detectada por nada e é permanente. Antes, o tipo era
 * um `<select>` já posicionado em `IN` — bastava um clique distraído.
 *
 * Por isso: **nenhuma intenção vem pré-selecionada**, e os campos dependentes
 * ficam **funcionalmente** inertes (não apenas apagados) até a escolha.
 * O controle é um `radiogroup` de rádios nativos — que entregam navegação por
 * setas, ponto único de tabulação e estado `checked` de graça (achado REV-08);
 * botões soltos perderiam tudo isso.
 */
export function MovementFormModal({ open, onOpenChange, product, onSuccess }: Props) {
  const [serverError, setServerError] = useState<string | null>(null);
  const { show: showToast } = useToast();
  const groupLabelId = useId();
  const quantityId = useId();
  const dateId = useId();
  const noteId = useId();

  const schema = useMemo(() => movementSchemaForBalance(product.balance), [product.balance]);

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
    reset,
  } = useForm<MovementFormValues>({
    resolver: zodResolver(schema),
    // Sem `type`: a intenção é declarada, nunca herdada.
    defaultValues: { quantity: 1, date: '', note: '' },
  });

  const type = watch('type');
  const quantity = Number(watch('quantity'));
  const hasIntent = type === 'IN' || type === 'OUT';
  const validQuantity = Number.isFinite(quantity) && quantity > 0;

  const delta = hasIntent && validQuantity ? (type === 'IN' ? quantity : -quantity) : 0;
  const nextBalance = product.balance + delta;
  // Saída acima do saldo (Task 18 / D-F): impedimento, não destino. O preview
  // já não desenhava saldo negativo como futuro plausível; agora a
  // confirmação também fica indisponível enquanto a quantidade for impossível.
  // Saída IGUAL ao saldo não é impedimento — resulta em zero, que é legítimo.
  const insufficient = hasIntent && type === 'OUT' && validQuantity && nextBalance < 0;

  // O impedimento derivado vale a partir da primeira tecla; o erro do schema
  // só existiria depois de uma tentativa de envio, tarde demais para explicar.
  const quantityError = insufficient ? overBalanceMessage(product.balance) : errors.quantity?.message;

  const intentLabel = type === 'IN' ? 'entrada' : 'saída';

  const mutation = useMutation({
    mutationFn: (values: MovementFormValues) =>
      createMovement(product.id, {
        type: values.type,
        quantity: values.quantity,
        // `datetime-local` é hora local; `toISOString()` normaliza para UTC.
        date: values.date ? new Date(values.date).toISOString() : undefined,
        note: values.note || undefined,
      }),
    onSuccess: (movement, values) => {
      const direction = values.type === 'IN' ? 'Entrada' : 'Saída';
      // O saldo anunciado vem da RESPOSTA do backend. Calcular sobre o snapshot
      // da listagem (`staleTime` 15s) anunciaria um número que pode já estar
      // errado. Sem `newQuantity`, o toast declara quantidade e direção e
      // **omite** o saldo em vez de inventá-lo.
      const newQuantity = movement?.newQuantity;
      const message =
        newQuantity == null
          ? `${direction} de ${formatQuantity(values.quantity)} un. registrada.`
          : `${direction} de ${formatQuantity(values.quantity)} un. registrada. Novo saldo: ${formatQuantity(newQuantity)} un.`;

      reset();
      setServerError(null);
      onOpenChange(false);
      onSuccess?.();
      showToast({ type: 'success', message });
    },
    onError: (error: unknown) => {
      const message = error instanceof Error && error.message ? error.message : 'Falha ao lançar movimentação';
      setServerError(message);
      showToast({ type: 'error', message });
    },
  });

  return (
    <Modal
      open={open}
      onClose={() => onOpenChange(false)}
      // Antes da escolha o título não pode afirmar intenção nenhuma; depois
      // dela, afirma (design-system.md §12: o título nomeia o objeto).
      title={hasIntent ? `Registrar ${intentLabel} · ${product.name}` : 'Movimentar Estoque'}
      description="Declare a intenção para liberar os demais campos."
    >
      <form
        onSubmit={handleSubmit((values) => {
          setServerError(null);
          mutation.mutate(values);
        })}
        className="space-y-4"
      >
        {/* Contexto: o diálogo sequer sabia o nome do produto (UF-20). */}
        <div className="rounded-surface border bg-surface-subtle px-3 py-2">
          <div className="text-sm font-medium text-gray-900">{product.name}</div>
          <div className="text-xs text-gray-600">SKU: {product.sku}</div>
          <div className="mt-1 text-sm tabular-nums text-gray-900">
            {formatQuantity(product.balance)} <span className="font-normal text-gray-600">un.</span>{' '}
            <span className="text-xs text-gray-600">mín. {formatQuantity(product.minStock)}</span>
          </div>
        </div>

        <fieldset role="radiogroup" aria-labelledby={groupLabelId}>
          <legend id={groupLabelId} className="text-sm font-medium text-gray-700">
            Intenção*
          </legend>
          <div className="mt-2 grid grid-cols-2 gap-2">
            {INTENTS.map((intent) => (
              // O nome acessível é exatamente "Entrada"/"Saída" — sem o
              // parêntese técnico de antes (UF-20) e sem texto auxiliar
              // dentro do rótulo, que entraria no nome do controle.
              <label
                key={intent.value}
                className="flex h-11 cursor-pointer items-center gap-2 rounded-control border border-border-strong px-3 has-[:checked]:border-accent has-[:checked]:bg-accent-subtle"
              >
                <input
                  type="radio"
                  value={intent.value}
                  className="h-4 w-4 text-accent focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-surface"
                  {...register('type')}
                />
                <span className="text-sm text-gray-900">{intent.label}</span>
              </label>
            ))}
          </div>
          {errors.type && (
            <p className="mt-1 text-xs text-danger" role="alert">
              {errors.type.message}
            </p>
          )}
        </fieldset>

        {/* Inércia FUNCIONAL: `disabled` de verdade, não opacidade (D2-B). */}
        {/*
          `max` só existe em `OUT` (em `IN` não há teto). Ele governa a seta do
          `number`; digitar ou colar acima do saldo continua possível — por
          isso o impedimento real não depende dele. A mensagem chega ao campo
          por `aria-describedby` + `aria-invalid`, sem `role="alert"` por campo
          (design-system.md §11.0), responsabilidade do primitivo `Input`.
        */}
        <Input
          id={quantityId}
          label="Quantidade*"
          type="number"
          min={1}
          max={type === 'OUT' ? product.balance : undefined}
          disabled={!hasIntent}
          error={quantityError}
          {...register('quantity')}
        />

        {hasIntent && validQuantity && (
          // `aria-live="polite"` (mesmo padrão do `AdjustmentFormModal`): a
          // consequência muda sem interação direta com este bloco, e o
          // impedimento precisa ser ANUNCIADO no momento em que ocorre — uma
          // troca de `aria-describedby` não é anunciada se o foco já está no
          // campo. Polite, não `role="alert"`: §11.0 reserva o assertivo ao
          // erro assíncrono do servidor.
          <div
            data-testid="movement-preview"
            aria-live="polite"
            className={`rounded-surface border px-3 py-2 text-sm tabular-nums ${
              insufficient ? 'border-danger bg-danger-subtle text-danger' : 'bg-surface-subtle text-gray-900'
            }`}
          >
            {insufficient ? (
              <>
                <span className="font-medium">Saldo insuficiente.</span> A saída de{' '}
                {formatQuantity(quantity)} un. excede o saldo de {formatQuantity(product.balance)} un.
              </>
            ) : (
              <>
                {formatBalanceTransition(product.balance, nextBalance)} un.{' '}
                <span className="text-gray-600">({formatDelta(delta)})</span>
              </>
            )}
          </div>
        )}

        <Input
          id={dateId}
          label="Data (opcional)"
          type="datetime-local"
          disabled={!hasIntent}
          error={errors.date?.message}
          {...register('date')}
        />

        <div>
          <label htmlFor={noteId} className="block text-sm font-medium text-gray-700">
            Observação (opcional)
          </label>
          <textarea
            id={noteId}
            rows={3}
            disabled={!hasIntent}
            className="mt-1 w-full rounded-control border border-border-strong p-2 outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-surface disabled:cursor-not-allowed disabled:bg-surface-subtle disabled:text-text-muted"
            {...register('note')}
          />
        </div>

        {serverError && (
          <p className="text-sm text-danger" role="alert">
            {serverError}
          </p>
        )}

        <div className="mt-4 flex items-center justify-end gap-2">
          <Button type="button" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          {/* Sem intenção não existe caminho de submissão — o primário só
              aparece quando há uma consequência para nomear. */}
          {/*
            Indisponível enquanto a saída for impossível — por `aria-disabled`,
            não `disabled` (design-system.md §11.2: é a regra, não a exceção).
            Um `disabled` nativo sai da tabulação, e a pessoa que usa leitor de
            tela descobriria o bloqueio pela AUSÊNCIA de um controle, sem nada
            que explicasse o motivo. Assim o botão continua focável e é
            anunciado como indisponível.

            Quem de fato impede o envio é o schema (`movementSchemaForBalance`),
            não este atributo: a tentativa de submissão falha na validação, e o
            `shouldFocusError` do react-hook-form leva o foco ao campo — onde a
            explicação está associada por `aria-describedby`.
          */}
          {hasIntent && (
            <Button
              type="submit"
              variant="primary"
              aria-disabled={insufficient}
              className={insufficient ? 'cursor-not-allowed opacity-50' : ''}
              isLoading={mutation.isPending}
            >
              {mutation.isPending
                ? 'Registrando...'
                : `Registrar ${intentLabel}${validQuantity ? ` de ${formatQuantity(quantity)} un.` : ''}`}
            </Button>
          )}
        </div>
      </form>
    </Modal>
  );
}

export default MovementFormModal;
