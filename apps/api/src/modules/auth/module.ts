import { Global, Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtStrategy } from './jwt.strategy';
import { PermissionsService } from './permissions.service';
import { PermissionsGuard } from './permissions.guard';
import { RolesGuard } from '../../middleware/rbac';
import { JwtAuthGuard } from '../../middleware/auth';

@Global()
@Module({
  imports: [
    ConfigModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (cfg: ConfigService) => ({
        secret: cfg.get<string>('ACCESS_TOKEN_SECRET'),
        signOptions: { expiresIn: cfg.get<string>('accessToken.expiresIn') },
      }),
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, JwtStrategy, PermissionsService, PermissionsGuard, RolesGuard, JwtAuthGuard],
  exports: [JwtModule, JwtStrategy, PermissionsService, PermissionsGuard, RolesGuard, JwtAuthGuard],
})
export class AuthModule {}

