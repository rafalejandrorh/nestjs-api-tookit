import { Body, Controller, Post } from '@nestjs/common';
import { OAuthService } from './oauth.service';
import type { OAuthTokenRequest } from './interfaces/oauth-token-request.interface';
import type { OAuthTokenResponse } from './interfaces/oauth-token-response.interface';

@Controller('oauth')
export class OAuthController {
  constructor(private readonly oauthService: OAuthService) {}

  @Post('token')
  async token(@Body() payload: OAuthTokenRequest): Promise<OAuthTokenResponse> {
    return this.oauthService.issueToken(payload);
  }
}