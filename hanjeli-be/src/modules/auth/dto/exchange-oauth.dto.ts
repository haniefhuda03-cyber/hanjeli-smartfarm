import { IsNotEmpty, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class ExchangeOauthDto {
  @ApiProperty({ description: 'Kode pertukaran OAuth' })
  @IsString()
  @IsNotEmpty()
  exchange_code!: string;
}
