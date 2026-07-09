import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';

export class DeleteAccountDto {
  @ApiPropertyOptional({
    description: 'Account password (required for accounts that have one)',
  })
  @IsOptional()
  @IsString()
  @MaxLength(72)
  password?: string;

  @ApiPropertyOptional({
    description: '6-digit TOTP code (required when 2FA is enabled)',
  })
  @IsOptional()
  @IsString()
  @MaxLength(10)
  twoFactorToken?: string;
}
