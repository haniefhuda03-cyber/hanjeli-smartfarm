import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsIn, IsOptional } from 'class-validator';

export class UpdatePreferenceDto {
  @ApiPropertyOptional({ enum: ['id', 'en'], example: 'id' })
  @IsOptional()
  @IsIn(['id', 'en'])
  language?: string;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  notifications_enabled?: boolean;
}
