import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { createMovement } from '../api/movements';
import { useToast } from './ui/ToastProvider';
import Modal from './ui/Modal';
import Button from './ui/Button';

const schema = z.object({
  type: z.enum(['IN', 'OUT'], { required_error: 'Selecione o tipo' }),
  quantity: z.coerce.number().int().positive('Quantidade deve ser > 0'),
  date: z
    .string()
    .datetime()
    .optional()
    .or(z.literal('')),
  note: z.string().optional().or(z.literal('')),
});

export type MovementFormValues = z.infer<typeof schema>;

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
    formState: { errors, isSubmitting },
    reset,
  } = useForm<MovementFormValues>({
    resolver: zodResolver(schema),
    defaultValues: { type: 'IN', quantity: 1, date: '', note: '' },
  });

  async function onSubmit(values: MovementFormValues) {
    setServerError(null);
    try {
      await createMovement(productId, {
        type: values.type,
        quantity: values.quantity,
        date: values.date || undefined,
        note: values.note || undefined,
      });
      reset();
      onOpenChange(false);
      onSuccess?.();
      showToast({ type: 'success', message: 'Movimentação lançada com sucesso.' });
    } catch (e: any) {
      setServerError(e?.message || 'Falha ao lançar movimentação');
      showToast({ type: 'error', message: e?.message || 'Falha ao lançar movimentação' });
    }
  }

  return (
    <Modal
      open={open}
      onClose={() => onOpenChange(false)}
      title="Movimentar Estoque"
      description="Lance uma entrada (IN) ou saída (OUT) para este produto."
    >
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-3">
            <div>
              <label htmlFor="type" className="block text-sm font-medium text-gray-700">
                Tipo*
              </label>
              <select
                id="type"
                className="mt-1 w-full rounded-md border border-gray-300 p-2 focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand"
                {...register('type')}
              >
                <option value="IN">Entrada (IN)</option>
                <option value="OUT">Saída (OUT)</option>
              </select>
              {errors.type && (
                <p className="mt-1 text-xs text-red-700" role="alert">
                  {errors.type.message}
                </p>
              )}
            </div>

            <div>
              <label htmlFor="quantity" className="block text-sm font-medium text-gray-700">
                Quantidade*
              </label>
              <input
                id="quantity"
                type="number"
                min={1}
                className="mt-1 w-full rounded-md border border-gray-300 p-2 focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand"
                {...register('quantity')}
              />
              {errors.quantity && (
                <p className="mt-1 text-xs text-red-700" role="alert">
                  {errors.quantity.message}
                </p>
              )}
            </div>

            <div>
              <label htmlFor="date" className="block text-sm font-medium text-gray-700">
                Data (opcional)
              </label>
              <input
                id="date"
                type="datetime-local"
                className="mt-1 w-full rounded-md border border-gray-300 p-2 focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand"
                {...register('date')}
              />
              {errors.date && (
                <p className="mt-1 text-xs text-red-700" role="alert">
                  {errors.date.message}
                </p>
              )}
            </div>

            <div>
              <label htmlFor="note" className="block text-sm font-medium text-gray-700">
                Observação (opcional)
              </label>
              <textarea
                id="note"
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
          <Button type="button" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button type="submit" variant="primary" disabled={isSubmitting}>
            {isSubmitting ? 'Lançando...' : 'Lançar'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

export default MovementFormModal;
