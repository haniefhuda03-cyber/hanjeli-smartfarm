import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty, IsString, MaxLength, MinLength } from 'class-validator';

export class VerifyEmailTokenDto {
  @ApiProperty({ example: 'newuser@example.com', maxLength: 255 })
  @IsNotEmpty()
  @IsEmail()
  @MaxLength(255)
  newEmail!: string;

  @ApiProperty({ example: '123456', minLength: 6, maxLength: 6 })
  @IsNotEmpty()
  @IsString()
  @MinLength(6)
  @MaxLength(6)
  token!: string;
}
