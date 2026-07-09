import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import {
  DEVICE_STATUSES,
  DEVICE_TYPES,
} from '../../../common/constants/domain.constants.js';

export class CreateDeviceDto {
  @ApiProperty({ example: 'Soil Station WS004', maxLength: 200 })
  @IsNotEmpty()
  @IsString()
  @MaxLength(200)
  name!: string;

  @ApiProperty({ example: '#WS004', maxLength: 20 })
  @IsNotEmpty()
  @IsString()
  @MaxLength(20)
  code!: string;

  @ApiProperty({ enum: DEVICE_TYPES, example: 'sensor' })
  @IsNotEmpty()
  @IsIn(DEVICE_TYPES)
  type!: string;

  @ApiPropertyOptional({ enum: DEVICE_STATUSES, example: 'offline' })
  @IsOptional()
  @IsIn(DEVICE_STATUSES)
  status?: string;

  @ApiPropertyOptional({ example: 'Signal lemah sejak 08:02', maxLength: 500 })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  warning_message?: string;
}
