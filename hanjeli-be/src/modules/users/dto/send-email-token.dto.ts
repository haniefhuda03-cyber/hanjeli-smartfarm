import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty, MaxLength } from 'class-validator';

export class SendEmailTokenDto {
  @ApiProperty({ example: 'newuser@example.com', maxLength: 255 })
  @IsNotEmpty()
  @IsEmail()
  @MaxLength(255)
  newEmail!: string;
}
