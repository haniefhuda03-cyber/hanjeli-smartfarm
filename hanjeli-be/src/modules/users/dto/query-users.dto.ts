import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';
import { USER_ROLES } from '../../../common/constants/domain.constants.js';
import { PaginationDto } from '../../../common/dto/pagination.dto.js';

export class QueryUsersDto extends PaginationDto {
  @ApiPropertyOptional({ example: 'admin', maxLength: 100 })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  q?: string;

  @ApiPropertyOptional({ enum: USER_ROLES, example: 'Guest' })
  @IsOptional()
  @IsIn(USER_ROLES)
  role?: string;
}
