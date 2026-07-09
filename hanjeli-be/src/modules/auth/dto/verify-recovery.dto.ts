import { ApiProperty } from '@nestjs/swagger';
import { IsJWT, IsString, Matches } from 'class-validator';

export class VerifyRecoveryDto {
  @ApiProperty({ example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...' })
  @IsJWT()
  challenge_token!: string;

  @ApiProperty({
    example: 'ABCD-1234',
    description: 'Recovery code sekali pakai',
  })
  @IsString()
  @Matches(/^[A-F0-9]{4}-[A-F0-9]{4}$/i)
  code!: string;
}
