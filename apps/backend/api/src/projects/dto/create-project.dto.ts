import { IsString, IsOptional, MaxLength, IsEnum } from 'class-validator';

export class CreateProjectDto {
  @IsString()
  @MaxLength(255)
  domain: string;

  @IsString()
  @MaxLength(100)
  name: string;

  @IsString()
  @IsOptional()
  @MaxLength(50)
  timezone?: string;

  @IsEnum(['MANUAL', 'WORDPRESS', 'GITHUB'])
  @IsOptional()
  sourceType?: 'MANUAL' | 'WORDPRESS' | 'GITHUB';
}
