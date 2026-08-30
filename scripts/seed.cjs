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
  { code: '1100', name: 'Accounts Receivable',             type: 'ASSET',     description: 'Amounts owed by customers', isControlAccount: true, controlSource: 'SALES' },
  { code: '1200', name: 'Inventory',                       type: 'ASSET',     description: 'Stock on hand' },
  { code: '1300', name: 'Prepaid Expenses',                type: 'ASSET',     description: 'Advance payments and prepayments' },
  { code: '1500', name: 'Property Plant and Equipment',    type: 'ASSET',     description: 'Fixed assets at cost' },
  { code: '1510', name: 'Accumulated Depreciation',        type: 'ASSET',     description: 'Contra asset — accumulated depreciation' },
  // Liabilities
  { code: '2000', name: 'Accounts Payable',                type: 'LIABILITY', description: 'Amounts owed to suppliers', isControlAccount: true, controlSource: 'PROCUREMENT' },
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


// Posting rules map a business event onto the accounts its journal hits. Without
// them the posting engine has nowhere to post, so invoices, bills, depreciation
// runs and loan repayments all fail. These are conventional defaults — review
// them against your own chart of accounts before going live.
const POSTING_RULES = [
  {
    module: 'SALES', transactionType: 'INVOICE', transactionSubtype: 'STANDARD',
    debit: '1100', credit: '4000',
    template: 'Sales invoice {{sourceDocumentNumber}}',
  },
  {
    module: 'SALES', transactionType: 'INVOICE', transactionSubtype: 'TAXED',
    debit: '1100', credit: '4000', tax: '2200',
    template: 'Sales invoice {{sourceDocumentNumber}} (taxed)',
  },
  {
    module: 'PROCUREMENT', transactionType: 'PURCHASE_BILL', transactionSubtype: 'STANDARD',
    debit: '1200', credit: '2000',
    template: 'Purchase bill {{sourceDocumentNumber}}',
  },
  {
    module: 'PROCUREMENT', transactionType: 'PURCHASE_BILL', transactionSubtype: 'TAXED',
    debit: '1200', credit: '2000', tax: '2200',
    template: 'Purchase bill {{sourceDocumentNumber}} (taxed)',
  },
  {
    module: 'FIXED_ASSETS', transactionType: 'DEPRECIATION', transactionSubtype: null,
    debit: '5400', credit: '1510',
    template: 'Depreciation run {{sourceDocumentNumber}}',
  },
  {
    // Interest lands on the tax account slot and fees on the rounding slot —
    // that is how the LOAN_REPAYMENT pattern reads them.
    module: 'TREASURY', transactionType: 'LOAN_REPAYMENT', transactionSubtype: null,
    debit: '2300', credit: '1000', tax: '5500', rounding: '5300',
    template: 'Loan repayment {{sourceDocumentNumber}}',
  },
  {
    module: 'TREASURY', transactionType: 'LOAN_DISBURSEMENT', transactionSubtype: null,
    debit: '1000', credit: '2300',
    template: 'Loan drawdown {{sourceDocumentNumber}}',
  },
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
      update: {
        name: account.name,
        type: account.type,
        description: account.description,
        isControlAccount: account.isControlAccount ?? false,
        controlSource: account.controlSource ?? null,
      },
      create: {
        code: account.code,
        name: account.name,
        type: account.type,
        description: account.description,
        isControlAccount: account.isControlAccount ?? false,
        controlSource: account.controlSource ?? null,
      },
    });
  }


  console.log('Seeding posting rules...');
  const accountsByCode = new Map(
    (await prisma.account.findMany({ select: { id: true, code: true } })).map((a) => [a.code, a.id]),
  );
  const accountId = (code) => {
    const id = accountsByCode.get(code);
    if (!id) throw new Error(`Posting rule references account ${code}, which is not in the chart of accounts.`);
    return id;
  };

  for (const rule of POSTING_RULES) {
    const existing = await prisma.postingRule.findFirst({
      where: {
        module: rule.module,
        transactionType: rule.transactionType,
        transactionSubtype: rule.transactionSubtype,
      },
    });

    // Never overwrite a rule someone has tuned; these are only a starting point.
    if (existing) continue;

    await prisma.postingRule.create({
      data: {
        module: rule.module,
        transactionType: rule.transactionType,
        transactionSubtype: rule.transactionSubtype,
        debitAccountId: accountId(rule.debit),
        creditAccountId: accountId(rule.credit),
        taxAccountId: rule.tax ? accountId(rule.tax) : null,
        roundingAccountId: rule.rounding ? accountId(rule.rounding) : null,
        postingDescriptionTemplate: rule.template,
        effectiveStartDate: new Date('2000-01-01'),
        status: 'ACTIVE',
      },
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