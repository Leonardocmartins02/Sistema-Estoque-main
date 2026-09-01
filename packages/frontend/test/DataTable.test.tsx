import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { DataTable } from '../src/components/ui/DataTable';

type Row = { id: string; name: string };

const items: Row[] = [
  { id: '1', name: 'Caneta' },
  { id: '2', name: 'Caderno' },
];

describe('DataTable', () => {
  it('não cria paradas de tab vazias nas linhas', () => {
    render(
      <DataTable<Row>
        columns={[{ key: 'name', header: 'Nome' }]}
        items={items}
        getRowId={(r) => r.id}
      />,
    );

    const rows = screen.getAllByRole('row').slice(1); // ignora cabeçalho
    for (const row of rows) {
      expect(row).not.toHaveAttribute('tabindex');
    }
  });

  it('mensagens de erro e carregamento são anunciadas por leitores de tela', () => {
    const { rerender } = render(
      <DataTable<Row>
        columns={[{ key: 'name', header: 'Nome' }]}
        items={[]}
        getRowId={(r) => r.id}
        error="Erro ao carregar produtos"
      />,
    );
    expect(screen.getByRole('alert')).toHaveTextContent('Erro ao carregar produtos');

    rerender(
      <DataTable<Row>
        columns={[{ key: 'name', header: 'Nome' }]}
        items={[]}
        getRowId={(r) => r.id}
        isLoading
      />,
    );
    expect(screen.getByRole('status')).toHaveTextContent('Carregando');
  });

  it('estado vazio é anunciado (A-12ʳ): erro e carregando já eram, vazio ficava mudo', () => {
    render(
      <DataTable<Row>
        columns={[{ key: 'name', header: 'Nome' }]}
        items={[]}
        getRowId={(r) => r.id}
        empty={<span>Nada por aqui</span>}
      />,
    );
    expect(screen.getByRole('status')).toHaveTextContent('Nada por aqui');
  });

  it('célula de dados é selecionável — select-none fica restrito ao cabeçalho clicável (A-5)', () => {
    render(
      <DataTable<Row>
        columns={[{ key: 'name', header: 'Nome' }]}
        items={items}
        getRowId={(r) => r.id}
      />,
    );
    const cell = screen.getAllByRole('cell')[0];
    expect(cell.className).not.toContain('select-none');
  });

  it('cabeçalho ordenável sem headerRender expõe rótulo + indicador (M-8)', () => {
    render(
      <DataTable<Row>
        columns={[{ key: 'name', header: 'Nome', sortable: true }]}
        items={items}
        getRowId={(r) => r.id}
        sorts={[]}
        onSortsChange={() => {}}
      />,
    );
    const button = screen.getByRole('button', { name: /Ordenar por Nome/i });
    expect(button).toHaveTextContent('Nome');
  });

  it('aria-sort só aparece na coluna primária — as demais não carregam "none" (A-8ʳ)', () => {
    render(
      <DataTable<Row>
        columns={[
          { key: 'name', header: 'Nome', sortable: true },
          { key: 'id', header: 'Id', sortable: true },
        ]}
        items={items}
        getRowId={(r) => r.id}
        sorts={[{ by: 'name', dir: 'asc' }]}
        onSortsChange={() => {}}
      />,
    );
    const nameHeader = screen.getByRole('button', { name: /Ordenar por Nome/i }).closest('th');
    const idHeader = screen.getByRole('button', { name: /Ordenar por Id/i }).closest('th');
    expect(nameHeader).toHaveAttribute('aria-sort', 'ascending');
    expect(idHeader).not.toHaveAttribute('aria-sort');
  });
});
