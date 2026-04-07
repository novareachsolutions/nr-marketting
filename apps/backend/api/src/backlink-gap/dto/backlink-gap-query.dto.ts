import { IsString, IsNotEmpty, IsOptional } from 'class-validator';

export class BacklinkGapQueryDto {
  @IsString()
  @IsNotEmpty()
  domains: string;

  @IsString()
  @IsOptional()
  country?: string;
}
