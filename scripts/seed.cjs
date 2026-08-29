// Haqly ERP — Minimal bootstrap seed
// Seeds: permissions, SuperAdmin role, admin user, base Chart of Accounts only.
// No fake companies, customers, suppliers, invoices, stock, or transactions.
// Run with: node scripts/seed.cjs

const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

const PERMISSIONS = [
  'admin:roles',
  'users:view',
  'users:create',
  'users:update',
  'org:view',
  'org:create',
  'accounting:coa',
  'accounting:journal',
  'accounting:voucher',
  'inventory:view',
  'sales:view',
  'purchases:view',
  'fixed_assets:view',
  'fixed_assets:create',
  'depreciation:policy',
  'depreciation:run',
  'loans:view',
  'loans:create',
  'loans:pay',
];

// Base Chart of Accounts — standard structure, no company tied
const BASE_ACCOUNTS = [
  // Assets
  { code: '1000', name: 'Cash and Cash Equivalents',      type: 'ASSET',     description: 'Petty cash, bank balances' },
  { code: '1100', name: 'Accounts Receivable',             type: 'ASSET',     description: 'Amounts owed by customers' },
  { code: '1200', name: 'Inventory',                       type: 'ASSET',     description: 'Stock on hand' },
  { code: '1300', name: 'Prepaid Expenses',                type: 'ASSET',     description: 'Advance payments and prepayments' },
  { code: '1500', name: 'Property Plant and Equipment',    type: 'ASSET',     description: 'Fixed assets at cost' },
  { code: '1510', name: 'Accumulated Depreciation',        type: 'ASSET',     description: 'Contra asset — accumulated depreciation' },
  // Liabilities
  { code: '2000', name: 'Accounts Payable',                type: 'LIABILITY', description: 'Amounts owed to suppliers' },
  { code: '2100', name: 'Accrued Liabilities',             type: 'LIABILITY', description: 'Accrued expenses not yet paid' },
  { code: '2200', name: 'Tax Payable',                     type: 'LIABILITY', description: 'VAT and withholding tax payable' },
  { code: '2300', name: 'Loans Payable',                   type: 'LIABILITY', description: 'Short and long term borrowings' },
  { code: '2400', name: 'Deferred Revenue',                type: 'LIABILITY', description: 'Advance payments from customers' },
  // Equity
  { code: '3000', name: 'Share Capital',                   type: 'EQUITY',    description: 'Issued and paid-up share capital' },
  { code: '3100', name: 'Retained Earnings',               type: 'EQUITY',    description: 'Accumulated profits retained' },
  { code: '3200', name: 'Current Year Earnings',           type: 'EQUITY',    description: 'Net profit or loss for current year' },
  // Revenue
  { code: '4000', name: 'Sales Revenue',                   type: 'REVENUE',   description: 'Income from goods and services sold' },
  { code: '4100', name: 'Service Revenue',                 type: 'REVENUE',   description: 'Income from professional services' },
  { code: '4200', name: 'Other Income',                    type: 'REVENUE',   description: 'Miscellaneous non-operating income' },
  // Expenses
  { code: '5000', name: 'Cost of Goods Sold',              type: 'EXPENSE',   description: 'Direct cost of goods sold' },
  { code: '5100', name: 'Salaries and Wages',              type: 'EXPENSE',   description: 'Employee compensation' },
  { code: '5200', name: 'Rent and Utilities',              type: 'EXPENSE',   description: 'Office and operational premises' },
  { code: '5300', name: 'General and Administrative',      type: 'EXPENSE',   description: 'General operating expenses' },
  { code: '5400', name: 'Depreciation Expense',            type: 'EXPENSE',   description: 'Periodic depreciation charges' },
  { code: '5500', name: 'Interest Expense',                type: 'EXPENSE',   description: 'Finance costs on borrowings' },
  { code: '5600', name: 'Tax Expense',                     type: 'EXPENSE',   description: 'Income tax and levies' },
];

async function main() {
  console.log('Seeding permissions...');
  for (const code of PERMISSIONS) {
    await prisma.permission.upsert({
      where: { code },
      update: { description: code },
      create: { code, description: code },
    });
  }

  console.log('Seeding SuperAdmin role...');
  const role = await prisma.role.upsert({
    where: { name: 'SuperAdmin' },
    update: { description: 'Full access' },
    create: { name: 'SuperAdmin', description: 'Full access' },
  });

  const perms = await prisma.permission.findMany({ where: { code: { in: PERMISSIONS } } });
  await prisma.rolePermission.createMany({
    data: perms.map((p) => ({ roleId: role.id, permissionId: p.id })),
    skipDuplicates: true,
  });

  console.log('Seeding admin user...');
  const isProduction = process.env.NODE_ENV === 'production';
  const email = (process.env.SEED_ADMIN_EMAIL || 'admin@example.com').toLowerCase();
  const passwordFromEnv = process.env.SEED_ADMIN_PASSWORD;

  // A default credential that ships in the repo is public knowledge, so it is
  // only ever acceptable for local development.
  if (isProduction && !passwordFromEnv) {
    throw new Error(
      'SEED_ADMIN_PASSWORD must be set when NODE_ENV=production. Refusing to seed a known default credential.',
    );
  }

  if (passwordFromEnv && passwordFromEnv.length < 12) {
    throw new Error('SEED_ADMIN_PASSWORD must be at least 12 characters.');
  }

  const password = passwordFromEnv || 'Admin123!';

  const existing = await prisma.user.findUnique({ where: { email } });
  let user;

  if (existing) {
    // Re-seeding is a routine part of deploys, and it must not quietly hand an
    // existing account back to whoever knows the default. Rotating the password
    // or unlocking an account is an explicit, opt-in action.
    const resetRequested = process.env.SEED_ADMIN_RESET_PASSWORD === 'true';

    if (resetRequested) {
      user = await prisma.user.update({
        where: { email },
        data: { passwordHash: await bcrypt.hash(password, 12), isActive: true, isLocked: false },
      });
      console.log(`Admin user ${email} already existed — password reset and account unlocked.`);
    } else {
      user = existing;
      console.log(
        `Admin user ${email} already exists — left untouched. ` +
          'Set SEED_ADMIN_RESET_PASSWORD=true to rotate its password and unlock it.',
      );
    }
  } else {
    user = await prisma.user.create({
      data: {
        email,
        passwordHash: await bcrypt.hash(password, 12),
        firstName: 'System',
        lastName: 'Administrator',
        isActive: true,
      },
    });
    console.log(`Admin user ${email} created.`);
  }

  // Assign SuperAdmin role to admin user
  const alreadyAssigned = await prisma.userRole.findFirst({
    where: { userId: user.id, roleId: role.id },
  });
  if (!alreadyAssigned) {
    await prisma.userRole.create({ data: { userId: user.id, roleId: role.id } });
  }

  console.log('Seeding base Chart of Accounts...');
  for (const account of BASE_ACCOUNTS) {
    await prisma.account.upsert({
      where: { code: account.code },
      update: { name: account.name, type: account.type, description: account.description },
      create: { code: account.code, name: account.name, type: account.type, description: account.description },
    });
  }

  console.log('');
  console.log('======================================================');
  console.log('  Bootstrap complete.');
  console.log(`  Admin login : ${email}`);
  // Never echo a real secret to stdout — deploy logs are widely readable.
  console.log(
    passwordFromEnv
      ? '  Password    : (as supplied in SEED_ADMIN_PASSWORD)'
      : '  Password    : Admin123!  ← development default, change it',
  );
  console.log('');
  console.log('  No placeholder companies or fake data created.');
  console.log('  Create your first company from the Organizations page.');
  console.log('======================================================');
}

main()
  .catch((error) => {
    console.error('Seed failed:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });