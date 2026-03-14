import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, $Enums } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import {
  ApproveJournalDto,
  AuditMetaDto,
  CancelJournalDto,
  CreateJournalDto,
  CreateRecurringJournalTemplateDto,
  GenerateRecurringJournalDto,
  JournalAttachmentDto,
  JournalLineDto,
  ListJournalsQueryDto,
  RejectJournalDto,
  ReverseJournalDto,
  UpdateJournalDto,
  ValidateJournalDto,
} from './dto';

type Actor = { userId?: number; email?: string };

type ValidationResult = {
  valid: boolean;
  errors: string[];
  totalDebit: number;
  totalCredit: number;
};

const JOURNAL_INCLUDE = {
  legalEntity: true,
  branch: true,
  department: true,
  costCenter: true,
  project: true,
  accountingPeriod: true,
  fiscalYear: true,
  lines: {
    include: {
      account: true,
      taxCode: true,
      branch: true,
      department: true,
      costCenter: true,
      project: true,
      product: true,
      warehouse: true,
    },
    orderBy: { lineNumber: 'asc' as const },
  },
  attachments: true,
  approvalHistory: { orderBy: { actedAt: 'asc' as const } },
  auditLogs: { orderBy: { createdAt: 'desc' as const } },
  statusHistory: { orderBy: { changedAt: 'asc' as const } },
  reversalOfJournal: true,
  reversalJournals: true,
  recurringTemplate: true,
  postedJournalEntry: { include: { lines: true } },
} satisfies Prisma.GLJournalHeaderInclude;

@Injectable()
export class JournalsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(query: ListJournalsQueryDto) {
    const where: Prisma.GLJournalHeaderWhereInput = {
      status: query.status,
      journalType: query.journalType,
      sourceModule: query.sourceModule,
      branchId: query.branchId,
      createdBy: query.createdBy,
      journalDate:
        query.dateFrom || query.dateTo
          ? {
              gte: query.dateFrom ? new Date(query.dateFrom) : undefined,
              lte: query.dateTo ? new Date(query.dateTo) : undefined,
            }
          : undefined,
      OR: query.search
        ? [
            { journalNumber: { contains: query.search, mode: 'insensitive' } },
            { narration: { contains: query.search, mode: 'insensitive' } },
            { referenceNumber: { contains: query.search, mode: 'insensitive' } },
            { sourceDocumentNumber: { contains: query.search, mode: 'insensitive' } },
          ]
        : undefined,
    };

    const journals = await this.prisma.gLJournalHeader.findMany({
      where,
      include: {
        branch: true,
        lines: true,
      },
      orderBy: [{ journalDate: 'desc' }, { id: 'desc' }],
    });

    return journals.filter((journal) => {
      const totalDebit = journal.lines.reduce((sum, line) => sum + Number(line.debitAmount), 0);
      if (query.minAmount && totalDebit < query.minAmount) return false;
      if (query.maxAmount && totalDebit > query.maxAmount) return false;
      return true;
    });
  }

  async getById(id: number) {
    const journal = await this.prisma.gLJournalHeader.findUnique({
      where: { id },
      include: JOURNAL_INCLUDE,
    });
    if (!journal) throw new NotFoundException('Journal entry not found');
    return journal;
  }

  async getMetadata(legalEntityId: number) {
    const [company, periods, fiscalYears, costCenters, projects, taxes] = await Promise.all([
      this.prisma.company.findUnique({
        where: { id: legalEntityId },
        include: { currency: true },
      }),
      this.prisma.accountingPeriod.findMany({
        where: { companyId: legalEntityId },
        orderBy: [{ startDate: 'desc' }, { id: 'desc' }],
      }),
      this.prisma.fiscalYear.findMany({
        where: { companyId: legalEntityId },
        orderBy: [{ startDate: 'desc' }, { id: 'desc' }],
      }),
      this.prisma.costCenter.findMany({
        where: { companyId: legalEntityId, isActive: true },
        orderBy: [{ code: 'asc' }],
      }),
      this.prisma.project.findMany({
        where: { companyId: legalEntityId, isActive: true },
        orderBy: [{ code: 'asc' }],
      }),
      this.prisma.taxConfig.findMany({
        where: { companyId: legalEntityId },
        orderBy: [{ code: 'asc' }],
      }),
    ]);

    if (!company) {
      throw new NotFoundException('Legal entity not found');
    }

    return {
      company: {
        id: company.id,
        name: company.name,
        currencyCode: company.currency?.code ?? 'NGN',
      },
      journalTypes: Object.values($Enums.GLJournalType),
      sourceTypes: Object.values($Enums.GLJournalSourceType),
      statuses: Object.values($Enums.GLJournalStatus),
      periods: periods.map((period) => ({
        id: period.id,
        name: period.name,
        startDate: period.startDate,
        endDate: period.endDate,
        status: period.status,
        fiscalYearId: period.fiscalYearId,
      })),
      fiscalYears: fiscalYears.map((fiscalYear) => ({
        id: fiscalYear.id,
        name: fiscalYear.name,
        startDate: fiscalYear.startDate,
        endDate: fiscalYear.endDate,
        status: fiscalYear.status,
      })),
      costCenters: costCenters.map((costCenter) => ({
        id: costCenter.id,
        code: costCenter.code,
        name: costCenter.name,
      })),
      projects: projects.map((project) => ({
        id: project.id,
        code: project.code,
        name: project.name,
      })),
      taxCodes: taxes.map((tax) => ({
        id: tax.id,
        code: tax.code,
        name: tax.name,
        rate: Number(tax.rate),
      })),
    };
  }

  async createDraft(dto: CreateJournalDto, actor: Actor, meta?: AuditMetaDto) {
    const prepared = await this.prepareJournalDraft(dto);

    return this.prisma.$transaction(async (tx) => {
      const journalNumber = await this.nextJournalNumber(tx, dto.legalEntityId);
      return tx.gLJournalHeader.create({
        data: {
          journalNumber,
          journalType: dto.journalType,
          sourceType: dto.sourceType ?? $Enums.GLJournalSourceType.MANUAL,
          sourceModule: dto.sourceModule,
          sourceDocumentId: dto.sourceDocumentId,
          sourceDocumentNumber: dto.sourceDocumentNumber,
          legalEntityId: dto.legalEntityId,
          branchId: dto.branchId,
          departmentId: dto.departmentId,
          costCenterId: dto.costCenterId,
          projectId: dto.projectId,
          journalDate: new Date(dto.journalDate),
          postingDate: new Date(dto.postingDate),
          accountingPeriodId: dto.accountingPeriodId,
          fiscalYearId: dto.fiscalYearId,
          currencyCode: dto.currencyCode,
          exchangeRate: this.decimalOrNull(dto.exchangeRate),
          referenceNumber: dto.referenceNumber,
          externalReference: dto.externalReference,
          narration: dto.narration,
          description: dto.description,
          attachmentCount: dto.attachments?.length ?? 0,
          workflowStatus: 'DRAFT',
          createdBy: actor.userId,
          updatedBy: actor.userId,
          isSystemGenerated: dto.sourceType === $Enums.GLJournalSourceType.SYSTEM,
          isAutoReversing: dto.isAutoReversing ?? false,
          autoReverseDate: dto.autoReverseDate ? new Date(dto.autoReverseDate) : undefined,
          isRecurring: dto.isRecurring ?? false,
          recurringTemplateId: dto.recurringTemplateId,
          isIntercompany: dto.isIntercompany ?? false,
          intercompanyReference: dto.intercompanyReference,
          idempotencyKey: dto.idempotencyKey,
          totalDebit: new Prisma.Decimal(prepared.totalDebit),
          totalCredit: new Prisma.Decimal(prepared.totalCredit),
          lines: { create: prepared.lines },
          attachments: dto.attachments?.length
            ? { create: dto.attachments.map((attachment) => this.mapAttachment(attachment, actor)) }
            : undefined,
          statusHistory: {
            create: {
              toStatus: $Enums.GLJournalStatus.DRAFT,
              changedBy: actor.userId,
              reason: 'Draft created',
            },
          },
          auditLogs: {
            create: {
              action: 'CREATE_DRAFT',
              actorUserId: actor.userId,
              actorName: actor.email,
              newValues: {
                header: this.headerAuditSnapshot(dto as unknown as Record<string, unknown>),
                lines: prepared.auditLines,
              },
              ipAddress: meta?.ipAddress,
              deviceInfo: meta?.deviceInfo,
            },
          },
        },
        include: JOURNAL_INCLUDE,
      });
    });
  }

  async updateDraft(id: number, dto: UpdateJournalDto, actor: Actor, meta?: AuditMetaDto) {
    const existing = await this.getById(id);
    if (existing.status !== $Enums.GLJournalStatus.DRAFT && existing.status !== $Enums.GLJournalStatus.REJECTED) {
      throw new ForbiddenException('Only draft or rejected journals can be edited');
    }
    if (existing.isSystemGenerated) {
      throw new ForbiddenException('System-generated journals are read-only');
    }
    if (existing.createdBy && existing.createdBy !== actor.userId) {
      throw new ForbiddenException('Draft can only be edited by the maker');
    }

    const merged: CreateJournalDto = {
      journalType: dto.journalType ?? existing.journalType,
      sourceType: existing.sourceType,
      sourceModule: existing.sourceModule ?? undefined,
      sourceDocumentId: existing.sourceDocumentId ?? undefined,
      sourceDocumentNumber: existing.sourceDocumentNumber ?? undefined,
      legalEntityId: dto.legalEntityId ?? existing.legalEntityId,
      branchId: dto.branchId ?? existing.branchId,
      departmentId: dto.departmentId ?? existing.departmentId ?? undefined,
      costCenterId: dto.costCenterId ?? existing.costCenterId ?? undefined,
      projectId: dto.projectId ?? existing.projectId ?? undefined,
      journalDate: dto.journalDate ?? existing.journalDate.toISOString(),
      postingDate: dto.postingDate ?? existing.postingDate.toISOString(),
      accountingPeriodId: dto.accountingPeriodId ?? existing.accountingPeriodId,
      fiscalYearId: dto.fiscalYearId ?? existing.fiscalYearId ?? undefined,
      currencyCode: dto.currencyCode ?? existing.currencyCode,
      exchangeRate: dto.exchangeRate ?? Number(existing.exchangeRate ?? 1),
      referenceNumber: dto.referenceNumber ?? existing.referenceNumber ?? undefined,
      externalReference: dto.externalReference ?? existing.externalReference ?? undefined,
      narration: dto.narration ?? existing.narration,
      description: dto.description ?? existing.description ?? undefined,
      isAutoReversing: dto.isAutoReversing ?? existing.isAutoReversing,
      autoReverseDate: dto.autoReverseDate ?? existing.autoReverseDate?.toISOString(),
      isRecurring: dto.isRecurring ?? existing.isRecurring,
      recurringTemplateId: existing.recurringTemplateId ?? undefined,
      isIntercompany: dto.isIntercompany ?? existing.isIntercompany,
      intercompanyReference: dto.intercompanyReference ?? existing.intercompanyReference ?? undefined,
      idempotencyKey: existing.idempotencyKey ?? undefined,
      attachments:
        dto.attachments ??
        existing.attachments.map((attachment) => ({
          fileName: attachment.fileName,
          fileUrl: attachment.fileUrl,
          mimeType: attachment.mimeType ?? undefined,
        })),
      lines:
        dto.lines ??
        existing.lines.map((line) => ({
          accountId: line.accountId,
          subledgerType: line.subledgerType ?? undefined,
          subledgerId: line.subledgerId ?? undefined,
          debitAmount: Number(line.debitAmount),
          creditAmount: Number(line.creditAmount),
          transactionCurrencyCode: line.transactionCurrencyCode,
          exchangeRate: line.exchangeRate ? Number(line.exchangeRate) : undefined,
          taxCodeId: line.taxCodeId ?? undefined,
          taxAmount: line.taxAmount ? Number(line.taxAmount) : undefined,
          branchId: line.branchId ?? undefined,
          departmentId: line.departmentId ?? undefined,
          costCenterId: line.costCenterId ?? undefined,
          projectId: line.projectId ?? undefined,
          productId: line.productId ?? undefined,
          itemId: line.itemId ?? undefined,
          warehouseId: line.warehouseId ?? undefined,
          quantity: line.quantity ? Number(line.quantity) : undefined,
          unitOfMeasure: line.unitOfMeasure ?? undefined,
          lineNarration: line.lineNarration ?? undefined,
          reference1: line.reference1 ?? undefined,
          reference2: line.reference2 ?? undefined,
          dueDate: line.dueDate?.toISOString(),
          partnerName: line.partnerName ?? undefined,
          partnerCode: line.partnerCode ?? undefined,
        })),
    };

    const prepared = await this.prepareJournalDraft(merged);

    return this.prisma.$transaction(async (tx) => {
      await tx.gLJournalLine.deleteMany({ where: { journalId: id } });
      await tx.gLJournalAttachment.deleteMany({ where: { journalId: id } });

      return tx.gLJournalHeader.update({
        where: { id },
        data: {
          journalType: merged.journalType,
          legalEntityId: merged.legalEntityId,
          branchId: merged.branchId,
          departmentId: merged.departmentId,
          costCenterId: merged.costCenterId,
          projectId: merged.projectId,
          journalDate: new Date(merged.journalDate),
          postingDate: new Date(merged.postingDate),
          accountingPeriodId: merged.accountingPeriodId,
          fiscalYearId: merged.fiscalYearId,
          currencyCode: merged.currencyCode,
          exchangeRate: this.decimalOrNull(merged.exchangeRate),
          referenceNumber: merged.referenceNumber,
          externalReference: merged.externalReference,
          narration: merged.narration,
          description: merged.description,
          attachmentCount: merged.attachments?.length ?? 0,
          updatedBy: actor.userId,
          isAutoReversing: merged.isAutoReversing,
          autoReverseDate: merged.autoReverseDate ? new Date(merged.autoReverseDate) : null,
          isRecurring: merged.isRecurring,
          isIntercompany: merged.isIntercompany,
          intercompanyReference: merged.intercompanyReference,
          totalDebit: new Prisma.Decimal(prepared.totalDebit),
          totalCredit: new Prisma.Decimal(prepared.totalCredit),
          lines: { create: prepared.lines },
          attachments: merged.attachments?.length
            ? { create: merged.attachments.map((attachment) => this.mapAttachment(attachment, actor)) }
            : undefined,
          auditLogs: {
            create: {
              action: 'UPDATE_DRAFT',
              actorUserId: actor.userId,
              actorName: actor.email,
              oldValues: {
                header: this.headerAuditSnapshot(existing as unknown as Record<string, unknown>),
                lines: existing.lines.map((line) => this.auditLineSnapshot(line as unknown as Record<string, unknown>)),
              },
              newValues: {
                header: this.headerAuditSnapshot(merged as unknown as Record<string, unknown>),
                lines: prepared.auditLines,
              },
              ipAddress: meta?.ipAddress,
              deviceInfo: meta?.deviceInfo,
            },
          },
        },
        include: JOURNAL_INCLUDE,
      });
    });
  }

  async validate(id: number, dto: ValidateJournalDto = {}) {
    const journal = await this.getById(id);
    return this.validateJournalState(journal, dto.strict ?? true);
  }

  async submit(id: number, actor: Actor, meta?: AuditMetaDto) {
    const journal = await this.getById(id);
    if (
      journal.status !== $Enums.GLJournalStatus.DRAFT &&
      journal.status !== $Enums.GLJournalStatus.REJECTED
    ) {
      throw new ForbiddenException('Only draft or rejected journals can be submitted');
    }

    const validation = await this.validateJournalState(journal, true);
    if (!validation.valid) {
      throw new BadRequestException(validation.errors.join('; '));
    }

    return this.transitionStatus(id, {
      from: journal.status,
      to: $Enums.GLJournalStatus.PENDING_APPROVAL,
      workflowStatus: 'PENDING_APPROVAL',
      headerUpdates: {
        submittedBy: actor.userId,
        submittedAt: new Date(),
        updatedBy: actor.userId,
        approvalLevel: 1,
      },
      approvalHistory: {
        action: $Enums.GLApprovalAction.SUBMITTED,
        approvalLevel: 1,
        actorUserId: actor.userId,
        actorName: actor.email,
        comments: 'Submitted for approval',
      },
      auditAction: 'SUBMIT',
      actor,
      meta,
    });
  }

  async recall(id: number, actor: Actor, meta?: AuditMetaDto) {
    const journal = await this.getById(id);
    if (journal.status !== $Enums.GLJournalStatus.PENDING_APPROVAL) {
      throw new ForbiddenException('Only pending journals can be recalled');
    }
    if (journal.submittedBy && journal.submittedBy !== actor.userId) {
      throw new ForbiddenException('Only the submitter can recall this journal');
    }

    return this.transitionStatus(id, {
      from: journal.status,
      to: $Enums.GLJournalStatus.DRAFT,
      workflowStatus: 'DRAFT',
      headerUpdates: {
        updatedBy: actor.userId,
        approvalLevel: 0,
      },
      approvalHistory: {
        action: $Enums.GLApprovalAction.RECALLED,
        actorUserId: actor.userId,
        actorName: actor.email,
        comments: 'Journal recalled to draft',
      },
      auditAction: 'RECALL',
      actor,
      meta,
    });
  }

  async approve(id: number, dto: ApproveJournalDto, actor: Actor, meta?: AuditMetaDto) {
    const journal = await this.getById(id);
    if (journal.status !== $Enums.GLJournalStatus.PENDING_APPROVAL) {
      throw new ForbiddenException('Only pending journals can be approved');
    }
    if (journal.createdBy && journal.createdBy === actor.userId) {
      throw new ForbiddenException('Maker-checker control prevents approving your own journal');
    }

    return this.transitionStatus(id, {
      from: journal.status,
      to: $Enums.GLJournalStatus.APPROVED,
      workflowStatus: 'APPROVED',
      headerUpdates: {
        approvedBy: actor.userId,
        approvedAt: new Date(),
        updatedBy: actor.userId,
      },
      approvalHistory: {
        action: $Enums.GLApprovalAction.APPROVED,
        approvalLevel: journal.approvalLevel || 1,
        actorUserId: actor.userId,
        actorName: actor.email,
        comments: dto.comments,
      },
      auditAction: 'APPROVE',
      actor,
      meta,
    });
  }

  async reject(id: number, dto: RejectJournalDto, actor: Actor, meta?: AuditMetaDto) {
    const journal = await this.getById(id);
    if (journal.status !== $Enums.GLJournalStatus.PENDING_APPROVAL) {
      throw new ForbiddenException('Only pending journals can be rejected');
    }

    return this.transitionStatus(id, {
      from: journal.status,
      to: $Enums.GLJournalStatus.REJECTED,
      workflowStatus: 'REJECTED',
      headerUpdates: {
        updatedBy: actor.userId,
      },
      approvalHistory: {
        action: $Enums.GLApprovalAction.REJECTED,
        approvalLevel: journal.approvalLevel || 1,
        actorUserId: actor.userId,
        actorName: actor.email,
        comments: dto.comments,
        rejectionReason: dto.reason,
      },
      statusReason: dto.reason,
      auditAction: 'REJECT',
      actor,
      meta,
    });
  }

  async cancel(id: number, dto: CancelJournalDto, actor: Actor, meta?: AuditMetaDto) {
    const journal = await this.getById(id);
    if (
      journal.status === $Enums.GLJournalStatus.POSTED ||
      journal.status === $Enums.GLJournalStatus.REVERSED
    ) {
      throw new ForbiddenException('Posted or reversed journals cannot be cancelled');
    }
    return this.transitionStatus(id, {
      from: journal.status,
      to: $Enums.GLJournalStatus.CANCELLED,
      workflowStatus: 'CANCELLED',
      headerUpdates: { updatedBy: actor.userId },
      approvalHistory: {
        action: $Enums.GLApprovalAction.CANCELLED,
        actorUserId: actor.userId,
        actorName: actor.email,
        comments: dto.reason,
      },
      statusReason: dto.reason,
      auditAction: 'CANCEL',
      actor,
      meta,
    });
  }

  async post(id: number, actor: Actor, meta?: AuditMetaDto) {
    const journal = await this.getById(id);
    if (journal.status !== $Enums.GLJournalStatus.APPROVED) {
      throw new ForbiddenException('Only approved journals can be posted');
    }
    if (journal.postedJournalEntryId) {
      throw new BadRequestException('This journal has already been posted');
    }

    const validation = await this.validateJournalState(journal, true);
    if (!validation.valid) {
      throw new BadRequestException(validation.errors.join('; '));
    }

    return this.prisma.$transaction(async (tx) => {
      const journalEntry = await tx.journalEntry.create({
        data: {
          reference: journal.journalNumber,
          description: journal.narration,
          date: journal.postingDate,
          type: this.mapLegacyJournalType(journal.sourceModule),
          createdBy: actor.userId,
          lines: {
            create: journal.lines.map((line) => ({
              accountId: line.accountId,
              branchId: line.branchId ?? journal.branchId,
              debit: line.debitAmount,
              credit: line.creditAmount,
              memo: line.lineNarration ?? journal.narration,
            })),
          },
        },
      });

      return tx.gLJournalHeader.update({
        where: { id },
        data: {
          status: $Enums.GLJournalStatus.POSTED,
          workflowStatus: 'POSTED',
          postedBy: actor.userId,
          postedAt: new Date(),
          updatedBy: actor.userId,
          postedJournalEntryId: journalEntry.id,
          approvalHistory: {
            create: {
              action: $Enums.GLApprovalAction.POSTED,
              actorUserId: actor.userId,
              actorName: actor.email,
              comments: 'Journal posted to the general ledger',
            },
          },
          statusHistory: {
            create: {
              fromStatus: journal.status,
              toStatus: $Enums.GLJournalStatus.POSTED,
              changedBy: actor.userId,
              reason: 'Posted',
            },
          },
          auditLogs: {
            create: {
              action: 'POST',
              actorUserId: actor.userId,
              actorName: actor.email,
              newValues: { postedJournalEntryId: journalEntry.id },
              ipAddress: meta?.ipAddress,
              deviceInfo: meta?.deviceInfo,
            },
          },
        },
        include: JOURNAL_INCLUDE,
      });
    });
  }

  async reverse(id: number, dto: ReverseJournalDto, actor: Actor, meta?: AuditMetaDto) {
    const journal = await this.getById(id);
    if (journal.status !== $Enums.GLJournalStatus.POSTED) {
      throw new ForbiddenException('Only posted journals can be reversed');
    }
    if (journal.reversalJournals.length > 0) {
      throw new BadRequestException('This journal has already been reversed');
    }

    return this.prisma.$transaction(async (tx) => {
      const reversalNumber = await this.nextJournalNumber(tx, journal.legalEntityId);
      const reversal = await tx.gLJournalHeader.create({
        data: {
          journalNumber: reversalNumber,
          journalType: $Enums.GLJournalType.REVERSAL,
          sourceType: journal.sourceType,
          sourceModule: journal.sourceModule,
          sourceDocumentId: journal.sourceDocumentId,
          sourceDocumentNumber: journal.sourceDocumentNumber,
          legalEntityId: journal.legalEntityId,
          branchId: journal.branchId,
          departmentId: journal.departmentId,
          costCenterId: journal.costCenterId,
          projectId: journal.projectId,
          journalDate: new Date(dto.reversalDate),
          postingDate: new Date(dto.reversalDate),
          accountingPeriodId: journal.accountingPeriodId,
          fiscalYearId: journal.fiscalYearId,
          currencyCode: journal.currencyCode,
          exchangeRate: journal.exchangeRate,
          referenceNumber: journal.referenceNumber,
          externalReference: journal.externalReference,
          narration: `Reversal of ${journal.journalNumber}`,
          description: dto.reason,
          status: $Enums.GLJournalStatus.POSTED,
          workflowStatus: 'POSTED',
          approvalLevel: journal.approvalLevel,
          createdBy: actor.userId,
          updatedBy: actor.userId,
          approvedBy: actor.userId,
          approvedAt: new Date(),
          postedBy: actor.userId,
          postedAt: new Date(),
          reversedBy: actor.userId,
          reversedAt: new Date(),
          reversalOfJournalId: journal.id,
          reversalReason: dto.reason,
          isSystemGenerated: true,
          totalDebit: journal.totalCredit,
          totalCredit: journal.totalDebit,
          lines: {
            create: journal.lines.map((line) => ({
              lineNumber: line.lineNumber,
              accountId: line.accountId,
              accountCode: line.accountCode,
              accountName: line.accountName,
              accountType: line.accountType,
              subledgerType: line.subledgerType,
              subledgerId: line.subledgerId,
              debitAmount: line.creditAmount,
              creditAmount: line.debitAmount,
              baseCurrencyDebit: line.baseCurrencyCredit,
              baseCurrencyCredit: line.baseCurrencyDebit,
              transactionCurrencyCode: line.transactionCurrencyCode,
              exchangeRate: line.exchangeRate,
              taxCodeId: line.taxCodeId,
              taxAmount: line.taxAmount,
              branchId: line.branchId,
              departmentId: line.departmentId,
              costCenterId: line.costCenterId,
              projectId: line.projectId,
              productId: line.productId,
              itemId: line.itemId,
              warehouseId: line.warehouseId,
              quantity: line.quantity,
              unitOfMeasure: line.unitOfMeasure,
              lineNarration: line.lineNarration,
              reference1: line.reference1,
              reference2: line.reference2,
              dueDate: line.dueDate,
              partnerName: line.partnerName,
              partnerCode: line.partnerCode,
            })),
          },
          approvalHistory: {
            create: {
              action: $Enums.GLApprovalAction.REVERSED,
              actorUserId: actor.userId,
              actorName: actor.email,
              comments: dto.reason,
            },
          },
          statusHistory: {
            create: {
              toStatus: $Enums.GLJournalStatus.POSTED,
              changedBy: actor.userId,
              reason: 'System reversal journal created and posted',
            },
          },
          auditLogs: {
            create: {
              action: 'CREATE_REVERSAL',
              actorUserId: actor.userId,
              actorName: actor.email,
              newValues: { reversalOfJournalId: journal.id, reason: dto.reason },
              ipAddress: meta?.ipAddress,
              deviceInfo: meta?.deviceInfo,
            },
          },
        },
      });

      const postedMirror = await tx.journalEntry.create({
        data: {
          reference: reversal.journalNumber,
          description: reversal.narration,
          date: reversal.postingDate,
          type: this.mapLegacyJournalType(reversal.sourceModule),
          createdBy: actor.userId,
          lines: {
            create: journal.lines.map((line) => ({
              accountId: line.accountId,
              branchId: line.branchId ?? journal.branchId,
              debit: line.creditAmount,
              credit: line.debitAmount,
              memo: line.lineNarration ?? reversal.narration,
            })),
          },
        },
      });

      await tx.gLJournalHeader.update({
        where: { id: reversal.id },
        data: { postedJournalEntryId: postedMirror.id },
      });

      return tx.gLJournalHeader.update({
        where: { id: journal.id },
        data: {
          status: $Enums.GLJournalStatus.REVERSED,
          workflowStatus: 'REVERSED',
          reversedBy: actor.userId,
          reversedAt: new Date(),
          reversalReason: dto.reason,
          statusHistory: {
            create: {
              fromStatus: journal.status,
              toStatus: $Enums.GLJournalStatus.REVERSED,
              changedBy: actor.userId,
              reason: dto.reason,
            },
          },
          auditLogs: {
            create: {
              action: 'REVERSE',
              actorUserId: actor.userId,
              actorName: actor.email,
              newValues: { reversalJournalId: reversal.id, reason: dto.reason },
              ipAddress: meta?.ipAddress,
              deviceInfo: meta?.deviceInfo,
            },
          },
        },
        include: JOURNAL_INCLUDE,
      });
    });
  }

  async listTemplates() {
    return this.prisma.gLRecurringJournalTemplate.findMany({
      include: {
        legalEntity: true,
        branch: true,
        department: true,
        costCenter: true,
        project: true,
        lines: { orderBy: { lineNumber: 'asc' } },
      },
      orderBy: { templateName: 'asc' },
    });
  }

  async createTemplate(dto: CreateRecurringJournalTemplateDto, actor: Actor) {
    const preparedLines = await this.prepareTemplateLines(dto.lines, dto.currencyCode);
    return this.prisma.gLRecurringJournalTemplate.create({
      data: {
        templateName: dto.templateName,
        journalType: dto.journalType,
        frequency: dto.frequency,
        legalEntityId: dto.legalEntityId,
        branchId: dto.branchId,
        departmentId: dto.departmentId,
        costCenterId: dto.costCenterId,
        projectId: dto.projectId,
        currencyCode: dto.currencyCode,
        startDate: new Date(dto.startDate),
        endDate: dto.endDate ? new Date(dto.endDate) : undefined,
        narrationTemplate: dto.narrationTemplate,
        description: dto.description,
        nextRunDate: dto.nextRunDate ? new Date(dto.nextRunDate) : undefined,
        isActive: dto.isActive ?? true,
        createdBy: actor.userId,
        lines: { create: preparedLines },
      },
      include: { lines: true },
    });
  }

  async generateFromTemplate(templateId: number, dto: GenerateRecurringJournalDto, actor: Actor, meta?: AuditMetaDto) {
    const template = await this.prisma.gLRecurringJournalTemplate.findUnique({
      where: { id: templateId },
      include: { lines: true },
    });
    if (!template) throw new NotFoundException('Recurring journal template not found');
    if (!template.isActive) throw new BadRequestException('Recurring journal template is inactive');

    const draftDto: CreateJournalDto = {
      journalType: template.journalType,
      sourceType: $Enums.GLJournalSourceType.MANUAL,
      sourceModule: 'recurring_journal',
      sourceDocumentId: String(template.id),
      sourceDocumentNumber: template.templateName,
      legalEntityId: template.legalEntityId,
      branchId: template.branchId,
      departmentId: template.departmentId ?? undefined,
      costCenterId: template.costCenterId ?? undefined,
      projectId: template.projectId ?? undefined,
      journalDate: dto.journalDate,
      postingDate: dto.postingDate,
      accountingPeriodId: dto.accountingPeriodId,
      fiscalYearId: dto.fiscalYearId,
      currencyCode: template.currencyCode,
      referenceNumber: dto.referenceNumber ?? undefined,
      narration: template.narrationTemplate,
      description: template.description ?? undefined,
      isRecurring: true,
      recurringTemplateId: template.id,
      lines: template.lines.map((line) => ({
        accountId: line.accountId,
        subledgerType: line.subledgerType ?? undefined,
        subledgerId: line.subledgerId ?? undefined,
        debitAmount: Number(line.debitAmount),
        creditAmount: Number(line.creditAmount),
        transactionCurrencyCode: line.transactionCurrencyCode,
        taxCodeId: line.taxCodeId ?? undefined,
        branchId: line.branchId ?? undefined,
        departmentId: line.departmentId ?? undefined,
        costCenterId: line.costCenterId ?? undefined,
        projectId: line.projectId ?? undefined,
        productId: line.productId ?? undefined,
        warehouseId: line.warehouseId ?? undefined,
        quantity: line.quantity ? Number(line.quantity) : undefined,
        unitOfMeasure: line.unitOfMeasure ?? undefined,
        lineNarration: line.lineNarration ?? undefined,
        dueDate: line.dueDate?.toISOString(),
        partnerName: line.partnerName ?? undefined,
        partnerCode: line.partnerCode ?? undefined,
      })),
    };

    const created = await this.createDraft(draftDto, actor, meta);
    return this.prisma.gLJournalHeader.update({
      where: { id: created.id },
      data: {
        recurringTemplateId: template.id,
      },
      include: JOURNAL_INCLUDE,
    });
  }

  private async prepareJournalDraft(dto: CreateJournalDto) {
    this.ensureHeaderBasics(dto);

    const accounts = await this.prisma.account.findMany({
      where: { id: { in: dto.lines.map((line) => line.accountId) } },
      orderBy: { id: 'asc' },
    });
    const accountMap = new Map(accounts.map((account) => [account.id, account]));

    const lines = dto.lines.map((line, index) => {
      const account = accountMap.get(line.accountId);
      if (!account) {
        throw new BadRequestException(`Account ${line.accountId} does not exist`);
      }
      if (!account.isActive) {
        throw new BadRequestException(`Account ${account.code} is inactive`);
      }

      const debit = Number(line.debitAmount ?? 0);
      const credit = Number(line.creditAmount ?? 0);
      if (debit < 0 || credit < 0) {
        throw new BadRequestException('Debit or credit cannot be negative');
      }
      if (debit > 0 && credit > 0) {
        throw new BadRequestException(`Line ${index + 1}: one line cannot have both debit and credit`);
      }
      if (debit === 0 && credit === 0) {
        throw new BadRequestException(`Line ${index + 1}: enter either debit or credit`);
      }
      if (account.requiresSubledger && !line.subledgerId) {
        throw new BadRequestException(`Subledger is required for account ${account.code}`);
      }

      return {
        lineNumber: index + 1,
        accountId: account.id,
        accountCode: account.code,
        accountName: account.name,
        accountType: account.type,
        subledgerType: line.subledgerType,
        subledgerId: line.subledgerId,
        debitAmount: new Prisma.Decimal(debit),
        creditAmount: new Prisma.Decimal(credit),
        baseCurrencyDebit: this.decimalOrNull(debit),
        baseCurrencyCredit: this.decimalOrNull(credit),
        transactionCurrencyCode: line.transactionCurrencyCode ?? dto.currencyCode,
        exchangeRate: this.decimalOrNull(line.exchangeRate ?? dto.exchangeRate),
        taxCodeId: line.taxCodeId,
        taxAmount: this.decimalOrNull(line.taxAmount),
        branchId: line.branchId ?? dto.branchId,
        departmentId: line.departmentId ?? dto.departmentId,
        costCenterId: line.costCenterId ?? dto.costCenterId,
        projectId: line.projectId ?? dto.projectId,
        productId: line.productId,
        itemId: line.itemId,
        warehouseId: line.warehouseId,
        quantity: this.decimalOrNull(line.quantity),
        unitOfMeasure: line.unitOfMeasure,
        lineNarration: line.lineNarration,
        reference1: line.reference1,
        reference2: line.reference2,
        dueDate: line.dueDate ? new Date(line.dueDate) : undefined,
        partnerName: line.partnerName,
        partnerCode: line.partnerCode,
      };
    });

    return {
      lines,
      totalDebit: dto.lines.reduce((sum, line) => sum + Number(line.debitAmount ?? 0), 0),
      totalCredit: dto.lines.reduce((sum, line) => sum + Number(line.creditAmount ?? 0), 0),
      auditLines: lines.map((line) => this.auditLineSnapshot(line as unknown as Record<string, unknown>)),
    };
  }

  private async prepareTemplateLines(lines: JournalLineDto[], currencyCode: string) {
    const accounts = await this.prisma.account.findMany({
      where: { id: { in: lines.map((line) => line.accountId) } },
    });
    const accountMap = new Map(accounts.map((account) => [account.id, account]));

    return lines.map((line, index) => {
      const account = accountMap.get(line.accountId);
      if (!account) {
        throw new BadRequestException(`Account ${line.accountId} does not exist`);
      }
      return {
        lineNumber: index + 1,
        accountId: account.id,
        accountCode: account.code,
        accountName: account.name,
        accountType: account.type,
        subledgerType: line.subledgerType,
        subledgerId: line.subledgerId,
        debitAmount: new Prisma.Decimal(Number(line.debitAmount ?? 0)),
        creditAmount: new Prisma.Decimal(Number(line.creditAmount ?? 0)),
        transactionCurrencyCode: line.transactionCurrencyCode ?? currencyCode,
        taxCodeId: line.taxCodeId,
        branchId: line.branchId,
        departmentId: line.departmentId,
        costCenterId: line.costCenterId,
        projectId: line.projectId,
        productId: line.productId,
        warehouseId: line.warehouseId,
        quantity: this.decimalOrNull(line.quantity),
        unitOfMeasure: line.unitOfMeasure,
        lineNarration: line.lineNarration,
        dueDate: line.dueDate ? new Date(line.dueDate) : undefined,
        partnerName: line.partnerName,
        partnerCode: line.partnerCode,
      };
    });
  }

  private async validateJournalState(
    journal: Awaited<ReturnType<JournalsService['getById']>>,
    strict: boolean,
  ): Promise<ValidationResult> {
    const errors: string[] = [];
    const totalDebit = journal.lines.reduce((sum, line) => sum + Number(line.debitAmount), 0);
    const totalCredit = journal.lines.reduce((sum, line) => sum + Number(line.creditAmount), 0);

    if (journal.lines.length < 2) {
      errors.push('At least two journal lines are required');
    }
    if (Math.abs(totalDebit - totalCredit) > 0.0001) {
      errors.push('Journal is not balanced');
    }

    const period = journal.accountingPeriod;
    if (period.status !== 'OPEN') {
      errors.push('Posting period is closed');
    }
    if (journal.postingDate < period.startDate || journal.postingDate > period.endDate) {
      errors.push('Posting date falls outside the selected accounting period');
    }

    const company = await this.prisma.company.findUnique({
      where: { id: journal.legalEntityId },
      include: { currency: true },
    });
    if (!company) errors.push('Legal entity is invalid');
    const baseCurrency = company?.currency?.code;
    if (baseCurrency && journal.currencyCode !== baseCurrency && !journal.exchangeRate) {
      errors.push('Exchange rate is missing');
    }

    for (const line of journal.lines) {
      if (Number(line.debitAmount) < 0 || Number(line.creditAmount) < 0) {
        errors.push(`Line ${line.lineNumber}: negative amounts are not allowed`);
      }
      if (Number(line.debitAmount) > 0 && Number(line.creditAmount) > 0) {
        errors.push(`Line ${line.lineNumber}: debit and credit cannot both be greater than zero`);
      }
      if (strict && !line.account.isActive) {
        errors.push(`Account ${line.accountCode} is inactive`);
      }
      if (strict && !line.account.allowsPosting) {
        errors.push(`Account ${line.accountCode} does not allow posting`);
      }
      if (strict && journal.sourceType === $Enums.GLJournalSourceType.MANUAL && !line.account.allowsManualPosting) {
        errors.push(`Account ${line.accountCode} does not allow manual posting`);
      }
      if ((line.account.requiresSubledger || line.account.isControlAccount) && !line.subledgerId) {
        errors.push(`Subledger is required for account ${line.accountCode}`);
      }
      if (line.account.requiresDepartment && !line.departmentId && !journal.departmentId) {
        errors.push(`Department is required for account ${line.accountCode}`);
      }
      if (line.account.requiresCostCenter && !line.costCenterId && !journal.costCenterId) {
        errors.push(`Cost center is required for account ${line.accountCode}`);
      }
      if (line.account.requiresProject && !line.projectId && !journal.projectId) {
        errors.push(`Project is required for account ${line.accountCode}`);
      }
      if (line.account.requiresTax && !line.taxCodeId) {
        errors.push(`Tax code is required for account ${line.accountCode}`);
      }
    }

    return {
      valid: errors.length === 0,
      errors,
      totalDebit,
      totalCredit,
    };
  }

  private ensureHeaderBasics(dto: CreateJournalDto) {
    if (!dto.legalEntityId) throw new BadRequestException('Legal entity is required');
    if (!dto.branchId) throw new BadRequestException('Branch is required');
    if (!dto.accountingPeriodId) throw new BadRequestException('Accounting period is required');
    if (!dto.currencyCode) throw new BadRequestException('Currency is required');
    if (!dto.narration) throw new BadRequestException('Narration is required');
    if (!dto.lines?.length) throw new BadRequestException('At least one journal line is required');
  }

  private async nextJournalNumber(tx: Prisma.TransactionClient, companyId: number) {
    const sequenceName = 'GL Journal';
    const existing = await tx.numberingSequence.findFirst({ where: { companyId, name: sequenceName } });
    if (!existing) {
      await tx.numberingSequence.create({
        data: {
          companyId,
          name: sequenceName,
          prefix: 'GLJ',
          nextNumber: 2,
        },
      });
      return 'GLJ-000001';
    }

    const updated = await tx.numberingSequence.update({
      where: { id: existing.id },
      data: { nextNumber: { increment: 1 } },
    });
    return `${updated.prefix ?? 'GLJ'}-${String(updated.nextNumber - 1).padStart(6, '0')}`;
  }

  private async transitionStatus(
    id: number,
    input: {
      from: $Enums.GLJournalStatus;
      to: $Enums.GLJournalStatus;
      workflowStatus: string;
      headerUpdates?: Prisma.GLJournalHeaderUpdateInput;
      approvalHistory?: Prisma.GLJournalApprovalHistoryUncheckedCreateWithoutJournalInput;
      statusReason?: string;
      auditAction: string;
      actor: Actor;
      meta?: AuditMetaDto;
    },
  ) {
    return this.prisma.gLJournalHeader.update({
      where: { id },
      data: {
        status: input.to,
        workflowStatus: input.workflowStatus,
        ...(input.headerUpdates ?? {}),
        approvalHistory: input.approvalHistory ? { create: input.approvalHistory } : undefined,
        statusHistory: {
          create: {
            fromStatus: input.from,
            toStatus: input.to,
            changedBy: input.actor.userId,
            reason: input.statusReason ?? input.workflowStatus,
          },
        },
        auditLogs: {
          create: {
            action: input.auditAction,
            actorUserId: input.actor.userId,
            actorName: input.actor.email,
            newValues: { status: input.to },
            ipAddress: input.meta?.ipAddress,
            deviceInfo: input.meta?.deviceInfo,
          },
        },
      },
      include: JOURNAL_INCLUDE,
    });
  }

  private mapLegacyJournalType(sourceModule?: string | null) {
    if (sourceModule === 'sales') return $Enums.JournalType.SALES;
    if (sourceModule === 'procurement' || sourceModule === 'purchases') return $Enums.JournalType.PURCHASE;
    if (sourceModule === 'bank') return $Enums.JournalType.BANK;
    if (sourceModule === 'cash') return $Enums.JournalType.CASH;
    return $Enums.JournalType.GENERAL;
  }

  private decimalOrNull(value?: number | string | Prisma.Decimal | null) {
    if (value === undefined || value === null || value === '') return undefined;
    return new Prisma.Decimal(value);
  }

  private mapAttachment(attachment: JournalAttachmentDto, actor: Actor) {
    return {
      fileName: attachment.fileName,
      fileUrl: attachment.fileUrl,
      mimeType: attachment.mimeType,
      uploadedBy: actor.userId,
    };
  }

  private headerAuditSnapshot(source: Record<string, any>): Prisma.InputJsonObject {
    return {
      journalType: source.journalType,
      legalEntityId: source.legalEntityId,
      branchId: source.branchId,
      departmentId: source.departmentId,
      costCenterId: source.costCenterId,
      projectId: source.projectId,
      journalDate: source.journalDate,
      postingDate: source.postingDate,
      accountingPeriodId: source.accountingPeriodId,
      fiscalYearId: source.fiscalYearId,
      currencyCode: source.currencyCode,
      referenceNumber: source.referenceNumber,
      externalReference: source.externalReference,
      narration: source.narration,
      description: source.description,
      isAutoReversing: source.isAutoReversing,
      autoReverseDate: source.autoReverseDate,
      isRecurring: source.isRecurring,
      isIntercompany: source.isIntercompany,
      intercompanyReference: source.intercompanyReference,
    };
  }

  private auditLineSnapshot(line: Record<string, any>): Prisma.InputJsonObject {
    return {
      lineNumber: line.lineNumber,
      accountId: line.accountId,
      accountCode: line.accountCode,
      debitAmount: line.debitAmount,
      creditAmount: line.creditAmount,
      branchId: line.branchId,
      departmentId: line.departmentId,
      costCenterId: line.costCenterId,
      projectId: line.projectId,
      taxCodeId: line.taxCodeId,
      lineNarration: line.lineNarration,
    };
  }
}

