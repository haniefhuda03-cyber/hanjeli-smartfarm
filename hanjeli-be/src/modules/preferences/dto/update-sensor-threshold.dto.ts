import { ApiProperty } from '@nestjs/swagger';
import { IsIn, IsNotEmpty, IsNumber } from 'class-validator';
import { THRESHOLD_PARAMETER_KEYS } from '../../../common/constants/domain.constants.js';

export class UpdateSensorThresholdDto {
  @ApiProperty({ enum: THRESHOLD_PARAMETER_KEYS, example: 'soil_moisture' })
  @IsNotEmpty()
  @IsIn(THRESHOLD_PARAMETER_KEYS)
  parameter_key!: string;

  @ApiProperty({ example: 30 })
  @IsNotEmpty()
  @IsNumber()
  min_value!: number;

  @ApiProperty({ example: 70 })
  @IsNotEmpty()
  @IsNumber()
  max_value!: number;
}
