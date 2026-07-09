import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEmail,
  IsOptional,
  IsString,
  IsUrl,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';
import {
  PASSWORD_MAX_LENGTH,
  PASSWORD_MIN_LENGTH,
  PASSWORD_POLICY_MESSAGE,
  PASSWORD_POLICY_REGEX,
} from '../../../common/constants/password.constants.js';

export class UpdateProfileDto {
  @ApiPropertyOptional({ example: 'Haniefu Fuda', maxLength: 100 })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  name?: string;

  @ApiPropertyOptional({ example: 'user@example.com', maxLength: 255 })
  @IsOptional()
  @IsEmail()
  @MaxLength(255)
  email?: string;

  @ApiPropertyOptional({ example: '123456', maxLength: 6 })
  @IsOptional()
  @IsString()
  @MaxLength(6)
  emailToken?: string;

  @ApiPropertyOptional({
    example: 'NewStrongPass123',
    minLength: 8,
    maxLength: 72,
  })
  @IsOptional()
  @IsString()
  @MinLength(PASSWORD_MIN_LENGTH)
  @MaxLength(PASSWORD_MAX_LENGTH)
  @Matches(PASSWORD_POLICY_REGEX, { message: PASSWORD_POLICY_MESSAGE })
  password?: string;

  @ApiPropertyOptional({
    example: 'CurrentPass123',
    description:
      'Required when changing the password of an account that has one',
  })
  @IsOptional()
  @IsString()
  @MaxLength(72)
  currentPassword?: string;

  @ApiPropertyOptional({
    example: 'https://example.com/avatar.webp',
    maxLength: 500,
  })
  @IsOptional()
  @IsString()
  @IsUrl(
    { require_protocol: true },
    { message: 'avatar_url harus berupa URL valid' },
  )
  @MaxLength(500)
  avatar_url?: string;
}
