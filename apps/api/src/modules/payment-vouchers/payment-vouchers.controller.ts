import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  Req,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { memoryStorage } from 'multer';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApprovePaymentVoucherDto,
  CancelPaymentVoucherDto,
  CreatePaymentTemplateDto,
  CreatePaymentVoucherDto,
  InitiatePaymentDto,
  ListPaymentVouchersQueryDto,
  MarkVoucherPaidDto,
  RecallPaymentVoucherDto,
  RejectPaymentVoucherDto,
  ReturnPaymentVoucherDto,
  UpdatePaymentVoucherDto,
  ValidatePaymentVoucherDto,
  VoucherCommentDto,
} from './dto';
import { PaymentVouchersService } from './payment-vouchers.service';
import { StorageService } from '../../storage/storage.service';
import { JwtAuthGuard } from '../auth/jwt.guard';
import { PermissionsGuard } from '../auth/permissions.guard';
import { RequirePermissions } from '../auth/permissions.decorator';
import { RequireRole, RolesGuard } from '../../middleware/rbac';

type RequestUser = { userId?: number; email?: string; role?: string; roles?: string[] };

const MAX_ATTACHMENT_BYTES = 15 * 1024 * 1024;

/** The subset of multer's file object this handler uses. */
type UploadedFileInput = { originalname: string; buffer: Buffer; mimetype?: string };

@UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
@RequireRole('ADMIN', 'FINANCE')
@Controller({ path: 'payment-vouchers', version: '1' })
export class PaymentVouchersController {
  constructor(
    private readonly paymentVouchersService: PaymentVouchersService,
    private readonly storage: StorageService,
  ) {}

  @Get()
  @RequirePermissions('accounting:voucher')
  list(@Query() query: ListPaymentVouchersQueryDto) {
    return this.paymentVouchersService.list(query);
  }

  @Get('queue')
  @RequirePermissions('accounting:voucher')
  queue(@Req() req: { user?: RequestUser }) {
    return this.paymentVouchersService.queue(req.user ?? {});
  }

  @Get('metadata/options')
  @RequirePermissions('accounting:voucher')
  metadata(@Query('legalEntityId', ParseIntPipe) legalEntityId: number) {
    return this.paymentVouchersService.getMetadata(legalEntityId);
  }

  @Post()
  @RequirePermissions('accounting:voucher')
  createDraft(@Body() dto: CreatePaymentVoucherDto, @Req() req: { user?: RequestUser; ip?: string; headers?: Record<string, string> }) {
    return this.paymentVouchersService.createDraft(dto, req.user ?? {}, {
      ipAddress: req.ip,
      deviceInfo: req.headers?.['user-agent'],
    });
  }

  @Patch(':id')
  @RequirePermissions('accounting:voucher')
  updateDraft(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdatePaymentVoucherDto, @Req() req: { user?: RequestUser; ip?: string; headers?: Record<string, string> }) {
    return this.paymentVouchersService.updateDraft(id, dto, req.user ?? {}, {
      ipAddress: req.ip,
      deviceInfo: req.headers?.['user-agent'],
    });
  }

  @Post(':id/validate')
  @RequirePermissions('accounting:voucher')
  validate(@Param('id', ParseIntPipe) id: number, @Body() dto: ValidatePaymentVoucherDto) {
    return this.paymentVouchersService.validate(id, dto);
  }

  @Post(':id/submit')
  @RequirePermissions('accounting:voucher')
  submit(@Param('id', ParseIntPipe) id: number, @Req() req: { user?: RequestUser; ip?: string; headers?: Record<string, string> }) {
    return this.paymentVouchersService.submit(id, req.user ?? {}, {
      ipAddress: req.ip,
      deviceInfo: req.headers?.['user-agent'],
    });
  }

  @Post(':id/recall')
  @RequirePermissions('accounting:voucher')
  recall(@Param('id', ParseIntPipe) id: number, @Body() dto: RecallPaymentVoucherDto, @Req() req: { user?: RequestUser; ip?: string; headers?: Record<string, string> }) {
    return this.paymentVouchersService.recall(id, dto, req.user ?? {}, {
      ipAddress: req.ip,
      deviceInfo: req.headers?.['user-agent'],
    });
  }

  @Post(':id/approve')
  @RequirePermissions('accounting:voucher')
  approve(@Param('id', ParseIntPipe) id: number, @Body() dto: ApprovePaymentVoucherDto, @Req() req: { user?: RequestUser; ip?: string; headers?: Record<string, string> }) {
    return this.paymentVouchersService.approve(id, dto, req.user ?? {}, {
      ipAddress: req.ip,
      deviceInfo: req.headers?.['user-agent'],
    });
  }

  @Post(':id/reject')
  @RequirePermissions('accounting:voucher')
  reject(@Param('id', ParseIntPipe) id: number, @Body() dto: RejectPaymentVoucherDto, @Req() req: { user?: RequestUser; ip?: string; headers?: Record<string, string> }) {
    return this.paymentVouchersService.reject(id, dto, req.user ?? {}, {
      ipAddress: req.ip,
      deviceInfo: req.headers?.['user-agent'],
    });
  }

  @Post(':id/return')
  @RequirePermissions('accounting:voucher')
  returnForCorrection(@Param('id', ParseIntPipe) id: number, @Body() dto: ReturnPaymentVoucherDto, @Req() req: { user?: RequestUser; ip?: string; headers?: Record<string, string> }) {
    return this.paymentVouchersService.returnForCorrection(id, dto, req.user ?? {}, {
      ipAddress: req.ip,
      deviceInfo: req.headers?.['user-agent'],
    });
  }

  @Post(':id/post')
  @RequirePermissions('accounting:voucher')
  postToGl(@Param('id', ParseIntPipe) id: number, @Req() req: { user?: RequestUser; ip?: string; headers?: Record<string, string> }) {
    return this.paymentVouchersService.postToGl(id, req.user ?? {}, {
      ipAddress: req.ip,
      deviceInfo: req.headers?.['user-agent'],
    });
  }

  @Post(':id/initiate-payment')
  @RequirePermissions('accounting:voucher')
  initiatePayment(@Param('id', ParseIntPipe) id: number, @Body() dto: InitiatePaymentDto, @Req() req: { user?: RequestUser; ip?: string; headers?: Record<string, string> }) {
    return this.paymentVouchersService.initiatePayment(id, dto, req.user ?? {}, {
      ipAddress: req.ip,
      deviceInfo: req.headers?.['user-agent'],
    });
  }

  @Post(':id/mark-paid')
  @RequirePermissions('accounting:voucher')
  markPaid(@Param('id', ParseIntPipe) id: number, @Body() dto: MarkVoucherPaidDto, @Req() req: { user?: RequestUser; ip?: string; headers?: Record<string, string> }) {
    return this.paymentVouchersService.markAsPaid(id, dto, req.user ?? {}, {
      ipAddress: req.ip,
      deviceInfo: req.headers?.['user-agent'],
    });
  }

  @Post(':id/cancel')
  @RequirePermissions('accounting:voucher')
  cancel(@Param('id', ParseIntPipe) id: number, @Body() dto: CancelPaymentVoucherDto, @Req() req: { user?: RequestUser; ip?: string; headers?: Record<string, string> }) {
    return this.paymentVouchersService.cancel(id, dto, req.user ?? {}, {
      ipAddress: req.ip,
      deviceInfo: req.headers?.['user-agent'],
    });
  }

  @Post(':id/comments')
  @RequirePermissions('accounting:voucher')
  addComment(@Param('id', ParseIntPipe) id: number, @Body() dto: VoucherCommentDto, @Req() req: { user?: RequestUser }) {
    return this.paymentVouchersService.addComment(id, dto, req.user ?? {});
  }

  @Get(':id/preview')
  @RequirePermissions('accounting:voucher')
  preview(@Param('id', ParseIntPipe) id: number) {
    return this.paymentVouchersService.preview(id);
  }

  @Post(':id/attachments/upload')
  @RequirePermissions('accounting:voucher')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: MAX_ATTACHMENT_BYTES },
    }),
  )
  async uploadAttachment(
    @Param('id', ParseIntPipe) id: number,
    @UploadedFile() file: UploadedFileInput | undefined,
    @Req() req: { user?: RequestUser },
  ) {
    if (!file) {
      throw new BadRequestException('No file was uploaded.');
    }

    const stored = await this.storage.put('payment-vouchers', file);

    return this.paymentVouchersService.addAttachment(
      id,
      {
        fileName: file.originalname,
        fileUrl: stored.url,
        mimeType: file.mimetype,
      },
      req.user ?? {},
    );
  }

  @Get('templates/all')
  @RequirePermissions('accounting:voucher')
  listTemplates() {
    return this.paymentVouchersService.listTemplates();
  }

  @Post('templates')
  @RequirePermissions('accounting:voucher')
  createTemplate(@Body() dto: CreatePaymentTemplateDto) {
    return this.paymentVouchersService.createTemplate(dto);
  }

  @Get(':id')
  @RequirePermissions('accounting:voucher')
  getById(@Param('id', ParseIntPipe) id: number) {
    return this.paymentVouchersService.getById(id);
  }
}
