# Demonstração do SimpleStock

O arquivo [fluxo-estoque.webm](./fluxo-estoque.webm) mostra o sistema local conectado à API Express e ao PostgreSQL. Não há interceptação de requisições nem respostas simuladas. Os produtos e a conta são fictícios, criados em banco isolado para apresentação. O vídeo tem duração de 1 minuto e 17 segundos e não tem áudio; este roteiro descreve o fluxo.

1. Entrar e visualizar o catálogo, com os alertas de reposição.
2. Cadastrar **Kit de escritório — demonstração**, SKU `DEMO-KIT-2026`, estoque inicial **10** e mínimo **5**.
3. Buscar o SKU e registrar uma **entrada de 5** unidades: saldo **10 → 15**.
4. Registrar uma **saída de 3** unidades: saldo **15 → 12**.
5. Abrir **Mais ações → Ver Histórico** e conferir as movimentações, observações e saldo final **12**.

## Ambiente da captura

- Node 22; aplicação executada pelos comandos `pnpm --filter @simplestock/backend dev` e `pnpm --filter @simplestock/frontend dev --host 127.0.0.1`.
- PostgreSQL 16.4 local, porta 55432, banco `simplestock_demo`, separado de `simplestock_test`.
- Três migrations aplicadas com `pnpm --filter @simplestock/backend db:migrate:deploy`; catálogo fictício carregado com `pnpm --filter @simplestock/backend db:seed`.
- Chromium via Playwright, resolução 1440 × 1080, locale pt-BR e fuso America/Sao_Paulo.
- Capturas em `docs/images/01-produtos.png`, `02-entrada.png` e `03-historico.png`.

## Reproduzir manualmente

Siga a configuração local do README, use um banco exclusivo para demonstrações, aplique as migrations e execute o seed. Defina `SEED_ADMIN_EMAIL` e `SEED_ADMIN_PASSWORD` antes do seed para escolher as credenciais locais; não reutilize contas ou dados de produção. Inicie backend e frontend e siga os cinco passos acima. Caso o SKU já exista, escolha outro para repetir o cadastro.

O vídeo comprova este percurso de apresentação; não substitui a suíte de testes nem demonstra uma implantação pública.
