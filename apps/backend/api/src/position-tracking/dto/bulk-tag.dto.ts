import {
  IsArray,
  IsString,
  IsNotEmpty,
  IsOptional,
  MaxLength,
  ArrayMinSize,
} from 'class-validator';

export class BulkTagDto {
  @IsArray()
  @ArrayMinSize(1)
  @IsString({ each: true })
  keywordIds: string[];

  @IsString()
  @IsNotEmpty()
  tagId: string;
}

export class CreateTagDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  name: string;

  @IsString()
  @IsOptional()
  @MaxLength(7)
  color?: string;
}

export class BulkDeleteDto {
  @IsArray()
  @ArrayMinSize(1)
  @IsString({ each: true })
  keywordIds: string[];
}

export class ImportFromProjectDto {
  @IsArray()
  @IsOptional()
  @IsString({ each: true })
  keywordIds?: string[];

  @IsOptional()
  all?: boolean;

  @IsString()
  @IsOptional()
  device?: 'DESKTOP' | 'MOBILE';

  @IsString()
  @IsOptional()
  country?: string;
}
