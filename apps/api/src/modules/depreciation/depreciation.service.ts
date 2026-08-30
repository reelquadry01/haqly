import { BadRequestException, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { PostingService } from '../posting/posting.service';
import { CreateDepPolicyDto, RunDepreciationDto } from './dto';

/** Money is compared to the cent; anything below half a cent is equal. */
const MONEY_EPSILON = 0.005;

export const DEPRECIATION_POSTING_MODULE = 'FIXED_ASSETS';
export const DEPRECIATION_POSTING_TYPE = 'DEPRECIATION';

type SkippedAsset = { assetId: number; tag: string; reason: string };

@Injectable()
export class DepreciationService {
  constructor(
    private prisma: PrismaService,
    private posting: PostingService,
  ) {}

  async createPolicy(dto: CreateDepPolicyDto) {
    return this.prisma.depreciationPolicy.create({ data: dto });
  }

  async listPolicies() {
    return this.prisma.depreciationPolicy.findMany();
  }

  /**
   * Charges one period of depreciation and posts it to the ledger.
   *
   * The run is atomic: if the ledger posting fails — no open period, no posting
   * rule configured — the depreciation lines roll back with it, so the asset
   * register can never claim depreciation the general ledger does not have.
   */
  async run(dto: RunDepreciationDto) {
    const book = dto.book || 'book';
    const periodStart = this.parseDate(dto.periodStart, 'periodStart');
    const periodEnd = this.parseDate(dto.periodEnd, 'periodEnd');

    if (periodEnd < periodStart) {
      throw new BadRequestException('periodEnd cannot fall before periodStart.');
    }

    const duplicate = await this.prisma.depreciationRun.findFirst({
      where: { book, periodStart, periodEnd },
    });
    if (duplicate) {
      throw new BadRequestException(
        `Depreciation for this period has already been run on book "${book}" (run ${duplicate.id}). ` +
          'Roll that run back before charging the period again.',
      );
    }

    return this.prisma.$transaction(async (tx) => {
      const assets = await tx.asset.findMany({
        where: dto.legalEntityId ? { branch: { companyId: dto.legalEntityId } } : {},
        include: { category: true, branch: true },
        orderBy: { id: 'asc' },
      });

      if (assets.length === 0) {
        throw new BadRequestException('No assets found to depreciate for this scope.');
      }

      const run = await tx.depreciationRun.create({
        data: { periodStart, periodEnd, book, status: 'POSTED' },
      });

      const skipped: SkippedAsset[] = [];
      // Keyed by the dimensions a journal is posted against, so a multi-branch
      // company gets one journal per branch rather than one undifferentiated lump.
      const groups = new Map<string, { legalEntityId?: number; branchId?: number; amount: number }>();
      let charged = 0;

      for (const asset of assets) {
        const outcome = await this.chargeAsset(tx, asset, run.id, periodStart, periodEnd);

        if ('reason' in outcome) {
          skipped.push({ assetId: asset.id, tag: asset.tag, reason: outcome.reason });
          continue;
        }

        charged += 1;

        const legalEntityId = asset.branch?.companyId ?? dto.legalEntityId;
        const branchId = asset.branch?.id;
        const key = `${legalEntityId ?? 'none'}:${branchId ?? 'none'}`;
        const bucket = groups.get(key) ?? { legalEntityId, branchId, amount: 0 };
        bucket.amount += outcome.amount;
        groups.set(key, bucket);
      }

      const postings = [];
      for (const [key, group] of groups.entries()) {
        if (group.amount <= MONEY_EPSILON) continue;

        const journal = await this.posting.post(
          {
            context: {
              module: DEPRECIATION_POSTING_MODULE,
              transactionType: DEPRECIATION_POSTING_TYPE,
              triggeringEvent: 'DEPRECIATION_RUN_POSTED',
              postingDate: periodEnd,
              sourceTable: 'depreciationRun',
              sourceDocumentId: String(run.id),
              sourceDocumentNumber: `DEP-${run.id}`,
              sourceStatus: 'POSTED',
              legalEntityId: group.legalEntityId,
              branchId: group.branchId,
              currencyCode: 'NGN',
              narration: `Depreciation for ${this.isoDate(periodStart)} to ${this.isoDate(periodEnd)}`,
              idempotencyKey: `depreciation-run-${run.id}-${key}`,
              descriptionTemplateData: { runId: run.id, book },
            },
            pattern: 'DEPRECIATION',
            amounts: {
              baseAmount: this.round(group.amount),
              totalAmount: this.round(group.amount),
            },
          },
          tx,
        );

        postings.push({
          branchId: group.branchId ?? null,
          legalEntityId: group.legalEntityId ?? null,
          amount: this.round(group.amount),
          journalEntryId: journal?.id ?? null,
        });
      }

      const result = await tx.depreciationRun.findUnique({
        where: { id: run.id },
        include: { lines: true },
      });

      return { ...result, charged, skipped, postings };
    });
  }

  /**
   * Works out one period's charge for a single asset and records it.
   *
   * Returns a reason instead of an amount when the asset should not be charged,
   * so the caller can report exactly what was left out rather than passing over
   * it in silence.
   */
  private async chargeAsset(
    tx: Prisma.TransactionClient,
    asset: Prisma.AssetGetPayload<{ include: { category: true; branch: true } }>,
    runId: number,
    periodStart: Date,
    periodEnd: Date,
  ): Promise<{ amount: number } | { reason: string }> {
    if (asset.status !== 'ACTIVE') {
      return { reason: `Asset is ${asset.status.toLowerCase()}, not active` };
    }

    const startsOn = asset.depreciationStart ?? asset.acquisitionDate;
    if (startsOn > periodEnd) {
      return { reason: `Depreciation does not start until ${this.isoDate(startsOn)}` };
    }

    const lifeMonths = asset.category.usefulLifeMonths;
    if (!lifeMonths || lifeMonths <= 0) {
      return { reason: `Category "${asset.category.name}" has no useful life set` };
    }

    const cost = Number(asset.acquisitionCost);
    const residual = Number(asset.residualValue ?? 0);
    const depreciableBase = cost - residual;
    if (depreciableBase <= MONEY_EPSILON) {
      return { reason: 'Residual value leaves nothing to depreciate' };
    }

    // The opening-balance importer records migrated depreciation as a line with
    // amount 0 and the accumulated total, so the running total has to come from
    // the latest accumulated figure rather than a sum of period amounts.
    const latest = await tx.depreciationLine.findFirst({
      where: { assetId: asset.id },
      orderBy: [{ periodEnd: 'desc' }, { id: 'desc' }],
      select: { accumulated: true },
    });
    const priorAccumulated = Number(latest?.accumulated ?? 0);

    const remaining = depreciableBase - priorAccumulated;
    if (remaining <= MONEY_EPSILON) {
      return { reason: 'Asset is already fully depreciated' };
    }

    const computed = this.periodCharge(asset.category.depreciationMethod, {
      depreciableBase,
      cost,
      lifeMonths,
      priorAccumulated,
    });

    if (computed === null) {
      return {
        reason: `${asset.category.depreciationMethod} requires usage data and is not supported by a scheduled run`,
      };
    }

    // Never depreciate past the residual value.
    const amount = this.round(Math.min(computed, remaining));
    if (amount <= MONEY_EPSILON) {
      return { reason: 'Computed charge for this period rounds to zero' };
    }

    await tx.depreciationLine.create({
      data: {
        runId,
        assetId: asset.id,
        amount: new Prisma.Decimal(amount),
        accumulated: new Prisma.Decimal(this.round(priorAccumulated + amount)),
        periodStart,
        periodEnd,
      },
    });

    return { amount };
  }

  private periodCharge(
    method: string,
    input: { depreciableBase: number; cost: number; lifeMonths: number; priorAccumulated: number },
  ): number | null {
    switch (method) {
      case 'STRAIGHT_LINE':
        return input.depreciableBase / input.lifeMonths;

      case 'DECLINING_BALANCE': {
        // Double-declining: twice the straight-line rate, applied to the carrying
        // amount rather than to original cost.
        const carrying = input.cost - input.priorAccumulated;
        return carrying * ((2 / input.lifeMonths) || 0);
      }

      case 'UNITS_OF_PRODUCTION':
        // Depends on metered output that a date-driven run has no way to know.
        return null;

      default:
        return null;
    }
  }

  private parseDate(value: string, field: string): Date {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      throw new BadRequestException(`Field "${field}" must be a valid date.`);
    }
    return date;
  }

  private isoDate(value: Date): string {
    return value.toISOString().slice(0, 10);
  }

  private round(value: number): number {
    return Math.round(value * 100) / 100;
  }
}
