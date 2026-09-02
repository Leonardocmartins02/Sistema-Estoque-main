import { zodResolver } from '@hookform/resolvers/zod';
import { useEffect, useId, useMemo, useRef, useState } from 'react';
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

/**
 * Teto da baixa (Task 21 / F-01): a quantidade não pode exceder o saldo
 * disponível. **Simétrica à Task 18 (D-F)**, que aplica a mesma regra à saída
 * manual — duas saídas do mesmo sistema não podem ter regras diferentes sobre
 * a mesma quantidade.
 *
 * Vive **fora** de `schema` de propósito, pelo mesmo motivo do
 * `movementSchemaForBalance`: o schema base não conhece saldo nenhum e continua
 * sendo o contrato validável fora da UI; o teto só existe onde há um produto
 * com saldo em mãos.
 *
 * Isto **previne** o erro do usuário — não é a autoridade da regra. Quem decide
 * continua sendo o backend, dentro da transação com lock de linha
 * (`stockService.recordMovementInTx`, `SELECT … FOR UPDATE` + `newQuantity < 0`
 * ⇒ 422): entre abrir o diálogo e enviá-lo o saldo pode ter mudado, e nesse
 * caso o 422 é a resposta correta.
 */
export function quickOutSchemaForBalance(balance: number) {
  return schema.refine((values) => values.quantity <= balance, {
    path: ['quantity'],
    message: overBalanceMessage(balance),
  });
}

/** Nomeia o impedimento e informa o saldo disponível — nunca só "não pode". */
function overBalanceMessage(balance: number): string {
  return `Quantidade acima do saldo disponível (${formatQuantity(balance)} un.).`;
}

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

  const balanceSchema = useMemo(
    () => quickOutSchemaForBalance(product.currentBalance),
    [product.currentBalance],
  );

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
    setValue,
    watch,
  } = useForm<QuickOutFormValues>({
    resolver: zodResolver(balanceSchema),
    defaultValues: { quantity: 1, note: '' },
  });

  const quantity = watch('quantity', 1);
  // Sem `Math.max(0, …)`: o clamp é o que produzia o ramo morto "Estoque
  // negativo" (N-4) e fazia a quantidade impossível aparecer como um zero
  // plausível. Agora o saldo resultante é o número real, e o caso impossível é
  // tratado como impedimento — nunca renderizado como futuro.
  const validQuantity = Number.isFinite(quantity) && quantity > 0;
  const newBalance = product.currentBalance - (quantity || 0);
  const insufficient = validQuantity && newBalance < 0;

  // O impedimento derivado vale a partir da primeira tecla; o erro do schema só
  // existiria depois de uma tentativa de envio, tarde demais para explicar.
  const quantityError = insufficient
    ? overBalanceMessage(product.currentBalance)
    : errors.quantity?.message;

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
            {insufficient ? (
              // O impossível não tem saldo resultante para mostrar. `—` é a
              // mesma convenção de ausência do `formatBalanceTransition`, e o
              // motivo aparece abaixo — nunca um zero que pareça plausível.
              //
              // O teto vem JUNTO no texto desta célula, e não só na mensagem do
              // campo: quando o impedimento ocorre o foco já está no campo, e
              // uma troca de `aria-describedby` não é reanunciada com o foco
              // parado. Sem o número aqui, quem usa leitor de tela ouviria
              // "Saldo insuficiente" sem nunca saber qual é o saldo.
              <>
                <span className="text-section-title tabular-nums text-danger">—</span>
                <span className="block text-caption text-danger">
                  Saldo insuficiente · máx. {formatQuantity(product.currentBalance)} un.
                </span>
              </>
            ) : (
              <>
                <span
                  className={`text-section-title tabular-nums ${
                    newBalance === 0 ? 'text-warning' : 'text-text-primary'
                  }`}
                >
                  {formatQuantity(newBalance)}{' '}
                  <span className="text-body font-normal text-text-secondary">un.</span>
                </span>
                {/* "Estoque zerado" continua legítimo AQUI: a saída igual ao
                    saldo resulta em zero, que é um destino possível. */}
                {newBalance === 0 && (
                  <span className="block text-caption text-warning">Estoque zerado</span>
                )}
              </>
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
            // Teto = saldo disponível (F-01). Governa a seta do `number` e o
            // `aria-valuemax` do spinbutton — anunciar o dobro do saldo era
            // declarar à tecnologia assistiva um teto que o domínio recusa.
            // Digitar ou colar acima continua possível: por isso o impedimento
            // real não depende dele, e sim do schema.
            max={product.currentBalance}
            step={1}
            className="h-11 text-center tabular-nums"
            error={quantityError}
            // Composto à mão porque o preview é externo ao primitivo: o `Input`
            // monta `aria-describedby` a partir de `hint`/`error`, e a prop
            // passada aqui o substitui. A convenção `${id}-error` é do próprio
            // `ui/Input`.
            //
            // Impedido, a descrição é SÓ a mensagem: encadear o preview junto
            // faria o mesmo fato ser lido duas vezes, em duas redações — e a
            // mensagem já carrega o saldo. Fora do impedimento, o preview é a
            // descrição útil do campo.
            aria-describedby={quantityError ? `${quantityId}-error` : previewId}
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
            {/* O texto acompanha o teto real. Dizer "Sem limite máximo" com
                saldo zero era o convite exato que F-01 fecha. */}
            <span>Máx: {formatQuantity(product.currentBalance)} un.</span>
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
          {/*
            Indisponível enquanto a saída for impossível — por `aria-disabled`,
            não `disabled` (design-system.md §11.2: é a regra, não a exceção, e
            é o que a Task 18 aplicou à saída manual). Um `disabled` nativo sai
            da tabulação, e quem usa leitor de tela descobriria o bloqueio pela
            AUSÊNCIA de um controle, sem nada que explicasse o motivo.

            O `disabled` nativo permanece só para `quantidade <= 0` (QOM-8): ali
            não há razão a alcançar — o campo está vazio ou zerado.

            Quem de fato impede o envio é o schema
            (`quickOutSchemaForBalance`), não este atributo: a submissão falha
            na validação e o `shouldFocusError` do react-hook-form leva o foco
            ao campo, onde a explicação está associada por `aria-describedby`.
          */}
          <Button
            type="submit"
            variant="destructive"
            disabled={quantity <= 0}
            // `|| undefined` para não emitir `aria-disabled="false"` junto do
            // `disabled` nativo de `quantidade <= 0`: os dois no mesmo elemento
            // se contradizem, e ARIA in HTML proíbe a combinação.
            aria-disabled={insufficient || undefined}
            className={insufficient ? 'w-full cursor-not-allowed opacity-50 sm:w-auto' : 'w-full sm:w-auto'}
            isLoading={isSubmitting}
          >
            {isSubmitting ? 'Processando...' : 'Confirmar Baixa'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

export default QuickOutModal;
