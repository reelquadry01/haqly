import { IsEmail, IsOptional, IsString, MinLength } from 'class-validator';

export class RegisterDto {
  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(8)
  password!: string;

  @IsOptional()
  @IsString()
  firstName?: string;

  @IsOptional()
  @IsString()
  lastName?: string;

  @IsOptional()
  @IsString()
  role?: string;
}

export class LoginDto {
  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(8)
  password!: string;
}

// ─── MFA DTOs ─────────────────────────────────────────────────────────────────

export class MfaVerifyDto {
  token!: string; // 6-digit TOTP code from authenticator app
}

export class MfaDisableDto {
  token!: string; // Must verify current TOTP before disabling
  password!: string; // Must also confirm password
}