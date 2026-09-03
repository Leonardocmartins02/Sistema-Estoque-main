import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useId, useEffect, useRef, useState } from 'react';
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

  // A1 (Task 25, `implementation-plan.md` §9.3.3): heading real do passo
  // ativo (`confirm`/`conflict`). Só um desses dois `Modal` está montado por
  // vez — a mesma ref é reaproveitada entre eles.
  const titleRef = useRef<HTMLHeadingElement>(null);
  // Sinaliza que o próximo commit do step `form` veio do retorno via
  // "Revisar", para focar "Nova quantidade" só depois que o campo já existe
  // no DOM — evita a corrida entre `setStep('form')` e o input ainda não
  // montado.
  const focusTargetOnReviewRef = useRef(false);

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    setFocus,
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

  // A1: um único efeito controlado pela mudança real de `step` — nunca
  // refoca em renders causados por outros states (`mutation.isPending`,
  // `watch`, etc.). `confirm`/`conflict` focam o heading do passo recém
  // montado; o retorno ao `form` via "Revisar" consome a sinalização acima e
  // foca "Nova quantidade" através do react-hook-form, já com o campo
  // montado.
  useEffect(() => {
    if (step === 'confirm' || step === 'conflict') {
      titleRef.current?.focus();
      return;
    }
    if (step === 'form' && focusTargetOnReviewRef.current) {
      focusTargetOnReviewRef.current = false;
      setFocus('targetQuantity');
    }
  }, [step, setFocus]);

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
        // Se esta busca falha (rede, timeout de 8s do httpClient, sessão
        // expirada), NÃO há saldo real para mostrar — então não se entra no
        // passo de conflito fingindo que a revisão aconteceu. Cai no mesmo
        // caminho de erro genérico já usado abaixo: volta ao formulário com o
        // motivo preservado e uma mensagem explícita, de onde dá para tentar
        // de novo ou cancelar. A baseline continua a original, porque nada
        // novo foi confirmado.
        try {
          const fresh = await queryClient.fetchQuery({
            queryKey: ['products', 'detail', product.id],
            queryFn: () => fetchProduct(product.id),
          });
          setConflictActualBalance(fresh.balance);
          setStep('conflict');
        } catch {
          setServerError(
            'O estoque deste produto mudou, mas não foi possível obter o saldo atualizado. Verifique sua conexão e tente novamente.',
          );
          setStep('form');
        }
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
    // O botão usa aria-disabled (não disabled) para não perder o foco durante
    // o envio, então a proteção contra envio duplo vive aqui.
    if (!pending || mutation.isPending) return;
    mutation.mutate(pending);
  }

  // Única ação disponível no conflito além de cancelar: reconhece o saldo
  // real explicitamente, atualiza a baseline, limpa SÓ a quantidade (o
  // motivo já digitado é preservado) e volta ao formulário para uma nova
  // decisão — nunca reenvia sozinho.
  function handleReview() {
    if (conflictActualBalance === null) return;
    focusTargetOnReviewRef.current = true;
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
        titleRef={titleRef}
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
          {/* Único caminho de erro do fluxo que não era anunciado. Mesmo padrão
              do erro de campo e do erro de servidor mais abaixo neste arquivo. */}
          <p className="text-gray-700" role="alert">
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
        titleRef={titleRef}
        size="md"
        footer={
          <div className="flex items-center justify-end gap-2">
            <Button type="button" onClick={handleClose} disabled={mutation.isPending}>
              Cancelar
            </Button>
            {/* aria-disabled em vez de disabled: desabilitar o elemento que
                está com o foco o joga para o <body>, e como "Cancelar" também
                fica desabilitado o rodapé ficaria sem nenhum controle focável
                durante a requisição. O rótulo muda junto porque o spinner do
                Button é aria-hidden — sem isso o envio é silencioso para
                leitor de tela. */}
            <Button
              type="button"
              variant="primary"
              onClick={confirmAdjustment}
              aria-disabled={mutation.isPending}
              isLoading={mutation.isPending}
              className={mutation.isPending ? 'cursor-not-allowed opacity-50' : ''}
            >
              {mutation.isPending ? 'Confirmando...' : 'Confirmar ajuste'}
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
            {/* A5 (§14.2 regra 3, mesma estratégia da Task 19 /
                MovementHistoryModal): a seta é decorativa para AT; o texto
                `sr-only` ao lado diz a mesma transição em palavras. */}
            <dd className="font-medium text-gray-900">
              <span aria-hidden="true">
                {expectedPreviousQuantity} → {pending.targetQuantity}
              </span>
              <span className="sr-only">
                de {expectedPreviousQuantity} para {pending.targetQuantity}
              </span>
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

        {/*
          A4 (§9.3.3): o nó `aria-live` fica SEMPRE montado durante o step
          `form`, independentemente de `hasValidPreview` — só o conteúdo
          interno é condicional. Sem isso, o anúncio da nova quantidade após
          "Revisar" nunca dispara: a live region não existiria no momento em
          que o valor válido chega.
          A5: mesma estratégia da Task 19 — seta decorativa (`aria-hidden`) +
          equivalente textual `sr-only`.
        */}
        <p className="text-sm text-gray-700" aria-live="polite">
          {hasValidPreview && (
            <>
              <span aria-hidden="true">
                {expectedPreviousQuantity} → {parsedTarget}
              </span>
              <span className="sr-only">
                de {expectedPreviousQuantity} para {parsedTarget}
              </span>
              <br />
              Diferença: {diffLabel}
            </>
          )}
        </p>

        <div>
          <label htmlFor={reasonId} className="block text-sm font-medium text-gray-700">
            Motivo*
          </label>
          <textarea
            id={reasonId}
            rows={3}
            aria-invalid={!!errors.reason}
            aria-describedby={errors.reason ? `${reasonId}-error` : undefined}
            className={`mt-1 w-full resize-y rounded-control border ${errors.reason ? 'border-danger' : 'border-border-strong'} bg-surface p-2 text-sm outline-none transition hover:border-border-hover focus-visible:border-accent focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-surface`}
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
