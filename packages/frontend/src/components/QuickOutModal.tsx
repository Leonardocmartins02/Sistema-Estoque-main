import { zodResolver } from '@hookform/resolvers/zod';
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useForm } from 'react-hook-form';
import { z } from 'zod';

import { quickOutProduct } from '../api/quickOut';

import Button from './ui/Button';
import Input from './ui/Input';
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

export function QuickOutModal({ open, onOpenChange, product, onSuccess }: Props) {
  console.log('QuickOutModal renderizado', { 
    open, 
    product, 
    hasProduct: !!product,
    hasOnOpenChange: !!onOpenChange,
    hasOnSuccess: !!onSuccess
  });
  
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const { show: showToast } = useToast();
  const formRef = useRef<HTMLFormElement | null>(null);
  const [highlight, setHighlight] = useState(false);
  
  // Efeito para debug
  useEffect(() => {
    console.log('QuickOutModal - open mudou para:', open);
    console.log('QuickOutModal - product:', product);
    
    if (open) {
      console.log('Modal aberto, verificando elementos no DOM...');
      const modalElement = document.querySelector('[data-testid="quick-out-modal"]');
      console.log('Elemento do modal no DOM:', modalElement);
      
      if (modalElement) {
        console.log('Estilos do modal:', window.getComputedStyle(modalElement));
        // Força o foco para o modal
        (modalElement as HTMLElement).focus();
      } else {
        console.error('Elemento do modal não encontrado no DOM');
      }
    }
  }, [open, product]);

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

  // Atalhos de teclado: ESC para fechar, Enter para confirmar
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onOpenChange(false);
      }
      if (e.key === 'Enter') {
        // evita submit quando focado no textarea com Shift+Enter
        const el = document.activeElement as HTMLElement | null;
        const isTextArea = el && el.tagName === 'TEXTAREA';
        const isShift = (e as any).shiftKey;
        if (!isShift && !isSubmitting && !isTextArea) {
          e.preventDefault();
          formRef.current?.requestSubmit();
        }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onOpenChange, isSubmitting]);

  // Animação sutil ao alterar a quantidade (realça o novo saldo)
  useEffect(() => {
    if (!open) return;
    setHighlight(true);
    const t = setTimeout(() => setHighlight(false), 250);
    return () => clearTimeout(t);
  }, [quantity, open]);

  async function onSubmit(values: QuickOutFormValues) {
    console.log('Submetendo baixa rápida', { values, product });
    setServerError(null);
    setIsSubmitting(true);
    
    try {
      await quickOutProduct({
        productId: product.id,
        quantity: values.quantity,
        note: values.note || undefined,
      });
      
      reset();
      onOpenChange(false);
      onSuccess?.();
      
      showToast({
        type: 'success',
        message: `Baixa de ${values.quantity} unidade(s) registrada com sucesso!`,
      });
    } catch (e: any) {
      const errorMessage = e.response?.data?.message || 'Falha ao registrar baixa';
      setServerError(errorMessage);
      showToast({ type: 'error', message: errorMessage });
    } finally {
      setIsSubmitting(false);
    }
  }

  console.log('Preparando para renderizar QuickOutModal com open =', open);
  
  if (!open) {
    console.log('QuickOutModal não renderizado (open = false)');
    return null;
  }
  
  // Versão simplificada do modal para debug
  // Valores pré-definidos para baixa rápida
  const quickAmounts = [1, 5, 10, 25, 50];

  const modalContent = (
    <div
      data-testid="quick-out-modal"
      className="fixed inset-0 z-[10000] p-4 flex items-center justify-center bg-black/40 backdrop-blur-sm"
      onClick={(e) => e.target === e.currentTarget && onOpenChange(false)}
    >
      <div className="w-full max-w-md overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-2xl">
        {/* Cabeçalho */}
        <div className="px-6 py-5 border-b border-gray-200 bg-gradient-to-b from-white to-gray-50">
          <h2 className="text-[18px] font-semibold tracking-tight text-gray-900">Baixa Rápida de Estoque</h2>
          <p className="mt-1 text-sm text-gray-600">
            {product.name} <span className="text-gray-400">({product.sku})</span>
          </p>
        </div>
        
        <div className="p-6">
          <form ref={formRef} onSubmit={handleSubmit(onSubmit)} className="space-y-5">
            {/* Saldo Atual e Novo Saldo */}
            <div className="mb-6 grid grid-cols-2 gap-4 rounded-xl border border-gray-200 bg-gray-50/70 p-4">
              <div className="text-center">
                <label className="mb-1 block text-sm font-medium text-gray-600">Saldo Atual</label>
                <div className="text-2xl font-bold text-gray-900">
                  {product.currentBalance.toLocaleString('pt-BR')} <span className="font-normal text-gray-500">un.</span>
                </div>
              </div>
              <div className="text-center">
                <label className="mb-1 block text-sm font-medium text-gray-600">Novo Saldo</label>
                <div className={`text-2xl font-bold transition-all duration-200 ${
                  newBalance < 0 ? 'text-rose-600' : newBalance === 0 ? 'text-amber-600' : 'text-emerald-600'
                } ${highlight ? 'scale-[1.03]' : ''}`}>
                  {newBalance.toLocaleString('pt-BR')} <span className="font-normal text-gray-500">un.</span>
                  {newBalance < 0 && (
                    <div className="mt-1 text-xs font-normal text-rose-600">Estoque negativo</div>
                  )}
                  {newBalance === 0 && (
                    <div className="mt-1 text-xs font-normal text-amber-600">Estoque zerado</div>
                  )}
                </div>
              </div>
            </div>

            {/* Quantidade */}
            <div className="space-y-3">
              <label className="block text-sm font-medium text-gray-700">
                Quantidade para Baixa *
              </label>
              
              {/* Botões de quantidade rápida */}
              <div className="mb-3 grid grid-cols-5 gap-2">
                {quickAmounts.map((amount) => (
                  <button
                    key={amount}
                    type="button"
                    aria-pressed={quantity === amount}
                    onClick={() => setValue('quantity', amount, { shouldValidate: true })}
                    className={`rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                      quantity === amount
                        ? 'bg-indigo-600 text-white shadow'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    {amount}
                  </button>
                ))}
              </div>
              
              <Input
                id="quantity"
                type="number"
                min={1}
                max={product.currentBalance > 0 ? product.currentBalance * 2 : undefined}
                step={1}
                className="w-full text-center text-lg py-3 font-medium"
                {...register('quantity')}
                onChange={(e) => {
                  const value = parseInt(e.target.value) || 0;
                  setValue('quantity', value, { shouldValidate: true });
                }}
              />
              
              {errors.quantity && (
                <p className="mt-1 text-sm text-red-600 text-center">
                  {errors.quantity.message}
                </p>
              )}
              
              <div className="flex justify-between text-sm text-gray-500 mt-1">
                <span>Mín: 1 un.</span>
                <span>
                  {product.currentBalance > 0
                    ? `Máx: ${(product.currentBalance * 2).toLocaleString('pt-BR')} un.`
                    : 'Sem limite máximo'}
                </span>
              </div>
            </div>

            {/* Observação (mantida apenas uma seção) */}
            <div className="space-y-2">
              <label htmlFor="note" className="block text-sm font-medium text-gray-700">
                Observação (opcional)
              </label>
              <textarea
                id="note"
                rows={3}
                className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                placeholder="Ex: Motivo da baixa, destino, responsável..."
                {...register('note')}
              />
              <p className="text-xs text-gray-500">
                Máx. 255 caracteres
              </p>
            </div>

            {serverError && (
              <div className="rounded-md bg-red-50 p-4">
                <div className="flex">
                  <div className="flex-shrink-0">
                    <svg
                      className="h-5 w-5 text-red-400"
                      xmlns="http://www.w3.org/2000/svg"
                      viewBox="0 0 20 20"
                      fill="currentColor"
                      aria-hidden="true"
                    >
                      <path
                        fillRule="evenodd"
                        d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                        clipRule="evenodd"
                      />
                    </svg>
                  </div>
                  <div className="ml-3">
                    <h3 className="text-sm font-medium text-red-800">
                      {serverError}
                    </h3>
                  </div>
                </div>
              </div>
            )}

        {/* Observação (removida duplicidade) */}

        {serverError && (
          <div className="rounded-md bg-red-50 p-4">
            <div className="flex">
              <div className="flex-shrink-0">
                <svg
                  className="h-5 w-5 text-red-400"
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 20 20"
                  fill="currentColor"
                  aria-hidden="true"
                >
                  <path
                    fillRule="evenodd"
                    d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                    clipRule="evenodd"
                  />
                </svg>
              </div>
              <div className="ml-3">
                <h3 className="text-sm font-medium text-red-800">
                  {serverError}
                </h3>
              </div>
            </div>
          </div>
        )}

        {/* Ações */}
        <div className="flex flex-col justify-end gap-2 pt-6 sm:flex-row sm:space-x-3">
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
            disabled={isSubmitting || quantity <= 0}
            isLoading={isSubmitting}
            className="w-full sm:w-auto"
          >
            {isSubmitting ? 'Processando...' : 'Confirmar Baixa'}
          </Button>
        </div>
      </form>
      </div>
    </div>
  </div>
  );

  // Usa portal para evitar problemas de z-index/stacking context
  return createPortal(modalContent, document.body);
}

export default QuickOutModal;
