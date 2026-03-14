import { Body, Controller, Get, Param, ParseIntPipe, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import { JournalsService } from './journals.service';
import {
  ApproveJournalDto,
  CancelJournalDto,
  CreateJournalDto,
  CreateRecurringJournalTemplateDto,
  GenerateRecurringJournalDto,
  ListJournalsQueryDto,
  RejectJournalDto,
  ReverseJournalDto,
  UpdateJournalDto,
  ValidateJournalDto,
} from './dto';
import { JwtAuthGuard } from '../auth/jwt.guard';
import { PermissionsGuard } from '../auth/permissions.guard';
import { RequirePermissions } from '../auth/permissions.decorator';
import { RequireRole, RolesGuard } from '../../middleware/rbac';

type RequestUser = { userId?: number; email?: string };

@UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
@RequireRole('ADMIN', 'FINANCE')
@Controller({ path: 'journals', version: '1' })
export class JournalsController {
  constructor(private readonly journalsService: JournalsService) {}

  @Get()
  @RequirePermissions('accounting:journal')
  list(@Query() query: ListJournalsQueryDto) {
    return this.journalsService.list(query);
  }

  @Get('metadata/options')
  @RequirePermissions('accounting:journal')
  metadata(@Query('legalEntityId', ParseIntPipe) legalEntityId: number) {
    return this.journalsService.getMetadata(legalEntityId);
  }

  @Post()
  @RequirePermissions('accounting:journal')
  createDraft(@Body() dto: CreateJournalDto, @Req() req: { user?: RequestUser; ip?: string; headers?: Record<string, string> }) {
    return this.journalsService.createDraft(dto, req.user ?? {}, {
      ipAddress: req.ip,
      deviceInfo: req.headers?.['user-agent'],
    });
  }

  @Patch(':id')
  @RequirePermissions('accounting:journal')
  updateDraft(
    @Param('id') id: string,
    @Body() dto: UpdateJournalDto,
    @Req() req: { user?: RequestUser; ip?: string; headers?: Record<string, string> },
  ) {
    return this.journalsService.updateDraft(Number(id), dto, req.user ?? {}, {
      ipAddress: req.ip,
      deviceInfo: req.headers?.['user-agent'],
    });
  }

  @Post(':id/validate')
  @RequirePermissions('accounting:journal')
  validate(@Param('id') id: string, @Body() dto: ValidateJournalDto) {
    return this.journalsService.validate(Number(id), dto);
  }

  @Post(':id/submit')
  @RequirePermissions('accounting:journal')
  submit(@Param('id') id: string, @Req() req: { user?: RequestUser; ip?: string; headers?: Record<string, string> }) {
    return this.journalsService.submit(Number(id), req.user ?? {}, {
      ipAddress: req.ip,
      deviceInfo: req.headers?.['user-agent'],
    });
  }

  @Post(':id/recall')
  @RequirePermissions('accounting:journal')
  recall(@Param('id') id: string, @Req() req: { user?: RequestUser; ip?: string; headers?: Record<string, string> }) {
    return this.journalsService.recall(Number(id), req.user ?? {}, {
      ipAddress: req.ip,
      deviceInfo: req.headers?.['user-agent'],
    });
  }

  @Post(':id/approve')
  @RequirePermissions('accounting:journal')
  approve(
    @Param('id') id: string,
    @Body() dto: ApproveJournalDto,
    @Req() req: { user?: RequestUser; ip?: string; headers?: Record<string, string> },
  ) {
    return this.journalsService.approve(Number(id), dto, req.user ?? {}, {
      ipAddress: req.ip,
      deviceInfo: req.headers?.['user-agent'],
    });
  }

  @Post(':id/reject')
  @RequirePermissions('accounting:journal')
  reject(
    @Param('id') id: string,
    @Body() dto: RejectJournalDto,
    @Req() req: { user?: RequestUser; ip?: string; headers?: Record<string, string> },
  ) {
    return this.journalsService.reject(Number(id), dto, req.user ?? {}, {
      ipAddress: req.ip,
      deviceInfo: req.headers?.['user-agent'],
    });
  }

  @Post(':id/post')
  @RequirePermissions('accounting:journal')
  post(@Param('id') id: string, @Req() req: { user?: RequestUser; ip?: string; headers?: Record<string, string> }) {
    return this.journalsService.post(Number(id), req.user ?? {}, {
      ipAddress: req.ip,
      deviceInfo: req.headers?.['user-agent'],
    });
  }

  @Post(':id/reverse')
  @RequirePermissions('accounting:journal')
  reverse(
    @Param('id') id: string,
    @Body() dto: ReverseJournalDto,
    @Req() req: { user?: RequestUser; ip?: string; headers?: Record<string, string> },
  ) {
    return this.journalsService.reverse(Number(id), dto, req.user ?? {}, {
      ipAddress: req.ip,
      deviceInfo: req.headers?.['user-agent'],
    });
  }

  @Post(':id/cancel')
  @RequirePermissions('accounting:journal')
  cancel(
    @Param('id') id: string,
    @Body() dto: CancelJournalDto,
    @Req() req: { user?: RequestUser; ip?: string; headers?: Record<string, string> },
  ) {
    return this.journalsService.cancel(Number(id), dto, req.user ?? {}, {
      ipAddress: req.ip,
      deviceInfo: req.headers?.['user-agent'],
    });
  }

  @Get('templates/all')
  @RequirePermissions('accounting:journal')
  listTemplates() {
    return this.journalsService.listTemplates();
  }

  @Post('templates')
  @RequirePermissions('accounting:journal')
  createTemplate(@Body() dto: CreateRecurringJournalTemplateDto, @Req() req: { user?: RequestUser }) {
    return this.journalsService.createTemplate(dto, req.user ?? {});
  }

  @Post('templates/:id/generate')
  @RequirePermissions('accounting:journal')
  generateFromTemplate(
    @Param('id') id: string,
    @Body() dto: GenerateRecurringJournalDto,
    @Req() req: { user?: RequestUser; ip?: string; headers?: Record<string, string> },
  ) {
    return this.journalsService.generateFromTemplate(Number(id), dto, req.user ?? {}, {
      ipAddress: req.ip,
      deviceInfo: req.headers?.['user-agent'],
    });
  }

  @Get(':id')
  @RequirePermissions('accounting:journal')
  getById(@Param('id') id: string) {
    return this.journalsService.getById(Number(id));
  }
}

