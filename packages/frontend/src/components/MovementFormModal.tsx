import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation } from '@tanstack/react-query';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';

import { createMovement } from '../api/movements';

import Button from './ui/Button';
import Modal from './ui/Modal';
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

type Props = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  productId: string;
  onSuccess?: () => void;
};

export function MovementFormModal({ open, onOpenChange, productId, onSuccess }: Props) {
  const [serverError, setServerError] = useState<string | null>(null);
  const { show: showToast } = useToast();

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
  } = useForm<MovementFormValues>({
    resolver: zodResolver(movementSchema),
    defaultValues: { type: 'IN', quantity: 1, date: '', note: '' },
  });

  const mutation = useMutation({
    mutationFn: (values: MovementFormValues) =>
      createMovement(productId, {
        type: values.type,
        quantity: values.quantity,
        // `datetime-local` é hora local; `toISOString()` normaliza para UTC.
        date: values.date ? new Date(values.date).toISOString() : undefined,
        note: values.note || undefined,
      }),
    onSuccess: () => {
      reset();
      setServerError(null);
      onOpenChange(false);
      onSuccess?.();
      showToast({ type: 'success', message: 'Movimentação lançada com sucesso.' });
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
      title="Movimentar Estoque"
      description="Lance uma entrada (IN) ou saída (OUT) para este produto."
    >
      <form
        onSubmit={handleSubmit((values) => {
          setServerError(null);
          mutation.mutate(values);
        })}
        className="space-y-3"
      >
        <div>
          <label htmlFor="movement-type" className="block text-sm font-medium text-gray-700">
            Tipo*
          </label>
          <select
            id="movement-type"
            aria-invalid={!!errors.type}
            aria-describedby={errors.type ? 'movement-type-error' : undefined}
            className="mt-1 w-full rounded-md border border-gray-300 p-2 focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand"
            {...register('type')}
          >
            <option value="IN">Entrada (IN)</option>
            <option value="OUT">Saída (OUT)</option>
          </select>
          {errors.type && (
            <p id="movement-type-error" className="mt-1 text-xs text-red-700" role="alert">
              {errors.type.message}
            </p>
          )}
        </div>

        <div>
          <label htmlFor="movement-quantity" className="block text-sm font-medium text-gray-700">
            Quantidade*
          </label>
          <input
            id="movement-quantity"
            type="number"
            min={1}
            aria-invalid={!!errors.quantity}
            aria-describedby={errors.quantity ? 'movement-quantity-error' : undefined}
            className="mt-1 w-full rounded-md border border-gray-300 p-2 focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand"
            {...register('quantity')}
          />
          {errors.quantity && (
            <p id="movement-quantity-error" className="mt-1 text-xs text-red-700" role="alert">
              {errors.quantity.message}
            </p>
          )}
        </div>

        <div>
          <label htmlFor="movement-date" className="block text-sm font-medium text-gray-700">
            Data (opcional)
          </label>
          <input
            id="movement-date"
            type="datetime-local"
            aria-invalid={!!errors.date}
            aria-describedby={errors.date ? 'movement-date-error' : undefined}
            className="mt-1 w-full rounded-md border border-gray-300 p-2 focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand"
            {...register('date')}
          />
          {errors.date && (
            <p id="movement-date-error" className="mt-1 text-xs text-red-700" role="alert">
              {errors.date.message}
            </p>
          )}
        </div>

        <div>
          <label htmlFor="movement-note" className="block text-sm font-medium text-gray-700">
            Observação (opcional)
          </label>
          <textarea
            id="movement-note"
            rows={3}
            className="mt-1 w-full rounded-md border border-gray-300 p-2 focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand"
            {...register('note')}
          />
        </div>

        {serverError && (
          <p className="text-sm text-red-700" role="alert">
            {serverError}
          </p>
        )}

        <div className="mt-4 flex items-center justify-end gap-2">
          <Button type="button" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button type="submit" variant="primary" disabled={mutation.isPending} isLoading={mutation.isPending}>
            {mutation.isPending ? 'Lançando...' : 'Lançar'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

export default MovementFormModal;
