import { IsString, IsNotEmpty, IsOptional } from 'class-validator';

export class CompareDomainsQueryDto {
  @IsString()
  @IsNotEmpty()
  domains: string; // comma-separated, 2-5 domains

  @IsString()
  @IsOptional()
  country?: string;
}
