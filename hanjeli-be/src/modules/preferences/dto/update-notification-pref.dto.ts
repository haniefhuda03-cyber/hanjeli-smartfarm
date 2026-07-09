import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean, IsIn, IsNotEmpty } from 'class-validator';
import {
  NOTIFICATION_CHANNELS,
  NOTIFICATION_PREF_CATEGORIES,
} from '../../../common/constants/domain.constants.js';

export class UpdateNotificationPrefDto {
  @ApiProperty({ enum: NOTIFICATION_PREF_CATEGORIES, example: 'sensor' })
  @IsNotEmpty()
  @IsIn(NOTIFICATION_PREF_CATEGORIES)
  category!: string;

  @ApiProperty({ enum: NOTIFICATION_CHANNELS, example: 'push' })
  @IsNotEmpty()
  @IsIn(NOTIFICATION_CHANNELS)
  channel!: string;

  @ApiProperty({ example: true })
  @IsNotEmpty()
  @IsBoolean()
  enabled!: boolean;
}
