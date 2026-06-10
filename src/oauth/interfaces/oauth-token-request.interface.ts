export interface OAuthTokenRequest {
  grant_type: 'client_credentials' | 'password';
  client_id: string;
  client_secret: string;
  username?: string;
  password?: string;
  scope?: string;
}