import { IsString, IsNotEmpty, IsOptional, Length } from 'class-validator';

export class SearchKeywordDto {
  @IsString()
  @IsNotEmpty()
  @Length(1, 200)
  q: string;

  @IsString()
  @IsOptional()
  @Length(2, 2)
  country?: string = 'US';
}
