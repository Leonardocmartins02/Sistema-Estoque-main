import { zodResolver } from '@hookform/resolvers/zod';
import { useEffect, useId, useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';

import { ApiRequestError } from '../api/httpClient';
import { quickOutProduct } from '../api/quickOut';
import { formatQuantity } from '../lib/formatNumber';

import Button from './ui/Button';
import Input from './ui/Input';
import { Modal } from './ui/Modal';
import { useToast } from './ui/ToastProvider';

const schema = z.object({
  quantity: z.coerce.number().int().positive('Quantidade deve ser maior que zero'),
  note: z.string().optional(),
});

type QuickOutFormValues = z.infer<typeof schema>;

type Props = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  product: {
    id: string;
    name: string;
    sku: string;
    currentBalance: number;
  };
  onSuccess?: () => void;
};

/** Valores frequentes de operação — o caminho curto que justifica a baixa rápida. */
const QUICK_AMOUNTS = [1, 5, 10, 25, 50];

/**
 * Baixa rápida migrada para o primitivo único de diálogo (Task 20).
 *
 * Este componente tinha **a melhor ideia de interação do produto** — o saldo
 * resultante recalculado a cada tecla — dentro do pior invólucro técnico:
 * portal montado à mão, sem `role="dialog"`, sem `aria-modal`, sem focus trap,
 * sem retorno de foco, sem bloqueio de scroll (C-1), sem `max-height` (A-13), e
 * com um listener de teclado **global no `window`** que interceptava o Enter da
 * página inteira. A ideia sobrevive; a embalagem, não.
 *
 * O que substitui o listener global: Escape e o trap vêm do Radix, através do
 * `Modal`; Enter volta a ser a **submissão nativa do `<form>`** — por isso as
 * ações ficam dentro do formulário, e não na região `footer` do primitivo (mesmo
 * arranjo do `MovementFormModal`). A proteção contra baixa duplicada deixa de
 * depender do listener e passa a viver no próprio envio (`submittingRef`).
 *
 * **F-01 não entra aqui** — o teto do campo (`saldo × 2`) e o vocabulário do
 * preview são da Task 21, imediatamente a seguir; T20 + T21 são uma unidade
 * atômica de entrega.
 */
export function QuickOutModal({ open, onOpenChange, product, onSuccess }: Props) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const { show: showToast } = useToast();
  const quantityId = useId();
  const noteId = useId();
  const previewId = useId();
  const quantityRef = useRef<HTMLInputElement | null>(null);
  // Guarda de reentrância: com a submissão nativa de volta, dois Enter seguidos
  // chegariam ao mesmo handler antes de o estado re-renderizar. Uma baixa
  // duplicada é permanente e não tem desfazer — o atributo `disabled` do botão
  // não protege o atalho de teclado.
  const submittingRef = useRef(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
    setValue,
    watch,
  } = useForm<QuickOutFormValues>({
    resolver: zodResolver(schema),
    defaultValues: { quantity: 1, note: '' },
  });

  const quantity = watch('quantity', 1);
  const newBalance = Math.max(0, product.currentBalance - (quantity || 0));

  const { ref: registerQuantityRef, ...quantityField } = register('quantity');

  // Foco inicial declarado (REV-14): o Radix focaria o primeiro elemento
  // tabulável do diálogo, que é o "Fechar" no cabeçalho — tecnicamente "foco
  // dentro do diálogo", na prática um passo a mais antes de digitar. O
  // `setTimeout` roda depois do foco automático do Radix, dentro do trap.
  useEffect(() => {
    if (!open) return;
    const id = window.setTimeout(() => quantityRef.current?.focus(), 0);
    return () => window.clearTimeout(id);
  }, [open]);

  async function onSubmit(values: QuickOutFormValues) {
    if (submittingRef.current) return;
    submittingRef.current = true;
    setServerError(null);
    setIsSubmitting(true);

    try {
      const response = await quickOutProduct({
        productId: product.id,
        quantity: values.quantity,
        note: values.note || undefined,
      });

      reset();
      onOpenChange(false);
      onSuccess?.();

      // O saldo anunciado vem da RESPOSTA do backend (`newBalance`), nunca de
      // cálculo sobre o cache da listagem — que pode estar velho. Sem ele, o
      // toast declara a quantidade e **omite** o saldo em vez de inventá-lo.
      const balance = response?.newBalance;
      showToast({
        type: 'success',
        message:
          balance == null
            ? `Baixa de ${formatQuantity(values.quantity)} unidade(s) registrada com sucesso!`
            : `Baixa de ${formatQuantity(values.quantity)} unidade(s) registrada com sucesso! Novo saldo: ${formatQuantity(balance)} un.`,
      });
    } catch (e) {
      // O projeto não usa axios: `apiFetch` lança `ApiRequestError` com a mensagem
      // já sanitizada pelo backend em `.message`. Qualquer outro erro (bug de
      // runtime, etc.) não é seguro de exibir e cai no texto genérico.
      const errorMessage =
        e instanceof ApiRequestError && e.message ? e.message : 'Falha ao registrar baixa';
      setServerError(errorMessage);
      showToast({ type: 'error', message: errorMessage });
    } finally {
      submittingRef.current = false;
      setIsSubmitting(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={() => onOpenChange(false)}
      title="Baixa Rápida de Estoque"
      description={`${product.name} · SKU ${product.sku}`}
      size="md"
    >
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        {/*
          Preview vivo (QOM-7) — promovido a elemento do sistema, sem o número
          gigante, o gradiente e o realce em `scale` (transformação em elemento
          não interativo, proibida por §16).

          `aria-live="polite"`: a consequência muda a cada tecla, sem interação
          direta com este bloco. Também é o alvo do `aria-describedby` do campo
          (A-14ʳ), para que quem chega ao campo saiba o que ele produz.
        */}
        <div
          id={previewId}
          className="grid grid-cols-2 gap-4 rounded-surface border border-border bg-surface-subtle p-3"
        >
          <div>
            <span className="block text-caption text-text-secondary">Saldo Atual</span>
            <span className="text-section-title tabular-nums text-text-primary">
              {formatQuantity(product.currentBalance)}{' '}
              <span className="text-body font-normal text-text-secondary">un.</span>
            </span>
          </div>
          {/*
            A live region é a CÉLULA, não o container, e é `aria-atomic`: só o
            novo saldo muda, e um `aria-live` no container anunciaria o número
            sozinho — "7 un.", indistinguível do saldo atual. Atômica na célula,
            o que se ouve é "Novo Saldo 7 un.". O container continua sendo o
            alvo do `aria-describedby` do campo, com os dois valores.
          */}
          <div aria-live="polite" aria-atomic="true">
            <span className="block text-caption text-text-secondary">Novo Saldo</span>
            <span
              className={`text-section-title tabular-nums ${
                newBalance === 0 ? 'text-warning' : 'text-text-primary'
              }`}
            >
              {formatQuantity(newBalance)}{' '}
              <span className="text-body font-normal text-text-secondary">un.</span>
            </span>
            {newBalance === 0 && (
              <span className="block text-caption text-warning">Estoque zerado</span>
            )}
          </div>
        </div>

        <div className="space-y-2">
          {/*
            Alvos de 44px em 320–375px: cinco colunas de `h-11`, sem quebra.

            O grupo é nomeado porque o rótulo visível do campo passou a vir do
            primitivo `Input` — ou seja, DEPOIS da grade. Sem isto, quem chega
            aqui por Shift+Tab ouve "50, botão alternar" e não tem como saber
            que o botão define uma quantidade.

            O nome do grupo evita a palavra "Quantidade" de propósito: ele
            entraria em `getByLabelText(/Quantidade/i)` junto com o campo, e o
            nome do CAMPO é o que precisa ser inequívoco.
          */}
          <div role="group" aria-label="Valores frequentes" className="grid grid-cols-5 gap-2">
            {QUICK_AMOUNTS.map((amount) => (
              <Button
                key={amount}
                type="button"
                variant="shortcut"
                aria-pressed={quantity === amount}
                onClick={() => setValue('quantity', amount, { shouldValidate: true })}
                className={`h-11 w-full border ${
                  quantity === amount
                    ? 'border-accent bg-accent-subtle text-accent-subtle-text'
                    : 'border-border-strong'
                }`}
              >
                {amount}
              </Button>
            ))}
          </div>

          <Input
            id={quantityId}
            label="Quantidade*"
            type="number"
            // O `*` do rótulo é convenção visual e não chega à tecnologia
            // assistiva (NVDA silencia a pontuação). `required` expõe o estado
            // de fato, via `aria-required` nativo do spinbutton.
            required
            min={1}
            // O teto continua sendo `saldo × 2` nesta task: trocá-lo por `saldo`
            // é a Task 21 (F-01), com o vocabulário de impedimento que ele exige.
            max={product.currentBalance > 0 ? product.currentBalance * 2 : undefined}
            step={1}
            className="h-11 text-center tabular-nums"
            error={errors.quantity?.message}
            // Composto à mão porque o preview é externo ao primitivo: o `Input`
            // monta `aria-describedby` a partir de `hint`/`error`, e a prop
            // passada aqui o substitui — então o id do erro entra junto. A
            // convenção `${id}-error` é do próprio `ui/Input`.
            aria-describedby={
              errors.quantity?.message ? `${previewId} ${quantityId}-error` : previewId
            }
            {...quantityField}
            ref={(el) => {
              registerQuantityRef(el);
              quantityRef.current = el;
            }}
            onChange={(e) => {
              const value = parseInt(e.target.value) || 0;
              setValue('quantity', value, { shouldValidate: true });
            }}
          />

          <div className="flex justify-between text-caption text-text-secondary">
            <span>Mín: 1 un.</span>
            <span>
              {product.currentBalance > 0
                ? `Máx: ${formatQuantity(product.currentBalance * 2)} un.`
                : 'Sem limite máximo'}
            </span>
          </div>
        </div>

        <div className="space-y-1">
          <label htmlFor={noteId} className="block text-label text-text-primary">
            Observação (opcional)
          </label>
          {/* A ajuda "Máx. 255 caracteres" saiu (N-1): não era validada no Zod
              do frontend, nem no do backend, nem no Prisma. */}
          <textarea
            id={noteId}
            rows={3}
            className="w-full rounded-control border border-border-strong bg-surface p-2 text-body outline-none transition-colors duration-120 hover:border-border-hover focus-visible:border-accent focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-surface"
            placeholder="Ex: Motivo da baixa, destino, responsável..."
            {...register('note')}
          />
        </div>

        {/* Erro assíncrono do servidor: `role="alert"` é o caso em que ele de
            fato ajuda (§11.0), e a mensagem é persistente até nova ação. */}
        {serverError && (
          <div role="alert" className="rounded-control bg-danger-subtle p-3">
            <h3 className="text-body font-medium text-danger">{serverError}</h3>
          </div>
        )}

        <div className="flex flex-col justify-end gap-2 pt-2 sm:flex-row">
          <Button
            type="button"
            variant="ghost"
            onClick={() => onOpenChange(false)}
            disabled={isSubmitting}
            className="w-full sm:w-auto"
          >
            Cancelar
          </Button>
          <Button
            type="submit"
            variant="destructive"
            disabled={quantity <= 0}
            isLoading={isSubmitting}
            className="w-full sm:w-auto"
          >
            {isSubmitting ? 'Processando...' : 'Confirmar Baixa'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

export default QuickOutModal;
