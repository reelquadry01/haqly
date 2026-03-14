import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import {
  AccountStatementQueryDto,
  FinancialStatementKind,
  ReportFormat,
  ReportQueryDto,
} from './reports.dto';
import type { Response } from 'express';
import PDFDocument from 'pdfkit';
import * as XLSX from 'xlsx';

const BS_NORMAL_TYPES = new Set(['ASSET', 'EXPENSE']);
const CURRENT_ASSET_CATEGORIES = ['ASSET_CURRENT', 'INVENTORY', 'RECEIVABLE', 'CASH_AND_EQUIVALENT'] as const;
const EQUITY_CATEGORIES = ['EQUITY_SHARE_CAPITAL', 'EQUITY_RETAINED_EARNINGS', 'EQUITY_RESERVE'] as const;

type TrialBalanceRow = {
  code: string;
  account: string;
  type: string;
  openingDebit: number;
  openingCredit: number;
  periodDebit: number;
  periodCredit: number;
  closingDebit: number;
  closingCredit: number;
};

type StatementSummaryRow = {
  code: string;
  account: string;
  type: string;
  debit: number;
  credit: number;
  balance: number;
  entries: number;
  lastActivity: string | null;
};

type StatementDetailRow = {
  date: string;
  reference: string;
  description: string;
  memo: string;
  debit: number;
  credit: number;
  runningBalance: number;
};

type BalanceSums = {
  debit: number;
  credit: number;
};

type AccountSnapshot = {
  accountId: number;
  code: string;
  account: string;
  type: string;
  category: string | null;
  openingAmount: number;
  periodAmount: number;
  closingAmount: number;
  comparativeOpeningAmount: number;
  comparativePeriodAmount: number;
  comparativeClosingAmount: number;
};

type FinancialStatementLine = {
  label: string;
  current: number;
  comparative: number;
  depth?: number;
  kind?: 'account' | 'subtotal' | 'total' | 'info';
  code?: string;
  category?: string | null;
};

type FinancialStatementSection = {
  key: string;
  label: string;
  lines: FinancialStatementLine[];
};

type FinancialStatementPayload = {
  report: 'financial_statement';
  statement: FinancialStatementKind;
  title: string;
  company: { id: number | null; name: string };
  branch: { id: number | null; name: string | null };
  currency: string;
  period: {
    from: string | null;
    to: string | null;
    compareFrom: string | null;
    compareTo: string | null;
  };
  sections: FinancialStatementSection[];
  warnings: string[];
  validation: Record<string, unknown>;
};

type NotesPayload = FinancialStatementPayload & {
  schedules: Array<{
    title: string;
    rows: Array<{ code: string; account: string; current: number; comparative: number }>;
  }>;
};

type RatioResult = {
  category: string;
  name: string;
  value: number | null;
  formattedValue: string;
  formula: string;
  interpretation: string;
  status: 'ok' | 'warning';
};

type RatioAnalysisPayload = {
  report: 'ratio_analysis';
  company: { id: number | null; name: string };
  branch: { id: number | null; name: string | null };
  currency: string;
  period: {
    from: string | null;
    to: string | null;
    compareFrom: string | null;
    compareTo: string | null;
  };
  ratios: RatioResult[];
  warnings: string[];
  sourceSummary: Record<string, number>;
};

@Injectable()
export class ReportsService {
  constructor(private readonly prisma: PrismaService) {}

  async handleTrialBalance(query: ReportQueryDto, res: Response) {
    const rows = await this.getTrialBalanceRows(query);
    const payload = {
      report: 'trial_balance',
      from: query.from ?? null,
      asOf: query.to ?? new Date().toISOString(),
      rows,
      totals: this.sumTrialBalanceRows(rows),
    };
    return this.respondWithFormat(res, query.format ?? 'json', 'trial-balance', payload, rows);
  }

  async handleAccountStatementSummary(query: ReportQueryDto, res: Response) {
    const rows = await this.getAccountStatementSummaryRows(query);
    const payload = {
      report: 'account_statement_summary',
      from: query.from ?? null,
      to: query.to ?? null,
      rows,
      totals: this.sumFinancialRows(rows),
    };
    return this.respondWithFormat(res, query.format ?? 'json', 'account-statement-summary', payload, rows);
  }

  async handleAccountStatement(query: AccountStatementQueryDto, res: Response) {
    const account = await this.prisma.account.findUnique({ where: { id: query.accountId } });
    if (!account) {
      throw new NotFoundException('Account not found');
    }

    const rows = await this.getAccountStatementRows(query);
    const closingBalance = rows.at(-1)?.runningBalance ?? 0;
    const payload = {
      report: 'account_statement',
      account: {
        id: account.id,
        code: account.code,
        name: account.name,
        type: account.type,
      },
      from: query.from ?? null,
      to: query.to ?? null,
      rows,
      totals: {
        debit: rows.reduce((sum, row) => sum + row.debit, 0),
        credit: rows.reduce((sum, row) => sum + row.credit, 0),
        closingBalance,
      },
    };
    return this.respondWithFormat(res, query.format ?? 'json', `account-statement-${account.code}`, payload, rows);
  }

  async handleFinancialStatement(statement: FinancialStatementKind, query: ReportQueryDto, res: Response) {
    const payload = await this.buildFinancialStatement(statement, query);
    return this.respondWithFormat(
      res,
      query.format ?? 'json',
      statement.replace(/-/g, '_'),
      payload,
      this.flattenFinancialStatement(payload),
    );
  }

  async handleRatioAnalysis(query: ReportQueryDto, res: Response) {
    const payload = await this.buildRatioAnalysis(query);
    return this.respondWithFormat(
      res,
      query.format ?? 'json',
      'ratio-analysis',
      payload,
      payload.ratios.map((ratio) => ({
        category: ratio.category,
        ratio: ratio.name,
        value: ratio.formattedValue,
        formula: ratio.formula,
        interpretation: ratio.interpretation,
        status: ratio.status,
      })),
    );
  }

  private async buildFinancialStatement(
    statement: FinancialStatementKind,
    query: ReportQueryDto,
  ): Promise<FinancialStatementPayload> {
    const snapshots = await this.buildAccountSnapshots(query);
    const context = await this.getReportContext(query);
    const warnings = this.getReportingWarnings(snapshots);

    if (statement === 'profit-or-loss') {
      return this.buildProfitOrLossPayload(context, snapshots, warnings);
    }
    if (statement === 'financial-position') {
      return this.buildFinancialPositionPayload(context, snapshots, warnings);
    }
    if (statement === 'cash-flow') {
      return this.buildCashFlowPayload(context, snapshots, warnings);
    }
    if (statement === 'changes-in-equity') {
      return this.buildChangesInEquityPayload(context, snapshots, warnings);
    }
    return this.buildNotesPayload(context, snapshots, warnings);
  }

  private async buildRatioAnalysis(query: ReportQueryDto): Promise<RatioAnalysisPayload> {
    const snapshots = await this.buildAccountSnapshots(query);
    const context = await this.getReportContext(query);
    const warnings = this.getReportingWarnings(snapshots);

    const revenue = this.sumByCategories(snapshots, ['REVENUE'], 'period');
    const costOfSales = this.sumByCategories(snapshots, ['COST_OF_SALES'], 'period');
    const otherIncome = this.sumByCategories(snapshots, ['OTHER_INCOME'], 'period');
    const operatingExpense = this.sumByCategories(
      snapshots,
      ['OPERATING_EXPENSE', 'DEPRECIATION_AND_AMORTIZATION'],
      'period',
    );
    const financeCost = this.sumByCategories(snapshots, ['FINANCE_COST'], 'period');
    const incomeTax = this.sumByCategories(snapshots, ['INCOME_TAX'], 'period');
    const grossProfit = revenue - costOfSales;
    const profitAfterTax = revenue - costOfSales + otherIncome - operatingExpense - financeCost - incomeTax;
    const currentAssets = this.sumByCategories(snapshots, CURRENT_ASSET_CATEGORIES, 'closing');
    const currentLiabilities = this.sumByCategories(snapshots, ['LIABILITY_CURRENT'], 'closing');
    const inventory = this.sumByCategories(snapshots, ['INVENTORY'], 'closing');
    const totalAssets = this.sumByCategories(
      snapshots,
      [...CURRENT_ASSET_CATEGORIES, 'ASSET_NONCURRENT'],
      'closing',
    );
    const totalLiabilities = this.sumByCategories(
      snapshots,
      ['LIABILITY_CURRENT', 'LIABILITY_NONCURRENT'],
      'closing',
    );
    const totalEquity = this.sumByCategories(snapshots, EQUITY_CATEGORIES, 'closing');
    const comparativeAssets = this.sumByCategories(
      snapshots,
      [...CURRENT_ASSET_CATEGORIES, 'ASSET_NONCURRENT'],
      'comparativeClosing',
    );
    const comparativeEquity = this.sumByCategories(snapshots, EQUITY_CATEGORIES, 'comparativeClosing');
    const receivables = this.sumByCategories(snapshots, ['RECEIVABLE'], 'closing');
    const comparativeReceivables = this.sumByCategories(snapshots, ['RECEIVABLE'], 'comparativeClosing');
    const averageAssets = this.average(comparativeAssets, totalAssets);
    const averageEquity = this.average(comparativeEquity, totalEquity);
    const averageReceivables = this.average(comparativeReceivables, receivables);
    const operatingProfit = grossProfit + otherIncome - operatingExpense;

    const ratios: RatioResult[] = [
      this.makeRatio('Liquidity', 'Current ratio', currentAssets, currentLiabilities, 'Current assets / Current liabilities', false),
      this.makeRatio('Liquidity', 'Quick ratio', currentAssets - inventory, currentLiabilities, '(Current assets - Inventory) / Current liabilities', false),
      this.makeRatio('Profitability', 'Gross margin', grossProfit, revenue, 'Gross profit / Revenue', true),
      this.makeRatio('Profitability', 'Net margin', profitAfterTax, revenue, 'Profit after tax / Revenue', true),
      this.makeRatio('Profitability', 'Return on assets', profitAfterTax, averageAssets, 'Profit after tax / Average assets', true),
      this.makeRatio('Profitability', 'Return on equity', profitAfterTax, averageEquity, 'Profit after tax / Average equity', true),
      this.makeRatio('Leverage', 'Debt to equity', totalLiabilities, totalEquity, 'Total liabilities / Total equity', false),
      this.makeRatio('Leverage', 'Interest coverage', operatingProfit, financeCost, 'Operating profit / Finance costs', false),
      this.makeRatio('Efficiency', 'Asset turnover', revenue, averageAssets, 'Revenue / Average assets', false),
      this.makeRatio('Efficiency', 'Receivable turnover', revenue, averageReceivables, 'Revenue / Average receivables', false),
    ];

    if (ratios.some((ratio) => ratio.status === 'warning')) {
      warnings.push('Some ratios could not be calculated because the denominator was zero or unavailable.');
    }

    return {
      report: 'ratio_analysis',
      company: context.company,
      branch: context.branch,
      currency: context.currency,
      period: context.period,
      ratios,
      warnings,
      sourceSummary: {
        revenue,
        grossProfit,
        profitAfterTax,
        currentAssets,
        currentLiabilities,
        totalAssets,
        totalLiabilities,
        totalEquity,
      },
    };
  }

  private buildProfitOrLossPayload(
    context: Awaited<ReturnType<ReportsService['getReportContext']>>,
    snapshots: AccountSnapshot[],
    warnings: string[],
  ): FinancialStatementPayload {
    const revenueLines = this.accountLines(snapshots, ['REVENUE'], 'period');
    const costLines = this.accountLines(snapshots, ['COST_OF_SALES'], 'period');
    const otherIncomeLines = this.accountLines(snapshots, ['OTHER_INCOME'], 'period');
    const operatingExpenseLines = this.accountLines(snapshots, ['OPERATING_EXPENSE'], 'period');
    const depreciationLines = this.accountLines(snapshots, ['DEPRECIATION_AND_AMORTIZATION'], 'period');
    const financeIncomeLines = this.accountLines(snapshots, ['FINANCE_INCOME'], 'period');
    const financeCostLines = this.accountLines(snapshots, ['FINANCE_COST'], 'period');
    const taxLines = this.accountLines(snapshots, ['INCOME_TAX'], 'period');
    const ociLines = this.accountLines(snapshots, ['OTHER_COMPREHENSIVE_INCOME'], 'period');

    const revenue = this.sumLines(revenueLines);
    const costOfSales = this.sumLines(costLines);
    const otherIncome = this.sumLines(otherIncomeLines);
    const operatingExpenses = this.combineSums(this.sumLines(operatingExpenseLines), this.sumLines(depreciationLines));
    const financeIncome = this.sumLines(financeIncomeLines);
    const financeCosts = this.sumLines(financeCostLines);
    const incomeTax = this.sumLines(taxLines);
    const oci = this.sumLines(ociLines);
    const grossProfit = {
      current: revenue.current - costOfSales.current,
      comparative: revenue.comparative - costOfSales.comparative,
    };
    const operatingProfit = {
      current: grossProfit.current + otherIncome.current - operatingExpenses.current,
      comparative: grossProfit.comparative + otherIncome.comparative - operatingExpenses.comparative,
    };
    const profitBeforeTax = {
      current: operatingProfit.current + financeIncome.current - financeCosts.current,
      comparative: operatingProfit.comparative + financeIncome.comparative - financeCosts.comparative,
    };
    const profitAfterTax = {
      current: profitBeforeTax.current - incomeTax.current,
      comparative: profitBeforeTax.comparative - incomeTax.comparative,
    };
    const totalComprehensiveIncome = {
      current: profitAfterTax.current + oci.current,
      comparative: profitAfterTax.comparative + oci.comparative,
    };

    return {
      report: 'financial_statement',
      statement: 'profit-or-loss',
      title: 'Statement of Profit or Loss and Other Comprehensive Income',
      company: context.company,
      branch: context.branch,
      currency: context.currency,
      period: context.period,
      warnings,
      validation: {
        profitAfterTax: profitAfterTax.current,
        totalComprehensiveIncome: totalComprehensiveIncome.current,
      },
      sections: [
        {
          key: 'profit_or_loss',
          label: 'Profit or Loss',
          lines: [
            ...revenueLines,
            this.totalLine('Revenue', revenue.current, revenue.comparative),
            ...costLines,
            this.totalLine('Cost of Sales', costOfSales.current, costOfSales.comparative),
            this.totalLine('Gross Profit', grossProfit.current, grossProfit.comparative),
            ...otherIncomeLines,
            this.totalLine('Other Income', otherIncome.current, otherIncome.comparative),
            ...operatingExpenseLines,
            ...depreciationLines,
            this.totalLine('Operating Expenses', operatingExpenses.current, operatingExpenses.comparative),
            this.totalLine('Operating Profit', operatingProfit.current, operatingProfit.comparative),
            ...financeIncomeLines,
            this.totalLine('Finance Income', financeIncome.current, financeIncome.comparative),
            ...financeCostLines,
            this.totalLine('Finance Costs', financeCosts.current, financeCosts.comparative),
            this.totalLine('Profit Before Tax', profitBeforeTax.current, profitBeforeTax.comparative),
            ...taxLines,
            this.totalLine('Income Tax', incomeTax.current, incomeTax.comparative),
            this.totalLine('Profit After Tax', profitAfterTax.current, profitAfterTax.comparative),
          ],
        },
        {
          key: 'oci',
          label: 'Other Comprehensive Income',
          lines: [
            ...ociLines,
            this.totalLine('Other Comprehensive Income', oci.current, oci.comparative),
            this.totalLine(
              'Total Comprehensive Income',
              totalComprehensiveIncome.current,
              totalComprehensiveIncome.comparative,
            ),
          ],
        },
      ],
    };
  }

  private buildFinancialPositionPayload(
    context: Awaited<ReturnType<ReportsService['getReportContext']>>,
    snapshots: AccountSnapshot[],
    warnings: string[],
  ): FinancialStatementPayload {
    const assetNonCurrent = this.accountLines(snapshots, ['ASSET_NONCURRENT'], 'closing');
    const assetCurrent = this.accountLines(snapshots, CURRENT_ASSET_CATEGORIES, 'closing');
    const liabilityNonCurrent = this.accountLines(snapshots, ['LIABILITY_NONCURRENT'], 'closing');
    const liabilityCurrent = this.accountLines(snapshots, ['LIABILITY_CURRENT'], 'closing');
    const shareCapital = this.accountLines(snapshots, ['EQUITY_SHARE_CAPITAL'], 'closing');
    const retainedEarnings = this.accountLines(snapshots, ['EQUITY_RETAINED_EARNINGS'], 'closing');
    const reserves = this.accountLines(snapshots, ['EQUITY_RESERVE'], 'closing');

    const nonCurrentAssets = this.sumLines(assetNonCurrent);
    const currentAssets = this.sumLines(assetCurrent);
    const totalAssets = this.combineSums(nonCurrentAssets, currentAssets);
    const totalEquity = this.combineSums(
      this.sumLines(shareCapital),
      this.sumLines(retainedEarnings),
      this.sumLines(reserves),
    );
    const totalLiabilities = this.combineSums(
      this.sumLines(liabilityCurrent),
      this.sumLines(liabilityNonCurrent),
    );
    const currentDifference = totalAssets.current - totalEquity.current - totalLiabilities.current;
    const comparativeDifference =
      totalAssets.comparative - totalEquity.comparative - totalLiabilities.comparative;

    if (Math.abs(currentDifference) > 0.5 || Math.abs(comparativeDifference) > 0.5) {
      warnings.push(
        'Statement of Financial Position does not currently balance. Review unmapped accounts, retained earnings mapping, and company filters.',
      );
    }

    return {
      report: 'financial_statement',
      statement: 'financial-position',
      title: 'Statement of Financial Position',
      company: context.company,
      branch: context.branch,
      currency: context.currency,
      period: context.period,
      warnings,
      validation: {
        assetsEqualEquityAndLiabilities: Math.abs(currentDifference) < 0.5,
        currentDifference,
        comparativeDifference,
      },
      sections: [
        {
          key: 'assets',
          label: 'Assets',
          lines: [
            this.infoLine('Non-current assets'),
            ...assetNonCurrent,
            this.totalLine('Total Non-current Assets', nonCurrentAssets.current, nonCurrentAssets.comparative),
            this.infoLine('Current assets'),
            ...assetCurrent,
            this.totalLine('Total Current Assets', currentAssets.current, currentAssets.comparative),
            this.totalLine('Total Assets', totalAssets.current, totalAssets.comparative),
          ],
        },
        {
          key: 'equity_and_liabilities',
          label: 'Equity and Liabilities',
          lines: [
            this.infoLine('Equity'),
            ...shareCapital,
            ...retainedEarnings,
            ...reserves,
            this.totalLine('Total Equity', totalEquity.current, totalEquity.comparative),
            this.infoLine('Non-current liabilities'),
            ...liabilityNonCurrent,
            this.totalLine(
              'Total Non-current Liabilities',
              this.sumLines(liabilityNonCurrent).current,
              this.sumLines(liabilityNonCurrent).comparative,
            ),
            this.infoLine('Current liabilities'),
            ...liabilityCurrent,
            this.totalLine(
              'Total Current Liabilities',
              this.sumLines(liabilityCurrent).current,
              this.sumLines(liabilityCurrent).comparative,
            ),
            this.totalLine('Total Liabilities', totalLiabilities.current, totalLiabilities.comparative),
            this.totalLine(
              'Total Equity and Liabilities',
              totalEquity.current + totalLiabilities.current,
              totalEquity.comparative + totalLiabilities.comparative,
            ),
          ],
        },
      ],
    };
  }

  private buildCashFlowPayload(
    context: Awaited<ReturnType<ReportsService['getReportContext']>>,
    snapshots: AccountSnapshot[],
    warnings: string[],
  ): FinancialStatementPayload {
    const profitBeforeTax = {
      current:
        this.sumByCategories(snapshots, ['REVENUE'], 'period') -
        this.sumByCategories(snapshots, ['COST_OF_SALES'], 'period') +
        this.sumByCategories(snapshots, ['OTHER_INCOME'], 'period') -
        this.sumByCategories(snapshots, ['OPERATING_EXPENSE', 'DEPRECIATION_AND_AMORTIZATION'], 'period') +
        this.sumByCategories(snapshots, ['FINANCE_INCOME'], 'period') -
        this.sumByCategories(snapshots, ['FINANCE_COST'], 'period'),
      comparative:
        this.sumByCategories(snapshots, ['REVENUE'], 'comparativePeriod') -
        this.sumByCategories(snapshots, ['COST_OF_SALES'], 'comparativePeriod') +
        this.sumByCategories(snapshots, ['OTHER_INCOME'], 'comparativePeriod') -
        this.sumByCategories(
          snapshots,
          ['OPERATING_EXPENSE', 'DEPRECIATION_AND_AMORTIZATION'],
          'comparativePeriod',
        ) +
        this.sumByCategories(snapshots, ['FINANCE_INCOME'], 'comparativePeriod') -
        this.sumByCategories(snapshots, ['FINANCE_COST'], 'comparativePeriod'),
    };
    const depreciation = {
      current: this.sumByCategories(snapshots, ['DEPRECIATION_AND_AMORTIZATION'], 'period'),
      comparative: this.sumByCategories(snapshots, ['DEPRECIATION_AND_AMORTIZATION'], 'comparativePeriod'),
    };
    const receivableMovement = {
      current:
        this.sumByCategories(snapshots, ['RECEIVABLE'], 'closing') -
        this.sumByCategories(snapshots, ['RECEIVABLE'], 'opening'),
      comparative:
        this.sumByCategories(snapshots, ['RECEIVABLE'], 'comparativeClosing') -
        this.sumByCategories(snapshots, ['RECEIVABLE'], 'comparativeOpening'),
    };
    const inventoryMovement = {
      current:
        this.sumByCategories(snapshots, ['INVENTORY'], 'closing') -
        this.sumByCategories(snapshots, ['INVENTORY'], 'opening'),
      comparative:
        this.sumByCategories(snapshots, ['INVENTORY'], 'comparativeClosing') -
        this.sumByCategories(snapshots, ['INVENTORY'], 'comparativeOpening'),
    };
    const liabilityMovement = {
      current:
        this.sumByCategories(snapshots, ['LIABILITY_CURRENT'], 'closing') -
        this.sumByCategories(snapshots, ['LIABILITY_CURRENT'], 'opening'),
      comparative:
        this.sumByCategories(snapshots, ['LIABILITY_CURRENT'], 'comparativeClosing') -
        this.sumByCategories(snapshots, ['LIABILITY_CURRENT'], 'comparativeOpening'),
    };
    const operating = {
      current:
        profitBeforeTax.current +
        depreciation.current -
        receivableMovement.current -
        inventoryMovement.current +
        liabilityMovement.current,
      comparative:
        profitBeforeTax.comparative +
        depreciation.comparative -
        receivableMovement.comparative -
        inventoryMovement.comparative +
        liabilityMovement.comparative,
    };
    const investing = {
      current:
        -(
          this.sumByCategories(snapshots, ['ASSET_NONCURRENT'], 'closing') -
          this.sumByCategories(snapshots, ['ASSET_NONCURRENT'], 'opening')
        ),
      comparative:
        -(
          this.sumByCategories(snapshots, ['ASSET_NONCURRENT'], 'comparativeClosing') -
          this.sumByCategories(snapshots, ['ASSET_NONCURRENT'], 'comparativeOpening')
        ),
    };
    const financing = {
      current:
        (this.sumByCategories(snapshots, ['LIABILITY_NONCURRENT'], 'closing') -
          this.sumByCategories(snapshots, ['LIABILITY_NONCURRENT'], 'opening')) +
        this.sumByCategories(snapshots, ['EQUITY_SHARE_CAPITAL'], 'period') -
        this.sumByCategories(snapshots, ['DIVIDEND'], 'period'),
      comparative:
        (this.sumByCategories(snapshots, ['LIABILITY_NONCURRENT'], 'comparativeClosing') -
          this.sumByCategories(snapshots, ['LIABILITY_NONCURRENT'], 'comparativeOpening')) +
        this.sumByCategories(snapshots, ['EQUITY_SHARE_CAPITAL'], 'comparativePeriod') -
        this.sumByCategories(snapshots, ['DIVIDEND'], 'comparativePeriod'),
    };
    const netIncrease = {
      current: operating.current + investing.current + financing.current,
      comparative: operating.comparative + investing.comparative + financing.comparative,
    };
    const openingCash = {
      current: this.sumByCategories(snapshots, ['CASH_AND_EQUIVALENT'], 'opening'),
      comparative: this.sumByCategories(snapshots, ['CASH_AND_EQUIVALENT'], 'comparativeOpening'),
    };
    const closingCash = {
      current: this.sumByCategories(snapshots, ['CASH_AND_EQUIVALENT'], 'closing'),
      comparative: this.sumByCategories(snapshots, ['CASH_AND_EQUIVALENT'], 'comparativeClosing'),
    };

    if (Math.abs(netIncrease.current - (closingCash.current - openingCash.current)) > 0.5) {
      warnings.push(
        'Cash flow does not fully reconcile to cash balances. Review cash mappings, financing tags, and non-cash adjustments.',
      );
    }

    return {
      report: 'financial_statement',
      statement: 'cash-flow',
      title: 'Statement of Cash Flows',
      company: context.company,
      branch: context.branch,
      currency: context.currency,
      period: context.period,
      warnings,
      validation: {
        cashMovementReconciles:
          Math.abs(netIncrease.current - (closingCash.current - openingCash.current)) < 0.5,
        derivedNetCashMovement: netIncrease.current,
        actualNetCashMovement: closingCash.current - openingCash.current,
      },
      sections: [
        {
          key: 'operating',
          label: 'Operating Activities',
          lines: [
            this.totalLine('Profit Before Tax', profitBeforeTax.current, profitBeforeTax.comparative),
            this.totalLine('Depreciation and amortization', depreciation.current, depreciation.comparative),
            this.totalLine('Movement in receivables', -receivableMovement.current, -receivableMovement.comparative),
            this.totalLine('Movement in inventory', -inventoryMovement.current, -inventoryMovement.comparative),
            this.totalLine('Movement in current liabilities', liabilityMovement.current, liabilityMovement.comparative),
            this.totalLine('Net Cash from Operating Activities', operating.current, operating.comparative),
          ],
        },
        {
          key: 'investing',
          label: 'Investing Activities',
          lines: [this.totalLine('Net Cash used in Investing Activities', investing.current, investing.comparative)],
        },
        {
          key: 'financing',
          label: 'Financing Activities',
          lines: [
            this.totalLine('Net Cash from Financing Activities', financing.current, financing.comparative),
            this.totalLine('Net Increase / (Decrease) in Cash', netIncrease.current, netIncrease.comparative),
            this.totalLine('Opening Cash and Cash Equivalents', openingCash.current, openingCash.comparative),
            this.totalLine('Closing Cash and Cash Equivalents', closingCash.current, closingCash.comparative),
          ],
        },
      ],
    };
  }

  private buildChangesInEquityPayload(
    context: Awaited<ReturnType<ReportsService['getReportContext']>>,
    snapshots: AccountSnapshot[],
    warnings: string[],
  ): FinancialStatementPayload {
    const shareCapitalOpening = this.sumByCategories(snapshots, ['EQUITY_SHARE_CAPITAL'], 'opening');
    const retainedOpening = this.sumByCategories(snapshots, ['EQUITY_RETAINED_EARNINGS'], 'opening');
    const reserveOpening = this.sumByCategories(snapshots, ['EQUITY_RESERVE'], 'opening');
    const shareCapitalClosing = this.sumByCategories(snapshots, ['EQUITY_SHARE_CAPITAL'], 'closing');
    const retainedClosing = this.sumByCategories(snapshots, ['EQUITY_RETAINED_EARNINGS'], 'closing');
    const reserveClosing = this.sumByCategories(snapshots, ['EQUITY_RESERVE'], 'closing');
    const profitForPeriod =
      this.sumByCategories(snapshots, ['REVENUE'], 'period') -
      this.sumByCategories(snapshots, ['COST_OF_SALES'], 'period') +
      this.sumByCategories(snapshots, ['OTHER_INCOME'], 'period') -
      this.sumByCategories(snapshots, ['OPERATING_EXPENSE', 'DEPRECIATION_AND_AMORTIZATION'], 'period') +
      this.sumByCategories(snapshots, ['FINANCE_INCOME'], 'period') -
      this.sumByCategories(snapshots, ['FINANCE_COST'], 'period') -
      this.sumByCategories(snapshots, ['INCOME_TAX'], 'period');
    const oci = this.sumByCategories(snapshots, ['OTHER_COMPREHENSIVE_INCOME'], 'period');
    const dividends = this.sumByCategories(snapshots, ['DIVIDEND'], 'period');

    return {
      report: 'financial_statement',
      statement: 'changes-in-equity',
      title: 'Statement of Changes in Equity',
      company: context.company,
      branch: context.branch,
      currency: context.currency,
      period: context.period,
      warnings,
      validation: { closingEquity: shareCapitalClosing + retainedClosing + reserveClosing },
      sections: [
        {
          key: 'changes_in_equity',
          label: 'Changes in Equity',
          lines: [
            this.totalLine('Opening Share Capital', shareCapitalOpening, 0),
            this.totalLine('Opening Retained Earnings', retainedOpening, 0),
            this.totalLine('Opening Reserves', reserveOpening, 0),
            this.totalLine('Profit for the Period', profitForPeriod, 0),
            this.totalLine('Other Comprehensive Income', oci, 0),
            this.totalLine('Dividends', -dividends, 0),
            this.totalLine('Closing Share Capital', shareCapitalClosing, 0),
            this.totalLine('Closing Retained Earnings', retainedClosing, 0),
            this.totalLine('Closing Reserves', reserveClosing, 0),
            this.totalLine('Closing Equity', shareCapitalClosing + retainedClosing + reserveClosing, 0),
          ],
        },
      ],
    };
  }

  private buildNotesPayload(
    context: Awaited<ReturnType<ReportsService['getReportContext']>>,
    snapshots: AccountSnapshot[],
    warnings: string[],
  ): NotesPayload {
    const unmapped = snapshots
      .filter(
        (snapshot) =>
          !snapshot.category &&
          (Math.abs(snapshot.closingAmount) > 0.0001 || Math.abs(snapshot.periodAmount) > 0.0001),
      )
      .map((snapshot) => ({
        code: snapshot.code,
        account: snapshot.account,
        current: snapshot.closingAmount,
        comparative: snapshot.comparativeClosingAmount,
      }));

    return {
      report: 'financial_statement',
      statement: 'notes',
      title: 'Notes and Supporting Schedules',
      company: context.company,
      branch: context.branch,
      currency: context.currency,
      period: context.period,
      warnings,
      validation: { unmappedAccounts: unmapped.length },
      sections: [
        {
          key: 'notes_summary',
          label: 'Notes Summary',
          lines: [
            this.infoLine('Supporting schedules are derived directly from posted ledger balances.'),
            this.totalLine('Unmapped accounts', unmapped.length, 0),
          ],
        },
      ],
      schedules: [
        { title: 'Unmapped accounts', rows: unmapped },
        { title: 'Cash and cash equivalents', rows: this.scheduleRows(snapshots, ['CASH_AND_EQUIVALENT']) },
        { title: 'Receivables', rows: this.scheduleRows(snapshots, ['RECEIVABLE']) },
        { title: 'Inventory', rows: this.scheduleRows(snapshots, ['INVENTORY']) },
        { title: 'Payables and current liabilities', rows: this.scheduleRows(snapshots, ['LIABILITY_CURRENT']) },
      ],
    };
  }

  private scheduleRows(snapshots: AccountSnapshot[], categories: readonly string[]) {
    return snapshots
      .filter((snapshot) => snapshot.category && categories.includes(snapshot.category))
      .map((snapshot) => ({
        code: snapshot.code,
        account: snapshot.account,
        current: snapshot.closingAmount,
        comparative: snapshot.comparativeClosingAmount,
      }));
  }

  private flattenFinancialStatement(payload: FinancialStatementPayload) {
    if ('schedules' in payload) {
      const notesPayload = payload as NotesPayload;
      return notesPayload.schedules.flatMap((schedule) =>
        schedule.rows.map((row) => ({
          schedule: schedule.title,
          code: row.code,
          account: row.account,
          current: row.current,
          comparative: row.comparative,
        })),
      );
    }

    return payload.sections.flatMap((section) =>
      section.lines.map((line) => ({
        section: section.label,
        label: line.label,
        current: line.current,
        comparative: line.comparative,
        code: line.code ?? '',
        kind: line.kind ?? 'account',
      })),
    );
  }

  private totalLine(label: string, current: number, comparative: number): FinancialStatementLine {
    return { label, current, comparative, kind: 'total' };
  }

  private infoLine(label: string): FinancialStatementLine {
    return { label, current: 0, comparative: 0, kind: 'info' };
  }

  private sumLines(lines: FinancialStatementLine[]) {
    return lines.reduce(
      (sum, line) => ({ current: sum.current + line.current, comparative: sum.comparative + line.comparative }),
      { current: 0, comparative: 0 },
    );
  }

  private combineSums(...parts: Array<{ current: number; comparative: number }>) {
    return parts.reduce(
      (sum, part) => ({ current: sum.current + part.current, comparative: sum.comparative + part.comparative }),
      { current: 0, comparative: 0 },
    );
  }

  private accountLines(
    snapshots: AccountSnapshot[],
    categories: readonly string[],
    mode: 'period' | 'closing',
  ) {
    return snapshots
      .filter((snapshot) => snapshot.category && categories.includes(snapshot.category))
      .filter(
        (snapshot) =>
          Math.abs(mode === 'period' ? snapshot.periodAmount : snapshot.closingAmount) > 0.0001 ||
          Math.abs(mode === 'period' ? snapshot.comparativePeriodAmount : snapshot.comparativeClosingAmount) > 0.0001,
      )
      .sort((left, right) => left.code.localeCompare(right.code))
      .map((snapshot) => ({
        label: snapshot.account,
        current: mode === 'period' ? snapshot.periodAmount : snapshot.closingAmount,
        comparative: mode === 'period' ? snapshot.comparativePeriodAmount : snapshot.comparativeClosingAmount,
        depth: 1,
        kind: 'account' as const,
        code: snapshot.code,
        category: snapshot.category,
      }));
  }

  private sumByCategories(
    snapshots: AccountSnapshot[],
    categories: readonly string[],
    mode: 'opening' | 'period' | 'closing' | 'comparativeOpening' | 'comparativePeriod' | 'comparativeClosing',
  ) {
    return snapshots
      .filter((snapshot) => snapshot.category && categories.includes(snapshot.category))
      .reduce((sum, snapshot) => {
        if (mode === 'opening') return sum + snapshot.openingAmount;
        if (mode === 'period') return sum + snapshot.periodAmount;
        if (mode === 'closing') return sum + snapshot.closingAmount;
        if (mode === 'comparativeOpening') return sum + snapshot.comparativeOpeningAmount;
        if (mode === 'comparativePeriod') return sum + snapshot.comparativePeriodAmount;
        return sum + snapshot.comparativeClosingAmount;
      }, 0);
  }

  private async buildAccountSnapshots(query: ReportQueryDto): Promise<AccountSnapshot[]> {
    const currentRange = this.resolvePrimaryRange(query);
    const comparativeRange = this.resolveComparativeRange(
      currentRange.from,
      currentRange.to,
      query.compareFrom,
      query.compareTo,
    );

    const [accounts, openingLines, currentLines, closingLines, comparativeOpeningLines, comparativeLines, comparativeClosingLines] =
      await Promise.all([
        this.prisma.account.findMany({ orderBy: { code: 'asc' } }),
        this.getJournalLines(undefined, this.dayBefore(currentRange.from), query),
        this.getJournalLines(currentRange.from, currentRange.to, query),
        this.getJournalLines(undefined, currentRange.to, query),
        this.getJournalLines(undefined, this.dayBefore(comparativeRange.from), query),
        this.getJournalLines(comparativeRange.from, comparativeRange.to, query),
        this.getJournalLines(undefined, comparativeRange.to, query),
      ]);

    const openingMap = this.aggregateByAccount(openingLines);
    const currentMap = this.aggregateByAccount(currentLines);
    const closingMap = this.aggregateByAccount(closingLines);
    const comparativeOpeningMap = this.aggregateByAccount(comparativeOpeningLines);
    const comparativeMap = this.aggregateByAccount(comparativeLines);
    const comparativeClosingMap = this.aggregateByAccount(comparativeClosingLines);

    return accounts.map((account) => {
      const opening = openingMap.get(account.id) ?? { debit: 0, credit: 0 };
      const current = currentMap.get(account.id) ?? { debit: 0, credit: 0 };
      const closing = closingMap.get(account.id) ?? { debit: 0, credit: 0 };
      const comparativeOpening = comparativeOpeningMap.get(account.id) ?? { debit: 0, credit: 0 };
      const comparative = comparativeMap.get(account.id) ?? { debit: 0, credit: 0 };
      const comparativeClosing = comparativeClosingMap.get(account.id) ?? { debit: 0, credit: 0 };

      return {
        accountId: account.id,
        code: account.code,
        account: account.name,
        type: account.type,
        category: account.financialStatementCategory ?? null,
        openingAmount: this.normalBalance(account.type, opening.debit, opening.credit),
        periodAmount: this.normalBalance(account.type, current.debit, current.credit),
        closingAmount: this.normalBalance(account.type, closing.debit, closing.credit),
        comparativeOpeningAmount: this.normalBalance(account.type, comparativeOpening.debit, comparativeOpening.credit),
        comparativePeriodAmount: this.normalBalance(account.type, comparative.debit, comparative.credit),
        comparativeClosingAmount: this.normalBalance(account.type, comparativeClosing.debit, comparativeClosing.credit),
      };
    });
  }

  private async getReportContext(query: ReportQueryDto) {
    const company = query.companyId
      ? await this.prisma.company.findUnique({ where: { id: query.companyId } })
      : null;
    const branch = query.branchId
      ? await this.prisma.branch.findUnique({ where: { id: query.branchId } })
      : null;
    const currency = company?.currencyId
      ? (await this.prisma.currency.findUnique({ where: { id: company.currencyId } }))?.code ?? 'NGN'
      : 'NGN';

    return {
      company: { id: company?.id ?? branch?.companyId ?? null, name: company?.name ?? 'All companies' },
      branch: { id: branch?.id ?? null, name: branch?.name ?? null },
      currency,
      period: {
        from: query.from ?? null,
        to: query.to ?? null,
        compareFrom: query.compareFrom ?? null,
        compareTo: query.compareTo ?? null,
      },
    };
  }

  private getReportingWarnings(snapshots: AccountSnapshot[]) {
    const warnings: string[] = [];
    const unmapped = snapshots.filter(
      (snapshot) =>
        !snapshot.category &&
        (Math.abs(snapshot.periodAmount) > 0.0001 || Math.abs(snapshot.closingAmount) > 0.0001),
    );
    if (unmapped.length > 0) {
      warnings.push(`${unmapped.length} account(s) with activity or balance are not mapped to financial statement categories.`);
    }
    return warnings;
  }

  private makeRatio(
    category: string,
    name: string,
    numerator: number,
    denominator: number,
    formula: string,
    percentage: boolean,
  ): RatioResult {
    if (!Number.isFinite(denominator) || Math.abs(denominator) < 0.000001) {
      return {
        category,
        name,
        value: null,
        formattedValue: 'Unavailable',
        formula,
        interpretation: 'Cannot compute this ratio until the required mapped balances exist.',
        status: 'warning',
      };
    }

    const value = numerator / denominator;
    return {
      category,
      name,
      value,
      formattedValue: percentage ? `${(value * 100).toFixed(2)}%` : value.toFixed(2),
      formula,
      interpretation: this.interpretRatio(name, value),
      status: 'ok',
    };
  }

  private interpretRatio(name: string, value: number) {
    if (name === 'Current ratio' || name === 'Quick ratio') {
      return value >= 1
        ? 'Liquidity cover is currently above 1.00x.'
        : 'Liquidity cover is below 1.00x and should be reviewed.';
    }
    if (name === 'Debt to equity') {
      return value <= 1.5 ? 'Leverage is within a moderate range.' : 'Leverage is elevated relative to equity.';
    }
    if (name === 'Interest coverage') {
      return value >= 2
        ? 'Operating profit covers finance costs comfortably.'
        : 'Interest cover is thin and needs monitoring.';
    }
    if (name.includes('margin') || name.includes('Return')) {
      return value >= 0
        ? 'The ratio is positive for the reporting period.'
        : 'The ratio is negative for the reporting period.';
    }
    return value >= 1
      ? 'Turnover is above 1.00x for the selected period.'
      : 'Turnover is below 1.00x for the selected period.';
  }

  private resolvePrimaryRange(query: ReportQueryDto) {
    const to = this.parseDate(query.to, true) ?? new Date();
    const from = this.parseDate(query.from, false) ?? new Date(to.getFullYear(), 0, 1);
    return { from, to };
  }

  private resolveComparativeRange(from: Date, to: Date, compareFrom?: string, compareTo?: string) {
    const explicitFrom = this.parseDate(compareFrom, false);
    const explicitTo = this.parseDate(compareTo, true);
    if (explicitFrom && explicitTo) {
      return { from: explicitFrom, to: explicitTo };
    }

    const duration = to.getTime() - from.getTime();
    const previousTo = this.dayBefore(from);
    const previousFrom = new Date(previousTo.getTime() - duration);
    previousFrom.setHours(0, 0, 0, 0);
    return { from: previousFrom, to: previousTo };
  }

  private async getJournalLines(from: Date | undefined, to: Date | undefined, query: ReportQueryDto) {
    return this.prisma.journalLine.findMany({
      where: {
        ...(query.branchId ? { branchId: query.branchId } : {}),
        ...(query.companyId ? { branch: { companyId: query.companyId } } : {}),
        entry: {
          date: {
            ...(from ? { gte: from } : {}),
            ...(to ? { lte: to } : {}),
          },
        },
      },
      include: {
        account: true,
      },
    });
  }

  private aggregateByAccount(lines: Array<{ accountId: number; debit: unknown; credit: unknown }>) {
    const grouped = new Map<number, BalanceSums>();
    for (const line of lines) {
      const current = grouped.get(line.accountId) ?? { debit: 0, credit: 0 };
      current.debit += Number(line.debit);
      current.credit += Number(line.credit);
      grouped.set(line.accountId, current);
    }
    return grouped;
  }

  private normalBalance(type: string, debit: number, credit: number) {
    return BS_NORMAL_TYPES.has(type.toUpperCase()) ? debit - credit : credit - debit;
  }

  private dayBefore(date: Date) {
    const previous = new Date(date);
    previous.setDate(previous.getDate() - 1);
    previous.setHours(23, 59, 59, 999);
    return previous;
  }

  private average(previous: number, current: number) {
    if (!previous && !current) {
      return 0;
    }
    return (previous + current) / 2;
  }

  private async getTrialBalanceRows(query: ReportQueryDto): Promise<TrialBalanceRow[]> {
    const fromDate = this.parseDate(query.from, false);
    const toDate = this.parseDate(query.to, true);

    const periodLines = await this.prisma.journalLine.findMany({
      where: {
        ...(query.branchId ? { branchId: query.branchId } : {}),
        ...(query.companyId ? { branch: { companyId: query.companyId } } : {}),
        entry: {
          date: {
            gte: fromDate,
            lte: toDate,
          },
        },
      },
      include: {
        account: true,
      },
      orderBy: [{ account: { code: 'asc' } }, { id: 'asc' }],
    });

    const openingLines = fromDate
      ? await this.prisma.journalLine.findMany({
          where: {
            ...(query.branchId ? { branchId: query.branchId } : {}),
            ...(query.companyId ? { branch: { companyId: query.companyId } } : {}),
            entry: {
              date: {
                lt: fromDate,
              },
            },
          },
          include: {
            account: true,
          },
          orderBy: [{ account: { code: 'asc' } }, { id: 'asc' }],
        })
      : [];

    const grouped = new Map<number, TrialBalanceRow>();
    for (const line of openingLines) {
      const current = grouped.get(line.accountId) ?? {
        code: line.account.code,
        account: line.account.name,
        type: line.account.type,
        openingDebit: 0,
        openingCredit: 0,
        periodDebit: 0,
        periodCredit: 0,
        closingDebit: 0,
        closingCredit: 0,
      };
      const openingNet = this.rowNet(current.openingDebit, current.openingCredit) + Number(line.debit) - Number(line.credit);
      current.openingDebit = openingNet > 0 ? openingNet : 0;
      current.openingCredit = openingNet < 0 ? Math.abs(openingNet) : 0;
      grouped.set(line.accountId, current);
    }

    for (const line of periodLines) {
      const current = grouped.get(line.accountId) ?? {
        code: line.account.code,
        account: line.account.name,
        type: line.account.type,
        openingDebit: 0,
        openingCredit: 0,
        periodDebit: 0,
        periodCredit: 0,
        closingDebit: 0,
        closingCredit: 0,
      };
      current.periodDebit += Number(line.debit);
      current.periodCredit += Number(line.credit);
      grouped.set(line.accountId, current);
    }

    const accounts = await this.prisma.account.findMany({ orderBy: { code: 'asc' } });
    return accounts.map((account) => {
      const current = grouped.get(account.id) ?? {
        code: account.code,
        account: account.name,
        type: account.type,
        openingDebit: 0,
        openingCredit: 0,
        periodDebit: 0,
        periodCredit: 0,
        closingDebit: 0,
        closingCredit: 0,
      };
      const closingNet =
        this.rowNet(current.openingDebit, current.openingCredit) +
        current.periodDebit -
        current.periodCredit;

      return {
        ...current,
        closingDebit: closingNet > 0 ? closingNet : 0,
        closingCredit: closingNet < 0 ? Math.abs(closingNet) : 0,
      };
    });
  }

  private async getAccountStatementSummaryRows(query: ReportQueryDto): Promise<StatementSummaryRow[]> {
    const lines = await this.prisma.journalLine.findMany({
      where: {
        ...(query.branchId ? { branchId: query.branchId } : {}),
        ...(query.companyId ? { branch: { companyId: query.companyId } } : {}),
        entry: {
          date: {
            gte: this.parseDate(query.from, false),
            lte: this.parseDate(query.to, true),
          },
        },
      },
      include: {
        account: true,
        entry: true,
      },
      orderBy: [{ account: { code: 'asc' } }, { entry: { date: 'asc' } }],
    });

    const grouped = new Map<number, StatementSummaryRow>();
    for (const line of lines) {
      const current = grouped.get(line.accountId) ?? {
        code: line.account.code,
        account: line.account.name,
        type: line.account.type,
        debit: 0,
        credit: 0,
        balance: 0,
        entries: 0,
        lastActivity: null,
      };
      current.debit += Number(line.debit);
      current.credit += Number(line.credit);
      current.balance = current.debit - current.credit;
      current.entries += 1;
      current.lastActivity = line.entry.date.toISOString();
      grouped.set(line.accountId, current);
    }

    return [...grouped.values()];
  }

  private async getAccountStatementRows(query: AccountStatementQueryDto): Promise<StatementDetailRow[]> {
    const fromDate = this.parseDate(query.from, false);
    const toDate = this.parseDate(query.to, true);
    const lines = await this.prisma.journalLine.findMany({
      where: {
        accountId: query.accountId,
        ...(query.branchId ? { branchId: query.branchId } : {}),
        ...(query.companyId ? { branch: { companyId: query.companyId } } : {}),
        entry: {
          date: {
            gte: fromDate,
            lte: toDate,
          },
        },
      },
      include: {
        entry: true,
      },
      orderBy: [{ entry: { date: 'asc' } }, { id: 'asc' }],
    });

    const openingAggregate = fromDate
      ? await this.prisma.journalLine.aggregate({
          where: {
            accountId: query.accountId,
            ...(query.branchId ? { branchId: query.branchId } : {}),
            ...(query.companyId ? { branch: { companyId: query.companyId } } : {}),
            entry: {
              date: {
                lt: fromDate,
              },
            },
          },
          _sum: {
            debit: true,
            credit: true,
          },
        })
      : null;

    let runningBalance =
      Number(openingAggregate?._sum.debit ?? 0) - Number(openingAggregate?._sum.credit ?? 0);

    const rows: StatementDetailRow[] = [];
    if (fromDate) {
      rows.push({
        date: fromDate.toISOString(),
        reference: 'OPENING',
        description: 'Opening Balance',
        memo: 'Balance before selected date range',
        debit: 0,
        credit: 0,
        runningBalance,
      });
    }

    rows.push(...lines.map((line) => {
      runningBalance += Number(line.debit) - Number(line.credit);
      return {
        date: line.entry.date.toISOString(),
        reference: line.entry.reference,
        description: line.entry.description ?? line.entry.type,
        memo: line.memo ?? '',
        debit: Number(line.debit),
        credit: Number(line.credit),
        runningBalance,
      };
    }));

    return rows;
  }

  private sumFinancialRows(rows: Array<{ debit: number; credit: number; balance?: number }>) {
    const debit = rows.reduce((sum, row) => sum + row.debit, 0);
    const credit = rows.reduce((sum, row) => sum + row.credit, 0);
    return {
      debit,
      credit,
      balance: rows.reduce((sum, row) => sum + (row.balance ?? 0), 0),
    };
  }

  private sumTrialBalanceRows(rows: TrialBalanceRow[]) {
    return {
      openingDebit: rows.reduce((sum, row) => sum + row.openingDebit, 0),
      openingCredit: rows.reduce((sum, row) => sum + row.openingCredit, 0),
      periodDebit: rows.reduce((sum, row) => sum + row.periodDebit, 0),
      periodCredit: rows.reduce((sum, row) => sum + row.periodCredit, 0),
      closingDebit: rows.reduce((sum, row) => sum + row.closingDebit, 0),
      closingCredit: rows.reduce((sum, row) => sum + row.closingCredit, 0),
    };
  }

  private rowNet(debit: number, credit: number) {
    return debit - credit;
  }

  private parseDate(value?: string, endOfDay?: boolean) {
    if (!value) {
      return undefined;
    }
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      return undefined;
    }
    if (endOfDay) {
      date.setHours(23, 59, 59, 999);
    } else {
      date.setHours(0, 0, 0, 0);
    }
    return date;
  }

  private async respondWithFormat(
    res: Response,
    format: ReportFormat,
    baseFilename: string,
    payload: Record<string, unknown>,
    rows: unknown[],
  ) {
    if (format === 'json') {
      return payload;
    }

    if (format === 'csv') {
      const csv = this.toCsv(rows);
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="${baseFilename}.csv"`);
      res.send(csv);
      return;
    }

    if (format === 'xlsx') {
      const worksheet = XLSX.utils.json_to_sheet(rows as XLSX.JSON2SheetOpts[]);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Report');
      const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename="${baseFilename}.xlsx"`);
      res.send(buffer);
      return;
    }

    if (format === 'pdf') {
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="${baseFilename}.pdf"`);
      const pdf = new PDFDocument({ margin: 40, size: 'A4' });
      pdf.pipe(res);
      if (payload.report === 'trial_balance') {
        this.renderTrialBalancePdf(pdf, payload as {
          from?: string | null;
          asOf?: string;
          rows: TrialBalanceRow[];
          totals: {
            openingDebit: number;
            openingCredit: number;
            periodDebit: number;
            periodCredit: number;
            closingDebit: number;
            closingCredit: number;
          };
        });
      } else if (payload.report === 'financial_statement') {
        this.renderFinancialStatementPdf(pdf, payload as FinancialStatementPayload);
      } else if (payload.report === 'ratio_analysis') {
        this.renderRatioPdf(pdf, payload as RatioAnalysisPayload);
      } else {
        pdf.fontSize(18).text(String(payload.report ?? 'Report').replace(/_/g, ' ').toUpperCase());
        pdf.moveDown(0.6);
        pdf.fontSize(10).fillColor('#52657b').text(`Generated: ${new Date().toLocaleString()}`);
        pdf.moveDown(0.8);
        pdf.fillColor('#17212b');
        const previewRows = rows.slice(0, 40) as Array<Record<string, unknown>>;
        if (previewRows.length === 0) {
          pdf.fontSize(11).text('No rows available for this report.');
        } else {
          for (const row of previewRows) {
            pdf.fontSize(10).text(Object.entries(row).map(([key, value]) => `${key}: ${value ?? ''}`).join(' | '));
            pdf.moveDown(0.2);
          }
        }
      }
      pdf.end();
      return;
    }

    return payload;
  }

  private toCsv(rows: unknown[]) {
    const normalized = rows as Array<Record<string, unknown>>;
    if (normalized.length === 0) {
      return '';
    }
    const headers = Object.keys(normalized[0]);
    const escapeCell = (value: unknown) => {
      const text = String(value ?? '');
      if (text.includes(',') || text.includes('"') || text.includes('\n')) {
        return `"${text.replace(/"/g, '""')}"`;
      }
      return text;
    };
    return [
      headers.join(','),
      ...normalized.map((row) => headers.map((header) => escapeCell(row[header])).join(',')),
    ].join('\n');
  }

  private renderFinancialStatementPdf(pdf: PDFKit.PDFDocument, payload: FinancialStatementPayload) {
    pdf.fontSize(18).fillColor('#17212b').text(payload.title);
    pdf.moveDown(0.3);
    pdf.fontSize(10).fillColor('#52657b').text(
      `${payload.company.name}${payload.branch.name ? ` • ${payload.branch.name}` : ''}`,
    );
    pdf.text(`Period: ${payload.period.from ?? 'Beginning'} to ${payload.period.to ?? 'Current date'}`);
    pdf.text(`Currency: ${payload.currency}`);
    pdf.moveDown(0.6);

    for (const section of payload.sections) {
      pdf.fontSize(12).fillColor('#173d92').text(section.label);
      pdf.moveDown(0.2);
      for (const line of section.lines) {
        if (pdf.y > 730) {
          pdf.addPage();
        }
        pdf.fontSize(line.kind === 'total' ? 10.5 : 9.5).fillColor(line.kind === 'info' ? '#52657b' : '#17212b');
        const label = `${line.code ? `${line.code} ` : ''}${line.label}`;
        pdf.text(label, 40, pdf.y, { continued: true, width: 300 });
        pdf.text(this.pdfMoney(line.current), 360, pdf.y, {
          width: 80,
          align: 'right',
          continued: true,
        });
        pdf.text(this.pdfMoney(line.comparative), 455, pdf.y, { width: 80, align: 'right' });
        pdf.moveDown(0.2);
      }
      pdf.moveDown(0.4);
    }

    if (payload.warnings.length > 0) {
      pdf.addPage();
      pdf.fontSize(12).fillColor('#8c4b00').text('Warnings');
      pdf.moveDown(0.4);
      for (const warning of payload.warnings) {
        pdf.fontSize(10).fillColor('#17212b').text(`- ${warning}`);
        pdf.moveDown(0.2);
      }
    }
  }

  private renderRatioPdf(pdf: PDFKit.PDFDocument, payload: RatioAnalysisPayload) {
    pdf.fontSize(18).fillColor('#17212b').text('Financial Ratio Analysis');
    pdf.moveDown(0.3);
    pdf.fontSize(10).fillColor('#52657b').text(
      `${payload.company.name}${payload.branch.name ? ` • ${payload.branch.name}` : ''}`,
    );
    pdf.text(`Period: ${payload.period.from ?? 'Beginning'} to ${payload.period.to ?? 'Current date'}`);
    pdf.moveDown(0.6);

    for (const ratio of payload.ratios) {
      pdf.fontSize(10.5).fillColor('#17212b').text(`${ratio.category} • ${ratio.name}`);
      pdf.fontSize(10).fillColor('#173d92').text(ratio.formattedValue);
      pdf.fontSize(9).fillColor('#52657b').text(ratio.formula);
      pdf.fontSize(9).fillColor('#17212b').text(ratio.interpretation);
      pdf.moveDown(0.5);
    }
  }

  private renderTrialBalancePdf(
    pdf: PDFKit.PDFDocument,
    payload: {
      from?: string | null;
      asOf?: string;
      rows: TrialBalanceRow[];
      totals: {
        openingDebit: number;
        openingCredit: number;
        periodDebit: number;
        periodCredit: number;
        closingDebit: number;
        closingCredit: number;
      };
    },
  ) {
    pdf.fontSize(18).fillColor('#17212b').text('TRIAL BALANCE');
    pdf.moveDown(0.4);
    pdf.fontSize(10).fillColor('#52657b').text(
      `From: ${payload.from ?? 'Beginning'}   To: ${payload.asOf ?? new Date().toISOString().slice(0, 10)}`,
    );
    pdf.moveDown(0.8);

    const startX = 40;
    const columns = [
      { key: 'code', label: 'Code', x: startX, width: 48 },
      { key: 'account', label: 'Account', x: 92, width: 120 },
      { key: 'openingDebit', label: 'Open Dr', x: 220, width: 52 },
      { key: 'openingCredit', label: 'Open Cr', x: 276, width: 52 },
      { key: 'periodDebit', label: 'Move Dr', x: 332, width: 52 },
      { key: 'periodCredit', label: 'Move Cr', x: 388, width: 52 },
      { key: 'closingDebit', label: 'Close Dr', x: 444, width: 52 },
      { key: 'closingCredit', label: 'Close Cr', x: 500, width: 52 },
    ] as const;

    const drawHeader = () => {
      const y = pdf.y;
      pdf.fontSize(9).fillColor('#17212b');
      for (const column of columns) {
        pdf.text(column.label, column.x, y, { width: column.width, align: column.key === 'account' ? 'left' : 'right' });
      }
      pdf.moveDown(1.2);
      pdf.moveTo(startX, pdf.y).lineTo(555, pdf.y).strokeColor('#cfd7e3').stroke();
      pdf.moveDown(0.4);
    };

    drawHeader();

    let currentType = '';
    for (const row of payload.rows) {
      if (pdf.y > 730) {
        pdf.addPage();
        drawHeader();
      }

      if (row.type !== currentType) {
        currentType = row.type;
        pdf.fontSize(9).fillColor('#173d92').text(currentType, startX, pdf.y, { width: 200 });
        pdf.moveDown(0.4);
      }

      const y = pdf.y;
      pdf.fontSize(8.5).fillColor('#17212b');
      pdf.text(row.code, columns[0].x, y, { width: columns[0].width });
      pdf.text(row.account, columns[1].x, y, { width: columns[1].width });
      pdf.text(this.pdfMoney(row.openingDebit), columns[2].x, y, { width: columns[2].width, align: 'right' });
      pdf.text(this.pdfMoney(row.openingCredit), columns[3].x, y, { width: columns[3].width, align: 'right' });
      pdf.text(this.pdfMoney(row.periodDebit), columns[4].x, y, { width: columns[4].width, align: 'right' });
      pdf.text(this.pdfMoney(row.periodCredit), columns[5].x, y, { width: columns[5].width, align: 'right' });
      pdf.text(this.pdfMoney(row.closingDebit), columns[6].x, y, { width: columns[6].width, align: 'right' });
      pdf.text(this.pdfMoney(row.closingCredit), columns[7].x, y, { width: columns[7].width, align: 'right' });
      pdf.moveDown(0.9);
    }

    pdf.moveDown(0.6);
    pdf.moveTo(startX, pdf.y).lineTo(555, pdf.y).strokeColor('#9fb0c8').stroke();
    pdf.moveDown(0.4);
    const totalY = pdf.y;
    pdf.fontSize(9).fillColor('#17212b').text('Totals', columns[0].x, totalY, { width: 172 });
    pdf.text(this.pdfMoney(payload.totals.openingDebit), columns[2].x, totalY, { width: columns[2].width, align: 'right' });
    pdf.text(this.pdfMoney(payload.totals.openingCredit), columns[3].x, totalY, { width: columns[3].width, align: 'right' });
    pdf.text(this.pdfMoney(payload.totals.periodDebit), columns[4].x, totalY, { width: columns[4].width, align: 'right' });
    pdf.text(this.pdfMoney(payload.totals.periodCredit), columns[5].x, totalY, { width: columns[5].width, align: 'right' });
    pdf.text(this.pdfMoney(payload.totals.closingDebit), columns[6].x, totalY, { width: columns[6].width, align: 'right' });
    pdf.text(this.pdfMoney(payload.totals.closingCredit), columns[7].x, totalY, { width: columns[7].width, align: 'right' });
  }

  private pdfMoney(value: number) {
    return value === 0 ? '-' : value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }
}
