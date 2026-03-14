// Seed script: bootstrap permissions, SuperAdmin role/user, one working Sample Company,
// and realistic sample operational data.
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

async function getOrCreateByName(model, name, extra = {}) {
  const existing = await prisma[model].findFirst({ where: { name } });
  if (existing) {
    return existing;
  }
  return prisma[model].create({ data: { name, ...extra } });
}

async function ensureCanonicalSampleCompany(currencyId) {
  const placeholderNames = ['Sample Company', 'Demo Company', 'SampleCo'];
  const placeholderCompanies = await prisma.company.findMany({
    where: { name: { in: placeholderNames } },
    orderBy: { id: 'asc' },
  });

  let sampleCompany = placeholderCompanies.find((company) => company.name === 'Sample Company') ?? placeholderCompanies[0] ?? null;

  if (sampleCompany) {
    sampleCompany = await prisma.company.update({
      where: { id: sampleCompany.id },
      data: { name: 'Sample Company', currencyId },
    });
  } else {
    sampleCompany = await prisma.company.create({
      data: { name: 'Sample Company', currencyId },
    });
  }

  const duplicates = placeholderCompanies.filter((company) => company.id !== sampleCompany.id);
  for (const duplicate of duplicates) {
    await prisma.company.delete({ where: { id: duplicate.id } });
  }

  return sampleCompany;
}

async function upsertAccount(code, name, type, description, extra = {}) {
  return prisma.account.upsert({
    where: { code },
    update: { name, type, description, ...extra },
    create: { code, name, type, description, ...extra },
  });
}

async function upsertCustomer(companyId, name, email, phone, address) {
  const existing = await prisma.customer.findFirst({ where: { companyId, name } });
  if (existing) {
    return existing;
  }
  return prisma.customer.create({
    data: {
      companyId,
      name,
      email,
      phone,
      addresses: { create: address ? [address] : [] },
    },
  });
}

async function upsertSupplier(companyId, name, email, phone, address) {
  const existing = await prisma.supplier.findFirst({ where: { companyId, name } });
  if (existing) {
    return existing;
  }
  return prisma.supplier.create({
    data: {
      companyId,
      name,
      email,
      phone,
      addresses: { create: address ? [address] : [] },
    },
  });
}

async function upsertProduct(companyId, sku, name, categoryId, uomId) {
  const existing = await prisma.product.findFirst({ where: { companyId, sku } });
  if (existing) {
    return prisma.product.update({
      where: { id: existing.id },
      data: { name, categoryId, uomId, isActive: true },
    });
  }
  return prisma.product.create({
    data: { companyId, sku, name, categoryId, uomId, isActive: true },
  });
}

async function upsertAccountingPeriod(companyId, name, startDate, endDate, status = 'OPEN') {
  const existing = await prisma.accountingPeriod.findFirst({
    where: {
      companyId,
      name,
    },
  });

  if (existing) {
    return prisma.accountingPeriod.update({
      where: { id: existing.id },
      data: { startDate, endDate, status },
    });
  }

  return prisma.accountingPeriod.create({
    data: { companyId, name, startDate, endDate, status },
  });
}

async function upsertFiscalYear(companyId, name, startDate, endDate, status = 'OPEN') {
  const existing = await prisma.fiscalYear.findFirst({
    where: {
      companyId,
      name,
    },
  });

  if (existing) {
    return prisma.fiscalYear.update({
      where: { id: existing.id },
      data: { startDate, endDate, status },
    });
  }

  return prisma.fiscalYear.create({
    data: { companyId, name, startDate, endDate, status },
  });
}

async function upsertCostCenter(companyId, code, name) {
  const existing = await prisma.costCenter.findFirst({ where: { companyId, code } });
  if (existing) {
    return prisma.costCenter.update({ where: { id: existing.id }, data: { name, isActive: true } });
  }
  return prisma.costCenter.create({ data: { companyId, code, name, isActive: true } });
}

async function upsertProject(companyId, code, name) {
  const existing = await prisma.project.findFirst({ where: { companyId, code } });
  if (existing) {
    return prisma.project.update({ where: { id: existing.id }, data: { name, isActive: true } });
  }
  return prisma.project.create({ data: { companyId, code, name, isActive: true } });
}

async function upsertPostingRule(where, data) {
  const existing = await prisma.postingRule.findFirst({ where });
  if (existing) {
    return prisma.postingRule.update({
      where: { id: existing.id },
      data,
    });
  }

  return prisma.postingRule.create({ data });
}

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
    data: perms.map((permission) => ({ roleId: role.id, permissionId: permission.id })),
    skipDuplicates: true,
  });

  console.log('Seeding admin user...');
  const email = 'admin@example.com';
  const passwordHash = await bcrypt.hash('Admin123!', 10);
  const user = await prisma.user.upsert({
    where: { email },
    update: {
      firstName: 'Super',
      lastName: 'Admin',
      isActive: true,
    },
    create: {
      email,
      passwordHash,
      firstName: 'Super',
      lastName: 'Admin',
      isActive: true,
    },
  });

  await prisma.userRole.upsert({
    where: { userId_roleId: { userId: user.id, roleId: role.id } },
    update: {},
    create: { userId: user.id, roleId: role.id },
  });

  console.log('Seeding master data...');
  const ngn = await prisma.currency.upsert({
    where: { code: 'NGN' },
    update: { name: 'Nigerian Naira', symbol: 'NGN' },
    create: { code: 'NGN', name: 'Nigerian Naira', symbol: 'NGN' },
  });

  const sampleCompany = await ensureCanonicalSampleCompany(ngn.id);

  const existingSequence = await prisma.numberingSequence.findFirst({
    where: { companyId: sampleCompany.id, name: 'Sales Invoice' },
  });
  if (existingSequence) {
    await prisma.numberingSequence.update({
      where: { id: existingSequence.id },
      data: { prefix: 'SINV', nextNumber: 922 },
    });
  } else {
    await prisma.numberingSequence.create({
      data: { name: 'Sales Invoice', prefix: 'SINV', nextNumber: 922, companyId: sampleCompany.id },
    });
  }

  const existingPaymentVoucherSequence = await prisma.numberingSequence.findFirst({
    where: { companyId: sampleCompany.id, name: 'Payment Voucher' },
  });
  if (existingPaymentVoucherSequence) {
    await prisma.numberingSequence.update({
      where: { id: existingPaymentVoucherSequence.id },
      data: { prefix: 'PV', nextNumber: 2 },
    });
  } else {
    await prisma.numberingSequence.create({
      data: { name: 'Payment Voucher', prefix: 'PV', nextNumber: 2, companyId: sampleCompany.id },
    });
  }

  const existingCustomerReceiptSequence = await prisma.numberingSequence.findFirst({
    where: { companyId: sampleCompany.id, name: 'Customer Receipt' },
  });
  if (existingCustomerReceiptSequence) {
    await prisma.numberingSequence.update({
      where: { id: existingCustomerReceiptSequence.id },
      data: { prefix: 'RCT', nextNumber: 2 },
    });
  } else {
    await prisma.numberingSequence.create({
      data: { name: 'Customer Receipt', prefix: 'RCT', nextNumber: 2, companyId: sampleCompany.id },
    });
  }

  await upsertAccountingPeriod(
    sampleCompany.id,
    'Mar 2026',
    new Date('2026-03-01T00:00:00.000Z'),
    new Date('2026-03-31T23:59:59.999Z'),
    'OPEN',
  );

  const fiscalYear2026 = await upsertFiscalYear(
    sampleCompany.id,
    'FY2026',
    new Date('2026-01-01T00:00:00.000Z'),
    new Date('2026-12-31T23:59:59.999Z'),
    'OPEN',
  );

  const financeDept = await getOrCreateByName('department', 'Finance', { companyId: sampleCompany.id });
  await getOrCreateByName('department', 'Operations', { companyId: sampleCompany.id });
  await getOrCreateByName('department', 'HR & Payroll', { companyId: sampleCompany.id });
  const adminCostCenter = await upsertCostCenter(sampleCompany.id, 'ADMIN', 'Administrative Services');
  const finOpsProject = await upsertProject(sampleCompany.id, 'FIN-OPS', 'Finance Transformation');

  const headOffice = await prisma.branch.upsert({
    where: { code: 'SMP-HQ' },
    update: { name: 'Head Office', companyId: sampleCompany.id },
    create: { name: 'Head Office', code: 'SMP-HQ', companyId: sampleCompany.id },
  });

  const lagosBranch = await prisma.branch.upsert({
    where: { code: 'SMP-LAG' },
    update: { name: 'Lagos Warehouse', companyId: sampleCompany.id },
    create: { name: 'Lagos Warehouse', code: 'SMP-LAG', companyId: sampleCompany.id },
  });

  const legacyDemoBranch = await prisma.branch.findUnique({ where: { code: 'HQ' } });
  if (legacyDemoBranch && legacyDemoBranch.companyId === sampleCompany.id) {
    await prisma.branch.delete({ where: { id: legacyDemoBranch.id } });
  }

  const mainWarehouse =
    (await prisma.warehouse.findFirst({ where: { name: 'Main Warehouse', branchId: headOffice.id } })) ||
    (await prisma.warehouse.create({
      data: { name: 'Main Warehouse', branchId: headOffice.id },
    }));

  const transitWarehouse =
    (await prisma.warehouse.findFirst({ where: { name: 'Transit Warehouse', branchId: lagosBranch.id } })) ||
    (await prisma.warehouse.create({
      data: { name: 'Transit Warehouse', branchId: lagosBranch.id },
    }));

  console.log('Seeding accounts...');
  const cash = await upsertAccount('1000', 'Cash at Bank', 'ASSET', 'Operating bank balances', {
    financialStatementCategory: 'CASH_AND_EQUIVALENT',
  });
  const receivables = await upsertAccount('1100', 'Accounts Receivable', 'ASSET', 'Trade receivables', {
    isControlAccount: true,
    controlSource: 'SALES',
    financialStatementCategory: 'RECEIVABLE',
  });
  const inputVat = await upsertAccount('1400', 'Input VAT', 'ASSET', 'Recoverable input VAT', {
    financialStatementCategory: 'ASSET_CURRENT',
  });
  const inventory = await upsertAccount('1200', 'Inventory', 'ASSET', 'Inventory on hand', {
    financialStatementCategory: 'INVENTORY',
  });
  const fixedAssets = await upsertAccount('1500', 'Fixed Assets', 'ASSET', 'Property and equipment', {
    financialStatementCategory: 'ASSET_NONCURRENT',
  });
  const accumDep = await upsertAccount('1510', 'Accumulated Depreciation', 'ASSET', 'Accumulated depreciation reserve', {
    financialStatementCategory: 'ASSET_NONCURRENT',
  });
  const payables = await upsertAccount('2000', 'Accounts Payable', 'LIABILITY', 'Trade payables', {
    isControlAccount: true,
    controlSource: 'PROCUREMENT',
    financialStatementCategory: 'LIABILITY_CURRENT',
  });
  const grni = await upsertAccount('2050', 'GRNI Clearing', 'LIABILITY', 'Goods received not invoiced clearing', {
    financialStatementCategory: 'LIABILITY_CURRENT',
  });
  const accruedPayroll = await upsertAccount('2100', 'Accrued Payroll', 'LIABILITY', 'Payroll accruals', {
    financialStatementCategory: 'LIABILITY_CURRENT',
  });
  const payePayable = await upsertAccount('2110', 'PAYE Payable', 'LIABILITY', 'Payroll tax liability', {
    financialStatementCategory: 'LIABILITY_CURRENT',
  });
  const pensionPayable = await upsertAccount('2120', 'Pension Payable', 'LIABILITY', 'Employee pension liability', {
    financialStatementCategory: 'LIABILITY_CURRENT',
  });
  const netSalaryPayable = await upsertAccount('2130', 'Net Salary Payable', 'LIABILITY', 'Net salaries due to employees', {
    financialStatementCategory: 'LIABILITY_CURRENT',
  });
  const loanPayable = await upsertAccount('2200', 'Loan Payable', 'LIABILITY', 'Long-term loan balance', {
    financialStatementCategory: 'LIABILITY_NONCURRENT',
  });
  const taxPayable = await upsertAccount('2300', 'Output VAT', 'LIABILITY', 'Output VAT obligations', {
    financialStatementCategory: 'LIABILITY_CURRENT',
  });
  const revenue = await upsertAccount('4000', 'Sales Revenue', 'INCOME', 'Sales revenue', {
    financialStatementCategory: 'REVENUE',
  });
  const cogs = await upsertAccount('5000', 'Cost of Sales', 'EXPENSE', 'Cost of goods sold', {
    financialStatementCategory: 'COST_OF_SALES',
  });
  const payrollExpense = await upsertAccount('6100', 'Payroll Expense', 'EXPENSE', 'Staff payroll expense', {
    financialStatementCategory: 'OPERATING_EXPENSE',
  });
  const depreciationExpense = await upsertAccount('6200', 'Depreciation Expense', 'EXPENSE', 'Monthly depreciation expense', {
    financialStatementCategory: 'DEPRECIATION_AND_AMORTIZATION',
  });
  const opex = await upsertAccount('6300', 'Operating Expense', 'EXPENSE', 'General operating expense', {
    financialStatementCategory: 'OPERATING_EXPENSE',
  });
  const interestExpense = await upsertAccount('7100', 'Interest Expense', 'EXPENSE', 'Interest on facilities', {
    financialStatementCategory: 'FINANCE_COST',
  });

  const existingOperationsBank = await prisma.bankAccount.findFirst({
    where: { companyId: sampleCompany.id, name: 'Operations Bank' },
  });
  const operationsBank = existingOperationsBank
    ? await prisma.bankAccount.update({
        where: { id: existingOperationsBank.id },
        data: {
          accountName: 'Sample Company Operations',
          number: '1023456789',
          bankName: 'Sterling Bank',
          companyId: sampleCompany.id,
          branchId: headOffice.id,
          currencyId: ngn.id,
          glAccountId: cash.id,
          providerName: 'MANUAL_TRANSFER',
          providerCode: 'MANUAL_TRANSFER',
          isActive: true,
          gatewayConfig: { mode: 'manual' },
        },
      })
    : await prisma.bankAccount.create({
        data: {
          name: 'Operations Bank',
          accountName: 'Sample Company Operations',
          number: '1023456789',
          bankName: 'Sterling Bank',
          companyId: sampleCompany.id,
          branchId: headOffice.id,
          currencyId: ngn.id,
          glAccountId: cash.id,
          providerName: 'MANUAL_TRANSFER',
          providerCode: 'MANUAL_TRANSFER',
          isActive: true,
          gatewayConfig: { mode: 'manual' },
        },
      });

  const existingVatConfig = await prisma.taxConfig.findFirst({
    where: { companyId: sampleCompany.id, code: 'VAT' },
  });
  if (existingVatConfig) {
    await prisma.taxConfig.update({
      where: { id: existingVatConfig.id },
      data: {
        code: 'VAT',
        name: 'Value Added Tax',
        taxType: 'VAT',
        rate: '7.5000',
        isInclusive: false,
        recoverable: true,
        filingFrequency: 'MONTHLY',
        outputAccountId: taxPayable.id,
        inputAccountId: inputVat.id,
        liabilityAccountId: taxPayable.id,
      },
    });
  } else {
    await prisma.taxConfig.create({
      data: {
        companyId: sampleCompany.id,
        code: 'VAT',
        name: 'Value Added Tax',
        taxType: 'VAT',
        rate: '7.5000',
        isInclusive: false,
        recoverable: true,
        filingFrequency: 'MONTHLY',
        outputAccountId: taxPayable.id,
        inputAccountId: inputVat.id,
        liabilityAccountId: taxPayable.id,
      },
    });
  }

  const vatConfig = await prisma.taxConfig.findFirst({
    where: { companyId: sampleCompany.id, code: 'VAT' },
  });

  const paymentTemplates = [
    {
      name: 'Standard Corporate Voucher',
      voucherType: 'VENDOR_PAYMENT',
      templateKind: 'STANDARD_CORPORATE',
      paymentMethod: 'BANK_TRANSFER',
      requiresAttachment: true,
      allowRecall: true,
      postAfterFinalApproval: true,
      allowPaymentExecution: true,
      enableGateway: false,
      defaultNarration: 'Vendor payment voucher',
      purposeTemplate: 'Settlement of approved supplier obligation',
      approvalMatrix: [
        { level: 1, label: 'Finance Review', role: 'FINANCE' },
        { level: 2, label: 'Final Approval', role: 'ADMIN' },
      ],
    },
    {
      name: 'Treasury Control Voucher',
      voucherType: 'TAX_REMITTANCE',
      templateKind: 'FINANCE_TREASURY',
      paymentMethod: 'BANK_TRANSFER',
      requiresAttachment: true,
      allowRecall: false,
      postAfterFinalApproval: true,
      allowPaymentExecution: true,
      enableGateway: true,
      defaultNarration: 'Treasury payment control voucher',
      purposeTemplate: 'Treasury-controlled outward payment',
      approvalMatrix: [
        { level: 1, label: 'Finance Review', role: 'FINANCE' },
        { level: 2, label: 'Controller Approval', role: 'ADMIN' },
        { level: 3, label: 'Treasury Release', role: 'FINANCE' },
      ],
    },
    {
      name: 'Clean A4 Voucher',
      voucherType: 'EXPENSE_PAYMENT',
      templateKind: 'CLEAN_A4',
      paymentMethod: 'BANK_TRANSFER',
      requiresAttachment: false,
      allowRecall: true,
      postAfterFinalApproval: true,
      allowPaymentExecution: true,
      enableGateway: false,
      defaultNarration: 'Expense reimbursement voucher',
      purposeTemplate: 'Clean finance filing template',
      approvalMatrix: [
        { level: 1, label: 'Line Manager Approval', role: 'FINANCE' },
        { level: 2, label: 'Finance Approval', role: 'ADMIN' },
      ],
    },
  ];

  for (const template of paymentTemplates) {
    const existingTemplate = await prisma.aPPaymentTemplate.findFirst({
      where: { legalEntityId: sampleCompany.id, name: template.name },
    });
    if (existingTemplate) {
      await prisma.aPPaymentTemplate.update({
        where: { id: existingTemplate.id },
        data: {
          voucherType: template.voucherType,
          templateKind: template.templateKind,
          legalEntityId: sampleCompany.id,
          branchId: headOffice.id,
          paymentMethod: template.paymentMethod,
          requiresAttachment: template.requiresAttachment,
          allowRecall: template.allowRecall,
          postAfterFinalApproval: template.postAfterFinalApproval,
          allowPaymentExecution: template.allowPaymentExecution,
          enableGateway: template.enableGateway,
          defaultAccountId: opex.id,
          defaultNarration: template.defaultNarration,
          purposeTemplate: template.purposeTemplate,
          approvalMatrix: template.approvalMatrix,
          isActive: true,
        },
      });
    } else {
      await prisma.aPPaymentTemplate.create({
        data: {
          name: template.name,
          voucherType: template.voucherType,
          templateKind: template.templateKind,
          legalEntityId: sampleCompany.id,
          branchId: headOffice.id,
          paymentMethod: template.paymentMethod,
          requiresAttachment: template.requiresAttachment,
          allowRecall: template.allowRecall,
          postAfterFinalApproval: template.postAfterFinalApproval,
          allowPaymentExecution: template.allowPaymentExecution,
          enableGateway: template.enableGateway,
          defaultAccountId: opex.id,
          defaultNarration: template.defaultNarration,
          purposeTemplate: template.purposeTemplate,
          approvalMatrix: template.approvalMatrix,
          isActive: true,
        },
      });
    }
  }

  console.log('Seeding commercial data...');
  const unit = await getOrCreateByName('unitOfMeasure', 'Unit', { symbol: 'ea' });
  const bag = await getOrCreateByName('unitOfMeasure', 'Bag', { symbol: 'bag' });
  const drum = await getOrCreateByName('unitOfMeasure', 'Drum', { symbol: 'drm' });
  const finishedGoods = await getOrCreateByName('productCategory', 'Finished Goods');
  const rawMaterials = await getOrCreateByName('productCategory', 'Raw Materials');
  const consumables = await getOrCreateByName('productCategory', 'Consumables');

  console.log('Seeding posting rules...');
  await upsertPostingRule(
    {
      module: 'SALES',
      transactionType: 'INVOICE',
      transactionSubtype: 'STANDARD',
      legalEntityId: sampleCompany.id,
      productCategoryId: finishedGoods.id,
      taxCode: 'VAT',
      currencyCode: 'NGN',
    },
    {
      module: 'SALES',
      transactionType: 'INVOICE',
      transactionSubtype: 'STANDARD',
      legalEntityId: sampleCompany.id,
      productCategoryId: finishedGoods.id,
      taxCode: 'VAT',
      currencyCode: 'NGN',
      debitAccountId: receivables.id,
      creditAccountId: revenue.id,
      taxAccountId: taxPayable.id,
      postingDescriptionTemplate: 'Sales invoice {{sourceDocumentNumber}}',
      requiresSubledger: true,
      requiresBranch: true,
      requiresTax: true,
      effectiveStartDate: new Date('2026-01-01T00:00:00.000Z'),
      status: 'ACTIVE',
    },
  );

  await upsertPostingRule(
    {
      module: 'PROCUREMENT',
      transactionType: 'PURCHASE_BILL',
      transactionSubtype: 'INVENTORY',
      legalEntityId: sampleCompany.id,
      productCategoryId: rawMaterials.id,
      taxCode: 'VAT',
      currencyCode: 'NGN',
    },
    {
      module: 'PROCUREMENT',
      transactionType: 'PURCHASE_BILL',
      transactionSubtype: 'INVENTORY',
      legalEntityId: sampleCompany.id,
      productCategoryId: rawMaterials.id,
      taxCode: 'VAT',
      currencyCode: 'NGN',
      debitAccountId: inventory.id,
      creditAccountId: payables.id,
      taxAccountId: inputVat.id,
      postingDescriptionTemplate: 'Inventory purchase bill {{sourceDocumentNumber}}',
      requiresSubledger: true,
      requiresBranch: true,
      requiresTax: true,
      effectiveStartDate: new Date('2026-01-01T00:00:00.000Z'),
      status: 'ACTIVE',
    },
  );

  await upsertPostingRule(
    {
      module: 'PROCUREMENT',
      transactionType: 'PURCHASE_BILL',
      transactionSubtype: 'EXPENSE',
      legalEntityId: sampleCompany.id,
      productCategoryId: consumables.id,
      taxCode: 'VAT',
      currencyCode: 'NGN',
    },
    {
      module: 'PROCUREMENT',
      transactionType: 'PURCHASE_BILL',
      transactionSubtype: 'EXPENSE',
      legalEntityId: sampleCompany.id,
      productCategoryId: consumables.id,
      taxCode: 'VAT',
      currencyCode: 'NGN',
      debitAccountId: opex.id,
      creditAccountId: payables.id,
      taxAccountId: inputVat.id,
      postingDescriptionTemplate: 'Expense purchase bill {{sourceDocumentNumber}}',
      requiresSubledger: true,
      requiresBranch: true,
      requiresTax: true,
      effectiveStartDate: new Date('2026-01-01T00:00:00.000Z'),
      status: 'ACTIVE',
    },
  );

  await upsertPostingRule(
    {
      module: 'INVENTORY',
      transactionType: 'RECEIPT',
      transactionSubtype: 'STANDARD',
      legalEntityId: sampleCompany.id,
      productCategoryId: rawMaterials.id,
      currencyCode: 'NGN',
    },
    {
      module: 'INVENTORY',
      transactionType: 'RECEIPT',
      transactionSubtype: 'STANDARD',
      legalEntityId: sampleCompany.id,
      productCategoryId: rawMaterials.id,
      currencyCode: 'NGN',
      debitAccountId: inventory.id,
      creditAccountId: grni.id,
      postingDescriptionTemplate: 'Inventory receipt {{sourceDocumentNumber}}',
      requiresBranch: true,
      effectiveStartDate: new Date('2026-01-01T00:00:00.000Z'),
      status: 'ACTIVE',
    },
  );

  await upsertPostingRule(
    {
      module: 'INVENTORY',
      transactionType: 'SALE_COST',
      transactionSubtype: 'STANDARD',
      legalEntityId: sampleCompany.id,
      productCategoryId: finishedGoods.id,
      currencyCode: 'NGN',
    },
    {
      module: 'INVENTORY',
      transactionType: 'SALE_COST',
      transactionSubtype: 'STANDARD',
      legalEntityId: sampleCompany.id,
      productCategoryId: finishedGoods.id,
      currencyCode: 'NGN',
      debitAccountId: cogs.id,
      creditAccountId: inventory.id,
      postingDescriptionTemplate: 'Inventory issue for sale {{sourceDocumentNumber}}',
      requiresBranch: true,
      effectiveStartDate: new Date('2026-01-01T00:00:00.000Z'),
      status: 'ACTIVE',
    },
  );

  await upsertPostingRule(
    {
      module: 'PAYROLL',
      transactionType: 'PAYROLL_POSTING',
      transactionSubtype: 'STANDARD',
      legalEntityId: sampleCompany.id,
      departmentId: financeDept.id,
      currencyCode: 'NGN',
    },
    {
      module: 'PAYROLL',
      transactionType: 'PAYROLL_POSTING',
      transactionSubtype: 'STANDARD',
      legalEntityId: sampleCompany.id,
      departmentId: financeDept.id,
      currencyCode: 'NGN',
      debitAccountId: payrollExpense.id,
      creditAccountId: netSalaryPayable.id,
      taxAccountId: payePayable.id,
      roundingAccountId: pensionPayable.id,
      postingDescriptionTemplate: 'Payroll posting {{sourceDocumentNumber}}',
      requiresBranch: true,
      effectiveStartDate: new Date('2026-01-01T00:00:00.000Z'),
      status: 'ACTIVE',
    },
  );

  await upsertPostingRule(
    {
      module: 'FIXED_ASSETS',
      transactionType: 'ASSET_PURCHASE',
      transactionSubtype: 'AP',
      legalEntityId: sampleCompany.id,
      currencyCode: 'NGN',
    },
    {
      module: 'FIXED_ASSETS',
      transactionType: 'ASSET_PURCHASE',
      transactionSubtype: 'AP',
      legalEntityId: sampleCompany.id,
      currencyCode: 'NGN',
      debitAccountId: fixedAssets.id,
      creditAccountId: payables.id,
      postingDescriptionTemplate: 'Asset purchase {{sourceDocumentNumber}}',
      requiresBranch: true,
      effectiveStartDate: new Date('2026-01-01T00:00:00.000Z'),
      status: 'ACTIVE',
    },
  );

  await upsertPostingRule(
    {
      module: 'FIXED_ASSETS',
      transactionType: 'DEPRECIATION',
      transactionSubtype: 'STRAIGHT_LINE',
      legalEntityId: sampleCompany.id,
      currencyCode: 'NGN',
    },
    {
      module: 'FIXED_ASSETS',
      transactionType: 'DEPRECIATION',
      transactionSubtype: 'STRAIGHT_LINE',
      legalEntityId: sampleCompany.id,
      currencyCode: 'NGN',
      debitAccountId: depreciationExpense.id,
      creditAccountId: accumDep.id,
      postingDescriptionTemplate: 'Depreciation run {{sourceDocumentNumber}}',
      requiresBranch: true,
      effectiveStartDate: new Date('2026-01-01T00:00:00.000Z'),
      status: 'ACTIVE',
    },
  );

  await upsertPostingRule(
    {
      module: 'LOANS',
      transactionType: 'REPAYMENT',
      transactionSubtype: 'STANDARD',
      legalEntityId: sampleCompany.id,
      currencyCode: 'NGN',
    },
    {
      module: 'LOANS',
      transactionType: 'REPAYMENT',
      transactionSubtype: 'STANDARD',
      legalEntityId: sampleCompany.id,
      currencyCode: 'NGN',
      debitAccountId: loanPayable.id,
      creditAccountId: cash.id,
      taxAccountId: interestExpense.id,
      postingDescriptionTemplate: 'Loan repayment {{sourceDocumentNumber}}',
      requiresBranch: true,
      effectiveStartDate: new Date('2026-01-01T00:00:00.000Z'),
      status: 'ACTIVE',
    },
  );

  const resin = await upsertProduct(sampleCompany.id, 'RM-100', 'Packaging Resin', rawMaterials.id, bag.id);
  const solvent = await upsertProduct(sampleCompany.id, 'RM-200', 'Industrial Solvent', consumables.id, drum.id);
  const starterKit = await upsertProduct(sampleCompany.id, 'FG-300', 'Starter Kit', finishedGoods.id, unit.id);

  const customerA = await upsertCustomer(sampleCompany.id, 'Atlantic Retail Ltd', 'ap@atlanticretail.com', '+2348011111111', {
    line1: '14 Akin Adesola Street', city: 'Lagos', state: 'Lagos', country: 'Nigeria', postalCode: '100001',
  });
  const customerB = await upsertCustomer(sampleCompany.id, 'Meridian Stores', 'finance@meridianstores.com', '+2348022222222', {
    line1: '22 Aminu Kano Crescent', city: 'Abuja', state: 'FCT', country: 'Nigeria', postalCode: '900001',
  });

  const supplierA = await upsertSupplier(sampleCompany.id, 'Prime Industrial', 'orders@primeindustrial.com', '+2348033333333', {
    line1: '8 Creek Road', city: 'Port Harcourt', state: 'Rivers', country: 'Nigeria', postalCode: '500001',
  });
  const supplierB = await upsertSupplier(sampleCompany.id, 'Metro Packaging', 'sales@metropackaging.com', '+2348044444444', {
    line1: '3 Wharf Road', city: 'Apapa', state: 'Lagos', country: 'Nigeria', postalCode: '102272',
  });

  console.log('Seeding stock movements...');
  const stockSeeds = [
    { productId: resin.id, warehouseId: mainWarehouse.id, quantity: '240.000', direction: 'IN', reference: 'OPENING-STOCK' },
    { productId: solvent.id, warehouseId: mainWarehouse.id, quantity: '60.000', direction: 'IN', reference: 'OPENING-STOCK' },
    { productId: starterKit.id, warehouseId: mainWarehouse.id, quantity: '45.000', direction: 'IN', reference: 'OPENING-STOCK' },
    { productId: starterKit.id, warehouseId: transitWarehouse.id, quantity: '5.000', direction: 'OUT', reference: 'TRF-0001' },
  ];
  for (const seed of stockSeeds) {
    const exists = await prisma.stockMovement.findFirst({ where: seed });
    if (!exists) {
      await prisma.stockMovement.create({ data: seed });
    }
  }

  console.log('Seeding transactions...');
  const salesInvoice = await prisma.salesInvoice.upsert({
    where: { number: 'SINV-00921' },
    update: { legalEntityId: sampleCompany.id, customerId: customerA.id, status: 'Posted', total: '21900.00', date: new Date('2026-03-11') },
    create: {
      number: 'SINV-00921',
      legalEntityId: sampleCompany.id,
      customerId: customerA.id,
      date: new Date('2026-03-11'),
      dueDate: new Date('2026-03-25'),
      status: 'Posted',
      total: '21900.00',
    },
  });
  const salesItemExists = await prisma.salesInvoiceItem.findFirst({ where: { invoiceId: salesInvoice.id, productId: starterKit.id } });
  if (!salesItemExists) {
    await prisma.salesInvoiceItem.create({
      data: { invoiceId: salesInvoice.id, productId: starterKit.id, quantity: '3.000', unitPrice: '6800.00', taxRate: '7.5000' },
    });
  }

  const purchaseBill = await prisma.purchaseBill.upsert({
    where: { number: 'PB-00412' },
    update: { legalEntityId: sampleCompany.id, supplierId: supplierA.id, status: 'Posted', total: '48120.00', date: new Date('2026-03-12') },
    create: {
      number: 'PB-00412',
      legalEntityId: sampleCompany.id,
      supplierId: supplierA.id,
      date: new Date('2026-03-12'),
      dueDate: new Date('2026-03-26'),
      status: 'Posted',
      total: '48120.00',
    },
  });
  const purchaseItemExists = await prisma.purchaseBillItem.findFirst({ where: { billId: purchaseBill.id, productId: resin.id } });
  if (!purchaseItemExists) {
    await prisma.purchaseBillItem.create({
      data: { billId: purchaseBill.id, productId: resin.id, quantity: '120.000', unitCost: '372.00', taxRate: '7.5000' },
    });
  }

  const payrollJournal = await prisma.journalEntry.upsert({
    where: { reference: 'JE-1048' },
    update: { type: 'GENERAL', description: 'Monthly payroll accrual', date: new Date('2026-03-12'), createdBy: user.id },
    create: {
      reference: 'JE-1048',
      type: 'GENERAL',
      description: 'Monthly payroll accrual',
      date: new Date('2026-03-12'),
      createdBy: user.id,
    },
  });

  const payrollLines = [
    { entryId: payrollJournal.id, accountId: payrollExpense.id, branchId: headOffice.id, debit: '84200.00', credit: '0.00', memo: 'Payroll accrual' },
    { entryId: payrollJournal.id, accountId: accruedPayroll.id, branchId: headOffice.id, debit: '0.00', credit: '84200.00', memo: 'Payroll accrual' },
  ];
  for (const line of payrollLines) {
    const exists = await prisma.journalLine.findFirst({ where: line });
    if (!exists) {
      await prisma.journalLine.create({ data: line });
    }
  }

  const marchPeriod = await prisma.accountingPeriod.findFirst({
    where: { companyId: sampleCompany.id, name: 'Mar 2026' },
  });

  if (marchPeriod) {
    const existingGlJournal = await prisma.gLJournalHeader.findFirst({
      where: { journalNumber: 'GLJ-000901' },
    });

    if (existingGlJournal) {
      await prisma.gLJournalLine.deleteMany({ where: { journalId: existingGlJournal.id } });
      await prisma.gLJournalAttachment.deleteMany({ where: { journalId: existingGlJournal.id } });
      await prisma.gLJournalApprovalHistory.deleteMany({ where: { journalId: existingGlJournal.id } });
      await prisma.gLJournalAuditLog.deleteMany({ where: { journalId: existingGlJournal.id } });
      await prisma.gLJournalStatusHistory.deleteMany({ where: { journalId: existingGlJournal.id } });
      await prisma.gLJournalHeader.delete({ where: { id: existingGlJournal.id } });
    }

    await prisma.gLJournalHeader.create({
      data: {
        journalNumber: 'GLJ-000901',
        journalType: 'MANUAL',
        sourceType: 'MANUAL',
        sourceModule: 'finance',
        legalEntityId: sampleCompany.id,
        branchId: headOffice.id,
        departmentId: financeDept.id,
        costCenterId: adminCostCenter.id,
        projectId: finOpsProject.id,
        journalDate: new Date('2026-03-13'),
        postingDate: new Date('2026-03-13'),
        accountingPeriodId: marchPeriod.id,
        fiscalYearId: fiscalYear2026.id,
        currencyCode: 'NGN',
        referenceNumber: 'ADJ-0007',
        narration: 'Month-end accrual for audit support services',
        description: 'Sample draft journal for the Journal Entry workspace',
        status: 'DRAFT',
        workflowStatus: 'DRAFT',
        createdBy: user.id,
        updatedBy: user.id,
        totalDebit: '15000.00',
        totalCredit: '15000.00',
        lines: {
          create: [
            {
              lineNumber: 1,
              accountId: opex.id,
              accountCode: opex.code,
              accountName: opex.name,
              accountType: opex.type,
              debitAmount: '15000.00',
              creditAmount: '0.00',
              baseCurrencyDebit: '15000.00',
              baseCurrencyCredit: '0.00',
              transactionCurrencyCode: 'NGN',
              branchId: headOffice.id,
              departmentId: financeDept.id,
              costCenterId: adminCostCenter.id,
              projectId: finOpsProject.id,
              lineNarration: 'Accrual of audit support services',
            },
            {
              lineNumber: 2,
              accountId: accruedPayroll.id,
              accountCode: accruedPayroll.code,
              accountName: accruedPayroll.name,
              accountType: accruedPayroll.type,
              debitAmount: '0.00',
              creditAmount: '15000.00',
              baseCurrencyDebit: '0.00',
              baseCurrencyCredit: '15000.00',
              transactionCurrencyCode: 'NGN',
              branchId: headOffice.id,
              departmentId: financeDept.id,
              costCenterId: adminCostCenter.id,
              projectId: finOpsProject.id,
              lineNarration: 'Accrued liability',
            },
          ],
        },
        statusHistory: {
          create: {
            toStatus: 'DRAFT',
            changedBy: user.id,
            reason: 'Seed sample draft journal',
          },
        },
        auditLogs: {
          create: {
            action: 'SEED_CREATE',
            actorUserId: user.id,
            actorName: user.email,
            newValues: {
              journalNumber: 'GLJ-000901',
              narration: 'Month-end accrual for audit support services',
            },
          },
        },
      },
    });
  }

  console.log('Seeding fixed assets and loans...');
  const laptopCategory =
    (await prisma.assetCategory.findFirst({ where: { name: 'IT Equipment' } })) ||
    (await prisma.assetCategory.create({
      data: {
        name: 'IT Equipment',
        usefulLifeMonths: 36,
        residualRate: '5.00',
        depreciationMethod: 'STRAIGHT_LINE',
        glAssetAccountId: fixedAssets.id,
        glAccumDepAccountId: accumDep.id,
        glExpenseAccountId: depreciationExpense.id,
      },
    }));

  await prisma.asset.upsert({
    where: { tag: 'FA-001' },
    update: {
      name: 'Finance Team Laptops',
      categoryId: laptopCategory.id,
      branchId: headOffice.id,
      acquisitionDate: new Date('2026-01-10'),
      acquisitionCost: '9500.00',
      residualValue: '475.00',
      depreciationStart: new Date('2026-02-01'),
    },
    create: {
      tag: 'FA-001',
      name: 'Finance Team Laptops',
      categoryId: laptopCategory.id,
      branchId: headOffice.id,
      acquisitionDate: new Date('2026-01-10'),
      acquisitionCost: '9500.00',
      residualValue: '475.00',
      depreciationStart: new Date('2026-02-01'),
    },
  });

  const loan = await prisma.loan.upsert({
    where: { code: 'LN-001' },
    update: {
      lender: 'Sterling Bank',
      principal: '1200000.00',
      currencyId: ngn.id,
      startDate: new Date('2026-01-01'),
      endDate: new Date('2026-12-31'),
      rateType: 'FIXED',
      baseRate: '18.5000',
      spread: '0.0000',
      scheduleType: 'ANNUITY',
    },
    create: {
      code: 'LN-001',
      lender: 'Sterling Bank',
      principal: '1200000.00',
      currencyId: ngn.id,
      startDate: new Date('2026-01-01'),
      endDate: new Date('2026-12-31'),
      rateType: 'FIXED',
      baseRate: '18.5000',
      spread: '0.0000',
      scheduleType: 'ANNUITY',
    },
  });

  const existingRate = await prisma.loanRate.findFirst({
    where: { loanId: loan.id, effective: new Date('2026-01-01') },
  });
  if (existingRate) {
    await prisma.loanRate.update({
      where: { id: existingRate.id },
      data: { rate: '18.5000' },
    });
  } else {
    await prisma.loanRate.create({
      data: { loanId: loan.id, effective: new Date('2026-01-01'), rate: '18.5000' },
    });
  }

  const scheduleOneExisting = await prisma.loanSchedule.findFirst({
    where: { loanId: loan.id, installment: 1 },
  });
  const scheduleOne = scheduleOneExisting
    ? await prisma.loanSchedule.update({
        where: { id: scheduleOneExisting.id },
        data: {
          dueDate: new Date('2026-02-01'),
          principalDue: '90000.00',
          interestDue: '18500.00',
          feesDue: '0.00',
          status: 'PAID',
        },
      })
    : await prisma.loanSchedule.create({
        data: {
          loanId: loan.id,
          installment: 1,
          dueDate: new Date('2026-02-01'),
          principalDue: '90000.00',
          interestDue: '18500.00',
          feesDue: '0.00',
          status: 'PAID',
        },
      });

  const scheduleTwoExisting = await prisma.loanSchedule.findFirst({
    where: { loanId: loan.id, installment: 2 },
  });
  if (scheduleTwoExisting) {
    await prisma.loanSchedule.update({
      where: { id: scheduleTwoExisting.id },
      data: {
        dueDate: new Date('2026-03-01'),
        principalDue: '90000.00',
        interestDue: '17100.00',
        feesDue: '0.00',
        status: 'PENDING',
      },
    });
  } else {
    await prisma.loanSchedule.create({
      data: {
        loanId: loan.id,
        installment: 2,
        dueDate: new Date('2026-03-01'),
        principalDue: '90000.00',
        interestDue: '17100.00',
        feesDue: '0.00',
        status: 'PENDING',
      },
    });
  }

  const paymentExists = await prisma.loanPayment.findFirst({ where: { loanId: loan.id, scheduleId: scheduleOne.id } });
  if (!paymentExists) {
    await prisma.loanPayment.create({
      data: {
        loanId: loan.id,
        scheduleId: scheduleOne.id,
        paymentDate: new Date('2026-02-01'),
        principalPaid: '90000.00',
        interestPaid: '18500.00',
        feesPaid: '0.00',
        memo: 'On-time monthly repayment',
      },
    });
  }

  console.log('Seeding payment vouchers...');
  const standardVoucherTemplate = await prisma.aPPaymentTemplate.findFirst({
    where: { legalEntityId: sampleCompany.id, name: 'Standard Corporate Voucher' },
  });
  const existingPaymentVoucher = await prisma.aPPaymentVoucherHeader.findFirst({
    where: { voucherNumber: 'PV-000001' },
  });

  const paymentVoucherData = {
    voucherNumber: 'PV-000001',
    voucherType: 'VENDOR_PAYMENT',
    sourceType: 'MANUAL',
    sourceModule: 'procurement',
    sourceDocumentNumber: 'BILL-0001',
    legalEntityId: sampleCompany.id,
    branchId: headOffice.id,
    departmentId: financeDept.id,
    costCenterId: adminCostCenter.id,
    projectId: finOpsProject.id,
    beneficiaryType: 'VENDOR',
    beneficiaryName: 'Metro Packaging',
    beneficiaryCode: 'VEN-001',
    supplierId: supplierB.id,
    payableAccountId: payables.id,
    bankAccountId: operationsBank.id,
    paymentMethod: 'BANK_TRANSFER',
    paymentChannel: 'MANUAL_TRANSFER',
    currencyCode: 'NGN',
    exchangeRate: '1.000000',
    voucherDate: new Date('2026-03-14T00:00:00.000Z'),
    requestedPaymentDate: new Date('2026-03-15T00:00:00.000Z'),
    postingDate: new Date('2026-03-14T00:00:00.000Z'),
    accountingPeriodId: (await prisma.accountingPeriod.findFirst({ where: { companyId: sampleCompany.id, name: 'Mar 2026' } })).id,
    fiscalYearId: fiscalYear2026.id,
    referenceNumber: 'PAY-2026-0314',
    narration: 'Settlement of approved supplier services invoice',
    purposeOfPayment: 'Vendor payment for support services and approved operating items',
    totalAmount: '16125.00',
    taxAmount: '1125.00',
    withholdingTaxAmount: '750.00',
    netPaymentAmount: '15375.00',
    status: 'DRAFT',
    workflowStatus: 'AWAITING_SUBMISSION',
    paymentStatus: 'NOT_PAID',
    approvalLevel: 0,
    currentApproverId: null,
    finalApproverId: null,
    requiresAttachment: true,
    attachmentCount: 0,
    commentsCount: 1,
    createdBy: user.id,
    updatedBy: user.id,
    isSystemGenerated: false,
    isPostedToGL: false,
    templateId: standardVoucherTemplate?.id ?? null,
    approvalChain: [
      { level: 1, label: 'Finance Review', role: 'FINANCE', status: 'PENDING' },
      { level: 2, label: 'Final Approval', role: 'ADMIN', status: 'PENDING' },
    ],
  };

  if (existingPaymentVoucher) {
    await prisma.aPPaymentVoucherHeader.update({
      where: { id: existingPaymentVoucher.id },
      data: {
        ...paymentVoucherData,
        lines: {
          deleteMany: {},
          create: [
            {
              lineNumber: 1,
              lineType: 'EXPENSE',
              accountId: opex.id,
              accountCode: opex.code,
              accountName: opex.name,              description: 'Approved vendor services settlement',
              grossAmount: '15000.00',
              taxCodeId: vatConfig?.id,
              taxAmount: '1125.00',
              withholdingTaxCodeId: vatConfig?.id,
              withholdingTaxAmount: '750.00',
              netAmount: '15375.00',
              branchId: headOffice.id,
              departmentId: financeDept.id,
              costCenterId: adminCostCenter.id,
              projectId: finOpsProject.id,
              lineStatus: 'OPEN',
            },
          ],
        },
        comments: {
          deleteMany: {},
          create: {
            commentType: 'INTERNAL',
            body: 'Seeded sample payment voucher awaiting workflow submission.',
            authorUserId: user.id,
            authorName: user.email,
          },
        },
        statusHistory: {
          deleteMany: {},
          create: {
            toStatus: 'DRAFT',
            toWorkflowStatus: 'AWAITING_SUBMISSION',
            toPaymentStatus: 'NOT_PAID',
            changedBy: user.id,
            reason: 'Seed sample payment voucher',
          },
        },
      },
    });
  } else {
    await prisma.aPPaymentVoucherHeader.create({
      data: {
        ...paymentVoucherData,
        lines: {
          create: [
            {
              lineNumber: 1,
              lineType: 'EXPENSE',
              accountId: opex.id,
              accountCode: opex.code,
              accountName: opex.name,              description: 'Approved vendor services settlement',
              grossAmount: '15000.00',
              taxCodeId: vatConfig?.id,
              taxAmount: '1125.00',
              withholdingTaxCodeId: vatConfig?.id,
              withholdingTaxAmount: '750.00',
              netAmount: '15375.00',
              branchId: headOffice.id,
              departmentId: financeDept.id,
              costCenterId: adminCostCenter.id,
              projectId: finOpsProject.id,
              lineStatus: 'OPEN',
            },
          ],
        },
        comments: {
          create: {
            commentType: 'INTERNAL',
            body: 'Seeded sample payment voucher awaiting workflow submission.',
            authorUserId: user.id,
            authorName: user.email,
          },
        },
        statusHistory: {
          create: {
            toStatus: 'DRAFT',
            toWorkflowStatus: 'AWAITING_SUBMISSION',
            toPaymentStatus: 'NOT_PAID',
            changedBy: user.id,
            reason: 'Seed sample payment voucher',
          },
        },
      },
    });
  }

  console.log('Sample company ready. Only one placeholder sample company is kept.');
  console.log('Sample data includes branches, warehouses, accounts, products, customers, suppliers, stock, invoices, bills, journals, payment vouchers, assets, and loans.');
  console.log('Admin login: admin@example.com / Admin123!');
}

main()
  .catch((error) => {
    console.error('Seed failed', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });



