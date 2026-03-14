import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, $Enums } from '@prisma/client';
import { normalizeRoleName } from '../../config/roles';
import { PrismaService } from '../../prisma/prisma.service';
import {
  ApprovePaymentVoucherDto,
  CancelPaymentVoucherDto,
  CreatePaymentTemplateDto,
  CreatePaymentVoucherDto,
  InitiatePaymentDto,
  ListPaymentVouchersQueryDto,
  MarkVoucherPaidDto,
  PaymentVoucherAttachmentDto,
  PaymentVoucherAuditMetaDto,
  RecallPaymentVoucherDto,
  RejectPaymentVoucherDto,
  ReturnPaymentVoucherDto,
  UpdatePaymentVoucherDto,
  ValidatePaymentVoucherDto,
  VoucherCommentDto,
} from './dto';
import { GatewayPayload, PaymentGatewayService } from './payment-gateway.service';

type Actor = {
  userId?: number;
  email?: string;
  role?: string;
  roles?: string[];
};

type ApprovalStep = {
  level: number;
  label: string;
  role: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  actorUserId?: number;
  actorName?: string;
  actedAt?: string;
  comments?: string;
  rejectionReason?: string;
};

type ValidationResult = {
  valid: boolean;
  errors: string[];
  warnings: string[];
  totals: {
    gross: number;
    tax: number;
    withholding: number;
    total: number;
    net: number;
  };
};

type PreparedVoucher = {
  totalAmount: number;
  taxAmount: number;
  withholdingTaxAmount: number;
  netPaymentAmount: number;
  lines: Prisma.APPaymentVoucherLineCreateWithoutPaymentVoucherInput[];
  auditLines: Record<string, unknown>[];
  attachmentCount: number;
  template: {
    id?: number;
    requiresAttachment: boolean;
    allowRecall: boolean;
    postAfterFinalApproval: boolean;
    allowPaymentExecution: boolean;
    enableGateway: boolean;
    templateKind: $Enums.PaymentTemplateKind;
    defaultAccountId?: number | null;
  };
  approvalChain: ApprovalStep[];
  payableAccountId?: number | null;
};

const PAYMENT_VOUCHER_INCLUDE = {
  legalEntity: true,
  branch: true,
  department: true,
  costCenter: true,
  project: true,
  supplier: true,
  payableAccount: true,
  bankAccount: { include: { currency: true, glAccount: true } },
  cashAccount: true,
  accountingPeriod: true,
  fiscalYear: true,
  glJournal: { include: { lines: true } },
  template: true,
  lines: {
    include: {
      account: true,
      taxCode: true,
      withholdingTaxCode: true,
      branch: true,
      department: true,
      costCenter: true,
      project: true,
    },
    orderBy: { lineNumber: 'asc' as const },
  },
  attachments: { orderBy: { uploadedAt: 'asc' as const } },
  comments: { orderBy: { createdAt: 'asc' as const } },
  approvalHistory: { orderBy: { actedAt: 'asc' as const } },
  auditLogs: { orderBy: { createdAt: 'desc' as const } },
  statusHistory: { orderBy: { changedAt: 'asc' as const } },
  paymentEvents: { orderBy: { createdAt: 'asc' as const } },
  gatewayLogs: { orderBy: { createdAt: 'asc' as const } },
} satisfies Prisma.APPaymentVoucherHeaderInclude;

@Injectable()
export class PaymentVouchersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly gatewayService: PaymentGatewayService,
  ) {}

  async list(query: ListPaymentVouchersQueryDto) {
    const where: Prisma.APPaymentVoucherHeaderWhereInput = {
      status: query.status,
      paymentStatus: query.paymentStatus,
      voucherType: query.voucherType,
      branchId: query.branchId,
      createdBy: query.createdBy,
      currentApproverId: query.currentApproverId,
      voucherDate:
        query.dateFrom || query.dateTo
          ? {
              gte: query.dateFrom ? new Date(query.dateFrom) : undefined,
              lte: query.dateTo ? new Date(query.dateTo) : undefined,
            }
          : undefined,
      OR: query.search
        ? [
            { voucherNumber: { contains: query.search, mode: 'insensitive' } },
            { beneficiaryName: { contains: query.search, mode: 'insensitive' } },
            { narration: { contains: query.search, mode: 'insensitive' } },
            { referenceNumber: { contains: query.search, mode: 'insensitive' } },
            { sourceDocumentNumber: { contains: query.search, mode: 'insensitive' } },
          ]
        : undefined,
    };

    const vouchers = await this.prisma.aPPaymentVoucherHeader.findMany({
      where,
      include: {
        branch: true,
        template: true,
        lines: true,
      },
      orderBy: [{ voucherDate: 'desc' }, { id: 'desc' }],
    });

    return vouchers.filter((voucher) => {
      const amount = Number(voucher.totalAmount);
      if (query.minAmount && amount < query.minAmount) return false;
      if (query.maxAmount && amount > query.maxAmount) return false;
      return true;
    });
  }

  async queue(actor: Actor) {
    const actorRole = this.resolveActorRole(actor);
    const rows = await this.prisma.aPPaymentVoucherHeader.findMany({
      where: {
        status: {
          in: [
            $Enums.PaymentVoucherStatus.PENDING_APPROVAL,
            $Enums.PaymentVoucherStatus.PARTIALLY_APPROVED,
          ],
        },
      },
      include: {
        branch: true,
        template: true,
        lines: true,
      },
      orderBy: [{ requestedPaymentDate: 'asc' }, { id: 'desc' }],
    });

    return rows.filter((voucher) => {
      const chain = this.parseApprovalChain(voucher.approvalChain);
      const step = this.nextPendingStep(chain);
      if (!step) return false;
      if (voucher.createdBy && voucher.createdBy === actor.userId) return false;
      return actor.userId === voucher.currentApproverId || step.role === actorRole;
    });
  }

  async getById(id: number) {
    const voucher = await this.prisma.aPPaymentVoucherHeader.findUnique({
      where: { id },
      include: PAYMENT_VOUCHER_INCLUDE,
    });
    if (!voucher) throw new NotFoundException('Payment voucher not found');
    return {
      ...voucher,
      amountInWords: this.amountInWords(Number(voucher.netPaymentAmount), voucher.currencyCode),
    };
  }

  async getMetadata(legalEntityId: number) {
    const [company, periods, fiscalYears, costCenters, projects, taxes, bankAccounts, templates, accounts, suppliers] =
      await Promise.all([
        this.prisma.company.findUnique({
          where: { id: legalEntityId },
          include: { currency: true, branches: true },
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
          include: { inputAccount: true, liabilityAccount: true, outputAccount: true },
          orderBy: [{ code: 'asc' }],
        }),
        this.prisma.bankAccount.findMany({
          where: {
            OR: [{ companyId: legalEntityId }, { companyId: null }],
            isActive: true,
          },
          include: { currency: true, glAccount: true, branch: true },
          orderBy: [{ name: 'asc' }],
        }),
        this.prisma.aPPaymentTemplate.findMany({
          where: { OR: [{ legalEntityId }, { legalEntityId: null }], isActive: true },
          orderBy: [{ name: 'asc' }],
        }),
        this.prisma.account.findMany({
          where: { isActive: true },
          orderBy: [{ code: 'asc' }],
        }),
        this.prisma.supplier.findMany({ where: { companyId: legalEntityId }, orderBy: [{ name: 'asc' }] }),
      ]);

    if (!company) throw new NotFoundException('Legal entity not found');

    return {
      company: {
        id: company.id,
        name: company.name,
        currencyCode: company.currency?.code ?? 'NGN',
      },
      voucherTypes: Object.values($Enums.PaymentVoucherType),
      paymentMethods: Object.values($Enums.PaymentMethod),
      statuses: Object.values($Enums.PaymentVoucherStatus),
      paymentStatuses: Object.values($Enums.PaymentExecutionStatus),
      workflowStatuses: Object.values($Enums.PaymentWorkflowStatus),
      beneficiaryTypes: Object.values($Enums.PaymentBeneficiaryType),
      periods,
      fiscalYears,
      branches: company.branches,
      costCenters,
      projects,
      taxCodes: taxes.map((tax) => ({
        id: tax.id,
        code: tax.code,
        name: tax.name,
        rate: Number(tax.rate),
        inputAccountId: tax.inputAccountId,
        liabilityAccountId: tax.liabilityAccountId,
      })),
      bankAccounts: bankAccounts.map((account) => ({
        id: account.id,
        name: account.name,
        accountName: account.accountName,
        number: account.number,
        bankName: account.bankName,
        currencyCode: account.currency?.code,
        branchId: account.branchId,
        glAccountId: account.glAccountId,
      })),
      templates,
      accounts: accounts.map((account) => ({
        id: account.id,
        code: account.code,
        name: account.name,
        type: account.type,
        requiresSubledger: account.requiresSubledger,
        requiresDepartment: account.requiresDepartment,
        requiresCostCenter: account.requiresCostCenter,
        requiresProject: account.requiresProject,
        requiresTax: account.requiresTax,
      })),
      suppliers,
    };
  }

  async createDraft(dto: CreatePaymentVoucherDto, actor: Actor, meta?: PaymentVoucherAuditMetaDto) {
    const prepared = await this.prepareVoucher(dto, false);

    return this.prisma.$transaction(async (tx) => {
      const voucherNumber = await this.nextVoucherNumber(tx, dto.legalEntityId);
      return tx.aPPaymentVoucherHeader.create({
        data: {
          voucherNumber,
          voucherType: dto.voucherType,
          sourceType: dto.sourceType ?? $Enums.PaymentVoucherSourceType.MANUAL,
          sourceModule: dto.sourceModule,
          sourceDocumentId: dto.sourceDocumentId,
          sourceDocumentNumber: dto.sourceDocumentNumber,
          legalEntityId: dto.legalEntityId,
          branchId: dto.branchId,
          departmentId: dto.departmentId,
          costCenterId: dto.costCenterId,
          projectId: dto.projectId,
          beneficiaryType: dto.beneficiaryType,
          beneficiaryId: dto.beneficiaryId,
          beneficiaryName: dto.beneficiaryName,
          beneficiaryCode: dto.beneficiaryCode,
          supplierId: dto.supplierId,
          payableAccountId: prepared.payableAccountId ?? dto.payableAccountId,
          bankAccountId: dto.bankAccountId,
          cashAccountId: dto.cashAccountId,
          paymentMethod: dto.paymentMethod,
          paymentChannel: dto.paymentChannel,
          currencyCode: dto.currencyCode,
          exchangeRate: this.decimalOrNull(dto.exchangeRate),
          voucherDate: new Date(dto.voucherDate),
          requestedPaymentDate: new Date(dto.requestedPaymentDate),
          postingDate: new Date(dto.postingDate),
          accountingPeriodId: dto.accountingPeriodId,
          fiscalYearId: dto.fiscalYearId,
          referenceNumber: dto.referenceNumber,
          externalReference: dto.externalReference,
          invoiceReference: dto.invoiceReference,
          narration: dto.narration,
          purposeOfPayment: dto.purposeOfPayment,
          totalAmount: new Prisma.Decimal(prepared.totalAmount),
          taxAmount: this.decimalOrNull(prepared.taxAmount),
          withholdingTaxAmount: this.decimalOrNull(prepared.withholdingTaxAmount),
          netPaymentAmount: new Prisma.Decimal(prepared.netPaymentAmount),
          requiresAttachment: prepared.template.requiresAttachment || Boolean(dto.requiresAttachment),
          attachmentCount: prepared.attachmentCount,
          commentsCount: 0,
          createdBy: actor.userId,
          updatedBy: actor.userId,
          templateId: prepared.template.id ?? dto.templateId,
          idempotencyKey: dto.idempotencyKey,
          approvalChain: prepared.approvalChain as unknown as Prisma.InputJsonValue,
          lines: { create: prepared.lines },
          attachments: dto.attachments?.length
            ? { create: dto.attachments.map((attachment) => this.mapAttachment(attachment, actor)) }
            : undefined,
          statusHistory: {
            create: {
              toStatus: $Enums.PaymentVoucherStatus.DRAFT,
              toWorkflowStatus: $Enums.PaymentWorkflowStatus.AWAITING_SUBMISSION,
              toPaymentStatus: $Enums.PaymentExecutionStatus.NOT_PAID,
              changedBy: actor.userId,
              reason: 'Draft created',
            },
          },
          auditLogs: {
            create: {
              action: 'CREATE_DRAFT',
              actorUserId: actor.userId,
              actorName: actor.email,
              newValues:
                ({
                  header: this.headerAuditSnapshot(dto as unknown as Record<string, unknown>),
                  lines: prepared.auditLines,
                } as unknown as Prisma.InputJsonValue),
              ipAddress: meta?.ipAddress,
              deviceInfo: meta?.deviceInfo,
            },
          },
        },
        include: PAYMENT_VOUCHER_INCLUDE,
      });
    });
  }

  async updateDraft(id: number, dto: UpdatePaymentVoucherDto, actor: Actor, meta?: PaymentVoucherAuditMetaDto) {
    const existing = await this.getById(id);
    if (!([$Enums.PaymentVoucherStatus.DRAFT, $Enums.PaymentVoucherStatus.REJECTED] as $Enums.PaymentVoucherStatus[]).includes(existing.status)) {
      throw new ForbiddenException('Only draft or rejected vouchers can be edited');
    }
    if (existing.createdBy && existing.createdBy !== actor.userId) {
      throw new ForbiddenException('Draft can only be edited by the maker');
    }
    if (existing.isSystemGenerated) {
      throw new ForbiddenException('System-generated vouchers are read-only');
    }

    const merged: CreatePaymentVoucherDto = {
      voucherType: dto.voucherType ?? existing.voucherType,
      sourceType: existing.sourceType,
      sourceModule: existing.sourceModule ?? undefined,
      sourceDocumentId: existing.sourceDocumentId ?? undefined,
      sourceDocumentNumber: existing.sourceDocumentNumber ?? undefined,
      legalEntityId: dto.legalEntityId ?? existing.legalEntityId,
      branchId: dto.branchId ?? existing.branchId,
      departmentId: dto.departmentId ?? existing.departmentId ?? undefined,
      costCenterId: dto.costCenterId ?? existing.costCenterId ?? undefined,
      projectId: dto.projectId ?? existing.projectId ?? undefined,
      beneficiaryType: dto.beneficiaryType ?? existing.beneficiaryType,
      beneficiaryId: dto.beneficiaryId ?? existing.beneficiaryId ?? undefined,
      beneficiaryName: dto.beneficiaryName ?? existing.beneficiaryName,
      beneficiaryCode: dto.beneficiaryCode ?? existing.beneficiaryCode ?? undefined,
      supplierId: dto.supplierId ?? existing.supplierId ?? undefined,
      payableAccountId: dto.payableAccountId ?? existing.payableAccountId ?? undefined,
      bankAccountId: dto.bankAccountId ?? existing.bankAccountId ?? undefined,
      cashAccountId: dto.cashAccountId ?? existing.cashAccountId ?? undefined,
      paymentMethod: dto.paymentMethod ?? existing.paymentMethod,
      paymentChannel: dto.paymentChannel ?? existing.paymentChannel ?? undefined,
      currencyCode: dto.currencyCode ?? existing.currencyCode,
      exchangeRate: dto.exchangeRate ?? Number(existing.exchangeRate ?? 1),
      voucherDate: dto.voucherDate ?? existing.voucherDate.toISOString(),
      requestedPaymentDate: dto.requestedPaymentDate ?? existing.requestedPaymentDate.toISOString(),
      postingDate: dto.postingDate ?? existing.postingDate.toISOString(),
      accountingPeriodId: dto.accountingPeriodId ?? existing.accountingPeriodId,
      fiscalYearId: dto.fiscalYearId ?? existing.fiscalYearId ?? undefined,
      referenceNumber: dto.referenceNumber ?? existing.referenceNumber ?? undefined,
      externalReference: dto.externalReference ?? existing.externalReference ?? undefined,
      invoiceReference: dto.invoiceReference ?? existing.invoiceReference ?? undefined,
      narration: dto.narration ?? existing.narration,
      purposeOfPayment: dto.purposeOfPayment ?? existing.purposeOfPayment,
      requiresAttachment: dto.requiresAttachment ?? existing.requiresAttachment,
      templateId: dto.templateId ?? existing.templateId ?? undefined,
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
          lineType: line.lineType,
          accountId: line.accountId,
          subledgerType: line.subledgerType ?? undefined,
          subledgerId: line.subledgerId ?? undefined,
          sourceInvoiceId: line.sourceInvoiceId ?? undefined,
          sourceInvoiceNumber: line.sourceInvoiceNumber ?? undefined,
          sourceExpenseClaimId: line.sourceExpenseClaimId ?? undefined,
          description: line.description,
          grossAmount: Number(line.grossAmount),
          taxCodeId: line.taxCodeId ?? undefined,
          taxAmount: line.taxAmount ? Number(line.taxAmount) : undefined,
          withholdingTaxCodeId: line.withholdingTaxCodeId ?? undefined,
          withholdingTaxAmount: line.withholdingTaxAmount ? Number(line.withholdingTaxAmount) : undefined,
          netAmount: Number(line.netAmount),
          branchId: line.branchId ?? undefined,
          departmentId: line.departmentId ?? undefined,
          costCenterId: line.costCenterId ?? undefined,
          projectId: line.projectId ?? undefined,
          dueDate: line.dueDate?.toISOString(),
        })),
    };

    const prepared = await this.prepareVoucher(merged, false);

    return this.prisma.$transaction(async (tx) => {
      await tx.aPPaymentVoucherLine.deleteMany({ where: { paymentVoucherId: id } });
      await tx.aPPaymentVoucherAttachment.deleteMany({ where: { paymentVoucherId: id } });

      return tx.aPPaymentVoucherHeader.update({
        where: { id },
        data: {
          voucherType: merged.voucherType,
          legalEntityId: merged.legalEntityId,
          branchId: merged.branchId,
          departmentId: merged.departmentId,
          costCenterId: merged.costCenterId,
          projectId: merged.projectId,
          beneficiaryType: merged.beneficiaryType,
          beneficiaryId: merged.beneficiaryId,
          beneficiaryName: merged.beneficiaryName,
          beneficiaryCode: merged.beneficiaryCode,
          supplierId: merged.supplierId,
          payableAccountId: prepared.payableAccountId ?? merged.payableAccountId,
          bankAccountId: merged.bankAccountId,
          cashAccountId: merged.cashAccountId,
          paymentMethod: merged.paymentMethod,
          paymentChannel: merged.paymentChannel,
          currencyCode: merged.currencyCode,
          exchangeRate: this.decimalOrNull(merged.exchangeRate),
          voucherDate: new Date(merged.voucherDate),
          requestedPaymentDate: new Date(merged.requestedPaymentDate),
          postingDate: new Date(merged.postingDate),
          accountingPeriodId: merged.accountingPeriodId,
          fiscalYearId: merged.fiscalYearId,
          referenceNumber: merged.referenceNumber,
          externalReference: merged.externalReference,
          invoiceReference: merged.invoiceReference,
          narration: merged.narration,
          purposeOfPayment: merged.purposeOfPayment,
          totalAmount: new Prisma.Decimal(prepared.totalAmount),
          taxAmount: this.decimalOrNull(prepared.taxAmount),
          withholdingTaxAmount: this.decimalOrNull(prepared.withholdingTaxAmount),
          netPaymentAmount: new Prisma.Decimal(prepared.netPaymentAmount),
          requiresAttachment: prepared.template.requiresAttachment || Boolean(merged.requiresAttachment),
          attachmentCount: prepared.attachmentCount,
          updatedBy: actor.userId,
          templateId: prepared.template.id ?? merged.templateId,
          approvalChain: prepared.approvalChain as unknown as Prisma.InputJsonValue,
          lines: { create: prepared.lines },
          attachments: merged.attachments?.length
            ? { create: merged.attachments.map((attachment) => this.mapAttachment(attachment, actor)) }
            : undefined,
          auditLogs: {
            create: {
              action: 'UPDATE_DRAFT',
              actorUserId: actor.userId,
              actorName: actor.email,
              oldValues:
                ({
                  header: this.headerAuditSnapshot(existing as unknown as Record<string, unknown>),
                  lines: existing.lines.map((line) =>
                    this.auditLineSnapshot(line as unknown as Record<string, unknown>),
                  ),
                } as unknown as Prisma.InputJsonValue),
              newValues:
                ({
                  header: this.headerAuditSnapshot(merged as unknown as Record<string, unknown>),
                  lines: prepared.auditLines,
                } as unknown as Prisma.InputJsonValue),
              ipAddress: meta?.ipAddress,
              deviceInfo: meta?.deviceInfo,
            },
          },
        },
        include: PAYMENT_VOUCHER_INCLUDE,
      });
    });
  }

  async validate(id: number, dto?: ValidatePaymentVoucherDto) {
    const voucher = await this.getById(id);
    return this.validatePersistedVoucher(voucher, dto?.requireAttachments ?? false);
  }

  async submit(id: number, actor: Actor, meta?: PaymentVoucherAuditMetaDto) {
    const voucher = await this.getById(id);
    if (!([$Enums.PaymentVoucherStatus.DRAFT, $Enums.PaymentVoucherStatus.REJECTED] as $Enums.PaymentVoucherStatus[]).includes(voucher.status)) {
      throw new ForbiddenException('Only draft or rejected vouchers can be submitted');
    }
    if (voucher.createdBy && voucher.createdBy !== actor.userId) {
      throw new ForbiddenException('Only the maker can submit this voucher');
    }

    const validation = this.validatePersistedVoucher(voucher, true);
    if (!validation.valid) {
      throw new BadRequestException(validation.errors.join(' '));
    }

    const chain = this.parseApprovalChain(voucher.approvalChain);
    const nextStep = this.nextPendingStep(chain);
    if (!nextStep) {
      throw new BadRequestException('Approval chain could not be resolved for this voucher.');
    }

    return this.prisma.aPPaymentVoucherHeader.update({
      where: { id },
      data: {
        status: $Enums.PaymentVoucherStatus.PENDING_APPROVAL,
        workflowStatus: this.workflowStatusForLevel(nextStep.level),
        approvalLevel: 0,
        submittedBy: actor.userId,
        submittedAt: new Date(),
        updatedBy: actor.userId,
        currentApproverId: null,
        approvalHistory: {
          create: {
            action: $Enums.PaymentApprovalAction.SUBMITTED,
            approvalLevel: 0,
            actorUserId: actor.userId,
            actorName: actor.email,
            comments: 'Voucher submitted for approval',
            assignedRole: nextStep.role,
          },
        },
        statusHistory: {
          create: {
            fromStatus: voucher.status,
            toStatus: $Enums.PaymentVoucherStatus.PENDING_APPROVAL,
            fromWorkflowStatus: voucher.workflowStatus,
            toWorkflowStatus: this.workflowStatusForLevel(nextStep.level),
            changedBy: actor.userId,
            reason: 'Submitted for approval',
          },
        },
        auditLogs: {
          create: {
            action: 'SUBMIT',
            actorUserId: actor.userId,
            actorName: actor.email,
            newValues: {
              status: $Enums.PaymentVoucherStatus.PENDING_APPROVAL,
              workflowStatus: this.workflowStatusForLevel(nextStep.level),
              nextApproverRole: nextStep.role,
            },
            ipAddress: meta?.ipAddress,
            deviceInfo: meta?.deviceInfo,
          },
        },
      },
      include: PAYMENT_VOUCHER_INCLUDE,
    });
  }

  async recall(id: number, dto: RecallPaymentVoucherDto, actor: Actor, meta?: PaymentVoucherAuditMetaDto) {
    const voucher = await this.getById(id);
    if (!([$Enums.PaymentVoucherStatus.PENDING_APPROVAL, $Enums.PaymentVoucherStatus.PARTIALLY_APPROVED] as $Enums.PaymentVoucherStatus[]).includes(voucher.status)) {
      throw new ForbiddenException('Only pending vouchers can be recalled');
    }
    if (voucher.createdBy && voucher.createdBy !== actor.userId) {
      throw new ForbiddenException('Only the maker can recall this voucher');
    }
    if (voucher.template && voucher.template.allowRecall === false) {
      throw new ForbiddenException('This payment template does not allow recall after submission');
    }

    const resetChain = this.parseApprovalChain(voucher.approvalChain).map((step) => ({
      level: step.level,
      label: step.label,
      role: step.role,
      status: 'PENDING' as const,
    }));

    return this.prisma.aPPaymentVoucherHeader.update({
      where: { id },
      data: {
        status: $Enums.PaymentVoucherStatus.DRAFT,
        workflowStatus: $Enums.PaymentWorkflowStatus.AWAITING_SUBMISSION,
        approvalLevel: 0,
        currentApproverId: null,
        approvalChain: resetChain as unknown as Prisma.InputJsonValue,
        approvalHistory: {
          create: {
            action: $Enums.PaymentApprovalAction.RECALLED,
            approvalLevel: 0,
            actorUserId: actor.userId,
            actorName: actor.email,
            comments: dto.reason ?? 'Voucher recalled by maker',
          },
        },
        statusHistory: {
          create: {
            fromStatus: voucher.status,
            toStatus: $Enums.PaymentVoucherStatus.DRAFT,
            fromWorkflowStatus: voucher.workflowStatus,
            toWorkflowStatus: $Enums.PaymentWorkflowStatus.AWAITING_SUBMISSION,
            changedBy: actor.userId,
            reason: dto.reason ?? 'Voucher recalled',
          },
        },
        auditLogs: {
          create: {
            action: 'RECALL',
            actorUserId: actor.userId,
            actorName: actor.email,
            newValues: {
              status: $Enums.PaymentVoucherStatus.DRAFT,
              workflowStatus: $Enums.PaymentWorkflowStatus.AWAITING_SUBMISSION,
            },
            ipAddress: meta?.ipAddress,
            deviceInfo: meta?.deviceInfo,
          },
        },
      },
      include: PAYMENT_VOUCHER_INCLUDE,
    });
  }

  async approve(id: number, dto: ApprovePaymentVoucherDto, actor: Actor, meta?: PaymentVoucherAuditMetaDto) {
    const voucher = await this.getById(id);
    if (!([$Enums.PaymentVoucherStatus.PENDING_APPROVAL, $Enums.PaymentVoucherStatus.PARTIALLY_APPROVED] as $Enums.PaymentVoucherStatus[]).includes(voucher.status)) {
      throw new ForbiddenException('This voucher is not awaiting approval');
    }
    if (voucher.createdBy && voucher.createdBy === actor.userId) {
      throw new ForbiddenException('Maker cannot be the final approver for this voucher');
    }

    const chain = this.parseApprovalChain(voucher.approvalChain);
    const currentStep = this.nextPendingStep(chain);
    if (!currentStep) {
      throw new BadRequestException('Approval chain is exhausted or invalid.');
    }
    const actorRole = this.resolveActorRole(actor);
    if (currentStep.role !== actorRole && voucher.currentApproverId !== actor.userId) {
      throw new ForbiddenException('You are not the current approver for this voucher');
    }

    const updatedChain = chain.map((step) =>
      step.level === currentStep.level
        ? {
            ...step,
            status: 'APPROVED' as const,
            actorUserId: actor.userId,
            actorName: actor.email,
            actedAt: new Date().toISOString(),
            comments: dto.comments,
          }
        : step,
    );
    const nextStep = this.nextPendingStep(updatedChain);
    const finalApproval = !nextStep;

    return this.prisma.aPPaymentVoucherHeader.update({
      where: { id },
      data: {
        status: finalApproval ? $Enums.PaymentVoucherStatus.APPROVED : $Enums.PaymentVoucherStatus.PARTIALLY_APPROVED,
        workflowStatus: finalApproval ? $Enums.PaymentWorkflowStatus.APPROVED : this.workflowStatusForLevel(nextStep.level),
        approvalLevel: currentStep.level,
        currentApproverId: null,
        finalApproverId: finalApproval ? actor.userId : voucher.finalApproverId,
        approvedBy: finalApproval ? actor.userId : voucher.approvedBy,
        approvedAt: finalApproval ? new Date() : voucher.approvedAt,
        approvalChain: updatedChain as unknown as Prisma.InputJsonValue,
        approvalHistory: {
          create: {
            action: $Enums.PaymentApprovalAction.APPROVED,
            approvalLevel: currentStep.level,
            actorUserId: actor.userId,
            actorName: actor.email,
            comments: dto.comments,
            assignedRole: nextStep?.role,
          },
        },
        statusHistory: {
          create: {
            fromStatus: voucher.status,
            toStatus: finalApproval ? $Enums.PaymentVoucherStatus.APPROVED : $Enums.PaymentVoucherStatus.PARTIALLY_APPROVED,
            fromWorkflowStatus: voucher.workflowStatus,
            toWorkflowStatus: finalApproval ? $Enums.PaymentWorkflowStatus.APPROVED : this.workflowStatusForLevel(nextStep.level),
            changedBy: actor.userId,
            reason: finalApproval ? 'Final approval completed' : `Approved at level ${currentStep.level}`,
          },
        },
        auditLogs: {
          create: {
            action: 'APPROVE',
            actorUserId: actor.userId,
            actorName: actor.email,
            newValues: {
              status: finalApproval ? $Enums.PaymentVoucherStatus.APPROVED : $Enums.PaymentVoucherStatus.PARTIALLY_APPROVED,
              workflowStatus: finalApproval ? $Enums.PaymentWorkflowStatus.APPROVED : this.workflowStatusForLevel(nextStep.level),
              approvalLevel: currentStep.level,
            },
            ipAddress: meta?.ipAddress,
            deviceInfo: meta?.deviceInfo,
          },
        },
      },
      include: PAYMENT_VOUCHER_INCLUDE,
    });
  }

  async reject(id: number, dto: RejectPaymentVoucherDto, actor: Actor, meta?: PaymentVoucherAuditMetaDto) {
    const voucher = await this.getById(id);
    if (!([$Enums.PaymentVoucherStatus.PENDING_APPROVAL, $Enums.PaymentVoucherStatus.PARTIALLY_APPROVED] as $Enums.PaymentVoucherStatus[]).includes(voucher.status)) {
      throw new ForbiddenException('This voucher is not awaiting approval');
    }

    const chain = this.parseApprovalChain(voucher.approvalChain);
    const currentStep = this.nextPendingStep(chain);
    if (!currentStep) {
      throw new BadRequestException('Approval chain is exhausted or invalid.');
    }

    const actorRole = this.resolveActorRole(actor);
    if (currentStep.role !== actorRole && voucher.currentApproverId !== actor.userId) {
      throw new ForbiddenException('You are not the current approver for this voucher');
    }

    const rejectedChain = chain.map((step) =>
      step.level === currentStep.level
        ? {
            ...step,
            status: 'REJECTED' as const,
            actorUserId: actor.userId,
            actorName: actor.email,
            actedAt: new Date().toISOString(),
            comments: dto.comments,
            rejectionReason: dto.rejectionReason,
          }
        : step,
    );

    return this.prisma.aPPaymentVoucherHeader.update({
      where: { id },
      data: {
        status: $Enums.PaymentVoucherStatus.REJECTED,
        workflowStatus: $Enums.PaymentWorkflowStatus.REJECTED,
        rejectedBy: actor.userId,
        rejectedAt: new Date(),
        rejectedReason: dto.rejectionReason,
        currentApproverId: null,
        approvalChain: rejectedChain as unknown as Prisma.InputJsonValue,
        approvalHistory: {
          create: {
            action: $Enums.PaymentApprovalAction.REJECTED,
            approvalLevel: currentStep.level,
            actorUserId: actor.userId,
            actorName: actor.email,
            comments: dto.comments,
            rejectionReason: dto.rejectionReason,
          },
        },
        statusHistory: {
          create: {
            fromStatus: voucher.status,
            toStatus: $Enums.PaymentVoucherStatus.REJECTED,
            fromWorkflowStatus: voucher.workflowStatus,
            toWorkflowStatus: $Enums.PaymentWorkflowStatus.REJECTED,
            changedBy: actor.userId,
            reason: dto.rejectionReason,
          },
        },
        auditLogs: {
          create: {
            action: 'REJECT',
            actorUserId: actor.userId,
            actorName: actor.email,
            newValues: {
              status: $Enums.PaymentVoucherStatus.REJECTED,
              workflowStatus: $Enums.PaymentWorkflowStatus.REJECTED,
              rejectionReason: dto.rejectionReason,
            },
            ipAddress: meta?.ipAddress,
            deviceInfo: meta?.deviceInfo,
          },
        },
      },
      include: PAYMENT_VOUCHER_INCLUDE,
    });
  }

  async returnForCorrection(id: number, dto: ReturnPaymentVoucherDto, actor: Actor, meta?: PaymentVoucherAuditMetaDto) {
    const voucher = await this.getById(id);
    if (!([$Enums.PaymentVoucherStatus.PENDING_APPROVAL, $Enums.PaymentVoucherStatus.PARTIALLY_APPROVED] as $Enums.PaymentVoucherStatus[]).includes(voucher.status)) {
      throw new ForbiddenException('This voucher is not awaiting approval');
    }

    return this.prisma.aPPaymentVoucherHeader.update({
      where: { id },
      data: {
        status: $Enums.PaymentVoucherStatus.DRAFT,
        workflowStatus: $Enums.PaymentWorkflowStatus.RETURNED_FOR_CORRECTION,
        currentApproverId: null,
        approvalHistory: {
          create: {
            action: $Enums.PaymentApprovalAction.RETURNED,
            approvalLevel: voucher.approvalLevel,
            actorUserId: actor.userId,
            actorName: actor.email,
            comments: dto.reason,
          },
        },
        statusHistory: {
          create: {
            fromStatus: voucher.status,
            toStatus: $Enums.PaymentVoucherStatus.DRAFT,
            fromWorkflowStatus: voucher.workflowStatus,
            toWorkflowStatus: $Enums.PaymentWorkflowStatus.RETURNED_FOR_CORRECTION,
            changedBy: actor.userId,
            reason: dto.reason,
          },
        },
        auditLogs: {
          create: {
            action: 'RETURN_FOR_CORRECTION',
            actorUserId: actor.userId,
            actorName: actor.email,
            newValues: {
              status: $Enums.PaymentVoucherStatus.DRAFT,
              workflowStatus: $Enums.PaymentWorkflowStatus.RETURNED_FOR_CORRECTION,
            },
            ipAddress: meta?.ipAddress,
            deviceInfo: meta?.deviceInfo,
          },
        },
      },
      include: PAYMENT_VOUCHER_INCLUDE,
    });
  }

  async cancel(id: number, dto: CancelPaymentVoucherDto, actor: Actor, meta?: PaymentVoucherAuditMetaDto) {
    const voucher = await this.getById(id);
    if (([$Enums.PaymentVoucherStatus.POSTED, $Enums.PaymentVoucherStatus.PAID] as $Enums.PaymentVoucherStatus[]).includes(voucher.status)) {
      throw new ForbiddenException('Posted or paid vouchers cannot be cancelled');
    }

    return this.prisma.aPPaymentVoucherHeader.update({
      where: { id },
      data: {
        status: $Enums.PaymentVoucherStatus.CANCELLED,
        cancelledBy: actor.userId,
        cancelledAt: new Date(),
        currentApproverId: null,
        approvalHistory: {
          create: {
            action: $Enums.PaymentApprovalAction.CANCELLED,
            approvalLevel: voucher.approvalLevel,
            actorUserId: actor.userId,
            actorName: actor.email,
            comments: dto.reason,
          },
        },
        statusHistory: {
          create: {
            fromStatus: voucher.status,
            toStatus: $Enums.PaymentVoucherStatus.CANCELLED,
            fromWorkflowStatus: voucher.workflowStatus,
            toWorkflowStatus: voucher.workflowStatus,
            changedBy: actor.userId,
            reason: dto.reason,
          },
        },
        auditLogs: {
          create: {
            action: 'CANCEL',
            actorUserId: actor.userId,
            actorName: actor.email,
            newValues: { status: $Enums.PaymentVoucherStatus.CANCELLED },
            ipAddress: meta?.ipAddress,
            deviceInfo: meta?.deviceInfo,
          },
        },
      },
      include: PAYMENT_VOUCHER_INCLUDE,
    });
  }

  async addComment(id: number, dto: VoucherCommentDto, actor: Actor) {
    const voucher = await this.getById(id);
    await this.prisma.aPPaymentVoucherComment.create({
      data: {
        paymentVoucherId: id,
        commentType: dto.commentType ?? $Enums.PaymentCommentType.INTERNAL,
        body: dto.body,
        authorUserId: actor.userId,
        authorName: actor.email,
      },
    });
    await this.prisma.aPPaymentVoucherHeader.update({
      where: { id },
      data: {
        commentsCount: (voucher.commentsCount ?? 0) + 1,
      },
    });
    return this.getById(id);
  }

  async createTemplate(dto: CreatePaymentTemplateDto) {
    return this.prisma.aPPaymentTemplate.create({
      data: {
        name: dto.name,
        voucherType: dto.voucherType,
        templateKind: dto.templateKind ?? $Enums.PaymentTemplateKind.STANDARD_CORPORATE,
        legalEntityId: dto.legalEntityId,
        branchId: dto.branchId,
        paymentMethod: dto.paymentMethod,
        minAmount: this.decimalOrNull(dto.minAmount),
        maxAmount: this.decimalOrNull(dto.maxAmount),
        requiresAttachment: dto.requiresAttachment ?? false,
        allowRecall: dto.allowRecall ?? true,
        postAfterFinalApproval: dto.postAfterFinalApproval ?? true,
        allowPaymentExecution: dto.allowPaymentExecution ?? true,
        enableGateway: dto.enableGateway ?? false,
        defaultAccountId: dto.defaultAccountId,
        defaultNarration: dto.defaultNarration,
        purposeTemplate: dto.purposeTemplate,
        approvalMatrix: dto.approvalMatrix as Prisma.InputJsonValue,
      },
    });
  }

  async listTemplates() {
    return this.prisma.aPPaymentTemplate.findMany({
      where: { isActive: true },
      orderBy: [{ voucherType: 'asc' }, { name: 'asc' }],
    });
  }

  async addAttachment(id: number, file: { fileName: string; fileUrl: string; mimeType?: string }, actor: Actor) {
    const voucher = await this.getById(id);
    await this.prisma.aPPaymentVoucherAttachment.create({
      data: {
        paymentVoucherId: id,
        fileName: file.fileName,
        fileUrl: file.fileUrl,
        mimeType: file.mimeType,
        uploadedBy: actor.userId,
      },
    });
    await this.prisma.aPPaymentVoucherHeader.update({
      where: { id },
      data: {
        attachmentCount: (voucher.attachmentCount ?? 0) + 1,
      },
    });
    return this.getById(id);
  }

  async preview(id: number) {
    const voucher = await this.getById(id);
    const chain = this.parseApprovalChain(voucher.approvalChain);
    return {
      ...voucher,
      approvalChain: chain,
      amountInWords: this.amountInWords(Number(voucher.netPaymentAmount), voucher.currencyCode),
      printTimestamp: new Date().toISOString(),
      templates: {
        standardCorporate: true,
        financeTreasury: true,
        cleanA4: true,
      },
    };
  }

  async postToGl(id: number, actor: Actor, meta?: PaymentVoucherAuditMetaDto) {
    const voucher = await this.getById(id);
    if (voucher.isPostedToGL || voucher.glJournalId) {
      throw new BadRequestException('This voucher has already been posted');
    }
    if (voucher.status !== $Enums.PaymentVoucherStatus.APPROVED) {
      throw new BadRequestException('Final approval is required before posting');
    }
    if (voucher.accountingPeriod.status !== 'OPEN') {
      throw new BadRequestException('Accounting period is closed');
    }

    const postingLines = this.buildPostingLines(voucher);
    this.ensureBalancedPosting(postingLines);

    return this.prisma.$transaction(async (tx) => {
      const journalReference = `PV-${voucher.voucherNumber}`;
      const journal = await tx.journalEntry.create({
        data: {
          reference: journalReference,
          type:
            voucher.paymentMethod === $Enums.PaymentMethod.CASH
              ? $Enums.JournalType.CASH
              : $Enums.JournalType.BANK,
          description: `Payment voucher ${voucher.voucherNumber} for ${voucher.beneficiaryName}`,
          date: voucher.postingDate,
          createdBy: actor.userId,
        },
      });

      await tx.journalLine.createMany({
        data: postingLines.map((line) => ({
          entryId: journal.id,
          accountId: line.accountId,
          branchId: voucher.branchId,
          debit: line.debit,
          credit: line.credit,
          memo: line.memo,
        })),
      });

      await tx.aPPaymentVoucherHeader.update({
        where: { id },
        data: {
          status:
            voucher.paymentStatus === $Enums.PaymentExecutionStatus.PAID
              ? $Enums.PaymentVoucherStatus.PAID
              : $Enums.PaymentVoucherStatus.POSTED,
          isPostedToGL: true,
          glJournalId: journal.id,
          postedBy: actor.userId,
          postedAt: new Date(),
          approvalHistory: {
            create: {
              action: $Enums.PaymentApprovalAction.POSTED,
              approvalLevel: voucher.approvalLevel,
              actorUserId: actor.userId,
              actorName: actor.email,
              comments: `Posted to GL reference ${journal.reference}`,
            },
          },
          statusHistory: {
            create: {
              fromStatus: voucher.status,
              toStatus:
                voucher.paymentStatus === $Enums.PaymentExecutionStatus.PAID
                  ? $Enums.PaymentVoucherStatus.PAID
                  : $Enums.PaymentVoucherStatus.POSTED,
              fromWorkflowStatus: voucher.workflowStatus,
              toWorkflowStatus: voucher.workflowStatus,
              changedBy: actor.userId,
              reason: `Posted to GL ${journal.reference}`,
            },
          },
          auditLogs: {
            create: {
              action: 'POST_TO_GL',
              actorUserId: actor.userId,
              actorName: actor.email,
              newValues: {
                glJournalId: journal.id,
                glJournalReference: journal.reference,
                status:
                  voucher.paymentStatus === $Enums.PaymentExecutionStatus.PAID
                    ? $Enums.PaymentVoucherStatus.PAID
                    : $Enums.PaymentVoucherStatus.POSTED,
              },
              ipAddress: meta?.ipAddress,
              deviceInfo: meta?.deviceInfo,
            },
          },
        },
      });

      return tx.aPPaymentVoucherHeader.findUnique({
        where: { id },
        include: PAYMENT_VOUCHER_INCLUDE,
      });
    });
  }

  async initiatePayment(id: number, dto: InitiatePaymentDto, actor: Actor, meta?: PaymentVoucherAuditMetaDto) {
    const voucher = await this.getById(id);
    if (!([$Enums.PaymentVoucherStatus.APPROVED, $Enums.PaymentVoucherStatus.POSTED] as $Enums.PaymentVoucherStatus[]).includes(voucher.status)) {
      throw new BadRequestException('Voucher is still awaiting approval');
    }
    if (voucher.paymentStatus === $Enums.PaymentExecutionStatus.PAID) {
      throw new BadRequestException('This voucher has already been paid');
    }
    if (!voucher.bankAccount && voucher.paymentMethod !== $Enums.PaymentMethod.CASH) {
      throw new BadRequestException('Beneficiary bank details are incomplete');
    }

    const validateResult = await this.gatewayService.validateBeneficiary({
      providerName: dto.providerName,
      paymentChannel: dto.paymentChannel ?? voucher.paymentChannel ?? undefined,
      voucherNumber: voucher.voucherNumber,
      beneficiaryName: voucher.beneficiaryName,
      amount: Number(voucher.netPaymentAmount),
      currencyCode: voucher.currencyCode,
      bankAccountNumber: voucher.bankAccount?.number ?? null,
      bankName: voucher.bankAccount?.bankName ?? null,
    });
    if (!validateResult.valid) {
      throw new BadRequestException(validateResult.message);
    }

    const gatewayPayload: GatewayPayload = {
      providerName: dto.providerName,
      paymentChannel: dto.paymentChannel ?? voucher.paymentChannel ?? undefined,
      voucherNumber: voucher.voucherNumber,
      beneficiaryName: voucher.beneficiaryName,
      amount: Number(voucher.netPaymentAmount),
      currencyCode: voucher.currencyCode,
      bankAccountNumber: voucher.bankAccount?.number ?? null,
      bankName: voucher.bankAccount?.bankName ?? null,
    };
    const result = await this.gatewayService.initiatePayment(gatewayPayload);

    return this.prisma.aPPaymentVoucherHeader.update({
      where: { id },
      data: {
        paymentStatus:
          result.providerStatus === 'PAID'
            ? $Enums.PaymentExecutionStatus.PAID
            : result.providerStatus === 'FAILED'
              ? $Enums.PaymentExecutionStatus.FAILED
              : $Enums.PaymentExecutionStatus.PAYMENT_PROCESSING,
        status:
          result.providerStatus === 'PAID'
            ? voucher.isPostedToGL
              ? $Enums.PaymentVoucherStatus.PAID
              : $Enums.PaymentVoucherStatus.APPROVED
            : result.providerStatus === 'FAILED'
              ? $Enums.PaymentVoucherStatus.FAILED_PAYMENT
              : voucher.status,
        paymentChannel: dto.paymentChannel ?? voucher.paymentChannel,
        gatewayTransactionReference: result.providerReference,
        paymentEvents: {
          create: {
            eventType:
              result.providerStatus === 'PAID'
                ? $Enums.PaymentEventType.CONFIRMED
                : result.providerStatus === 'FAILED'
                  ? $Enums.PaymentEventType.FAILED
                  : $Enums.PaymentEventType.INITIATED,
            paymentChannel: dto.paymentChannel ?? voucher.paymentChannel,
            providerName: result.providerName,
            providerReference: result.providerReference,
            providerStatus: result.providerStatus,
            providerMessage: result.providerMessage,
            initiatedAt: new Date(),
            confirmedAt: result.providerStatus === 'PAID' ? new Date() : null,
            failureReason: result.providerStatus === 'FAILED' ? result.providerMessage : null,
            createdBy: actor.userId,
            rawResponseJson: result.rawResponseJson as Prisma.InputJsonValue,
          },
        },
        gatewayLogs: {
          create: {
            bankAccountId: voucher.bankAccountId,
            providerName: result.providerName,
            action: 'INITIATE_PAYMENT',
            requestPayload: gatewayPayload as unknown as Prisma.InputJsonValue,
            responsePayload: result.rawResponseJson as Prisma.InputJsonValue,
            providerStatus: result.providerStatus,
            providerMessage: result.providerMessage,
          },
        },
        auditLogs: {
          create: {
            action: 'INITIATE_PAYMENT',
            actorUserId: actor.userId,
            actorName: actor.email,
            newValues: {
              paymentStatus:
                result.providerStatus === 'PAID'
                  ? $Enums.PaymentExecutionStatus.PAID
                  : result.providerStatus === 'FAILED'
                    ? $Enums.PaymentExecutionStatus.FAILED
                    : $Enums.PaymentExecutionStatus.PAYMENT_PROCESSING,
              providerReference: result.providerReference,
              providerStatus: result.providerStatus,
            },
            ipAddress: meta?.ipAddress,
            deviceInfo: meta?.deviceInfo,
          },
        },
      },
      include: PAYMENT_VOUCHER_INCLUDE,
    });
  }

  async markAsPaid(id: number, dto: MarkVoucherPaidDto, actor: Actor, meta?: PaymentVoucherAuditMetaDto) {
    const voucher = await this.getById(id);
    if (voucher.paymentStatus === $Enums.PaymentExecutionStatus.PAID) {
      throw new BadRequestException('This voucher has already been paid');
    }

    return this.prisma.aPPaymentVoucherHeader.update({
      where: { id },
      data: {
        paymentStatus: $Enums.PaymentExecutionStatus.PAID,
        status: voucher.isPostedToGL ? $Enums.PaymentVoucherStatus.PAID : voucher.status,
        paidBy: actor.userId,
        paidAt: new Date(),
        bankPaymentReference: dto.bankReference ?? voucher.bankPaymentReference,
        paymentEvents: {
          create: {
            eventType: $Enums.PaymentEventType.MANUAL_MARKED_PAID,
            paymentChannel: voucher.paymentChannel,
            providerName: 'MANUAL_TRANSFER',
            providerReference: dto.bankReference,
            providerStatus: 'PAID',
            providerMessage: dto.comments ?? 'Payment marked as paid manually',
            initiatedAt: voucher.paidAt ?? new Date(),
            confirmedAt: new Date(),
            bankReference: dto.bankReference,
            proofFileUrl: dto.proofFileUrl,
            createdBy: actor.userId,
          },
        },
        auditLogs: {
          create: {
            action: 'MARK_AS_PAID',
            actorUserId: actor.userId,
            actorName: actor.email,
            newValues: {
              paymentStatus: $Enums.PaymentExecutionStatus.PAID,
              bankReference: dto.bankReference,
            },
            ipAddress: meta?.ipAddress,
            deviceInfo: meta?.deviceInfo,
          },
        },
      },
      include: PAYMENT_VOUCHER_INCLUDE,
    });
  }

  private async prepareVoucher(dto: CreatePaymentVoucherDto, enforceAttachment: boolean): Promise<PreparedVoucher> {
    if (!dto.bankAccountId && !dto.cashAccountId) {
      throw new BadRequestException('Select an active bank or cash account for this voucher.');
    }
    if (dto.bankAccountId && dto.cashAccountId) {
      throw new BadRequestException('Choose either a bank account or a cash account, not both.');
    }

    const accountIds = Array.from(
      new Set(
        [...dto.lines.map((line) => line.accountId), dto.payableAccountId, dto.cashAccountId].filter(
          (value): value is number => typeof value === 'number',
        ),
      ),
    );
    const taxIds = Array.from(
      new Set(
        dto.lines
          .flatMap((line) => [line.taxCodeId, line.withholdingTaxCodeId])
          .filter((value): value is number => typeof value === 'number'),
      ),
    );

    const [accounts, taxes, bankAccount, period, template] = await Promise.all([
      this.prisma.account.findMany({ where: { id: { in: accountIds } } }),
      this.prisma.taxConfig.findMany({
        where: { id: { in: taxIds } },
        include: { inputAccount: true, liabilityAccount: true },
      }),
      dto.bankAccountId
        ? this.prisma.bankAccount.findUnique({
            where: { id: dto.bankAccountId },
            include: { glAccount: true },
          })
        : Promise.resolve(null),
      this.prisma.accountingPeriod.findUnique({ where: { id: dto.accountingPeriodId } }),
      this.resolveTemplate(dto),
    ]);

    if (!period) throw new BadRequestException('Accounting period does not exist.');

    const accountMap = new Map(accounts.map((account) => [account.id, account]));
    const taxMap = new Map(taxes.map((tax) => [tax.id, tax]));

    if (dto.bankAccountId) {
      if (!bankAccount || !bankAccount.isActive) {
        throw new BadRequestException('Bank account is inactive');
      }
      if (!bankAccount.glAccountId || !bankAccount.glAccount?.isActive) {
        throw new BadRequestException('Bank account does not have a valid GL mapping.');
      }
    }

    const lines = dto.lines.map((line, index) => {
      const account = accountMap.get(line.accountId);
      if (!account) {
        throw new BadRequestException(`Line ${index + 1}: account does not exist.`);
      }
      if (!account.isActive || !account.allowsPosting || !account.allowsManualPosting) {
        throw new BadRequestException(`Line ${index + 1}: account ${account.code} is inactive or blocked.`);
      }
      if (account.requiresDepartment && !line.departmentId && !dto.departmentId) {
        throw new BadRequestException(`Line ${index + 1}: department is required for account ${account.code}.`);
      }
      if (account.requiresCostCenter && !line.costCenterId && !dto.costCenterId) {
        throw new BadRequestException(`Line ${index + 1}: cost center is required for account ${account.code}.`);
      }
      if (account.requiresProject && !line.projectId && !dto.projectId) {
        throw new BadRequestException(`Line ${index + 1}: project is required for account ${account.code}.`);
      }
      if (account.requiresTax && !line.taxCodeId) {
        throw new BadRequestException(`Line ${index + 1}: tax code is required for account ${account.code}.`);
      }

      const gross = Number(line.grossAmount ?? 0);
      const tax = Number(line.taxAmount ?? 0);
      const withholding = Number(line.withholdingTaxAmount ?? 0);
      const net = Number(line.netAmount ?? 0);
      const expectedNet = this.roundMoney(gross + tax - withholding);
      if (gross <= 0) {
        throw new BadRequestException(`Line ${index + 1}: gross amount must be greater than zero.`);
      }
      if (Math.abs(this.roundMoney(net) - expectedNet) > 0.01) {
        throw new BadRequestException(`Line ${index + 1}: net amount does not match gross plus tax less withholding tax.`);
      }

      const taxCode = line.taxCodeId ? taxMap.get(line.taxCodeId) : null;
      if (line.taxAmount && line.taxAmount > 0 && (!taxCode || !taxCode.inputAccountId)) {
        throw new BadRequestException(`Line ${index + 1}: tax code is missing an input VAT account mapping.`);
      }
      const withholdingTaxCode = line.withholdingTaxCodeId ? taxMap.get(line.withholdingTaxCodeId) : null;
      if (
        line.withholdingTaxAmount &&
        line.withholdingTaxAmount > 0 &&
        (!withholdingTaxCode || !withholdingTaxCode.liabilityAccountId)
      ) {
        throw new BadRequestException(`Line ${index + 1}: withholding tax code is missing a liability account mapping.`);
      }

      return {
        lineNumber: index + 1,
        lineType: line.lineType,
        accountCode: account.code,
        accountName: account.name,
        subledgerType: line.subledgerType,
        subledgerId: line.subledgerId,
        sourceInvoiceId: line.sourceInvoiceId,
        sourceInvoiceNumber: line.sourceInvoiceNumber,
        sourceExpenseClaimId: line.sourceExpenseClaimId,
        description: line.description,
        grossAmount: new Prisma.Decimal(gross),
        taxAmount: this.decimalOrNull(tax),
        withholdingTaxAmount: this.decimalOrNull(withholding),
        netAmount: new Prisma.Decimal(net),
        dueDate: line.dueDate ? new Date(line.dueDate) : undefined,
        lineStatus: 'OPEN',
        account: { connect: { id: account.id } },
        taxCode: line.taxCodeId ? { connect: { id: line.taxCodeId } } : undefined,
        withholdingTaxCode: line.withholdingTaxCodeId
          ? { connect: { id: line.withholdingTaxCodeId } }
          : undefined,
        branch: line.branchId ?? dto.branchId ? { connect: { id: line.branchId ?? dto.branchId! } } : undefined,
        department:
          line.departmentId ?? dto.departmentId
            ? { connect: { id: line.departmentId ?? dto.departmentId! } }
            : undefined,
        costCenter:
          line.costCenterId ?? dto.costCenterId
            ? { connect: { id: line.costCenterId ?? dto.costCenterId! } }
            : undefined,
        project:
          line.projectId ?? dto.projectId
            ? { connect: { id: line.projectId ?? dto.projectId! } }
            : undefined,
      } satisfies Prisma.APPaymentVoucherLineCreateWithoutPaymentVoucherInput;
    });

    const totalGross = this.roundMoney(dto.lines.reduce((sum, line) => sum + Number(line.grossAmount ?? 0), 0));
    const totalTax = this.roundMoney(dto.lines.reduce((sum, line) => sum + Number(line.taxAmount ?? 0), 0));
    const totalWithholding = this.roundMoney(dto.lines.reduce((sum, line) => sum + Number(line.withholdingTaxAmount ?? 0), 0));
    const total = this.roundMoney(totalGross + totalTax);
    const net = this.roundMoney(total - totalWithholding);

    if (enforceAttachment && (template.requiresAttachment || dto.requiresAttachment) && !dto.attachments?.length) {
      throw new BadRequestException('Supporting attachment is required for this voucher type.');
    }

    const approvalChain = this.resolveApprovalChain({
      voucherType: dto.voucherType,
      paymentMethod: dto.paymentMethod,
      amount: total,
      template,
    });

    return {
      totalAmount: total,
      taxAmount: totalTax,
      withholdingTaxAmount: totalWithholding,
      netPaymentAmount: net,
      lines,
      auditLines: lines.map((line) => this.auditLineSnapshot(line as unknown as Record<string, unknown>)),
      attachmentCount: dto.attachments?.length ?? 0,
      template,
      approvalChain,
      payableAccountId: dto.payableAccountId ?? template.defaultAccountId ?? null,
    };
  }

  private validatePersistedVoucher(voucher: Awaited<ReturnType<PaymentVouchersService['getById']>>, requireAttachments: boolean): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (!voucher.branchId) errors.push('Branch is required.');
    if (!voucher.accountingPeriodId) errors.push('Accounting period is required.');
    if (voucher.accountingPeriod.status !== 'OPEN') errors.push('Accounting period is closed.');
    if (!voucher.narration?.trim()) errors.push('Narration is required.');
    if (!voucher.purposeOfPayment?.trim()) errors.push('Purpose of payment is required.');
    if (!voucher.lines.length) errors.push('Voucher lines are required.');
    if (requireAttachments && voucher.requiresAttachment && voucher.attachmentCount < 1) {
      errors.push('Supporting attachment is required.');
    }
    if (!voucher.bankAccountId && !voucher.cashAccountId) {
      errors.push('Bank or cash account is required.');
    }
    if (voucher.bankAccountId && voucher.bankAccount && !voucher.bankAccount.isActive) {
      errors.push('Bank account is inactive.');
    }

    const totals = voucher.lines.reduce(
      (acc, line) => {
        acc.gross += Number(line.grossAmount);
        acc.tax += Number(line.taxAmount ?? 0);
        acc.withholding += Number(line.withholdingTaxAmount ?? 0);
        acc.net += Number(line.netAmount);
        return acc;
      },
      { gross: 0, tax: 0, withholding: 0, total: 0, net: 0 },
    );
    totals.total = this.roundMoney(totals.gross + totals.tax);
    totals.net = this.roundMoney(totals.net);

    voucher.lines.forEach((line, index) => {
      if (!line.account?.isActive || !line.account?.allowsPosting) {
        errors.push(`Line ${index + 1}: account is inactive.`);
      }
      const expectedNet = this.roundMoney(Number(line.grossAmount) + Number(line.taxAmount ?? 0) - Number(line.withholdingTaxAmount ?? 0));
      if (Math.abs(this.roundMoney(Number(line.netAmount)) - expectedNet) > 0.01) {
        errors.push(`Line ${index + 1}: net amount is not aligned to deductions.`);
      }
      if (line.taxAmount && Number(line.taxAmount) > 0 && !line.taxCode?.inputAccountId) {
        errors.push(`Line ${index + 1}: tax code is missing input VAT account mapping.`);
      }
      if (line.withholdingTaxAmount && Number(line.withholdingTaxAmount) > 0 && !line.withholdingTaxCode?.liabilityAccountId) {
        errors.push(`Line ${index + 1}: withholding tax code is missing liability mapping.`);
      }
    });

    if (!this.parseApprovalChain(voucher.approvalChain).length) {
      warnings.push('Approval chain is empty.');
    }

    return { valid: errors.length === 0, errors, warnings, totals };
  }

  private async resolveTemplate(dto: CreatePaymentVoucherDto) {
    if (dto.templateId) {
      const specific = await this.prisma.aPPaymentTemplate.findUnique({ where: { id: dto.templateId } });
      if (!specific) throw new BadRequestException('Selected payment template does not exist.');
      return specific;
    }

    const candidates = await this.prisma.aPPaymentTemplate.findMany({
      where: {
        voucherType: dto.voucherType,
        isActive: true,
        OR: [{ legalEntityId: dto.legalEntityId }, { legalEntityId: null }],
      },
      orderBy: [{ legalEntityId: 'desc' }, { minAmount: 'asc' }],
    });

    const matched = candidates.find((template) => {
      if (template.paymentMethod && template.paymentMethod !== dto.paymentMethod) return false;
      const total = dto.lines.reduce((sum, line) => sum + Number(line.grossAmount ?? 0) + Number(line.taxAmount ?? 0), 0);
      if (template.minAmount && total < Number(template.minAmount)) return false;
      if (template.maxAmount && total > Number(template.maxAmount)) return false;
      if (template.branchId && template.branchId !== dto.branchId) return false;
      return true;
    });

    return matched ?? {
      id: undefined,
      requiresAttachment: false,
      allowRecall: true,
      postAfterFinalApproval: true,
      allowPaymentExecution: true,
      enableGateway: false,
      templateKind: $Enums.PaymentTemplateKind.STANDARD_CORPORATE,
      defaultAccountId: null,
      approvalMatrix: null,
    };
  }

  private resolveApprovalChain(input: {
    voucherType: $Enums.PaymentVoucherType;
    paymentMethod: $Enums.PaymentMethod;
    amount: number;
    template: { approvalMatrix?: Prisma.JsonValue | null };
  }): ApprovalStep[] {
    const configured = this.parseApprovalMatrix(input.template.approvalMatrix);
    if (configured.length) return configured;

    const steps: ApprovalStep[] = [
      { level: 1, label: 'Finance review', role: 'FINANCE', status: 'PENDING' },
    ];
    if (input.amount >= 250000 || input.voucherType === $Enums.PaymentVoucherType.TAX_REMITTANCE) {
      steps.push({ level: 2, label: 'Controller approval', role: 'ADMIN', status: 'PENDING' });
    }
    if (input.amount >= 1000000 || input.paymentMethod === $Enums.PaymentMethod.GATEWAY) {
      steps.push({ level: 3, label: 'Treasury release', role: 'FINANCE', status: 'PENDING' });
    }
    return steps;
  }

  private parseApprovalMatrix(value: Prisma.JsonValue | null | undefined): ApprovalStep[] {
    if (!value || !Array.isArray(value)) return [];
    const steps: ApprovalStep[] = [];
    value.forEach((entry, index) => {
      const step = entry as Record<string, unknown>;
      const role = typeof step.role === 'string' ? step.role : undefined;
      if (!role) return;
      steps.push({
        level: Number(step.level ?? index + 1),
        label: typeof step.label === 'string' ? step.label : `Approval level ${index + 1}`,
        role: normalizeRoleName(role),
        status: 'PENDING',
      });
    });
    return steps;
  }

  private parseApprovalChain(value: Prisma.JsonValue | null | undefined): ApprovalStep[] {
    if (!value || !Array.isArray(value)) return [];
    const steps: ApprovalStep[] = [];
    value.forEach((entry) => {
      const step = entry as Record<string, unknown>;
      if (typeof step.role !== 'string') return;
      steps.push({
        level: Number(step.level ?? 0),
        label: typeof step.label === 'string' ? step.label : 'Approval step',
        role: normalizeRoleName(step.role),
        status: step.status === 'APPROVED' || step.status === 'REJECTED' ? step.status : 'PENDING',
        actorUserId: typeof step.actorUserId === 'number' ? step.actorUserId : undefined,
        actorName: typeof step.actorName === 'string' ? step.actorName : undefined,
        actedAt: typeof step.actedAt === 'string' ? step.actedAt : undefined,
        comments: typeof step.comments === 'string' ? step.comments : undefined,
        rejectionReason: typeof step.rejectionReason === 'string' ? step.rejectionReason : undefined,
      });
    });
    return steps;
  }

  private nextPendingStep(chain: ApprovalStep[]) {
    return chain.find((step) => step.status === 'PENDING');
  }

  private workflowStatusForLevel(level: number): $Enums.PaymentWorkflowStatus {
    switch (level) {
      case 1:
        return $Enums.PaymentWorkflowStatus.AWAITING_LEVEL_1_APPROVAL;
      case 2:
        return $Enums.PaymentWorkflowStatus.AWAITING_LEVEL_2_APPROVAL;
      default:
        return $Enums.PaymentWorkflowStatus.AWAITING_FINAL_APPROVAL;
    }
  }

  private buildPostingLines(voucher: Awaited<ReturnType<PaymentVouchersService['getById']>>) {
    const lines: Array<{ accountId: number; debit: Prisma.Decimal; credit: Prisma.Decimal; memo: string }> = [];

    voucher.lines.forEach((line) => {
      lines.push({
        accountId: line.accountId,
        debit: new Prisma.Decimal(line.grossAmount),
        credit: new Prisma.Decimal(0),
        memo: `${line.lineType} main posting`,
      });

      if (line.taxAmount && Number(line.taxAmount) > 0) {
        if (!line.taxCode?.inputAccountId) {
          throw new BadRequestException('Input VAT account mapping is missing for one of the voucher tax lines.');
        }
        lines.push({
          accountId: line.taxCode.inputAccountId,
          debit: new Prisma.Decimal(line.taxAmount),
          credit: new Prisma.Decimal(0),
          memo: `${line.lineType} tax posting`,
        });
      }

      if (line.withholdingTaxAmount && Number(line.withholdingTaxAmount) > 0) {
        if (!line.withholdingTaxCode?.liabilityAccountId) {
          throw new BadRequestException('Withholding tax liability mapping is missing for one of the voucher lines.');
        }
        lines.push({
          accountId: line.withholdingTaxCode.liabilityAccountId,
          debit: new Prisma.Decimal(0),
          credit: new Prisma.Decimal(line.withholdingTaxAmount),
          memo: `${line.lineType} withholding posting`,
        });
      }
    });

    const settlementAccountId = voucher.bankAccount?.glAccountId ?? voucher.cashAccountId;
    if (!settlementAccountId) {
      throw new BadRequestException('Bank or cash account must be mapped to a posting account.');
    }

    lines.push({
      accountId: settlementAccountId,
      debit: new Prisma.Decimal(0),
      credit: new Prisma.Decimal(voucher.netPaymentAmount),
      memo: voucher.paymentMethod === $Enums.PaymentMethod.CASH ? 'Cash payment' : 'Bank payment',
    });

    return this.mergePostingLines(lines);
  }

  private mergePostingLines(lines: Array<{ accountId: number; debit: Prisma.Decimal; credit: Prisma.Decimal; memo: string }>) {
    const merged = new Map<string, { accountId: number; debit: Prisma.Decimal; credit: Prisma.Decimal; memo: string }>();
    for (const line of lines) {
      const key = `${line.accountId}:${line.memo}`;
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

  private ensureBalancedPosting(lines: Array<{ debit: Prisma.Decimal; credit: Prisma.Decimal }>) {
    const totalDebit = this.roundMoney(lines.reduce((sum, line) => sum + Number(line.debit), 0));
    const totalCredit = this.roundMoney(lines.reduce((sum, line) => sum + Number(line.credit), 0));
    if (totalDebit <= 0 || totalCredit <= 0) {
      throw new BadRequestException('Balanced accounting impact is required before posting.');
    }
    if (Math.abs(totalDebit - totalCredit) > 0.01) {
      throw new BadRequestException('GL posting failed due to invalid account mapping.');
    }
  }

  private resolveActorRole(actor: Actor) {
    const candidates = [actor.role, ...(actor.roles ?? [])].filter((value): value is string => Boolean(value));
    return normalizeRoleName(candidates[0] ?? 'viewer');
  }

  private async nextVoucherNumber(tx: Prisma.TransactionClient, legalEntityId: number) {
    const sequenceName = 'Payment Voucher';
    let sequence = await tx.numberingSequence.findFirst({
      where: { companyId: legalEntityId, name: sequenceName },
      orderBy: { id: 'asc' },
    });

    if (!sequence) {
      sequence = await tx.numberingSequence.create({
        data: {
          companyId: legalEntityId,
          name: sequenceName,
          prefix: 'PV',
          nextNumber: 2,
        },
      });
      return 'PV-000001';
    }

    const currentNumber = sequence.nextNumber;
    await tx.numberingSequence.update({
      where: { id: sequence.id },
      data: { nextNumber: currentNumber + 1 },
    });
    return `${sequence.prefix ?? 'PV'}-${String(currentNumber).padStart(6, '0')}`;
  }

  private mapAttachment(attachment: PaymentVoucherAttachmentDto, actor: Actor): Prisma.APPaymentVoucherAttachmentCreateWithoutPaymentVoucherInput {
    return {
      fileName: attachment.fileName,
      fileUrl: attachment.fileUrl,
      mimeType: attachment.mimeType,
      uploadedBy: actor.userId,
    };
  }

  private headerAuditSnapshot(data: Record<string, unknown>) {
    return {
      voucherType: data.voucherType,
      sourceType: data.sourceType,
      legalEntityId: data.legalEntityId,
      branchId: data.branchId,
      beneficiaryType: data.beneficiaryType,
      beneficiaryName: data.beneficiaryName,
      paymentMethod: data.paymentMethod,
      currencyCode: data.currencyCode,
      voucherDate: data.voucherDate,
      requestedPaymentDate: data.requestedPaymentDate,
      postingDate: data.postingDate,
      referenceNumber: data.referenceNumber,
      narration: data.narration,
      purposeOfPayment: data.purposeOfPayment,
    };
  }

  private auditLineSnapshot(data: Record<string, unknown>) {
    return {
      lineNumber: data.lineNumber,
      lineType: data.lineType,
      accountId: data.accountId,
      accountCode: data.accountCode,
      description: data.description,
      grossAmount: data.grossAmount,
      taxAmount: data.taxAmount,
      withholdingTaxAmount: data.withholdingTaxAmount,
      netAmount: data.netAmount,
      branchId: data.branchId,
      departmentId: data.departmentId,
      costCenterId: data.costCenterId,
      projectId: data.projectId,
    };
  }

  private decimalOrNull(value?: number | null) {
    if (value === null || value === undefined) return null;
    return new Prisma.Decimal(value);
  }

  private roundMoney(value: number) {
    return Math.round((value + Number.EPSILON) * 100) / 100;
  }

  private amountInWords(amount: number, currencyCode: string) {
    const whole = Math.floor(amount);
    const fraction = Math.round((amount - whole) * 100);
    const wholeWords = this.numberToWords(whole);
    const fractionWords = fraction ? ` and ${this.numberToWords(fraction)} kobo` : '';
    return `${wholeWords} ${currencyCode}${fractionWords}`.replace(/\s+/g, ' ').trim();
  }

  private numberToWords(value: number): string {
    if (value === 0) return 'zero';
    const ones = ['', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen'];
    const tens = ['', '', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety'];
    const toWords = (num: number): string => {
      if (num < 20) return ones[num];
      if (num < 100) return `${tens[Math.floor(num / 10)]}${num % 10 ? ` ${ones[num % 10]}` : ''}`;
      if (num < 1000) return `${ones[Math.floor(num / 100)]} hundred${num % 100 ? ` ${toWords(num % 100)}` : ''}`;
      if (num < 1000000) return `${toWords(Math.floor(num / 1000))} thousand${num % 1000 ? ` ${toWords(num % 1000)}` : ''}`;
      if (num < 1000000000) return `${toWords(Math.floor(num / 1000000))} million${num % 1000000 ? ` ${toWords(num % 1000000)}` : ''}`;
      return `${toWords(Math.floor(num / 1000000000))} billion${num % 1000000000 ? ` ${toWords(num % 1000000000)}` : ''}`;
    };
    return toWords(value);
  }
}
