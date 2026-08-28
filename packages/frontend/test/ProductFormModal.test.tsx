import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { updateProduct } from '../src/api/products';
import { ProductFormModal } from '../src/components/ProductFormModal';
import { ToastProvider } from '../src/components/ui/ToastProvider';

vi.mock('../src/api/products', () => ({
  createProduct: vi.fn(),
  updateProduct: vi.fn(),
}));

const mockedUpdateProduct = vi.mocked(updateProduct);

type Produto = { id: string; name: string; sku: string; minStock: number; description: string | null };

const CANETA: Produto = {
  id: 'p1',
  name: 'Caneta Esferográfica Azul',
  sku: 'PAP-014',
  minStock: 200,
  description: 'Caixa com 50 unidades.',
};

const CADERNO: Produto = {
  id: 'p2',
  name: 'Caderno Universitário 200 folhas',
  sku: 'PAP-001',
  minStock: 20,
  description: 'Capa dura.',
};

/**
 * Reproduz o uso real de `ProductFormModal` em `ProductDashboard`: a instância
 * de edição é montada UMA vez, enquanto nenhum produto está em edição
 * (`editing === null`), e depois é reaproveitada — só a prop `open` e os
 * `initialValues` mudam. É essa reutilização que o bug expõe; montar o modal
 * já aberto esconderia o problema.
 */
function Harness() {
  const [editing, setEditing] = useState<Produto | null>(null);

  return (
    <ToastProvider>
      <button type="button" onClick={() => setEditing(CANETA)}>
        Editar Caneta
      </button>
      <button type="button" onClick={() => setEditing(CADERNO)}>
        Editar Caderno
      </button>

      <ProductFormModal
        open={editing !== null}
        onOpenChange={(v) => {
          if (!v) setEditing(null);
        }}
        mode="edit"
        initialId={editing?.id}
        initialValues={{
          name: editing?.name,
          sku: editing?.sku,
          minStock: editing?.minStock,
          description: editing?.description ?? '',
        }}
      />
    </ToastProvider>
  );
}

const campoNome = () => screen.getByLabelText(/^Nome\*/i) as HTMLInputElement;
const campoSku = () => screen.getByLabelText(/^SKU\*/i) as HTMLInputElement;
const campoMinimo = () => screen.getByLabelText(/Estoque mínimo/i) as HTMLInputElement;
const campoDescricao = () => screen.getByLabelText(/Descrição/i) as HTMLTextAreaElement;

describe('ProductFormModal — modo edição carrega o produto selecionado', () => {
  beforeEach(() => {
    mockedUpdateProduct.mockReset();
    mockedUpdateProduct.mockResolvedValue({} as never);
  });

  it('preenche os campos com os dados do produto ao abrir a edição', async () => {
    const user = userEvent.setup();
    render(<Harness />);

    await user.click(screen.getByRole('button', { name: 'Editar Caneta' }));

    await screen.findByRole('dialog');
    expect(campoNome().value).toBe(CANETA.name);
    expect(campoSku().value).toBe(CANETA.sku);
    expect(campoMinimo().value).toBe(String(CANETA.minStock));
    expect(campoDescricao().value).toBe(CANETA.description);
  });

  it('não mantém nenhum valor do produto anterior ao editar outro produto', async () => {
    const user = userEvent.setup();
    render(<Harness />);

    // Produto A
    await user.click(screen.getByRole('button', { name: 'Editar Caneta' }));
    await screen.findByRole('dialog');
    expect(campoNome().value).toBe(CANETA.name);

    // Fecha
    await user.click(screen.getByRole('button', { name: /Cancelar/i }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());

    // Produto B
    await user.click(screen.getByRole('button', { name: 'Editar Caderno' }));
    await screen.findByRole('dialog');

    expect(campoNome().value).toBe(CADERNO.name);
    expect(campoSku().value).toBe(CADERNO.sku);
    expect(campoMinimo().value).toBe(String(CADERNO.minStock));
    expect(campoDescricao().value).toBe(CADERNO.description);
  });

  it('preserva a edição feita pelo usuário e envia os valores do produto correto', async () => {
    const user = userEvent.setup();
    render(<Harness />);

    await user.click(screen.getByRole('button', { name: 'Editar Caderno' }));
    await screen.findByRole('dialog');

    // Só o estoque mínimo é alterado — nome e SKU devem seguir para a API
    // com os valores do produto, sem o usuário precisar redigitá-los.
    await user.clear(campoMinimo());
    await user.type(campoMinimo(), '35');
    await user.click(screen.getByRole('button', { name: /Salvar/i }));

    await waitFor(() => expect(mockedUpdateProduct).toHaveBeenCalledTimes(1));
    expect(mockedUpdateProduct).toHaveBeenCalledWith(CADERNO.id, {
      name: CADERNO.name,
      sku: CADERNO.sku,
      minStock: 35,
      description: CADERNO.description,
    });
  });
});
