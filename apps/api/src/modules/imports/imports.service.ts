import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

export interface BulkImportResult {
  dataset: string;
  created: number;
  updated?: number;
  failed: number;
  errors: { row: number; message: string }[];
}

@Injectable()
export class ImportsService {
  constructor(private prisma: PrismaService) {}

  async importBranches(dto: any): Promise<BulkImportResult> {
    const errors: BulkImportResult["errors"] = [];
    let created = 0;
    let updated = 0;

    for (const [index, row] of dto.rows.entries()) {
      try {
        const company = await this.prisma.company.findFirst({
          where: { code: row.companyCode?.trim() },
        });

        if (!company) {
          throw new NotFoundException(`Company ${row.companyCode} not found`);
        }

        const existing = await this.prisma.branch.findUnique({
          where: { code: row.branchCode },
        });

        if (existing) {
          await this.prisma.branch.update({
            where: { id: existing.id },
            data: {
              name: row.branchName,
              companyId: company.id,
            },
          });
          updated++;
        } else {
          await this.prisma.branch.create({
            data: {
              code: row.branchCode,
              name: row.branchName,
              companyId: company.id,
            },
          });
          created++;
        }
      } catch (error) {
        errors.push({
          row: index + 1,
          message: error instanceof Error ? error.message : "Could not import branch row",
        });
      }
    }

    return {
      dataset: "branches",
      created,
      updated,
      failed: errors.length,
      errors,
    };
  }

  async importDepartments(dto: any): Promise<BulkImportResult> {
    return {
      dataset: "departments",
      created: 0,
      failed: 0,
      errors: [],
    };
  }

  async importWarehouses(dto: any): Promise<BulkImportResult> {
    return {
      dataset: "warehouses",
      created: 0,
      failed: 0,
      errors: [],
    };
  }

  async importBankAccounts(dto: any): Promise<BulkImportResult> {
    return {
      dataset: "bank-accounts",
      created: 0,
      failed: 0,
      errors: [],
    };
  }

  async importGLJournalDump(dto: { companyId: number; defaultNarration?: string; rows: Array<Record<string, unknown>> }): Promise<BulkImportResult> {
    const rows = Array.isArray(dto?.rows) ? dto.rows : [];
    const errors: BulkImportResult["errors"] = [];
    let created = 0;
    const updated = 0;

    const norm = (value: unknown): string => String(value ?? "").trim().toUpperCase();

    const required = (row: Record<string, unknown>, field: string): string => {
      const value = row?.[field];
      if (value === null || value === undefined) {
        throw new Error(`Missing required field "${field}"`);
      }
      const text = String(value).trim();
      if (!text) {
        throw new Error(`Missing required field "${field}"`);
      }
      return text;
    };

    const optional = (row: Record<string, unknown>, field: string): string | undefined => {
      const value = row?.[field];
      if (value === null || value === undefined) return undefined;
      const text = String(value).trim();
      return text ? text : undefined;
    };

    const numberValue = (row: Record<string, unknown>, field: string): number => {
      const value = row?.[field];
      if (value === null || value === undefined || value === "") {
        return 0;
      }
      const parsed = Number(value);
      if (Number.isNaN(parsed)) {
        throw new Error(`Field "${field}" must be a valid number`);
      }
      return parsed;
    };

    if (!dto?.companyId || Number(dto.companyId) <= 0) {
      return {
        dataset: "gl-journal-dump",
        created: 0,
        updated: 0,
        failed: rows.length || 1,
        errors: [{ row: 0, message: "companyId is required" }],
      };
    }

    const company = await this.prisma.company.findUnique({
      where: { id: Number(dto.companyId) },
      select: { id: true, code: true, name: true },
    });

    if (!company) {
      return {
        dataset: "gl-journal-dump",
        created: 0,
        updated: 0,
        failed: rows.length || 1,
        errors: [{ row: 0, message: `Company ${dto.companyId} not found` }],
      };
    }

    const [accounts, branches, departments, costCenters, projects, currencies] = await Promise.all([
      this.prisma.account.findMany({ select: { id: true, code: true, name: true } }),
      this.prisma.branch.findMany({ select: { id: true, code: true, name: true, companyId: true } }),
      this.prisma.department.findMany({ select: { id: true, name: true, companyId: true } }),
      this.prisma.costCenter.findMany({ select: { id: true, name: true, companyId: true } }),
      this.prisma.project.findMany({ select: { id: true, name: true, companyId: true } }),
      this.prisma.currency.findMany({ select: { id: true, code: true } }),
    ]);

    const accountMap = new Map(
      accounts
        .filter((x) => !!x.code)
        .map((x) => [norm(x.code), x.id]),
    );

    const branchMap = new Map(
      branches
        .filter((x) => !!x.code && x.companyId === company.id)
        .map((x) => [norm(x.code), x.id]),
    );

    const departmentMap = new Map(
      departments
        .filter((x) => !!x.name && x.companyId === company.id)
        .map((x) => [norm(x.name), x.id]),
    );

    const costCenterMap = new Map(
      costCenters
        .filter((x) => !!x.name && x.companyId === company.id)
        .map((x) => [norm(x.name), x.id]),
    );

    const projectMap = new Map(
      projects
        .filter((x) => !!x.name && x.companyId === company.id)
        .map((x) => [norm(x.name), x.id]),
    );

    const currencyMap = new Map(
      currencies
        .filter((x) => !!x.code)
        .map((x) => [norm(x.code), x.id]),
    );

    const validRows: Array<{ rowNumber: number; row: Record<string, unknown> }> = [];

    for (const [index, rawRow] of rows.entries()) {
      const rowNumber = index + 1;

      try {
        const journalNumber = required(rawRow, "journalNumber");
        const postingDate = required(rawRow, "postingDate");
        const accountCode = required(rawRow, "accountCode");

        const debit = numberValue(rawRow, "debit");
        const credit = numberValue(rawRow, "credit");

        if (!journalNumber) {
          throw new Error(`Missing required field "journalNumber"`);
        }

        if (!postingDate) {
          throw new Error(`Missing required field "postingDate"`);
        }

        if (debit < 0 || credit < 0) {
          throw new Error("Debit and credit cannot be negative");
        }

        if ((debit > 0 && credit > 0) || (debit === 0 && credit === 0)) {
          throw new Error("Each row must have either debit or credit populated, but not both");
        }

        if (!accountMap.has(norm(accountCode))) {
          throw new Error(`Account code "${accountCode}" not found`);
        }

        const branchCode = optional(rawRow, "branchCode");
        if (branchCode && !branchMap.has(norm(branchCode))) {
          throw new Error(`Branch code "${branchCode}" not found`);
        }

        const departmentCode = optional(rawRow, "departmentCode");
        if (departmentCode && !departmentMap.has(norm(departmentCode))) {
          throw new Error(`Department code "${departmentCode}" not found`);
        }

        const costCenterCode = optional(rawRow, "costCenterCode");
        if (costCenterCode && !costCenterMap.has(norm(costCenterCode))) {
          throw new Error(`Cost center code "${costCenterCode}" not found`);
        }

        const projectCode = optional(rawRow, "projectCode");
        if (projectCode && !projectMap.has(norm(projectCode))) {
          throw new Error(`Project code "${projectCode}" not found`);
        }

        const currencyCode = optional(rawRow, "currencyCode");
        if (currencyCode && !currencyMap.has(norm(currencyCode))) {
          throw new Error(`Currency code "${currencyCode}" not found`);
        }

        validRows.push({ rowNumber, row: rawRow });
      } catch (error) {
        errors.push({
          row: rowNumber,
          message: error instanceof Error ? error.message : "Could not validate GL journal dump row",
        });
      }
    }

    const grouped = new Map<string, Array<{ rowNumber: number; row: Record<string, unknown> }>>();

    for (const item of validRows) {
      const journalNumber = required(item.row, "journalNumber");
      const bucket = grouped.get(journalNumber) ?? [];
      bucket.push(item);
      grouped.set(journalNumber, bucket);
    }

    for (const [journalNumber, journalRows] of grouped.entries()) {
      const totalDebit = journalRows.reduce((sum, item) => sum + numberValue(item.row, "debit"), 0);
      const totalCredit = journalRows.reduce((sum, item) => sum + numberValue(item.row, "credit"), 0);

      if (Math.abs(totalDebit - totalCredit) > 0.000001) {
        for (const item of journalRows) {
          errors.push({
            row: item.rowNumber,
            message: `Journal "${journalNumber}" is not balanced. Debit=${totalDebit}, Credit=${totalCredit}`,
          });
        }
        continue;
      }

      // Initial scaffold only.
      // This validates the batch and grouped journals.
      // Posting into GLJournalHeader and GLJournalLine should be added
      // after confirming the exact Prisma model fields.
      created++;
    }

    return {
      dataset: "gl-journal-dump",
      created,
      updated,
      failed: errors.length,
      errors,
    };
  }

  async importGLJournalDump(dto: { companyId: number; defaultNarration?: string; rows: Array<Record<string, unknown>> }): Promise<BulkImportResult> {
    const rows = Array.isArray(dto?.rows) ? dto.rows : [];
    const errors: BulkImportResult["errors"] = [];
    let created = 0;
    const updated = 0;

    const norm = (value: unknown): string => String(value ?? "").trim().toUpperCase();

    const required = (row: Record<string, unknown>, field: string): string => {
      const value = row?.[field];
      if (value === null || value === undefined) {
        throw new Error(`Missing required field "${field}"`);
      }
      const text = String(value).trim();
      if (!text) {
        throw new Error(`Missing required field "${field}"`);
      }
      return text;
    };

    const optional = (row: Record<string, unknown>, field: string): string | undefined => {
      const value = row?.[field];
      if (value === null || value === undefined) return undefined;
      const text = String(value).trim();
      return text ? text : undefined;
    };

    const numberValue = (row: Record<string, unknown>, field: string): number => {
      const value = row?.[field];
      if (value === null || value === undefined || value === "") {
        return 0;
      }
      const parsed = Number(value);
      if (Number.isNaN(parsed)) {
        throw new Error(`Field "${field}" must be a valid number`);
      }
      return parsed;
    };

    const parseDate = (value: string, field: string): Date => {
      const date = new Date(value);
      if (Number.isNaN(date.getTime())) {
        throw new Error(`Field "${field}" must be a valid date`);
      }
      return date;
    };

    if (!dto?.companyId || Number(dto.companyId) <= 0) {
      return {
        dataset: "gl-journal-dump",
        created: 0,
        updated: 0,
        failed: rows.length || 1,
        errors: [{ row: 0, message: "companyId is required" }],
      };
    }

    const company = await this.prisma.company.findUnique({
      where: { id: Number(dto.companyId) },
      select: { id: true, code: true, name: true },
    });

    if (!company) {
      return {
        dataset: "gl-journal-dump",
        created: 0,
        updated: 0,
        failed: rows.length || 1,
        errors: [{ row: 0, message: `Company ${dto.companyId} not found` }],
      };
    }

    const [accounts, branches, departments, costCenters, projects, currencies, periods, fiscalYears] = await Promise.all([
      this.prisma.account.findMany({
        select: { id: true, code: true, name: true, type: true },
      }),
      this.prisma.branch.findMany({
        where: { companyId: company.id },
        select: { id: true, code: true, name: true, companyId: true },
      }),
      this.prisma.department.findMany({
        where: { companyId: company.id },
        select: { id: true, name: true, companyId: true },
      }),
      this.prisma.costCenter.findMany({
        where: { companyId: company.id },
        select: { id: true, code: true, name: true, companyId: true },
      }),
      this.prisma.project.findMany({
        where: { companyId: company.id },
        select: { id: true, code: true, name: true, companyId: true },
      }),
      this.prisma.currency.findMany({
        select: { id: true, code: true },
      }),
      this.prisma.accountingPeriod.findMany({
        where: { companyId: company.id },
        select: { id: true, name: true, startDate: true, endDate: true, status: true, fiscalYearId: true },
      }),
      this.prisma.fiscalYear.findMany({
        where: { companyId: company.id },
        select: { id: true, name: true, startDate: true, endDate: true, status: true },
      }),
    ]);

    const accountMap = new Map(
      accounts
        .filter((x) => !!x.code)
        .map((x) => [norm(x.code), x]),
    );

    const branchMap = new Map(
      branches
        .filter((x) => !!x.code)
        .map((x) => [norm(x.code), x]),
    );

    const departmentMap = new Map(
      departments
        .filter((x) => !!x.name)
        .map((x) => [norm(x.name), x]),
    );

    const costCenterMap = new Map<string, { id: number; code: string; name: string; companyId: number }>();
    for (const item of costCenters) {
      if (item.code) costCenterMap.set(norm(item.code), item);
      costCenterMap.set(norm(item.name), item);
    }

    const projectMap = new Map<string, { id: number; code: string; name: string; companyId: number }>();
    for (const item of projects) {
      if (item.code) projectMap.set(norm(item.code), item);
      projectMap.set(norm(item.name), item);
    }

    const currencyMap = new Map(
      currencies
        .filter((x) => !!x.code)
        .map((x) => [norm(x.code), x]),
    );

    const validRows: Array<{ rowNumber: number; row: Record<string, unknown> }> = [];

    for (const [index, rawRow] of rows.entries()) {
      const rowNumber = index + 1;

      try {
        const journalNumber = required(rawRow, "journalNumber");
        const postingDate = required(rawRow, "postingDate");
        const accountCode = required(rawRow, "accountCode");
        const branchCode = required(rawRow, "branchCode");

        const debit = numberValue(rawRow, "debit");
        const credit = numberValue(rawRow, "credit");

        parseDate(postingDate, "postingDate");

        if (!journalNumber) {
          throw new Error(`Missing required field "journalNumber"`);
        }

        if (debit < 0 || credit < 0) {
          throw new Error("Debit and credit cannot be negative");
        }

        if ((debit > 0 && credit > 0) || (debit === 0 && credit === 0)) {
          throw new Error("Each row must have either debit or credit populated, but not both");
        }

        const account = accountMap.get(norm(accountCode));
        if (!account) {
          throw new Error(`Account code "${accountCode}" not found`);
        }

        const branch = branchMap.get(norm(branchCode));
        if (!branch) {
          throw new Error(`Branch code "${branchCode}" not found`);
        }

        const departmentCode = optional(rawRow, "departmentCode");
        if (departmentCode && !departmentMap.has(norm(departmentCode))) {
          throw new Error(`Department code "${departmentCode}" not found`);
        }

        const costCenterCode = optional(rawRow, "costCenterCode");
        if (costCenterCode && !costCenterMap.has(norm(costCenterCode))) {
          throw new Error(`Cost center code "${costCenterCode}" not found`);
        }

        const projectCode = optional(rawRow, "projectCode");
        if (projectCode && !projectMap.has(norm(projectCode))) {
          throw new Error(`Project code "${projectCode}" not found`);
        }

        const currencyCode = optional(rawRow, "currencyCode");
        if (currencyCode && !currencyMap.has(norm(currencyCode))) {
          throw new Error(`Currency code "${currencyCode}" not found`);
        }

        validRows.push({ rowNumber, row: rawRow });
      } catch (error) {
        errors.push({
          row: rowNumber,
          message: error instanceof Error ? error.message : "Could not validate GL journal dump row",
        });
      }
    }

    const grouped = new Map<string, Array<{ rowNumber: number; row: Record<string, unknown> }>>();

    for (const item of validRows) {
      const journalNumber = required(item.row, "journalNumber");
      const bucket = grouped.get(journalNumber) ?? [];
      bucket.push(item);
      grouped.set(journalNumber, bucket);
    }

    for (const [journalNumber, journalRows] of grouped.entries()) {
      try {
        const existingJournal = await this.prisma.gLJournalHeader.findUnique({
          where: { journalNumber },
          select: { id: true },
        });

        if (existingJournal) {
          for (const item of journalRows) {
            errors.push({
              row: item.rowNumber,
              message: `Journal "${journalNumber}" already exists`,
            });
          }
          continue;
        }

        const totalDebit = journalRows.reduce((sum, item) => sum + numberValue(item.row, "debit"), 0);
        const totalCredit = journalRows.reduce((sum, item) => sum + numberValue(item.row, "credit"), 0);

        if (Math.abs(totalDebit - totalCredit) > 0.000001) {
          for (const item of journalRows) {
            errors.push({
              row: item.rowNumber,
              message: `Journal "${journalNumber}" is not balanced. Debit=${totalDebit}, Credit=${totalCredit}`,
            });
          }
          continue;
        }

        const firstRow = journalRows[0].row;
        const postingDate = parseDate(required(firstRow, "postingDate"), "postingDate");
        const journalDate = postingDate;

        const headerBranchCode = required(firstRow, "branchCode");
        const headerBranch = branchMap.get(norm(headerBranchCode));
        if (!headerBranch) {
          throw new Error(`Branch code "${headerBranchCode}" not found`);
        }

        for (const item of journalRows) {
          const rowBranchCode = required(item.row, "branchCode");
          if (norm(rowBranchCode) !== norm(headerBranchCode)) {
            throw new Error(`Journal "${journalNumber}" contains multiple branch codes. One journal must belong to one branch`);
          }
        }

        const headerCurrencyCode = optional(firstRow, "currencyCode") ?? "NGN";
        for (const item of journalRows) {
          const rowCurrencyCode = optional(item.row, "currencyCode") ?? "NGN";
          if (norm(rowCurrencyCode) !== norm(headerCurrencyCode)) {
            throw new Error(`Journal "${journalNumber}" contains multiple currency codes. One journal must use one currency`);
          }
        }

        const period = periods.find((p) => {
          const status = String(p.status ?? "").toUpperCase();
          return postingDate >= new Date(p.startDate) && postingDate <= new Date(p.endDate) && status === "OPEN";
        });

        if (!period) {
          throw new Error(`No open accounting period found for ${postingDate.toISOString().slice(0, 10)}`);
        }

        const fiscalYear = fiscalYears.find((fy) => {
          return postingDate >= new Date(fy.startDate) && postingDate <= new Date(fy.endDate);
        });

        const headerDepartmentCode = optional(firstRow, "departmentCode");
        const headerDepartment = headerDepartmentCode ? departmentMap.get(norm(headerDepartmentCode)) : undefined;

        const headerCostCenterCode = optional(firstRow, "costCenterCode");
        const headerCostCenter = headerCostCenterCode ? costCenterMap.get(norm(headerCostCenterCode)) : undefined;

        const headerProjectCode = optional(firstRow, "projectCode");
        const headerProject = headerProjectCode ? projectMap.get(norm(headerProjectCode)) : undefined;

        const headerNarration =
          optional(firstRow, "narration") ??
          dto.defaultNarration ??
          `Imported GL journal ${journalNumber}`;

        const referenceNumber = optional(firstRow, "reference");
        const externalReference = optional(firstRow, "sourceDocument");

        await this.prisma.$transaction(async (tx) => {
          const header = await tx.gLJournalHeader.create({
            data: {
              journalNumber,
              journalType: "MANUAL",
              sourceType: "SYSTEM",
              sourceModule: "GL_IMPORT",
              sourceDocumentId: journalNumber,
              sourceDocumentNumber: externalReference ?? referenceNumber ?? journalNumber,
              legalEntityId: company.id,
              branchId: headerBranch.id,
              departmentId: headerDepartment?.id ?? null,
              costCenterId: headerCostCenter?.id ?? null,
              projectId: headerProject?.id ?? null,
              journalDate,
              postingDate,
              accountingPeriodId: period.id,
              fiscalYearId: fiscalYear?.id ?? period.fiscalYearId ?? null,
              currencyCode: headerCurrencyCode,
              exchangeRate: 1,
              referenceNumber: referenceNumber ?? null,
              externalReference: externalReference ?? null,
              narration: headerNarration,
              description: "Imported from GL journal dump",
              status: "DRAFT",
              workflowStatus: "DRAFT",
              approvalLevel: 0,
              isSystemGenerated: true,
              isRecurring: false,
              isIntercompany: false,
              totalDebit,
              totalCredit,
            },
          });

          for (let i = 0; i < journalRows.length; i++) {
            const item = journalRows[i];
            const row = item.row;

            const accountCode = required(row, "accountCode");
            const account = accountMap.get(norm(accountCode));
            if (!account) {
              throw new Error(`Account code "${accountCode}" not found`);
            }

            const branchCode = required(row, "branchCode");
            const lineBranch = branchMap.get(norm(branchCode));

            const departmentCode = optional(row, "departmentCode");
            const lineDepartment = departmentCode ? departmentMap.get(norm(departmentCode)) : undefined;

            const costCenterCode = optional(row, "costCenterCode");
            const lineCostCenter = costCenterCode ? costCenterMap.get(norm(costCenterCode)) : undefined;

            const projectCode = optional(row, "projectCode");
            const lineProject = projectCode ? projectMap.get(norm(projectCode)) : undefined;

            const currencyCode = optional(row, "currencyCode") ?? headerCurrencyCode;
            const debit = numberValue(row, "debit");
            const credit = numberValue(row, "credit");
            const lineNarration = optional(row, "narration") ?? headerNarration;
            const reference1 = optional(row, "reference");
            const reference2 = optional(row, "sourceDocument");

            await tx.gLJournalLine.create({
              data: {
                journalId: header.id,
                lineNumber: i + 1,
                accountId: account.id,
                accountCode: account.code,
                accountName: account.name,
                accountType: account.type,
                debitAmount: debit,
                creditAmount: credit,
                baseCurrencyDebit: debit,
                baseCurrencyCredit: credit,
                transactionCurrencyCode: currencyCode,
                exchangeRate: 1,
                branchId: lineBranch?.id ?? null,
                departmentId: lineDepartment?.id ?? null,
                costCenterId: lineCostCenter?.id ?? null,
                projectId: lineProject?.id ?? null,
                lineNarration: lineNarration ?? null,
                reference1: reference1 ?? null,
                reference2: reference2 ?? null,
              },
            });
          }
        });

        created++;
      } catch (error) {
        for (const item of journalRows) {
          errors.push({
            row: item.rowNumber,
            message: error instanceof Error ? error.message : `Could not import journal "${journalNumber}"`,
          });
        }
      }
    }

    return {
      dataset: "gl-journal-dump",
      created,
      updated,
      failed: errors.length,
      errors,
    };
  }
}

