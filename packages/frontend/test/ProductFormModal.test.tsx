import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { createProduct, updateProduct } from '../src/api/products';
import { ProductFormModal } from '../src/components/ProductFormModal';
import { ToastProvider } from '../src/components/ui/ToastProvider';

vi.mock('../src/api/products', () => ({
  createProduct: vi.fn(),
  updateProduct: vi.fn(),
}));

const mockedCreateProduct = vi.mocked(createProduct);
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

/**
 * Reproduz o uso real do modo `create` em `ProductDashboard`: a instância é
 * montada UMA vez com `open={false}` e só a prop `open` muda — não há
 * `initialId`/`initialValues`. Montar o modal já aberto, ou remontá-lo a cada
 * abertura, esconderia F-10: o `serverError` sobrevive justamente porque o
 * componente permanece montado entre fechar e reabrir.
 */
function CreateHarness() {
  const [aberto, setAberto] = useState(false);

  return (
    <ToastProvider>
      <button type="button" onClick={() => setAberto(true)}>
        Novo Produto
      </button>

      <ProductFormModal open={aberto} onOpenChange={setAberto} mode="create" />
    </ToastProvider>
  );
}

const campoEstoqueInicial = () => screen.getByLabelText(/Estoque inicial/i) as HTMLInputElement;

/** O erro do servidor vive DENTRO do diálogo. O toast de erro é outra camada e
 *  persiste até dispensa manual (`ToastProvider`, A-11) — consultar a tela
 *  inteira faria o toast responder por F-10 e mascarar o resultado. */
const dialogo = () => screen.getByRole('dialog');

describe('ProductFormModal — modo criação', () => {
  beforeEach(() => {
    mockedCreateProduct.mockReset();
    mockedCreateProduct.mockResolvedValue({} as never);
  });

  it('envia à API exatamente os valores preenchidos pelo usuário', async () => {
    const user = userEvent.setup();
    render(<CreateHarness />);

    await user.click(screen.getByRole('button', { name: 'Novo Produto' }));
    await screen.findByRole('dialog');

    // Valores discriminativos: nenhum coincide com default do formulário, então
    // um campo trocado por outro no payload faz o teste falhar.
    await user.type(campoNome(), 'Grampeador Metálico 26/6');
    // SKU digitado já em maiúsculas de propósito: a exibição em caixa alta é
    // só CSS (`uppercase`) e a política de normalização é F-05, fora de escopo
    // (§9, D-C). O teste não afirma nem nega normalização.
    await user.type(campoSku(), 'PAP-777');
    await user.type(campoEstoqueInicial(), '12');
    await user.clear(campoMinimo());
    await user.type(campoMinimo(), '5');
    await user.type(campoDescricao(), 'Caixa com 10 unidades.');

    await user.click(screen.getByRole('button', { name: /Salvar/i }));

    await waitFor(() => expect(mockedCreateProduct).toHaveBeenCalledTimes(1));
    expect(mockedCreateProduct).toHaveBeenCalledWith({
      name: 'Grampeador Metálico 26/6',
      sku: 'PAP-777',
      minStock: 5,
      initialStock: 12,
      description: 'Caixa com 10 unidades.',
    });
  });

  it('bloqueia o envio com obrigatórios vazios e associa a mensagem ao campo inválido', async () => {
    const user = userEvent.setup();
    render(<CreateHarness />);

    await user.click(screen.getByRole('button', { name: 'Novo Produto' }));
    await screen.findByRole('dialog');

    // Nome e SKU já nascem vazios no modo create.
    await user.click(screen.getByRole('button', { name: /Salvar/i }));

    // Mensagem real do schema (`ProductFormModal.tsx`), não uma inventada.
    await screen.findByText('Informe o nome');
    expect(mockedCreateProduct).not.toHaveBeenCalled();

    // A mensagem existir na tela não basta: quem usa leitor de tela precisa
    // saber QUAL campo está inválido e ouvir o motivo ao focá-lo (§11.0, A6).
    const nome = campoNome();
    expect(nome).toHaveAttribute('aria-invalid', 'true');

    const descrito = nome.getAttribute('aria-describedby');
    expect(descrito).toBeTruthy();
    const mensagem = document.getElementById(descrito!.split(' ')[0]);
    expect(mensagem).toHaveTextContent('Informe o nome');
  });

  it('mostra ao usuário o erro devolvido pelo servidor', async () => {
    const user = userEvent.setup();
    mockedCreateProduct.mockRejectedValue(new Error('SKU já cadastrado para outro produto.'));

    render(<CreateHarness />);
    await user.click(screen.getByRole('button', { name: 'Novo Produto' }));
    await screen.findByRole('dialog');

    await user.type(campoNome(), 'Grampeador Metálico 26/6');
    await user.type(campoSku(), 'PAP-777');
    await user.click(screen.getByRole('button', { name: /Salvar/i }));

    // Erro assíncrono do servidor: `role="alert"` é exigido pelo §11.0 e
    // permanece mesmo depois dos primitivos (SD-4) — é erro global do
    // formulário, não erro de campo.
    const alerta = await within(dialogo()).findByRole('alert');
    expect(alerta).toHaveTextContent('SKU já cadastrado para outro produto.');
  });

  it('não mostra o erro do servidor anterior ao reabrir o formulário (F-10)', async () => {
    const user = userEvent.setup();
    mockedCreateProduct.mockRejectedValue(new Error('SKU já cadastrado para outro produto.'));

    render(<CreateHarness />);

    // 1-2. Abrir e provocar a falha.
    await user.click(screen.getByRole('button', { name: 'Novo Produto' }));
    await screen.findByRole('dialog');
    await user.type(campoNome(), 'Grampeador Metálico 26/6');
    await user.type(campoSku(), 'PAP-777');
    await user.click(screen.getByRole('button', { name: /Salvar/i }));

    // 3. O erro apareceu.
    expect(
      await within(dialogo()).findByText('SKU já cadastrado para outro produto.'),
    ).toBeInTheDocument();

    // 4. Fechar de verdade, pelo botão — sem mexer em state por fora.
    await user.click(screen.getByRole('button', { name: /Cancelar/i }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());

    // 5. Reabrir.
    await user.click(screen.getByRole('button', { name: 'Novo Produto' }));
    await screen.findByRole('dialog');

    // 6. Antes de qualquer novo envio, o formulário está limpo: o erro da
    // tentativa anterior não pode acusar de falho um formulário que o usuário
    // ainda nem submeteu.
    expect(
      within(dialogo()).queryByText('SKU já cadastrado para outro produto.'),
    ).not.toBeInTheDocument();
  });
});
