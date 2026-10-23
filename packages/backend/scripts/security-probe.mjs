#!/usr/bin/env node
/**
 * Sonda de segurança/carga para a API do SimpleStock.
 *
 * Uso (API local rodando):
 *   BASE_URL=http://localhost:4000 PROBE_EMAIL=... PROBE_PASSWORD=... node scripts/security-probe.mjs
 *
 * Só use contra ambientes SEUS. Alvos não-locais exigem ALLOW_REMOTE=1.
 * Atenção: o teste de força bruta consome a cota de login do seu IP
 * (10 tentativas / 15 min) — rode por último ou reinicie a API depois.
 */
const BASE = (process.env.BASE_URL ?? 'http://localhost:4000').replace(/\/$/, '');
const EMAIL = process.env.PROBE_EMAIL;
const PASSWORD = process.env.PROBE_PASSWORD;

if (!/^https?:\/\/(localhost|127\.0\.0\.1)(:|\/|$)/.test(BASE) && process.env.ALLOW_REMOTE !== '1') {
  console.error(`Recusado: ${BASE} não é local. Defina ALLOW_REMOTE=1 se for um ambiente seu.`);
  process.exit(2);
}

const results = [];
const check = (name, ok, detail = '') => {
  results.push({ name, ok });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? `  (${detail})` : ''}`);
};
const call = (path, init = {}) => fetch(BASE + path, { ...init, headers: { 'Content-Type': 'application/json', ...init.headers } });
const tally = (arr) => arr.reduce((m, s) => ((m[s] = (m[s] ?? 0) + 1), m), {});

// 1. Rotas protegidas sem token / token forjado
const protectedRoutes = ['/api/products', '/api/products/x/movements', '/api/quick-out/history', '/api/auth/me'];
for (const r of protectedRoutes) {
  const noToken = await call(r);
  const bad = await call(r, { headers: { Authorization: 'Bearer eyJhbGciOiJub25lIn0.e30.' } });
  check(`sem token → 401: ${r}`, noToken.status === 401, noToken.status);
  check(`JWT alg=none → 401: ${r}`, bad.status === 401, bad.status);
}

// 2. Cabeçalhos
const health = await call('/health');
check('sem X-Powered-By', !health.headers.get('x-powered-by'));
check('X-Content-Type-Options: nosniff', health.headers.get('x-content-type-options') === 'nosniff');

// 3. CORS com origem hostil
const cors = await call('/api/products', { headers: { Origin: 'https://evil.example' } });
check('CORS bloqueia origem desconhecida', cors.status === 403 || !cors.headers.get('access-control-allow-origin'), cors.status);

// 4. Entradas hostis (precisam de login)
if (EMAIL && PASSWORD) {
  const login = await call('/api/auth/login', { method: 'POST', body: JSON.stringify({ email: EMAIL, password: PASSWORD }) });
  const { token } = await login.json().catch(() => ({}));
  if (!token) {
    check('login de teste', false, `status ${login.status}`);
  } else {
    const auth = { Authorization: `Bearer ${token}` };
    const sqli = await call('/api/products?search=' + encodeURIComponent(`' OR 1=1; DROP TABLE "Product";--`), { headers: auth });
    check('SQLi em search não gera 500', sqli.status < 500, sqli.status);
    const arr = await call('/api/products?page=1&page=2', { headers: auth });
    check('parâmetro duplicado → 400', arr.status === 400, arr.status);
    const big = await call('/api/products', { method: 'POST', headers: auth, body: JSON.stringify({ name: 'x'.repeat(5000), sku: 'S' }) });
    check('nome gigante → 400', big.status === 400, big.status);
    const huge = await call('/api/products', { method: 'POST', headers: auth, body: JSON.stringify({ name: 'x'.repeat(300_000), sku: 'S' }) });
    check('corpo > 100kb → 413', huge.status === 413, huge.status);
    const broken = await call('/api/products', { method: 'POST', headers: auth, body: '{"a":' });
    check('JSON quebrado → 400', broken.status === 400, broken.status);

    // 5. Rajada concorrente de leituras (rate limit global: 300/15min)
    const t0 = Date.now();
    const burst = await Promise.all(Array.from({ length: 350 }, () => call('/api/products?pageSize=5', { headers: auth }).then((r) => r.status)));
    const dist = tally(burst);
    console.log(`INFO  350 GETs concorrentes em ${Date.now() - t0}ms →`, dist);
    check('nenhum 5xx sob rajada', !Object.keys(dist).some((s) => s.startsWith('5')));
    check('rate limit global aciona (429)', (dist[429] ?? 0) > 0);
  }
} else {
  console.log('SKIP  testes autenticados (defina PROBE_EMAIL e PROBE_PASSWORD)');
}

// 6. Força bruta no login (por último: consome a cota)
const attempts = await Promise.all(
  Array.from({ length: 15 }, (_, i) => call('/api/auth/login', { method: 'POST', body: JSON.stringify({ email: 'alvo@example.com', password: `errada-${i}` }) }).then((r) => r.status)),
);
const d = tally(attempts);
console.log('INFO  15 logins errados →', d);
check('limite de login aciona (429)', (d[429] ?? 0) >= 5);

const failed = results.filter((r) => !r.ok).length;
console.log(`\n${results.length - failed}/${results.length} verificações OK`);
process.exit(failed ? 1 : 0);
