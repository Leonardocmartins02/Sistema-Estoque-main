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
});
