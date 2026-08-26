import { PrismaClient } from '@prisma/client';

import { hashPassword } from './shared/password';

const prisma = new PrismaClient();

const DEFAULT_ADMIN_EMAIL = process.env.SEED_ADMIN_EMAIL || 'admin@simplestock.local';
const DEFAULT_ADMIN_PASSWORD = process.env.SEED_ADMIN_PASSWORD || 'trocar-esta-senha-123';

async function seedAdminUser() {
  const existing = await prisma.user.findUnique({ where: { email: DEFAULT_ADMIN_EMAIL } });
  if (existing) {
    console.log(`• Usuário admin já existe, pulando: ${DEFAULT_ADMIN_EMAIL}`);
    return;
  }

  const passwordHash = await hashPassword(DEFAULT_ADMIN_PASSWORD);
  await prisma.user.create({ data: { email: DEFAULT_ADMIN_EMAIL, passwordHash } });
  console.log(
    `• Usuário admin criado: ${DEFAULT_ADMIN_EMAIL} / senha inicial: ${DEFAULT_ADMIN_PASSWORD} (troque após o primeiro login; defina SEED_ADMIN_EMAIL/SEED_ADMIN_PASSWORD para customizar)`,
  );
}

// Utilidades
function slugify(s: string) {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

function rand(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

// Gera uma lista de 50 produtos de papelaria
const baseItems = [
  'Caneta Azul', 'Caneta Preta', 'Caneta Vermelha', 'Caneta Verde', 'Caneta Amarela', 'Caneta Marrom',
  'Lápis HB', 'Lápis 2B', 'Lápis Preto', 'Lapiseira 0.5mm', 'Lapiseira 0.7mm',
  'Borracha Branca', 'Borracha Escolar',
  'Caderno Universitário', 'Caderno de Desenho', 'Caderno Pequeno', 'Caderno Pautado', 'Caderno Quadriculado',
  'Marcador de Texto Amarelo', 'Marcador de Texto Rosa', 'Marcador de Texto Verde', 'Marcador de Texto Azul',
  'Post-it Amarelo', 'Post-it Colorido',
  'Régua 30cm', 'Régua 15cm',
  'Clips Metálico', 'Clips Colorido',
  'Grampeador Pequeno', 'Grampeador Médio',
  'Grampo 26/6', 'Grampo 24/6',
  'Fita Adesiva Transparente', 'Fita Adesiva Marrom', 'Fita Dupla Face',
  'Tesoura Escolar', 'Tesoura de Escritório',
  'Cola Branca 90g', 'Cola Bastão',
  'Pasta Catálogo', 'Pasta Sanfonada', 'Pasta L',
  'Envelope A4', 'Envelope Ofício',
  'Apontador Simples', 'Apontador com Depósito',
  'Canetão Quadro Branco Preto', 'Canetão Quadro Branco Azul',
  'Pincel Atômico Preto', 'Pincel Atômico Vermelho'
];

// Garante 50 itens (se baseItems tiver mais, pega 50; se tiver menos, repete)
const productNames = baseItems.slice(0, 50);

async function main() {
  await seedAdminUser();

  console.log('Seeding 50 produtos de papelaria...');

  // Distribuição de status desejada
  // - OK: saldo >= minStock
  // - AVISO: 0 < saldo < minStock
  // - EM FALTA: saldo = 0
  const desiredStatuses = [
    ...new Array(20).fill('OK' as const),
    ...new Array(15).fill('ATTN' as const),
    ...new Array(15).fill('OUT' as const),
  ];

  // Embaralhar distribuição para variação
  for (let i = desiredStatuses.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [desiredStatuses[i], desiredStatuses[j]] = [desiredStatuses[j], desiredStatuses[i]];
  }

  for (let i = 0; i < productNames.length; i++) {
    const name = productNames[i];
    const base = slugify(name);
    const sku = `${base.toUpperCase()}-${String(i + 1).padStart(3, '0')}`.replace(/-/g, '_');

    // Evita duplicar em execuções repetidas
    const exists = await prisma.product.findUnique({ where: { sku } });
    if (exists) {
      console.log(`• Produto já existe, pulando: ${sku}`);
      continue;
    }

    const minStock = rand(3, 20);
    const description = `${name} de papelaria.`;

    const created = await prisma.product.create({
      data: {
        name,
        sku,
        minStock,
        description,
      },
    });

    const status = desiredStatuses[i] ?? 'OK';
    let balance = 0;

    if (status === 'OK') {
      balance = rand(minStock, minStock + 25);
    } else if (status === 'ATTN') {
      // garantir pelo menos 1 e menor que minStock
      balance = Math.max(1, rand(1, Math.max(1, minStock - 1)));
    } else {
      balance = 0;
    }

    if (balance > 0) {
      await prisma.stockMovement.create({
        data: {
          productId: created.id,
          type: 'IN',
          quantity: balance,
          note: 'Seed inicial',
        },
      });
    }

    console.log(`• Criado: ${name} | SKU=${sku} | min=${minStock} | saldo=${balance} | status=${status}`);
  }

  console.log('Seed concluído.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
