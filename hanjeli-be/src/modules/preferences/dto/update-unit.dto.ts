import { ApiProperty } from '@nestjs/swagger';
import { IsIn, IsNotEmpty, IsString, MaxLength } from 'class-validator';
import { MEASUREMENT_UNIT_OPTIONS } from '../../../common/constants/domain.constants.js';

export class UpdateUnitDto {
  @ApiProperty({ enum: Object.keys(MEASUREMENT_UNIT_OPTIONS), example: 'soil_temperature' })
  @IsNotEmpty()
  @IsIn(Object.keys(MEASUREMENT_UNIT_OPTIONS))
  parameter_key!: string;

  @ApiProperty({ example: '°C', maxLength: 20 })
  @IsNotEmpty()
  @IsString()
  @MaxLength(20)
  unit_value!: string;
}
