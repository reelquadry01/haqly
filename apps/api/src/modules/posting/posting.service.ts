import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { Prisma, PrismaClient } from '@prisma/client';
import { createHash, randomUUID } from 'crypto';
import { PrismaService } from '../../prisma/prisma.service';
import { GeneratedJournalLine, PostingRequest, ResolvedPostingRule } from './posting.types';

type TxClient = Prisma.TransactionClient | PrismaService | PrismaClient;

@Injectable()
export class PostingService {
  private readonly logger = new Logger(PostingService.name);

  constructor(private readonly prisma: PrismaService) {}

  async post(request: PostingRequest, txOrClient?: TxClient) {
    const client = txOrClient ?? this.prisma;
    const rule = await this.resolveRule(client, request);
    await this.validateContext(client, request, rule);
    await this.ensureIdempotency(client, request);

    const lines = this.buildLines(request, rule);
    this.ensureBalanced(lines);

    const referenceSeed = `${request.context.module}-${request.context.sourceDocumentNumber}-${request.context.triggeringEvent}`;
    const reference = this.buildReference(referenceSeed);
    const description = this.renderDescription(rule.postingDescriptionTemplate, request);

    const journalEntry = await client.journalEntry.create({
      data: {
        reference,
        description,
        date: request.context.postingDate,
        type: this.resolveJournalType(request.context.module),
        createdBy: request.context.userId,
      },
    });

    await client.journalLine.createMany({
      data: lines.map((line) => ({
        entryId: journalEntry.id,
        accountId: line.accountId,
        branchId: line.branchId,
        debit: line.debit,
        credit: line.credit,
        memo: line.memo,
      })),
    });

    const matchingPeriod = await this.findPostingPeriod(client, request);
    const idempotencyKey = request.context.idempotencyKey ?? this.buildIdempotencyKey(request);

    await client.postingAudit.create({
      data: {
        journalEntryId: journalEntry.id,
        postingRuleId: rule.id,
        sourceModule: request.context.module,
        sourceTable: request.context.sourceTable,
        sourceDocumentId: request.context.sourceDocumentId,
        sourceDocumentNumber: request.context.sourceDocumentNumber,
        referenceId: request.context.referenceId,
        partyName: request.context.partyName,
        triggeringEvent: request.context.triggeringEvent,
        userId: request.context.userId,
        approvalReference: request.context.approvalReference,
        postingTimestamp: new Date(),
        period: matchingPeriod?.name,
        branchId: request.context.branchId,
        legalEntityId: request.context.legalEntityId,
        departmentId: request.context.departmentId,
        costCenterCode: request.context.costCenterCode,
        projectCode: request.context.projectCode,
        taxCode: request.context.taxCode,
        currencyCode: request.context.currencyCode,
        narration: request.context.narration,
        correlationId: request.context.correlationId ?? randomUUID(),
        idempotencyKey,
        ruleSnapshot: {
          ruleId: rule.id,
          module: rule.module,
          transactionType: rule.transactionType,
          transactionSubtype: rule.transactionSubtype,
          debitAccountId: rule.debitAccountId,
          creditAccountId: rule.creditAccountId,
          taxAccountId: rule.taxAccountId,
          postingDescriptionTemplate: rule.postingDescriptionTemplate,
        },
      },
    });

    this.logger.log(
      `Posted ${request.context.module}:${request.context.transactionType} for ${request.context.sourceDocumentNumber} using rule ${rule.id}`,
    );

    return client.journalEntry.findUnique({
      where: { id: journalEntry.id },
      include: { lines: true, postingAudit: true },
    });
  }

  async resolveRule(client: TxClient, request: PostingRequest): Promise<ResolvedPostingRule> {
    const postingDate = request.context.postingDate;
    const candidates = await client.postingRule.findMany({
      where: {
        module: request.context.module,
        transactionType: request.context.transactionType,
        transactionSubtype: request.context.transactionSubtype ?? null,
        status: 'ACTIVE',
        effectiveStartDate: { lte: postingDate },
        OR: [{ effectiveEndDate: null }, { effectiveEndDate: { gte: postingDate } }],
      },
      include: {
        debitAccount: true,
        creditAccount: true,
        taxAccount: true,
        roundingAccount: true,
        exchangeGainAccount: true,
        exchangeLossAccount: true,
        suspenseAccount: true,
      },
    });

    const scoped = candidates
      .filter((rule) => this.matchesOptional(rule.legalEntityId, request.context.legalEntityId))
      .filter((rule) => this.matchesOptional(rule.branchId, request.context.branchId))
      .filter((rule) => this.matchesOptional(rule.departmentId, request.context.departmentId))
      .filter((rule) => this.matchesOptional(rule.productCategoryId, request.context.productCategoryId))
      .filter((rule) => this.matchesOptional(rule.customerGroup, request.context.customerGroup))
      .filter((rule) => this.matchesOptional(rule.vendorGroup, request.context.vendorGroup))
      .filter((rule) => this.matchesOptional(rule.taxCode, request.context.taxCode))
      .filter((rule) => this.matchesOptional(rule.currencyCode, request.context.currencyCode));

    if (!scoped.length) {
      throw new BadRequestException(
        `No posting rule found for ${request.context.module}/${request.context.transactionType}. Create an explicit posting matrix entry before posting this transaction.`,
      );
    }

    const ranked = scoped
      .map((rule) => ({
        rule,
        score: [
          rule.legalEntityId,
          rule.branchId,
          rule.departmentId,
          rule.productCategoryId,
          rule.customerGroup,
          rule.vendorGroup,
          rule.taxCode,
          rule.currencyCode,
        ].filter((value) => value !== null && value !== undefined).length,
      }))
      .sort((left, right) => right.score - left.score);

    if (ranked.length > 1 && ranked[0].score === ranked[1].score) {
      throw new BadRequestException(
        `Posting matrix is ambiguous for ${request.context.module}/${request.context.transactionType}. Tighten the rule scope so exactly one rule matches.`,
      );
    }

    return ranked[0].rule;
  }

  private async validateContext(client: TxClient, request: PostingRequest, rule: ResolvedPostingRule) {
    if (!['APPROVED', 'OPEN', 'POSTED'].includes(request.context.sourceStatus)) {
      throw new BadRequestException(
        `Source document ${request.context.sourceDocumentNumber} is not approved for posting.`,
      );
    }

    if (rule.requiresBranch && !request.context.branchId) {
      throw new BadRequestException('Branch is required by the posting rule.');
    }
    if (rule.requiresTax && !request.context.taxCode && !rule.taxAccountId) {
      throw new BadRequestException('Tax mapping is required before posting this transaction.');
    }
    if (rule.requiresSubledger && !request.context.subledgerPartyId) {
      throw new BadRequestException('Subledger party is required by the posting rule.');
    }
    if (rule.requiresCostCenter && !request.context.costCenterId) {
      throw new BadRequestException('Cost center is required by the posting rule.');
    }
    if (rule.requiresProject && !request.context.projectId) {
      throw new BadRequestException('Project is required by the posting rule.');
    }

    if (request.context.branchId) {
      const branch = await client.branch.findUnique({ where: { id: request.context.branchId } });
      if (!branch) throw new BadRequestException(`Branch ${request.context.branchId} does not exist.`);
    }

    await this.validateAccount(rule.debitAccount, request.context.module, 'debit');
    await this.validateAccount(rule.creditAccount, request.context.module, 'credit');
    if (request.amounts.taxAmount && Number(request.amounts.taxAmount) > 0) {
      if (!rule.taxAccount) {
        throw new BadRequestException('Tax amount exists but no tax account is mapped in the posting rule.');
      }
      await this.validateAccount(rule.taxAccount, request.context.module, 'tax');
    }

    await this.ensureOpenPeriod(client, request);
  }

  private async validateAccount(account: { id: number; code: string; isActive: boolean; allowsPosting: boolean; isControlAccount: boolean; controlSource: string | null }, module: string, side: string) {
    if (!account.isActive) {
      throw new BadRequestException(`Account ${account.code} is inactive and cannot be used on the ${side} side.`);
    }
    if (!account.allowsPosting) {
      throw new BadRequestException(`Account ${account.code} is blocked for posting.`);
    }
    if (account.isControlAccount && account.controlSource && account.controlSource !== module) {
      throw new BadRequestException(
        `Control account ${account.code} is reserved for ${account.controlSource} postings, not ${module}.`,
      );
    }
  }

  private buildLines(request: PostingRequest, rule: ResolvedPostingRule): GeneratedJournalLine[] {
    const { baseAmount, taxAmount = 0, totalAmount, exchangeDifferenceAmount = 0, roundingAmount = 0, principalAmount = 0, interestAmount = 0, feeAmount = 0 } = request.amounts;
    const branchId = request.context.branchId;
    const lines: GeneratedJournalLine[] = [];

    switch (request.pattern) {
      case 'SALES_INVOICE':
        lines.push(
          { accountId: rule.debitAccountId, debit: new Prisma.Decimal(totalAmount), credit: new Prisma.Decimal(0), branchId, memo: 'Receivable control posting' },
          { accountId: rule.creditAccountId, debit: new Prisma.Decimal(0), credit: new Prisma.Decimal(baseAmount), branchId, memo: 'Revenue posting' },
        );
        if (taxAmount > 0) {
          lines.push({ accountId: rule.taxAccountId!, debit: new Prisma.Decimal(0), credit: new Prisma.Decimal(taxAmount), branchId, memo: 'Output tax posting' });
        }
        break;
      case 'PURCHASE_BILL':
        lines.push(
          { accountId: rule.debitAccountId, debit: new Prisma.Decimal(baseAmount), credit: new Prisma.Decimal(0), branchId, memo: 'Expense or inventory posting' },
          { accountId: rule.creditAccountId, debit: new Prisma.Decimal(0), credit: new Prisma.Decimal(totalAmount), branchId, memo: 'Payables control posting' },
        );
        if (taxAmount > 0) {
          lines.push({ accountId: rule.taxAccountId!, debit: new Prisma.Decimal(taxAmount), credit: new Prisma.Decimal(0), branchId, memo: 'Input tax posting' });
        }
        break;
      case 'DEPRECIATION':
        lines.push(
          { accountId: rule.debitAccountId, debit: new Prisma.Decimal(baseAmount), credit: new Prisma.Decimal(0), branchId, memo: 'Depreciation expense' },
          { accountId: rule.creditAccountId, debit: new Prisma.Decimal(0), credit: new Prisma.Decimal(baseAmount), branchId, memo: 'Accumulated depreciation' },
        );
        break;
      case 'LOAN_REPAYMENT':
        lines.push(
          { accountId: rule.debitAccountId, debit: new Prisma.Decimal(principalAmount), credit: new Prisma.Decimal(0), branchId, memo: 'Loan principal reduction' },
          { accountId: rule.creditAccountId, debit: new Prisma.Decimal(0), credit: new Prisma.Decimal(principalAmount + interestAmount + feeAmount), branchId, memo: 'Bank or cash outflow' },
        );
        if (interestAmount > 0 && rule.taxAccountId) {
          lines.push({ accountId: rule.taxAccountId, debit: new Prisma.Decimal(interestAmount), credit: new Prisma.Decimal(0), branchId, memo: 'Interest expense' });
        }
        if (feeAmount > 0 && rule.roundingAccountId) {
          lines.push({ accountId: rule.roundingAccountId, debit: new Prisma.Decimal(feeAmount), credit: new Prisma.Decimal(0), branchId, memo: 'Fees and penalties' });
        }
        break;
      case 'LOAN_DISBURSEMENT':
        lines.push(
          { accountId: rule.debitAccountId, debit: new Prisma.Decimal(totalAmount), credit: new Prisma.Decimal(0), branchId, memo: 'Loan proceeds' },
          { accountId: rule.creditAccountId, debit: new Prisma.Decimal(0), credit: new Prisma.Decimal(totalAmount), branchId, memo: 'Loan principal recognition' },
        );
        break;
      default:
        throw new BadRequestException(`Posting pattern ${request.pattern} is not implemented.`);
    }

    if (roundingAmount !== 0) {
      if (!rule.roundingAccountId) {
        throw new BadRequestException('Rounding difference exists but no rounding account is configured.');
      }
      if (roundingAmount > 0) {
        lines.push({ accountId: rule.roundingAccountId, debit: new Prisma.Decimal(roundingAmount), credit: new Prisma.Decimal(0), branchId, memo: 'Rounding adjustment' });
      } else {
        lines.push({ accountId: rule.roundingAccountId, debit: new Prisma.Decimal(0), credit: new Prisma.Decimal(Math.abs(roundingAmount)), branchId, memo: 'Rounding adjustment' });
      }
    }

    if (exchangeDifferenceAmount !== 0) {
      if (exchangeDifferenceAmount > 0) {
        if (!rule.exchangeGainAccountId) throw new BadRequestException('Exchange gain exists but no exchange gain account is configured.');
        lines.push({ accountId: rule.exchangeGainAccountId, debit: new Prisma.Decimal(0), credit: new Prisma.Decimal(exchangeDifferenceAmount), branchId, memo: 'Exchange gain' });
      } else {
        if (!rule.exchangeLossAccountId) throw new BadRequestException('Exchange loss exists but no exchange loss account is configured.');
        lines.push({ accountId: rule.exchangeLossAccountId, debit: new Prisma.Decimal(Math.abs(exchangeDifferenceAmount)), credit: new Prisma.Decimal(0), branchId, memo: 'Exchange loss' });
      }
    }

    return this.mergeLines(lines);
  }

  private mergeLines(lines: GeneratedJournalLine[]) {
    const merged = new Map<string, GeneratedJournalLine>();
    for (const line of lines) {
      const key = `${line.accountId}:${line.branchId ?? 'na'}:${line.memo ?? ''}`;
      const current = merged.get(key);
      if (!current) {
        merged.set(key, { ...line });
        continue;
      }
      current.debit = new Prisma.Decimal(Number(current.debit) + Number(line.debit));
      current.credit = new Prisma.Decimal(Number(current.credit) + Number(line.credit));
    }
    return [...merged.values()];
  }

  private ensureBalanced(lines: GeneratedJournalLine[]) {
    const totalDebit = lines.reduce((sum, line) => sum + Number(line.debit), 0);
    const totalCredit = lines.reduce((sum, line) => sum + Number(line.credit), 0);
    if (totalDebit <= 0 || totalCredit <= 0) {
      throw new BadRequestException('Posting must generate both debit and credit totals.');
    }
    if (Math.abs(totalDebit - totalCredit) > 0.0001) {
      throw new BadRequestException('Generated journal does not balance.');
    }
  }

  private async ensureIdempotency(client: TxClient, request: PostingRequest) {
    const idempotencyKey = request.context.idempotencyKey ?? this.buildIdempotencyKey(request);
    const existing = await client.postingAudit.findUnique({ where: { idempotencyKey } });
    if (existing) {
      throw new BadRequestException(
        `Posting already exists for ${request.context.sourceDocumentNumber} (${request.context.triggeringEvent}). Reverse or repost explicitly instead of posting again.`,
      );
    }
  }

  private async ensureOpenPeriod(client: TxClient, request: PostingRequest) {
    const period = await this.findPostingPeriod(client, request);
    if (!period) {
      throw new BadRequestException(
        `No accounting period is configured for ${request.context.postingDate.toISOString().slice(0, 10)}. Create an open period before posting.`,
      );
    }
    if (period.status !== 'OPEN') {
      throw new BadRequestException(`Accounting period ${period.name} is ${period.status} and does not allow posting.`);
    }
  }

  private async findPostingPeriod(client: TxClient, request: PostingRequest) {
    return client.accountingPeriod.findFirst({
      where: {
        startDate: { lte: request.context.postingDate },
        endDate: { gte: request.context.postingDate },
        OR: [
          { companyId: request.context.legalEntityId ?? undefined },
          { companyId: null },
        ],
      },
      orderBy: [{ companyId: 'desc' }, { startDate: 'desc' }],
    });
  }

  private resolveJournalType(module: string) {
    switch (module) {
      case 'SALES':
        return 'SALES' as const;
      case 'PROCUREMENT':
        return 'PURCHASE' as const;
      default:
        return 'GENERAL' as const;
    }
  }

  private renderDescription(template: string, request: PostingRequest) {
    const values: Record<string, string> = {
      sourceDocumentNumber: request.context.sourceDocumentNumber,
      referenceId: request.context.referenceId ?? '',
      triggeringEvent: request.context.triggeringEvent,
      module: request.context.module,
      transactionType: request.context.transactionType,
      partyName: request.context.partyName ?? '',
      narration: request.context.narration ?? '',
      ...(request.context.descriptionTemplateData
        ? Object.fromEntries(
            Object.entries(request.context.descriptionTemplateData).map(([key, value]) => [key, String(value)]),
          )
        : {}),
    };

    return template.replace(/\{\{(\w+)\}\}/g, (_, key: string) => values[key] ?? '');
  }

  private buildReference(seed: string) {
    const digest = createHash('sha1').update(`${seed}-${Date.now()}`).digest('hex').slice(0, 10).toUpperCase();
    return `JR-${digest}`;
  }

  private buildIdempotencyKey(request: PostingRequest) {
    return createHash('sha1')
      .update(
        [
          request.context.module,
          request.context.transactionType,
          request.context.transactionSubtype ?? '',
          request.context.triggeringEvent,
          request.context.sourceTable,
          request.context.sourceDocumentId,
        ].join('|'),
      )
      .digest('hex');
  }

  private matchesOptional<T>(ruleValue: T | null, contextValue: T | undefined) {
    if (ruleValue === null || ruleValue === undefined) return true;
    return ruleValue === contextValue;
  }
}
