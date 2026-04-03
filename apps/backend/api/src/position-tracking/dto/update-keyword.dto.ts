import { IsString, IsOptional, MaxLength } from 'class-validator';

export class UpdateKeywordDto {
  @IsString()
  @IsOptional()
  @MaxLength(2000)
  targetUrl?: string;
}
