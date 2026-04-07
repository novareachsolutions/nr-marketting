import { IsString, IsNotEmpty, MaxLength, IsOptional } from 'class-validator';

export class TopPagesQueryDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(253)
  domain: string;

  @IsString()
  @IsOptional()
  country?: string;
}
