import { ApiProperty } from '@nestjs/swagger';
import { IsString, MaxLength, MinLength } from 'class-validator';

export class VerifyEmailDto {
  @ApiProperty({ example: 'opaque-email-verification-token', minLength: 32 })
  @IsString()
  @MinLength(32)
  @MaxLength(256)
  token!: string;
}
