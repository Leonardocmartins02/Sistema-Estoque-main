import { createRef } from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import Textarea from '../src/components/ui/Textarea';

/**
 * `Textarea` — contrato espelhado de `ui/Input` (`implementation-plan.md`,
 * Task 24 e §9.3.2/SD-3; `design-system.md` §11, §11.0; regra de `useId()` do
 * `CLAUDE.md`).
 *
 * Escopo destes testes: **apenas** o contrato acessível já estabelecido por
 * `ui/Input` na Task 6 (b96b237) — nome acessível obrigatório pelo tipo,
 * `useId()`, `hint`/`error` via `aria-describedby`, `aria-invalid`,
 * `forwardRef` e props nativas. Nada de cor, classe Tailwind ou formato do id
 * gerado pelo React: são detalhes de implementação, não contrato.
 */

describe('Textarea — nome acessível e associação do label', () => {
  it('associa o label ao campo, e o campo é um textarea', () => {
    render(<Textarea label="Descrição" />);

    const field = screen.getByLabelText('Descrição');
    expect(field.tagName).toBe('TEXTAREA');
  });

  it('respeita o id explícito quando ele é fornecido', () => {
    render(<Textarea label="Descrição" id="product-description" />);

    const field = screen.getByLabelText('Descrição');
    expect(field).toHaveAttribute('id', 'product-description');
  });

  it('sem id explícito, o label continua associado ao id gerado', () => {
    render(<Textarea label="Descrição" />);

    const field = screen.getByLabelText('Descrição');
    // Identidade, não formato: o id gerado é do React e não deve ser
    // congelado por teste — só a associação label/campo é contrato.
    expect(field.id).toBeTruthy();
    expect(document.querySelector(`label[for="${field.id}"]`)).toHaveTextContent('Descrição');
  });

  it('aceita aria-label no lugar de label', () => {
    render(<Textarea aria-label="Observação" />);

    expect(screen.getByLabelText('Observação')).toBeInTheDocument();
  });
});

describe('Textarea — hint e erro associados ao campo (§11.0 / dívida A6)', () => {
  it('o hint é referenciado por aria-describedby', () => {
    render(<Textarea label="Descrição" hint="Máximo de 500 caracteres" />);

    const field = screen.getByLabelText('Descrição');
    const describedBy = field.getAttribute('aria-describedby');
    expect(describedBy).toBeTruthy();
    expect(document.getElementById(describedBy!)).toHaveTextContent('Máximo de 500 caracteres');
  });

  it('o erro é referenciado por aria-describedby e marca aria-invalid', () => {
    render(<Textarea label="Descrição" error="Descrição é obrigatória" />);

    const field = screen.getByLabelText('Descrição');
    expect(field).toHaveAttribute('aria-invalid', 'true');

    const describedBy = field.getAttribute('aria-describedby');
    expect(describedBy).toBeTruthy();
    expect(document.getElementById(describedBy!)).toHaveTextContent('Descrição é obrigatória');
  });

  it('sem erro, o campo não é inválido nem tem descrição associada', () => {
    render(<Textarea label="Descrição" />);

    const field = screen.getByLabelText('Descrição');
    expect(field).not.toHaveAttribute('aria-invalid', 'true');
    expect(field).not.toHaveAttribute('aria-describedby');
  });

  it('não usa role="alert" por campo — o resumo global é de outra camada (SD-4)', () => {
    render(<Textarea label="Descrição" error="Descrição é obrigatória" />);

    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('com hint e erro juntos, o erro substitui o hint e é a única referência', () => {
    render(<Textarea label="Descrição" hint="Máximo de 500 caracteres" error="Descrição é obrigatória" />);

    const field = screen.getByLabelText('Descrição');

    // O erro é renderizado e o hint é suprimido — o contrato visual segue o
    // `ui/Input`, que também esconde o hint quando há erro.
    expect(screen.getByText('Descrição é obrigatória')).toBeInTheDocument();
    expect(screen.queryByText('Máximo de 500 caracteres')).not.toBeInTheDocument();

    const ids = (field.getAttribute('aria-describedby') ?? '').split(' ').filter(Boolean);

    // Toda referência de `aria-describedby` resolve para um elemento presente
    // no DOM — nenhuma referência pendurada. (`ui/Input` hoje referencia o id
    // do hint mesmo sem renderizá-lo; essa dívida do Input não é congelada
    // aqui, e o Input não é alterado nesta task.)
    const referenciados = ids.map((id) => document.getElementById(id));
    expect(referenciados.every((el) => el !== null)).toBe(true);

    // Somente o erro é referenciado. Os valores dos ids são derivados
    // internamente e não fazem parte do contrato.
    expect(referenciados.map((el) => el!.textContent)).toEqual(['Descrição é obrigatória']);
  });
});

describe('Textarea — props nativas e ref', () => {
  it('preserva props nativas de textarea', () => {
    render(<Textarea label="Descrição" rows={5} maxLength={500} placeholder="Detalhe o produto" disabled />);

    const field = screen.getByLabelText('Descrição');
    expect(field).toHaveAttribute('rows', '5');
    expect(field).toHaveAttribute('maxLength', '500');
    expect(field).toHaveAttribute('placeholder', 'Detalhe o produto');
    expect(field).toBeDisabled();
  });

  it('encaminha a ref para o elemento textarea', () => {
    const ref = createRef<HTMLTextAreaElement>();
    render(<Textarea label="Descrição" ref={ref} />);

    expect(ref.current).toBe(screen.getByLabelText('Descrição'));
    expect(ref.current).toBeInstanceOf(HTMLTextAreaElement);
  });
});

/**
 * Contrato de TIPO — nome acessível obrigatório pelo tipo, não pela convenção
 * (`design-system.md` §11; `implementation-plan.md` §9.3.2/SD-3).
 *
 * Espelha a union `LabelledProps` de `ui/Input`: `label` OU `aria-label`,
 * nunca nenhum dos dois. É a única regra do contrato que o runtime não
 * consegue provar — um componente sem nome acessível compila e renderiza,
 * só é inutilizável por leitor de tela. Quem reprova é o `tsc`.
 *
 * Esta função NUNCA é chamada: existe só para o `tsc --noEmit` avaliar os três
 * usos. O `tsconfig.json` do pacote já inclui `test`, então ela entra no
 * typecheck sem configuração nova.
 */
const _contratoDeNomeAcessivel = () => {
  // Válidos — cada um satisfaz um lado da union.
  const comLabel = <Textarea label="Descrição" />;
  const comAriaLabel = <Textarea aria-label="Observação" />;

  // @ts-expect-error — sem `label` e sem `aria-label` não há nome acessível:
  // o tipo DEVE rejeitar este uso, como `InputProps` já rejeita. Enquanto o
  // tipo aceitar, o `tsc` acusa esta diretiva como não utilizada (TS2578) —
  // e essa falha é justamente o RED de contrato de tipo.
  const semNomeAcessivel = <Textarea />;

  return [comLabel, comAriaLabel, semNomeAcessivel];
};
