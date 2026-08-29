import { BadRequestException, Controller, Get, Param, Res, UseGuards } from '@nestjs/common';
import type { Response } from 'express';
import { JwtAuthGuard } from '../../middleware/auth';
import { StorageService } from '../../storage/storage.service';

@UseGuards(JwtAuthGuard)
@Controller({ path: 'files', version: '1' })
export class FilesController {
  constructor(private readonly storage: StorageService) {}

  /**
   * Redirects to a short-lived signed URL for a stored object.
   *
   * Attachments are financial records, so the bucket itself stays private —
   * this route is the only way in, and it sits behind the same auth as the
   * voucher the file belongs to.
   */
  @Get(':key(*)')
  async download(@Param('key') key: string, @Res() res: Response) {
    const safeKey = this.assertSafeKey(key);
    const url = await this.storage.signedUrl(safeKey);
    return res.redirect(302, url);
  }

  private assertSafeKey(key: string): string {
    const decoded = decodeURIComponent(key ?? '').replace(/^\/+/, '');

    // Keys are generated server-side, so anything with traversal or a scheme in
    // it was crafted by the caller.
    if (!decoded || decoded.includes('..') || decoded.includes('\0') || /^[a-z]+:\/\//i.test(decoded)) {
      throw new BadRequestException('Invalid file key.');
    }

    return decoded;
  }
}
