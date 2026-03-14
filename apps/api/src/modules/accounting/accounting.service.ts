import { BadRequestException, Injectable } from '@nestjs/common';
import { Prisma, $Enums } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateAccountDto, CreateJournalDto, CreateVoucherDto } from './dto';

@Injectable()
export class AccountingService {
  constructor(private prisma: PrismaService) {}

  async createAccount(dto: CreateAccountDto) {
    return this.prisma.account.create({ data: dto });
  }

  async listAccounts() {
    return this.prisma.account.findMany({ orderBy: { code: 'asc' } });
  }

  async postJournal(dto: CreateJournalDto) {
    const totalDebit = dto.lines.reduce((s, l) => s + Number(l.debit || 0), 0);
    const totalCredit = dto.lines.reduce((s, l) => s + Number(l.credit || 0), 0);
    if (totalDebit <= 0 || totalCredit <= 0) throw new BadRequestException('Debits and credits required');
    if (Math.abs(totalDebit - totalCredit) > 0.0001) throw new BadRequestException('Debits must equal credits');

    return this.prisma.$transaction(async (tx) => {
      const entry = await tx.journalEntry.create({
        data: {
          reference: dto.reference || `JR-${Date.now()}`,
          description: dto.description,
          date: new Date(dto.date),
          type: (dto.type as $Enums.JournalType) || $Enums.JournalType.GENERAL,
        },
      });

      const linesData = dto.lines.map((l) => ({
        entryId: entry.id,
        accountId: l.accountId,
        branchId: l.branchId,
        debit: new Prisma.Decimal(l.debit || 0),
        credit: new Prisma.Decimal(l.credit || 0),
        memo: l.memo,
      }));
      await tx.journalLine.createMany({ data: linesData });
      return tx.journalEntry.findUnique({ where: { id: entry.id }, include: { lines: true } });
    });
  }

  async listJournals() {
    return this.prisma.journalEntry.findMany({ orderBy: { date: 'desc' }, include: { lines: true } });
  }

  async postVoucher(dto: CreateVoucherDto) {
    return this.prisma.$transaction(async (tx) => {
      let journalId: number | undefined;
      if (dto.lines?.length) {
        const jr = await this.postJournalWithClient(tx, { ...dto, lines: dto.lines });
        journalId = jr.id;
      }
      const voucher = await tx.voucher.create({
        data: {
          type: dto.type,
          reference: dto.reference || `V-${Date.now()}`,
          amount: new Prisma.Decimal(dto.amount),
          date: new Date(dto.date),
          payee: dto.payee,
          memo: dto.memo,
          journalId,
        },
      });
      return voucher;
    });
  }

  async listVouchers() {
    return this.prisma.voucher.findMany({
      orderBy: { date: 'desc' },
      include: { journal: { include: { lines: true } } },
    });
  }

  private async postJournalWithClient(tx: Prisma.TransactionClient, dto: CreateJournalDto) {
    const totalDebit = dto.lines.reduce((s, l) => s + Number(l.debit || 0), 0);
    const totalCredit = dto.lines.reduce((s, l) => s + Number(l.credit || 0), 0);
    if (totalDebit <= 0 || totalCredit <= 0) throw new BadRequestException('Debits and credits required');
    if (Math.abs(totalDebit - totalCredit) > 0.0001) throw new BadRequestException('Debits must equal credits');

    const entry = await tx.journalEntry.create({
      data: {
        reference: dto.reference || `JR-${Date.now()}`,
        description: dto.description,
        date: new Date(dto.date),
        type: (dto.type as $Enums.JournalType) || $Enums.JournalType.GENERAL,
      },
    });
    const linesData = dto.lines.map((l) => ({
      entryId: entry.id,
      accountId: l.accountId,
      branchId: l.branchId,
      debit: new Prisma.Decimal(l.debit || 0),
      credit: new Prisma.Decimal(l.credit || 0),
      memo: l.memo,
    }));
    await tx.journalLine.createMany({ data: linesData });
    return entry;
  }
}

