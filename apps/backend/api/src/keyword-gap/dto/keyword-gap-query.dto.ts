import { IsString, IsNotEmpty, IsOptional } from 'class-validator';

export class KeywordGapQueryDto {
  @IsString()
  @IsNotEmpty()
  domains: string; // comma-separated, 2-5 domains (first = "you")

  @IsString()
  @IsOptional()
  country?: string;
}
