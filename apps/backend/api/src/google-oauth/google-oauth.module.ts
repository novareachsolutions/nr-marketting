import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { GoogleOAuthController } from './google-oauth.controller';
import { GoogleOAuthService } from './google-oauth.service';

@Module({
  imports: [AuthModule],
  controllers: [GoogleOAuthController],
  providers: [GoogleOAuthService],
  exports: [GoogleOAuthService],
})
export class GoogleOAuthModule {}
