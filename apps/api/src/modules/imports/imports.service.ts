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
}

