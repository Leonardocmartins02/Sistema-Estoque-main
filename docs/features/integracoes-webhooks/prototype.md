# PROTOTYPE — Tela de Integrações

> Tarefa 7 do `implementation-plan.md`. Valida a tela antes da implementação (Tarefa 8). Nenhum componente foi criado ou alterado — só o protótipo estático `prototype/integracoes.html` e este documento. Mesmas regras do protótipo da Fase 6 (`docs/ui-ux/prototype/README.md`): HTML + CSS puro, sem script, sem dependência, dados fictícios; **não é código de produção**.

## Protótipo executável foi necessário?

**Sim, estático.** Diferente do Ajuste de Estoque (que só recompunha componentes existentes), esta é uma **tela nova** com vocabulário novo (situações de entrega, saúde do destino, segredo exibido uma vez). As decisões abaixo são de composição e de texto — precisam ser **vistas** para serem aprovadas, mas não dependem de comportamento em tempo de execução.

Componentes reais lidos para o protótipo não inventar padrão: `App.tsx` (shell), `ProductDashboard.tsx` + `products/ProductsTable.tsx` (página com região de dados, ação primária por linha + overflow), `ui/MenuPopover.tsx` (menu com separador), `MovementHistoryModal.tsx` (lista paginada filtrável em modal), `MovementFormModal.tsx`/`AdjustmentFormModal.tsx` (formulário + erro do servidor), `ui/ConfirmDialog.tsx` + `hooks/useConfirm.tsx`, `ui/Badge.tsx`, `ui/ToastProvider.tsx`. Tokens e regras: `docs/ui-ux/design-system.md`.

Abrir `prototype/integracoes.html` direto no navegador.

## Decisões que precisam de aprovação

| # | Decisão | Alternativa descartada | Por quê |
|---|---|---|---|
| D1 | **Navegação primária no cabeçalho**: "Estoque" · "Integrações", item ativo com `aria-current="page"` (fundo `accent-subtle` + filete `accent` — dois sinais, nunca só cor). A visão ativa fica no hash (`#integracoes`) | Roteador (`react-router`) | Duas telas não justificam dependência de roteamento (decidido no PLAN); o hash dá recarregar no lugar e link direto |
| D2 | **Entregas em modal grande**, no padrão do `MovementHistoryModal` (âncora + filtro + lista paginada) | Página própria com rota | Mesmo padrão que o usuário já conhece para "histórico de algo"; não cria terceira tela na navegação |
| D3 | **Ação primária da linha = "Ver entregas"**; o resto no "⋯" (Enviar teste, Editar, Gerar novo segredo · separador · Desativar/Ativar, Excluir) | Botões soltos na linha | Mesma hierarquia de Produtos: uma PRIMARY por linha (§10.1), destrutivas depois do separador (D3 da Fase 5). Em destino desativado, "Ver entregas" vira SECONDARY — não há o que acompanhar em tempo real |
| D4 | **Vocabulário e cor das situações** (cor nunca sozinha — sempre a palavra) | — | Ver tabela abaixo. O `Badge` não tem variante neutra e o design system é fechado (§3.1), então os estados "em andamento" usam `info` |
| D5 | **Segredo é um passo do mesmo modal**, depois de criar/gerar. Fechar só por "Já copiei"; Esc e ✕ pedem confirmação | Toast com o segredo / segredo na lista | O segredo não volta (PRD, RF 6). Um toast some sozinho; fechar sem copiar tem que ser decisão explícita |
| D6 | **Desativar e Gerar novo segredo pedem confirmação destrutiva** (`useConfirm`), com a consequência concreta no corpo | Ação direta | Desativar cancela a fila e descarta eventos do período; gerar segredo quebra o receptor até ele ser atualizado — as duas têm efeito fora da tela |
| D8 | **Lista de destinos troca tabela → cards em 1024px (`lg`)**, não em 768px como Produtos. Cabeçalho: abaixo de 768px a navegação vai para a própria linha, itens em largura cheia com 44px | Trocar em 768px | Medido no protótipo: com URL longa, quatro colunas não cabem em 768px sem a URL virar uma coluna de uma palavra por linha. O §15 do design system prevê exatamente isso — "se a linha quebrar, a troca sobe para `lg`" |
| D7 | **Erro de rede interna vem do servidor** (bloco `role="alert"` no topo do formulário), não de validação no cliente | Validar IP no navegador | Só o servidor resolve o DNS de verdade; validar no cliente daria falsa segurança e duplicaria a regra |

### Situações (D4)

| Entrega | Badge | Complemento em texto |
|---|---|---|
| Pendente | `info` "Pendente" | — |
| Enviando | `info` "Enviando" | — |
| Retentando | `warning` "Retentando" | "próxima tentativa às HH:MM" + "N de M" na coluna Tentativas |
| Entregue | `success` "Entregue" | — |
| Falhou definitivamente | `danger` "Falhou definitivamente" | "pode ser reenviada" |
| Cancelada | `info` "Cancelada" | "destino foi desativado" |

| Destino | Badge | Complemento |
|---|---|---|
| Ativo, sem falha | `success` "Ativo" | Última entrega: situação · hora |
| Ativo, com falhas | `warning` "Ativo · com falhas" | "Falhando desde DD/MM às HH:MM" |
| Desativado pelo usuário | `info` "Desativado" | — |
| Desativado pelo sistema | `danger` "Desativado automaticamente" | o `disabledReason` (ex.: "respondeu 410 Gone") |

| Tipo de evento | Rótulo |
|---|---|
| `stock.movement.created` | Movimentação registrada |
| `stock.status.changed` | Mudança de status |
| `webhook.test` | Teste |

O tipo técnico aparece só no detalhe (corpo JSON) — a lista fala a língua do produto.

## Ajustes de backend que a tela exige (entram na Tarefa 8)

Descobertos ao montar a lista — a API da Tarefa 4 não entrega:

1. **Resumo do evento na lista de entregas.** A linha mostra "Mudança de status · LAPIS_HB_007 / Estoque baixo → Sem estoque". O `WebhookDeliveryDTO` da listagem passa a incluir o `payload` (já existe no detalhe; ~0,5 KB por item, 20 por página).
2. **"N de M" tentativas.** Só o backend sabe o tamanho do cronograma (`WEBHOOK_RETRY_SCHEDULE_SECONDS`). O DTO de entrega ganha `maxAttempts`.

Contagens das confirmações ("3 entregas na fila", "132 entregas") saem da API existente (`total` de `GET /webhooks/:id/deliveries?status=…&pageSize=1`) — sem mudança.

## Estados cobertos

Lista: com itens · vazia (nenhum destino, com ação) · carregando (`role="status"`) · erro (persistente, com "Tentar de novo"). Formulário: preenchendo · erro de campo (`aria-invalid` + `aria-describedby`, sem `role="alert"`) · erro do servidor (`role="alert"`). Segredo: exibido uma vez. Entregas: todas as situações · paginação. Detalhe: com reenviar (falhou) — nas outras situações o rodapé tem só "Fechar". Confirmações: gerar segredo · excluir · desativar. Avisos: teste enfileirado · entrega reenviada (`role="status"`, toast existente).

## Larguras (§15)

O protótipo é responsivo de verdade — conferido em 375, 768, 1024 e 1440px, **sem rolagem horizontal** em nenhuma:

- **< 1024px:** destinos em cards — URL, descrição, eventos, situação; "Ver entregas" em largura cheia (44px) + "⋯" (44×44). Nenhuma capacidade some (D8).
- **< 768px:** navegação do cabeçalho em linha própria (dois itens de 44px), e-mail oculto como já é hoje no `App.tsx`; "Novo destino" em largura cheia; listas dentro dos modais (entregas, tentativas) viram linhas empilhadas com rótulo ("Tentativas: 4 de 8").
- URLs quebram nas barras, não no meio do domínio.

## Fora do escopo desta tela

Edição do cronograma de retentativa pela UI (é configuração de ambiente); busca/filtro de destinos (poucos destinos por instalação); exportar entregas; aviso por e-mail de destino desativado (PRD).
