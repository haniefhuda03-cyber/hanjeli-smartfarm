import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEmail,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';
import { USER_ROLES } from '../../../common/constants/domain.constants.js';
import {
  PASSWORD_MAX_LENGTH,
  PASSWORD_MIN_LENGTH,
  PASSWORD_POLICY_MESSAGE,
  PASSWORD_POLICY_REGEX,
} from '../../../common/constants/password.constants.js';

export class CreateUserDto {
  @ApiProperty({ example: 'Admin Kebun', maxLength: 100 })
  @IsNotEmpty()
  @IsString()
  @MaxLength(100)
  name!: string;

  @ApiProperty({ example: 'admin@example.com', maxLength: 255 })
  @IsNotEmpty()
  @IsEmail()
  @MaxLength(255)
  email!: string;

  @ApiProperty({ example: 'StrongPass123', minLength: 8, maxLength: 72 })
  @IsNotEmpty()
  @IsString()
  @MinLength(PASSWORD_MIN_LENGTH)
  @MaxLength(PASSWORD_MAX_LENGTH)
  @Matches(PASSWORD_POLICY_REGEX, { message: PASSWORD_POLICY_MESSAGE })
  password!: string;

  @ApiPropertyOptional({ enum: USER_ROLES, example: 'Guest' })
  @IsOptional()
  @IsIn(USER_ROLES)
  role?: string;
}
