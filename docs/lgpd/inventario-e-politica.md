# LGPD — inventário de dados, retenção e política de privacidade

> Rascunho técnico. Os textos jurídicos (base legal, identificação do controlador, contato do encarregado) precisam de revisão de quem responde legalmente pelo sistema.

## 1. Inventário de dados pessoais

| Dado | Onde fica | Finalidade | Base legal (sugerida) | Retenção |
|---|---|---|---|---|
| E-mail do usuário | `User.email` | Identificar e autenticar quem opera o estoque | Execução de contrato / legítimo interesse (art. 7º, V e IX) | Enquanto a conta existir |
| Hash da senha (bcrypt, custo 12) | `User.passwordHash` | Autenticação | Idem | Enquanto a conta existir; nunca exposto pela API |
| Autoria das movimentações | `StockMovement.userId` | Trilha de auditoria do estoque | Legítimo interesse (controle de inventário) | Anonimizada (`NULL`) quando a conta é excluída |
| Observações livres | `StockMovement.note`, motivo de ajuste | Contexto da operação | Idem | Ver abaixo — **não digitar dados pessoais** |
| IP e user-agent | Logs HTTP (`pino-http`) | Segurança e diagnóstico | Legítimo interesse | Definido pelo provedor de logs (Render); recomendado ≤ 30 dias |
| Token de sessão (JWT, 12h) | `localStorage` do navegador | Manter a sessão | Execução de contrato | Expira em 12h ou no logout |

Dados sensíveis (art. 5º, II): **não são coletados**. Nenhum dado de crianças/adolescentes.

## 2. Operadores e transferência internacional

- **Render** (API e banco), **Netlify** (frontend): servidores possivelmente fora do Brasil — transferência internacional (art. 33); conferir cláusulas do contrato com cada provedor.
- **Google Fonts**: o navegador do usuário envia o IP ao Google ao carregar a fonte Inter. Recomendação: hospedar a fonte localmente (`@fontsource/inter`) e remover `fonts.googleapis.com`/`fonts.gstatic.com` do `index.html` e do CSP em `netlify.toml`.

## 3. Direitos do titular — como o sistema atende

| Direito (art. 18) | Implementação |
|---|---|
| Confirmação e acesso / portabilidade | `GET /api/auth/me/data` — JSON com conta e movimentações do próprio usuário (sem hash de senha) |
| Eliminação | `DELETE /api/auth/me` com `{ "password": "..." }` — remove a conta; movimentações permanecem anonimizadas por integridade do estoque |
| Correção | Pedido ao administrador (não há troca de e-mail na interface) |
| Informação sobre compartilhamento | Item 2 deste documento |

Prazo sugerido de resposta a pedidos: 15 dias (art. 19, II).

## 4. Segurança (art. 46)

Rate limit global e no login, JWT com expiração, bcrypt, CORS restrito, Helmet, CSP e demais cabeçalhos no frontend, validação Zod com limites de tamanho, erro 500 sem detalhe interno, logs sem senha/token. Incidente de segurança com risco relevante: comunicar a ANPD e os titulares em prazo razoável (art. 48).

## 5. Rascunho da política de privacidade (texto para o usuário)

**Quais dados usamos.** Seu e-mail e uma senha (guardada apenas como hash) para você acessar o SimpleStock. Registramos quais movimentações de estoque você fez, para fins de auditoria. Os servidores registram seu endereço IP por motivos de segurança.

**Por quê.** Para identificar quem opera o estoque e manter o histórico confiável do inventário.

**Com quem compartilhamos.** Apenas com os provedores que hospedam o sistema (Render e Netlify). Não vendemos nem usamos seus dados para publicidade.

**Por quanto tempo.** Enquanto sua conta existir. Ao excluí-la, seu e-mail e senha são apagados e suas movimentações passam a constar sem identificação.

**Seus direitos.** Você pode ver seus dados e excluir sua conta na própria aplicação, ou falar com [ENCARREGADO — nome e e-mail].

**Controlador.** [razão social / nome, CNPJ/CPF, contato].
