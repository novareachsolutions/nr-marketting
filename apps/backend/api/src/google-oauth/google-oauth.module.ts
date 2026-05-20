import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { GoogleOAuthController } from './google-oauth.controller';
import { GoogleOAuthService } from './google-oauth.service';
import { GscApiService } from './gsc-api.service';
import { GaApiService } from './ga-api.service';

@Module({
  imports: [AuthModule],
  controllers: [GoogleOAuthController],
  providers: [GoogleOAuthService, GscApiService, GaApiService],
  exports: [GoogleOAuthService, GscApiService, GaApiService],
})
export class GoogleOAuthModule {}
