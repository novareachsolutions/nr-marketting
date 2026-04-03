import { IsString, IsNotEmpty, IsOptional, MaxLength } from 'class-validator';

export class SaveKeywordDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  keyword: string;

  @IsString()
  @IsOptional()
  @MaxLength(2000)
  targetUrl?: string;

  @IsString()
  @IsOptional()
  @MaxLength(1000)
  notes?: string;
}
