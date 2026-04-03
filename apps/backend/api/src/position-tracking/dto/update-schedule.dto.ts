import { IsString, IsIn } from 'class-validator';

export class UpdateScheduleDto {
  @IsString()
  @IsIn(['NONE', 'DAILY', 'WEEKLY', 'MONTHLY'])
  schedule: 'NONE' | 'DAILY' | 'WEEKLY' | 'MONTHLY';
}
