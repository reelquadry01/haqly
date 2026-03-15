import {
  Body,
  Controller,
  Get,
  HttpCode,
  Post,
  Req,
  Res,
  UsePipes,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { AuthService } from './auth.service';
import { LoginDto, RegisterDto, MfaVerifyDto, MfaDisableDto } from './auth.dto';
import { validate } from '../../middleware/validate';
import { userCreationSchema } from '../../schemas/user.schema';
import { Public } from '../../middleware/public';
import { getRequestIp } from '../../middleware/auth';

const refreshCookieOptions = {
  httpOnly: true,
  sameSite: 'lax' as const,
  secure: process.env.NODE_ENV === 'production',
  maxAge: 7 * 24 * 60 * 60 * 1000,
  path: '/api/v1/auth',
};

@Controller({ path: 'auth', version: '1' })
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Public()
  @Post('register')
  @UsePipes(validate(userCreationSchema))
  async register(@Body() dto: RegisterDto, @Req() req: Request, @Res({ passthrough: true }) res: Response) {
    try {
      const result = await this.auth.register(dto, getRequestIp(req));
      res.cookie('refreshToken', result.refreshToken, refreshCookieOptions);
      const { refreshToken, ...payload } = result;
      return payload;
    } catch (error) {
      throw error;
    }
  }

  @Public()
  @Post('login')
  @HttpCode(200)
  async login(@Body() dto: LoginDto, @Req() req: Request, @Res({ passthrough: true }) res: Response) {
    try {
      const result = await this.auth.login(dto, getRequestIp(req));
      res.cookie('refreshToken', result.refreshToken, refreshCookieOptions);
      const { refreshToken, ...payload } = result;
      return payload;
    } catch (error) {
      throw error;
    }
  }

  @Public()
  @Post('refresh')
  @HttpCode(200)
  async refresh(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    try {
      const currentRefreshToken = req.cookies?.refreshToken as string | undefined;
      const result = await this.auth.refresh(currentRefreshToken ?? '');
      res.cookie('refreshToken', result.refreshToken, refreshCookieOptions);
      const { refreshToken, ...payload } = result;
      return payload;
    } catch (error) {
      throw error;
    }
  }

  @Post('logout')
  @HttpCode(200)
  async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    try {
      const currentRefreshToken = req.cookies?.refreshToken as string | undefined;
      const result = await this.auth.logout(currentRefreshToken);
      res.clearCookie('refreshToken', refreshCookieOptions);
      return result;
    } catch (error) {
      throw error;
    }
  }


  // ─── MFA Routes ───────────────────────────────────────────────────────────────

  @Get('mfa/status')
  async mfaStatus(@Req() req: Request) {
    const user = req.user as { userId: number };
    return this.auth.mfaStatus(user.userId);
  }

  @Post('mfa/setup')
  @HttpCode(200)
  async mfaSetup(@Req() req: Request) {
    const user = req.user as { userId: number };
    return this.auth.mfaSetup(user.userId);
  }

  @Post('mfa/activate')
  @HttpCode(200)
  async mfaActivate(@Req() req: Request, @Body() dto: MfaVerifyDto) {
    const user = req.user as { userId: number };
    return this.auth.mfaActivate(user.userId, dto.token);
  }

  @Post('mfa/disable')
  @HttpCode(200)
  async mfaDisable(@Req() req: Request, @Body() dto: MfaDisableDto) {
    const user = req.user as { userId: number };
    return this.auth.mfaDisable(user.userId, dto.token, dto.password);
  }
}