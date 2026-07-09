import { ApiProperty } from '@nestjs/swagger';
import { IsJWT, IsString, Matches } from 'class-validator';

export class VerifyTotpDto {
  @ApiProperty({ example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...' })
  @IsJWT()
  challenge_token!: string;

  @ApiProperty({ example: '123456', description: 'Kode TOTP 6 digit' })
  @IsString()
  @Matches(/^\d{6}$/)
  token!: string;
}
