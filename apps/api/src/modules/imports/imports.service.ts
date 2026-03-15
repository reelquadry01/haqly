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
}