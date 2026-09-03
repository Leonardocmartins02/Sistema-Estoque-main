import { zodResolver } from '@hookform/resolvers/zod';
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';

import { createProduct, updateProduct } from '../api/products';

import Button from './ui/Button';
import { Input } from './ui/Input';
import Modal from './ui/Modal';
import { Textarea } from './ui/Textarea';
import { useToast } from './ui/ToastProvider';

const schema = z.object({
  name: z.string().min(1, 'Informe o nome'),
  sku: z.string().min(1, 'Informe o SKU'),
  minStock: z.coerce.number().int().min(0, 'Estoque mínimo deve ser >= 0'),
  initialStock: z.coerce
    .number()
    .int()
    .min(0, 'Estoque inicial deve ser >= 0')
    .default(0),
  description: z.string().optional().or(z.literal('')),
});

// Types aligned with ZodResolver: input (raw) vs output (after coercion/defaults)
export type ProductFormInput = z.input<typeof schema>;
export type ProductFormValues = z.output<typeof schema>;

type Props = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  mode: 'create' | 'edit';
  initialId?: string;
  initialValues?: Partial<ProductFormValues>;
  onSuccess?: () => void;
};

export function ProductFormModal({ open, onOpenChange, mode, initialId, initialValues, onSuccess }: Props) {
  const [serverError, setServerError] = useState<string | null>(null);
  const { show: showToast } = useToast();

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    reset,
  } = useForm({
    resolver: zodResolver(schema),
    defaultValues: {
      name: initialValues?.name ?? '',
      sku: initialValues?.sku ?? '',
      minStock: initialValues?.minStock ?? 0,
      initialStock: 0,
      description: initialValues?.description ?? '',
    },
  });

  // `defaultValues` do react-hook-form é lido UMA vez, na montagem. Esta
  // instância é montada pelo `ProductDashboard` enquanto nenhum produto está em
  // edição (`editing === null`, portanto todos os `initialValues` indefinidos) e
  // depois é reaproveitada — só `open` e `initialValues` mudam. Sem este efeito,
  // abrir a edição mostrava o formulário com os valores da primeira montagem
  // (vazios) em vez dos do produto selecionado, e salvar era bloqueado pelo Zod
  // com "Informe o nome" / "Informe o SKU".
  //
  // Dependências deliberadas: `initialValues` é um objeto literal novo a cada
  // render do pai, então depender da identidade dele resetaria o formulário no
  // meio da digitação. O que define quando recarregar é a abertura do diálogo e
  // qual produto ele está editando.
  useEffect(() => {
    if (!open) return;
    // F-10: o erro do servidor pertence à TENTATIVA de envio, não ao
    // formulário. Como esta instância permanece montada entre fechar e
    // reabrir, sem esta linha o erro da tentativa anterior acusava de falho um
    // formulário que o usuário ainda nem submeteu. Limpar aqui — e não no
    // submit — é o que cobre reabrir e trocar o produto em edição.
    setServerError(null);
    reset({
      name: initialValues?.name ?? '',
      sku: initialValues?.sku ?? '',
      minStock: initialValues?.minStock ?? 0,
      initialStock: 0,
      description: initialValues?.description ?? '',
    });
  }, [open, initialId, reset]);

  // Submit logic is inlined into handleSubmit below to simplify generic typing

  const title = mode === 'create' ? 'Novo Produto' : 'Editar Produto';

  return (
    <Modal
      open={open}
      onClose={() => onOpenChange(false)}
      title={title}
      description="Preencha os campos abaixo. Todos os campos com * são obrigatórios."
    >
      <form
        onSubmit={handleSubmit(async (values) => {
              setServerError(null);
              try {
                if (mode === 'create') {
                  await createProduct({
                    name: values.name,
                    sku: values.sku,
                    minStock: values.minStock,
                    initialStock: values.initialStock ?? 0,
                    description: values.description || undefined,
                  });
                  showToast({ type: 'success', message: 'Produto criado com sucesso.' });
                } else if (mode === 'edit' && initialId) {
                  await updateProduct(initialId, {
                    name: values.name,
                    sku: values.sku,
                    minStock: values.minStock,
                    description: values.description || undefined,
                  });
                  showToast({ type: 'success', message: 'Produto atualizado com sucesso.' });
                }
                reset();
                onOpenChange(false);
                onSuccess?.();
              } catch (e: any) {
                setServerError(e?.message || 'Falha ao salvar produto');
                showToast({ type: 'error', message: e?.message || 'Falha ao salvar produto' });
              }
            })}
        className="space-y-3"
      >
            <Input
              label="Nome*"
              error={errors.name?.message}
              {...register('name')}
            />

            {/* `uppercase` é só exibição (F-05, §9/D-C): a política de
                normalização do dado segue pendente e não é decidida aqui. */}
            <Input
              label="SKU*"
              className="uppercase tracking-wide"
              error={errors.sku?.message}
              {...register('sku')}
            />

            {mode === 'create' && (
              <Input
                label="Estoque inicial (opcional)"
                type="number"
                min={0}
                placeholder="Ex.: 10"
                hint="Se informado, será lançado automaticamente como uma Entrada (IN) ao salvar o produto."
                error={errors.initialStock?.message}
                {...register('initialStock')}
              />
            )}

            <Input
              label="Estoque mínimo*"
              type="number"
              min={0}
              hint="Usado apenas para alerta na lista quando o saldo ficar abaixo desse valor. Não altera o saldo."
              error={errors.minStock?.message}
              {...register('minStock')}
            />

            <Textarea
              label="Descrição"
              rows={3}
              error={errors.description?.message}
              {...register('description')}
            />

            {serverError && (
              <p className="text-sm text-red-700" role="alert">
                {serverError}
              </p>
            )}

            <div className="mt-4 flex items-center justify-end gap-2">
              <Button type="button" onClick={() => onOpenChange(false)}>Cancelar</Button>
              <Button type="submit" variant="primary" isLoading={isSubmitting}>
                {isSubmitting ? 'Salvando...' : 'Salvar'}
              </Button>
            </div>
      </form>
    </Modal>
  );
}

export default ProductFormModal;
