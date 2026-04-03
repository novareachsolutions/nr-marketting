import { IsString, IsOptional, MaxLength } from 'class-validator';

export class AddCompetitorDto {
  @IsString()
  @MaxLength(255)
  domain: string;

  @IsString()
  @IsOptional()
  @MaxLength(100)
  name?: string;
}
