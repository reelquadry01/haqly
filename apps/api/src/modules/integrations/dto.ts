import { IsBoolean, IsInt, IsObject, IsOptional, IsString, MinLength } from 'class-validator';

export class CreateIntegrationDto {
  @IsInt()
  companyId!: number;

  @IsString()
  @MinLength(1)
  provider!: string;

  @IsOptional()
  @IsString()
  label?: string;

  @IsOptional()
  @IsObject()
  config?: Record<string, unknown>;
}

export class UpdateIntegrationDto {
  @IsOptional()
  @IsString()
  label?: string;

  @IsOptional()
  @IsObject()
  config?: Record<string, unknown>;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
