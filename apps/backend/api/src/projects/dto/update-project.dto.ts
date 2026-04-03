import { IsString, IsOptional, MaxLength, IsBoolean } from 'class-validator';

export class UpdateProjectDto {
  @IsString()
  @IsOptional()
  @MaxLength(100)
  name?: string;

  @IsString()
  @IsOptional()
  @MaxLength(50)
  timezone?: string;

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}
