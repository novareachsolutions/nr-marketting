import {
  IsString,
  IsUrl,
  IsEnum,
  IsOptional,
  IsNotEmpty,
} from 'class-validator';

export enum WpAuthMethodDto {
  APP_PASSWORD = 'APP_PASSWORD',
  PLUGIN = 'PLUGIN',
}

export class ConnectWordPressDto {
  @IsUrl({ require_tld: false }, { message: 'siteUrl must be a valid URL' })
  @IsNotEmpty()
  siteUrl: string;

  @IsString()
  @IsNotEmpty()
  username: string;

  @IsString()
  @IsOptional()
  appPassword?: string;

  @IsString()
  @IsOptional()
  pluginApiKey?: string;

  @IsEnum(WpAuthMethodDto)
  authMethod: WpAuthMethodDto;
}
