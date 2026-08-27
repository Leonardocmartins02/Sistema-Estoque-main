import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useId, useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';

import { createAdjustment } from '../api/adjustments';
import { ApiRequestError } from '../api/httpClient';
import { fetchProduct } from '../api/products';

import Button from './ui/Button';
import Input from './ui/Input';
import Modal from './ui/Modal';
import { useToast } from './ui/ToastProvider';

type Product = { id: string; name: string; sku: string; balance: number };

type Props = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  product: Product;
  onSuccess?: () => void;
};

type AdjustmentFormValues = {
  targetQuantity: number;
  reason: string;
};

/**
 * Schema depende do saldo atual do produto (para rejeitar "alvo igual ao
 * saldo atual") — por isso é uma função, não uma constante no topo do
 * arquivo. Recriar a cada render é barato e evita duplicar essa regra em
 * outro lugar.
 */
function buildAdjustmentSchema(currentBalance: number) {
  return z
    .object({
      targetQuantity: z.coerce
        .number({ invalid_type_error: 'Informe um valor válido (0 ou mais).' })
        .int('Informe um valor válido (0 ou mais).')
        .min(0, 'Informe um valor válido (0 ou mais).'),
      reason: z
        .string()
        .trim()
        .min(1, 'Informe o motivo do ajuste.')
        .max(500, 'Motivo muito longo (máximo de 500 caracteres).'),
    })
    .refine((data) => data.targetQuantity !== currentBalance, {
      message: 'Informe um valor diferente do saldo atual.',
      path: ['targetQuantity'],
    });
}

/**
 * Ajuste de estoque via saldo alvo (contagem física), não delta — ver
 * docs/features/ajuste-estoque/idea.md. Dois passos dentro do próprio
 * componente ('form' | 'confirm'), sobre o primitivo `Modal` real —
 * deliberadamente NÃO usa `ConfirmDialog`/`useConfirm` (decisão de escopo
 * registrada no PRD: o resumo da confirmação é estruturado, generalizar o
 * componente compartilhado para isso aumentaria o escopo desta feature).
 */
export function AdjustmentFormModal({ open, onOpenChange, product, onSuccess }: Props) {
  const [step, setStep] = useState<'form' | 'confirm' | 'conflict'>('form');
  const [pending, setPending] = useState<AdjustmentFormValues | null>(null);
  const [serverError, setServerError] = useState<string | null>(null);
  // Saldo que a sessão de edição considera "atual" — inicia como product.balance,
  // mas é a Task 5 (não a prop, que nunca muda) que atualiza isto depois de um
  // conflito resolvido via "Revisar". Todo lugar que precisa do "saldo atual
  // desta tentativa" usa esta variável, nunca product.balance diretamente
  // (exceto para inicializá-la).
  const [expectedPreviousQuantity, setExpectedPreviousQuantity] = useState(product.balance);
  const [conflictActualBalance, setConflictActualBalance] = useState<number | null>(null);
  const { show: showToast } = useToast();
  const queryClient = useQueryClient();
  const targetId = useId();
  const reasonId = useId();

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<AdjustmentFormValues>({
    resolver: zodResolver(buildAdjustmentSchema(expectedPreviousQuantity)),
    defaultValues: { targetQuantity: product.balance, reason: '' },
  });

  // Reabrir o modal sempre começa no formulário — sem isso, cancelar a
  // partir da confirmação/conflito e reabrir depois deixaria o usuário preso
  // numa tela de uma tentativa anterior.
  useEffect(() => {
    if (open) {
      setStep('form');
      setServerError(null);
    }
  }, [open]);

  const mutation = useMutation({
    mutationFn: (values: AdjustmentFormValues) =>
      createAdjustment(product.id, {
        targetQuantity: values.targetQuantity,
        expectedPreviousQuantity,
        reason: values.reason,
      }),
    onSuccess: () => {
      setServerError(null);
      onOpenChange(false);
      onSuccess?.();
      showToast({ type: 'success', message: 'Estoque ajustado com sucesso.' });
    },
    onError: async (error: unknown) => {
      if (error instanceof ApiRequestError && error.status === 409) {
        // O corpo do erro 409 é só { message } (ver stockService.ts) — não
        // traz o saldo real. Busca-se via GET /products/:id, a mesma fonte
        // de verdade que o resto do app já usa — nunca recalculado aqui.
        const fresh = await queryClient.fetchQuery({
          queryKey: ['products', 'detail', product.id],
          queryFn: () => fetchProduct(product.id),
        });
        setConflictActualBalance(fresh.balance);
        setStep('conflict');
        return;
      }

      const message = error instanceof Error && error.message ? error.message : 'Falha ao ajustar estoque';
      setServerError(message);
      setStep('form');
    },
  });

  const watchedTarget = watch('targetQuantity');
  const parsedTarget = typeof watchedTarget === 'number' ? watchedTarget : Number(watchedTarget);
  const hasValidPreview =
    watchedTarget !== undefined && watchedTarget !== ('' as unknown) && !Number.isNaN(parsedTarget);
  const diff = hasValidPreview ? parsedTarget - expectedPreviousQuantity : 0;
  const diffLabel = diff > 0 ? `+${diff}` : `${diff}`;

  function handleClose() {
    onOpenChange(false);
  }

  function advanceToConfirm(values: AdjustmentFormValues) {
    setServerError(null);
    setPending(values);
    setStep('confirm');
  }

  function confirmAdjustment() {
    if (!pending) return;
    mutation.mutate(pending);
  }

  // Única ação disponível no conflito além de cancelar: reconhece o saldo
  // real explicitamente, atualiza a baseline, limpa SÓ a quantidade (o
  // motivo já digitado é preservado) e volta ao formulário para uma nova
  // decisão — nunca reenvia sozinho.
  function handleReview() {
    if (conflictActualBalance === null) return;
    setExpectedPreviousQuantity(conflictActualBalance);
    setValue('targetQuantity', '' as unknown as number);
    setConflictActualBalance(null);
    setPending(null);
    setStep('form');
  }

  if (step === 'conflict' && conflictActualBalance !== null) {
    return (
      <Modal
        open={open}
        onClose={handleClose}
        title="O estoque deste produto mudou"
        size="md"
        footer={
          <div className="flex items-center justify-end gap-2">
            <Button type="button" onClick={handleClose}>
              Cancelar
            </Button>
            <Button type="button" variant="primary" onClick={handleReview}>
              Revisar
            </Button>
          </div>
        }
      >
        <div className="space-y-3 text-sm">
          <p className="text-gray-700">
            O estoque deste produto mudou enquanto você realizava o ajuste. Revise o novo saldo antes de continuar.
          </p>
          <dl className="space-y-2">
            <div className="flex justify-between gap-4">
              <dt className="text-gray-600">Saldo que você visualizou</dt>
              <dd className="font-medium text-gray-900">{expectedPreviousQuantity}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-gray-600">Saldo atual</dt>
              <dd className="font-medium text-gray-900">{conflictActualBalance}</dd>
            </div>
          </dl>
        </div>
      </Modal>
    );
  }

  if (step === 'confirm' && pending) {
    return (
      <Modal
        open={open}
        onClose={handleClose}
        title="Ajustar estoque?"
        size="md"
        footer={
          <div className="flex items-center justify-end gap-2">
            <Button type="button" onClick={handleClose} disabled={mutation.isPending}>
              Cancelar
            </Button>
            <Button
              type="button"
              variant="primary"
              onClick={confirmAdjustment}
              disabled={mutation.isPending}
              isLoading={mutation.isPending}
            >
              Confirmar ajuste
            </Button>
          </div>
        }
      >
        <dl className="space-y-2 text-sm">
          <div className="flex justify-between gap-4">
            <dt className="text-gray-600">Produto</dt>
            <dd className="font-medium text-gray-900">{product.name}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-gray-600">Saldo atual → Novo saldo</dt>
            <dd className="font-medium text-gray-900">
              {expectedPreviousQuantity} → {pending.targetQuantity}
            </dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-gray-600">Diferença</dt>
            <dd className="font-medium text-gray-900">
              {pending.targetQuantity > expectedPreviousQuantity ? '+' : ''}
              {pending.targetQuantity - expectedPreviousQuantity}
            </dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-gray-600">Motivo</dt>
            <dd className="font-medium text-gray-900">{pending.reason}</dd>
          </div>
        </dl>
      </Modal>
    );
  }

  return (
    <Modal
      open={open}
      onClose={handleClose}
      title="Ajustar Estoque"
      description={`${product.name} · ${product.sku}`}
    >
      <form onSubmit={handleSubmit(advanceToConfirm)} noValidate className="space-y-3">
        <div>
          <span className="block text-sm font-medium text-gray-700">Saldo atual</span>
          <p className="mt-1 text-lg font-semibold text-gray-900">{expectedPreviousQuantity}</p>
        </div>

        <Input
          id={targetId}
          type="number"
          label="Nova quantidade*"
          min={0}
          error={errors.targetQuantity?.message}
          {...register('targetQuantity')}
        />

        {hasValidPreview && (
          <p className="text-sm text-gray-700" aria-live="polite">
            {expectedPreviousQuantity} → {parsedTarget}
            <br />
            Diferença: {diffLabel}
          </p>
        )}

        <div>
          <label htmlFor={reasonId} className="block text-sm font-medium text-gray-700">
            Motivo*
          </label>
          <textarea
            id={reasonId}
            rows={3}
            aria-invalid={!!errors.reason}
            aria-describedby={errors.reason ? `${reasonId}-error` : undefined}
            className="mt-1 w-full rounded-md border border-gray-300 p-2 focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand"
            {...register('reason')}
          />
          {errors.reason && (
            <p id={`${reasonId}-error`} className="mt-1 text-xs text-red-700" role="alert">
              {errors.reason.message}
            </p>
          )}
        </div>

        {serverError && (
          <p className="text-sm text-red-700" role="alert">
            {serverError}
          </p>
        )}

        <div className="mt-4 flex items-center justify-end gap-2">
          <Button type="button" onClick={handleClose}>
            Cancelar
          </Button>
          <Button type="submit" variant="primary">
            Ajustar
          </Button>
        </div>
      </form>
    </Modal>
  );
}

export default AdjustmentFormModal;
