import { BadRequestException, Controller, Get, Param, Query, Res, UseGuards } from '@nestjs/common';
import type { Response } from 'express';
import { JwtAuthGuard } from '../auth/jwt.guard';
import { PermissionsGuard } from '../auth/permissions.guard';
import { RequirePermissions } from '../auth/permissions.decorator';
import { RequireRole, RolesGuard } from '../../middleware/rbac';
import { ReportsService } from './reports.service';
import {
  AccountStatementQueryDto,
  FinancialStatementKind,
  financialStatementKinds,
  ReportQueryDto,
} from './reports.dto';

@UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
@RequireRole('ADMIN', 'FINANCE', 'VIEWER')
@Controller({ path: 'reports', version: '1' })
export class ReportsController {
  constructor(private readonly reports: ReportsService) {}

  @Get('trial-balance')
  @RequirePermissions('accounting:journal')
  async getTrialBalance(@Query() query: ReportQueryDto, @Res({ passthrough: true }) res: Response) {
    return this.reports.handleTrialBalance(query, res);
  }

  @Get('account-statement-summary')
  @RequirePermissions('accounting:journal')
  async getAccountStatementSummary(@Query() query: ReportQueryDto, @Res({ passthrough: true }) res: Response) {
    return this.reports.handleAccountStatementSummary(query, res);
  }

  @Get('account-statement')
  @RequirePermissions('accounting:journal')
  async getAccountStatement(@Query() query: AccountStatementQueryDto, @Res({ passthrough: true }) res: Response) {
    return this.reports.handleAccountStatement(query, res);
  }

  @Get('financial-statements/:statement')
  @RequirePermissions('accounting:journal')
  async getFinancialStatement(
    @Param('statement') statement: FinancialStatementKind,
    @Query() query: ReportQueryDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    if (!financialStatementKinds.includes(statement)) {
      throw new BadRequestException('Unsupported financial statement type');
    }
    return this.reports.handleFinancialStatement(statement, query, res);
  }

  @Get('ratio-analysis')
  @RequirePermissions('accounting:journal')
  async getRatioAnalysis(@Query() query: ReportQueryDto, @Res({ passthrough: true }) res: Response) {
    return this.reports.handleRatioAnalysis(query, res);
  }
}

