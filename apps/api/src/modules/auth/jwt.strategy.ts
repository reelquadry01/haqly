import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { normalizeRoleName } from '../../config/roles';
import type { AccessTokenPayload } from '../../lib/tokens';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(cfg: ConfigService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: cfg.get<string>('accessToken.secret'),
    });
  }

  async validate(payload: AccessTokenPayload) {
    return {
      userId: Number(payload.userId),
      email: payload.email ?? '',
      role: normalizeRoleName(payload.role),
      roles: [payload.role],
    };
  }
}
