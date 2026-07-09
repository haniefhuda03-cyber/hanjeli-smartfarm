import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional } from 'class-validator';
import { PaginationDto } from '../../../common/dto/pagination.dto.js';

export class QueryNotificationsDto extends PaginationDto {
  @ApiPropertyOptional({ enum: ['true', 'false'], example: 'false' })
  @IsOptional()
  @IsIn(['true', 'false'])
  read?: string;
}
