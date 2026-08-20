export const EncryptionAad = {
  OAUTH_CLIENT_ID: 'oauth.client_id',
  OAUTH_CLIENT_SECRET: 'oauth.client_secret',
  AUDIT_REQUEST_BODY: 'audit.request_body',
  AUDIT_RESPONSE_BODY: 'audit.response_body',
  AUDIT_AUTHENTICATED_USER: 'audit.authenticated_user',
  AUDIT_AUTHENTICATED_CLIENT_ID: 'audit.authenticated_client_id',
  CACHE_VALUE: 'cache.value',
} as const;

export type EncryptionAadValue = (typeof EncryptionAad)[keyof typeof EncryptionAad];
