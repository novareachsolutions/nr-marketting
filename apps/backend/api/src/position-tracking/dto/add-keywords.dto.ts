import {
  IsArray,
  IsString,
  IsNotEmpty,
  IsOptional,
  IsEnum,
  MaxLength,
  ArrayMinSize,
  ArrayMaxSize,
} from 'class-validator';

enum DeviceEnum {
  DESKTOP = 'DESKTOP',
  MOBILE = 'MOBILE',
}

export class AddKeywordsDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(100)
  @IsString({ each: true })
  @IsNotEmpty({ each: true })
  keywords: string[];

  @IsEnum(DeviceEnum)
  @IsOptional()
  device?: 'DESKTOP' | 'MOBILE';

  @IsString()
  @IsOptional()
  @MaxLength(10)
  country?: string;

  @IsString()
  @IsOptional()
  @MaxLength(2000)
  targetUrl?: string;
}
