import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { PaginationDto } from '../../../common/dto/pagination.dto.js';

export const IRRIGATION_MODES = ['auto', 'manual', 'scheduled', 'off'] as const;
export const IRRIGATION_AUTO_PARAMETERS = [
  'soil_moisture',
  'ph',
  'soil_temperature',
  'soil_nitrogen',
  'soil_phosphorus',
  'soil_potassium',
] as const;
export const IRRIGATION_THRESHOLD_DIRECTIONS = ['below', 'above'] as const;
export const IRRIGATION_SCHEDULED_BEHAVIORS = ['manual', 'auto'] as const;

const TIME_PATTERN = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]:[0-5][0-9]$/;

export class UpdateIrrigationConfigDto {
  @ApiPropertyOptional({ enum: IRRIGATION_MODES, example: 'auto' })
  @IsOptional()
  @IsIn(IRRIGATION_MODES)
  active_mode?: (typeof IRRIGATION_MODES)[number];

  @ApiPropertyOptional({ example: false })
  @IsOptional()
  @IsBoolean()
  emergency_stop?: boolean;

  @ApiPropertyOptional({
    enum: IRRIGATION_AUTO_PARAMETERS,
    example: 'soil_moisture',
  })
  @IsOptional()
  @IsIn(IRRIGATION_AUTO_PARAMETERS)
  auto_parameter?: (typeof IRRIGATION_AUTO_PARAMETERS)[number];

  @ApiPropertyOptional({ example: 40, minimum: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  auto_threshold_value?: number;

  @ApiPropertyOptional({
    enum: IRRIGATION_THRESHOLD_DIRECTIONS,
    example: 'below',
  })
  @IsOptional()
  @IsIn(IRRIGATION_THRESHOLD_DIRECTIONS)
  auto_threshold_direction?: (typeof IRRIGATION_THRESHOLD_DIRECTIONS)[number];

  @ApiPropertyOptional({
    example: 30,
    minimum: 0,
    maximum: 100,
    description:
      'Minimum soil moisture percentage before water irrigation turns on.',
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(100)
  water_min_threshold?: number;

  @ApiPropertyOptional({
    example: 80,
    minimum: 0,
    maximum: 100,
    description:
      'Maximum soil moisture percentage before water irrigation turns off.',
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(100)
  water_max_threshold?: number;

  @ApiPropertyOptional({
    example: 60,
    minimum: 0,
    description:
      'Minimum soil NPK value before nutrition status is considered low.',
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  npk_min_threshold?: number;

  @ApiPropertyOptional({
    example: 180,
    minimum: 0,
    description:
      'Maximum soil NPK value before nutrition status is considered high.',
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  npk_max_threshold?: number;

  @ApiPropertyOptional({ example: 20, minimum: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  nitrogen_min_threshold?: number;

  @ApiPropertyOptional({ example: 60, minimum: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  nitrogen_max_threshold?: number;

  @ApiPropertyOptional({ example: 20, minimum: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  phosphorus_min_threshold?: number;

  @ApiPropertyOptional({ example: 60, minimum: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  phosphorus_max_threshold?: number;

  @ApiPropertyOptional({ example: 20, minimum: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  potassium_min_threshold?: number;

  @ApiPropertyOptional({ example: 60, minimum: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  potassium_max_threshold?: number;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  manual_water_enabled?: boolean;

  @ApiPropertyOptional({ example: false })
  @IsOptional()
  @IsBoolean()
  manual_fertilizer_enabled?: boolean;

  @ApiPropertyOptional({ example: 80, minimum: 0, maximum: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(100)
  manual_speed?: number;

  @ApiPropertyOptional({ example: 100, minimum: 0, maximum: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(100)
  fertilizer_manual_speed?: number;

  @ApiPropertyOptional({
    enum: IRRIGATION_SCHEDULED_BEHAVIORS,
    example: 'manual',
  })
  @IsOptional()
  @IsIn(IRRIGATION_SCHEDULED_BEHAVIORS)
  scheduled_behavior?: (typeof IRRIGATION_SCHEDULED_BEHAVIORS)[number];
}

export class CreateIrrigationScheduleDto {
  @ApiProperty({ example: 'Pagi hari', maxLength: 100 })
  @IsNotEmpty()
  @IsString()
  @MaxLength(100)
  name!: string;

  @ApiProperty({ example: true })
  @IsBoolean()
  mon!: boolean;

  @ApiProperty({ example: true })
  @IsBoolean()
  tue!: boolean;

  @ApiProperty({ example: true })
  @IsBoolean()
  wed!: boolean;

  @ApiProperty({ example: true })
  @IsBoolean()
  thu!: boolean;

  @ApiProperty({ example: true })
  @IsBoolean()
  fri!: boolean;

  @ApiProperty({ example: false })
  @IsBoolean()
  sat!: boolean;

  @ApiProperty({ example: false })
  @IsBoolean()
  sun!: boolean;

  @ApiProperty({ example: '06:00:00', pattern: TIME_PATTERN.source })
  @Matches(TIME_PATTERN, {
    message: 'start_time must be a valid time in HH:mm:ss format',
  })
  start_time!: string;

  @ApiProperty({ example: '06:30:00', pattern: TIME_PATTERN.source })
  @Matches(TIME_PATTERN, {
    message: 'end_time must be a valid time in HH:mm:ss format',
  })
  end_time!: string;

  @ApiPropertyOptional({ example: true, default: true })
  @IsOptional()
  @IsBoolean()
  active?: boolean;
}

export class UpdateIrrigationScheduleDto extends PartialType(
  CreateIrrigationScheduleDto,
) {}

export class IrrigationActivityQueryDto extends PaginationDto {}
