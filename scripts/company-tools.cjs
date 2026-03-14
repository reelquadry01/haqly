#!/usr/bin/env node
/**
 * Simple company helper script
 *
 * Usage:
 *   node scripts/company-tools.cjs create --name "NewCo" [--branch "Main"]
 *   node scripts/company-tools.cjs list
 *
 * (Data migration/clone is a placeholder and can be expanded.)
 */
const minimist = require('minimist');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function main() {
  const args = minimist(process.argv.slice(2));
  const cmd = args._[0];

  if (!cmd || cmd === 'help') {
    console.log('Commands:');
    console.log('  create --name "Company" [--branch "BranchName" --code "BR-1"]');
    console.log('  list');
    console.log('  clone --from <companyId> --name "NewCo"  (placeholder)');
    process.exit(0);
  }

  if (cmd === 'list') {
    const companies = await prisma.company.findMany({ include: { branches: true } });
    console.table(
      companies.map((c) => ({
        id: c.id,
        name: c.name,
        branches: c.branches.map((b) => `${b.id}:${b.code}`).join(', '),
      })),
    );
    return;
  }

  if (cmd === 'create') {
    const name = args.name || args.n;
    if (!name) {
      console.error('Missing --name');
      process.exit(1);
    }
    const branchName = args.branch || 'Main Branch';
    const branchCode = args.code || `BR-${Date.now()}`;

    const company = await prisma.company.create({ data: { name } });
    const branch = await prisma.branch.create({ data: { name: branchName, code: branchCode, companyId: company.id } });
    console.log('Created company:', company);
    console.log('Created branch:', branch);
    return;
  }

  if (cmd === 'clone') {
    // Placeholder for future data migration logic
    console.log('Clone/migrate placeholder: implement copying customers/products/accounts as needed.');
    return;
  }

  console.error('Unknown command:', cmd);
  process.exit(1);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
