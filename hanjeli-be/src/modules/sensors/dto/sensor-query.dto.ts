import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsDateString,
  IsIn,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';
import { PaginationDto } from '../../../common/dto/pagination.dto.js';

export const SENSOR_QUERY_PARAMS = [
  'ph',
  'ph_level',
  'soil_moisture',
  'soil_nitrogen',
  'soil_phosphorus',
  'soil_potassium',
  'soil_temperature',
] as const;

export const SENSOR_RANGE_OPTIONS = ['day', 'week', 'month'] as const;

export class SensorTrendQueryDto {
  @ApiPropertyOptional({
    enum: SENSOR_QUERY_PARAMS,
    example: 'ph',
    default: 'ph',
  })
  @IsIn(SENSOR_QUERY_PARAMS)
  param: (typeof SENSOR_QUERY_PARAMS)[number] = 'ph';

  @ApiPropertyOptional({
    enum: SENSOR_RANGE_OPTIONS,
    example: 'day',
    default: 'day',
  })
  @IsIn(SENSOR_RANGE_OPTIONS)
  range: (typeof SENSOR_RANGE_OPTIONS)[number] = 'day';

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  device_id?: string;
}

export class SensorHistoryQueryDto extends PaginationDto {
  @ApiPropertyOptional({ example: '2026-06-09T00:00:00.000Z' })
  @IsOptional()
  @IsDateString()
  from?: string;

  @ApiPropertyOptional({ example: '2026-06-09T23:59:59.000Z' })
  @IsOptional()
  @IsDateString()
  to?: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  device_id?: string;

  @ApiPropertyOptional({ enum: ['csv'], example: 'csv' })
  @IsOptional()
  @IsIn(['csv'])
  format?: 'csv';
}

/**
 * Query ekspor CSV. Selain filter riwayat, frontend mengirim label hasil i18n
 * (bahasa yang dipilih pengguna) agar isi file — header kolom, label status,
 * label kondisi — mengikuti bahasa aktif. Backend tidak menyimpan teks bahasa.
 */
export class SensorExportQueryDto extends SensorHistoryQueryDto {
  @ApiPropertyOptional({
    description: 'Baris header CSV (sudah diterjemahkan & digabung koma di FE)',
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  header?: string;

  @ApiPropertyOptional({ description: 'Label status: kondisi aman/optimal' })
  @IsOptional()
  @IsString()
  @MaxLength(60)
  statusOptimal?: string;

  @ApiPropertyOptional({ description: 'Label status: perlu perhatian' })
  @IsOptional()
  @IsString()
  @MaxLength(60)
  statusWarning?: string;

  @ApiPropertyOptional({ description: 'Label status: bahaya' })
  @IsOptional()
  @IsString()
  @MaxLength(60)
  statusDanger?: string;

  @ApiPropertyOptional({ description: 'Label status: data tidak tersedia' })
  @IsOptional()
  @IsString()
  @MaxLength(60)
  statusNoData?: string;

  @ApiPropertyOptional({ description: 'Label kondisi: hujan' })
  @IsOptional()
  @IsString()
  @MaxLength(60)
  conditionRain?: string;

  @ApiPropertyOptional({ description: 'Label kondisi: tidak hujan' })
  @IsOptional()
  @IsString()
  @MaxLength(60)
  conditionNoRain?: string;
}
