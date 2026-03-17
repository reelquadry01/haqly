import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(cfg: ConfigService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: cfg.get<string>('ACCESS_TOKEN_SECRET'),
    });
  }

  async validate(payload: any) {
    return {
      id: payload.userId ?? payload.sub ?? payload.id,
      userId: payload.userId ?? payload.sub ?? payload.id,
      email: payload.email,
      role: payload.role,
      companyId: payload.companyId ?? null,
    };
  }
}
