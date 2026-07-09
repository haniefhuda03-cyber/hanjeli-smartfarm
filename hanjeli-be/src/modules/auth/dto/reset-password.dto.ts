import { ApiProperty } from '@nestjs/swagger';
import { IsString, Matches, MaxLength, MinLength } from 'class-validator';
import {
  PASSWORD_MAX_LENGTH,
  PASSWORD_MIN_LENGTH,
  PASSWORD_POLICY_MESSAGE,
  PASSWORD_POLICY_REGEX,
} from '../../../common/constants/password.constants.js';

export class ResetPasswordDto {
  @ApiProperty({ example: 'opaque-reset-token-from-email', minLength: 32 })
  @IsString()
  @MinLength(32)
  @MaxLength(256)
  token!: string;

  @ApiProperty({ example: 'NewStrongPass123', minLength: 8, maxLength: 72 })
  @IsString()
  @MinLength(PASSWORD_MIN_LENGTH)
  @MaxLength(PASSWORD_MAX_LENGTH)
  @Matches(PASSWORD_POLICY_REGEX, { message: PASSWORD_POLICY_MESSAGE })
  new_password!: string;
}
