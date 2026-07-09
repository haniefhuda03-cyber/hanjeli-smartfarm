import { ApiProperty } from '@nestjs/swagger';
import { IsString, Matches } from 'class-validator';

export class EnableTotpDto {
  @ApiProperty({ example: '123456', description: 'Kode TOTP 6 digit' })
  @IsString()
  @Matches(/^\d{6}$/)
  token!: string;
}
