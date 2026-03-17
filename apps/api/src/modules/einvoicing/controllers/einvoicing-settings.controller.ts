import { Body, Controller, Get, Param, ParseIntPipe, Patch, Post } from '@nestjs/common';
import { EInvoicingSettingsService } from '../services/einvoicing-settings.service';
import { UpsertEInvoiceProfileDto } from '../dto/upsert-einvoice-profile.dto';
import { SaveEInvoiceCredentialsDto } from '../dto/save-einvoice-credentials.dto';

@Controller('einvoicing')
export class EInvoicingSettingsController {
  constructor(private readonly settingsService: EInvoicingSettingsService) {}

  @Get('profile/:companyId')
  getProfile(@Param('companyId', ParseIntPipe) companyId: number) {
    return this.settingsService.getProfile(companyId);
  }

  @Post('profile')
  upsertProfile(@Body() dto: UpsertEInvoiceProfileDto) {
    return this.settingsService.upsertProfile(dto);
  }

  @Patch('profile/:companyId')
  patchProfile(
    @Param('companyId', ParseIntPipe) companyId: number,
    @Body() dto: UpsertEInvoiceProfileDto,
  ) {
    return this.settingsService.upsertProfile({
      ...dto,
      companyId,
    });
  }

  @Post('credentials')
  saveCredentials(@Body() dto: SaveEInvoiceCredentialsDto) {
    return this.settingsService.saveCredentials(dto);
  }

  @Get('credentials/status/:companyId')
  getCredentialStatus(@Param('companyId', ParseIntPipe) companyId: number) {
    return this.settingsService.getCredentialStatus(companyId);
  }

  @Get('readiness/:companyId')
  getReadiness(@Param('companyId', ParseIntPipe) companyId: number) {
    return this.settingsService.getReadiness(companyId);
  }

  @Get('health')
  health() {
    return {
      ok: true,
      module: 'einvoicing',
      stage: 'foundation',
    };
  }
}
