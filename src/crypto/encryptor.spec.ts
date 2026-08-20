import { createCipheriv, createHash, createHmac, randomBytes } from 'crypto';
import { Encryptor } from './encryptor';

function legacyEncrypt(plaintext: string, secret: string): string {
  const secretKey = createHash('sha256').update(secret).digest();
  const iv = createHmac('sha256', secretKey).update(plaintext).digest().subarray(0, 12);
  const cipher = createCipheriv('aes-256-gcm', secretKey, iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, ciphertext]).toString('base64');
}

describe('Encryptor', () => {
  const encryptor = new Encryptor('bundle-test-secret', 'bundle-test-secret');

  it('encrypts and decrypts with ATK1 prefix', () => {
    const encrypted = encryptor.encrypt('client-123', 'oauth.client_secret');

    expect(encrypted).not.toBe('client-123');
    expect(encrypted.startsWith('ATK1.')).toBe(true);
    expect(encryptor.decrypt(encrypted, 'oauth.client_secret')).toBe('client-123');
  });

  it('encrypt is not deterministic', () => {
    const first = encryptor.encrypt('client-123');
    const second = encryptor.encrypt('client-123');

    expect(first).not.toBe(second);
    expect(encryptor.decrypt(first)).toBe('client-123');
    expect(encryptor.decrypt(second)).toBe('client-123');
  });

  it('encryptDeterministic is stable for same plaintext and aad', () => {
    const first = encryptor.encryptDeterministic('client-123', 'oauth.client_id');
    const second = encryptor.encryptDeterministic('client-123', 'oauth.client_id');

    expect(first.startsWith('ATK2.')).toBe(true);
    expect(first).toBe(second);
    expect(encryptor.decrypt(first, 'oauth.client_id')).toBe('client-123');
  });

  it('decrypt rejects aad mismatch', () => {
    const encrypted = encryptor.encrypt('secret-value', 'oauth.client_secret');
    expect(() => encryptor.decrypt(encrypted, 'oauth.client_id')).toThrow(
      'No se pudo descifrar el valor.',
    );
  });

  it('decrypts legacy payloads without ATK prefix', () => {
    const legacy = legacyEncrypt('client-123', 'bundle-test-secret');
    expect(legacy.startsWith('ATK')).toBe(false);
    expect(encryptor.decrypt(legacy)).toBe('client-123');
  });

  it('rejects empty secret', () => {
    expect(() => new Encryptor('')).toThrow('El secreto de cifrado no puede estar vacío.');
  });

  it('keyedHash is stable', () => {
    const first = encryptor.keyedHash('cache-key');
    const second = encryptor.keyedHash('cache-key');

    expect(first).toBe(second);
    expect(first).toHaveLength(64);
    expect(first).not.toBe(encryptor.keyedHash('other-key'));
  });

  it('decrypt empty string returns empty string', () => {
    expect(encryptor.decrypt('')).toBe('');
  });

  it('encrypt empty string round trips', () => {
    const encrypted = encryptor.encrypt('');
    expect(encrypted.startsWith('ATK1.')).toBe(true);
    expect(encryptor.decrypt(encrypted)).toBe('');
  });

  it('decrypt rejects invalid payload', () => {
    expect(() => encryptor.decrypt('invalid-base64')).toThrow('Formato de dato cifrado inválido.');
  });

  it('rejects truncated ciphertext', () => {
    const short = randomBytes(8).toString('base64');
    expect(() => encryptor.decrypt(`ATK1.${short}`)).toThrow('Formato de dato cifrado inválido.');
  });
});
