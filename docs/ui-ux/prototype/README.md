# Protótipo da Fase 6 — o que é e o que não é

## O que é

`dashboard.html` — um protótipo **autocontido** do dashboard de produtos,
construído para validar a direção **B — Operação** e o Design System da Fase 5
**antes** de qualquer implementação no produto.

- HTML + CSS puro. **Sem framework, sem CDN de script, sem dependência
  instalada, sem build.**
- Única requisição externa: a fonte Inter do Google Fonts — a mesma origem que o
  `packages/frontend/index.html` de produção já usa, para o protótipo ter
  fidelidade tipográfica.
- Dados fictícios embutidos, no formato do domínio (papelaria, `minStock` 3–20),
  espelhando `packages/backend/src/seed.ts`.
- **Sem backend, sem API, sem schema, sem autenticação.**

## O que NÃO é

- **Não é código de produção** e não deve ser copiado para `packages/`.
  As classes CSS aqui não são o Design System implementado — são uma **maquete**
  dos tokens para poder olhar para eles.
- **Não corrige nenhum bug.** Onde o protótipo mostra um comportamento melhor
  que o do produto (formulário de edição preenchido, mensagem de erro
  específica, filtro com saída no mobile), isso é o **alvo**, não algo que já
  exista. Os bugs continuam abertos — ver `docs/ui-ux/prototype.md`, seção
  "Diferenças intencionais entre protótipo e produto".
- Não é referenciado por nenhum arquivo da aplicação e não entra em build algum.

## Como abrir

Abrir `dashboard.html` direto no navegador funciona para ver o layout.

Para que as **molduras de breakpoint** (os `<iframe>`) carreguem, é preciso
servir por HTTP — vários navegadores bloqueiam iframe de `file://`:

```bash
cd docs/ui-ux/prototype
node -e "const h=require('http'),f=require('fs'),p=require('path');h.createServer((q,s)=>{const n=decodeURIComponent(q.url).split('?')[0];const t=p.join(process.cwd(),n==='/'?'dashboard.html':n);f.readFile(t,(e,d)=>{if(e){s.writeHead(404);s.end();return}s.writeHead(200,{'Content-Type':'text/html; charset=utf-8'});s.end(d)})}).listen(4173,()=>console.log('http://localhost:4173/dashboard.html'))"
```

Depois abrir `http://localhost:4173/dashboard.html`.

## Estrutura da página

1. **Dashboard real**, nas quatro zonas da direção B: identidade · alerta ·
   controle · dados.
2. **Andaimes de validação** (títulos em roxo) — comparações lado a lado que
   existem só para decidir, e que **não fazem parte do design**:
   - variante A (3 controles por linha) × variante B (2 controles);
   - card mobile A (baixa rápida inline) × B (no overflow);
   - D2-A (intenção antes de abrir) × D2-B (intenção dentro, sem default);
   - as quatro operações de estoque na mesma gramática;
   - histórico como extrato;
   - **molduras de breakpoint** em 375 · 600 · 767 · 768 · 900 · 1024 · 1440px,
     cada uma um `<iframe>` com viewport próprio — é assim que as media queries
     são testadas de forma determinística, sem depender de redimensionar a
     janela do sistema operacional;
   - estados: vazio (com e sem filtro), carregando, erro.

`?frame=1` na URL esconde os andaimes e mostra só o app — é o modo usado pelas
molduras de breakpoint.
