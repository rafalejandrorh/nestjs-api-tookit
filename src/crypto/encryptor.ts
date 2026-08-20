import {
  createCipheriv,
  createDecipheriv,
  createHash,
  createHmac,
  hkdfSync,
  randomBytes,
} from 'crypto';

const PREFIX_RANDOM = 'ATK1.';
const PREFIX_DETERMINISTIC = 'ATK2.';
const CIPHER = 'aes-256-gcm';
const IV_LENGTH = 12;
const TAG_LENGTH = 16;
const MIN_PAYLOAD_LENGTH = IV_LENGTH + TAG_LENGTH;

export class Encryptor {
  private readonly encKey: Buffer;
  private readonly macKey: Buffer;
  private readonly legacyKey: Buffer;

  constructor(secret: string, legacySecret?: string | null) {
    if (secret === '') {
      throw new Error('El secreto de cifrado no puede estar vacío.');
    }

    this.encKey = Buffer.from(hkdfSync('sha256', secret, '', 'api-toolkit-aes-256-gcm', 32));
    this.macKey = Buffer.from(hkdfSync('sha256', secret, '', 'api-toolkit-hmac-siv', 32));
    const legacyMaterial = legacySecret != null && legacySecret !== '' ? legacySecret : secret;
    this.legacyKey = createHash('sha256').update(legacyMaterial).digest();
  }

  encrypt(plaintext: string, aad = ''): string {
    const iv = randomBytes(IV_LENGTH);
    return PREFIX_RANDOM + this.seal(plaintext, iv, aad, this.encKey);
  }

  encryptDeterministic(plaintext: string, aad = ''): string {
    const iv = createHmac('sha256', this.macKey)
      .update(aad + plaintext)
      .digest()
      .subarray(0, IV_LENGTH);
    return PREFIX_DETERMINISTIC + this.seal(plaintext, iv, aad, this.encKey);
  }

  decrypt(encrypted: string, aad = ''): string {
    if (encrypted === '') {
      return '';
    }

    if (encrypted.startsWith(PREFIX_RANDOM) || encrypted.startsWith(PREFIX_DETERMINISTIC)) {
      return this.open(encrypted.slice(PREFIX_RANDOM.length), aad, this.encKey);
    }

    return this.openLegacy(encrypted);
  }

  keyedHash(data: string): string {
    return createHmac('sha256', this.macKey).update(data).digest('hex');
  }

  private seal(plaintext: string, iv: Buffer, aad: string, key: Buffer): string {
    const cipher = createCipheriv(CIPHER, key, iv);
    if (aad !== '') {
      cipher.setAAD(Buffer.from(aad, 'utf8'));
    }

    const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
    const tag = cipher.getAuthTag();
    return Buffer.concat([iv, tag, ciphertext]).toString('base64');
  }

  private open(encoded: string, aad: string, key: Buffer): string {
    if (!this.isValidBase64(encoded)) {
      throw new Error('Formato de dato cifrado inválido.');
    }

    const data = Buffer.from(encoded, 'base64');
    if (data.length < MIN_PAYLOAD_LENGTH) {
      throw new Error('Formato de dato cifrado inválido.');
    }

    const iv = data.subarray(0, IV_LENGTH);
    const tag = data.subarray(IV_LENGTH, MIN_PAYLOAD_LENGTH);
    const ciphertext = data.subarray(MIN_PAYLOAD_LENGTH);

    try {
      const decipher = createDecipheriv(CIPHER, key, iv);
      if (aad !== '') {
        decipher.setAAD(Buffer.from(aad, 'utf8'));
      }
      decipher.setAuthTag(tag);
      return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf8');
    } catch (error) {
      if (error instanceof Error && error.message === 'Formato de dato cifrado inválido.') {
        throw error;
      }
      throw new Error('No se pudo descifrar el valor.');
    }
  }

  private openLegacy(encrypted: string): string {
    if (!this.isValidBase64(encrypted)) {
      throw new Error('Formato de dato cifrado inválido.');
    }

    const data = Buffer.from(encrypted, 'base64');
    if (data.length < MIN_PAYLOAD_LENGTH) {
      throw new Error('Formato de dato cifrado inválido.');
    }

    const iv = data.subarray(0, IV_LENGTH);
    const tag = data.subarray(IV_LENGTH, MIN_PAYLOAD_LENGTH);
    const ciphertext = data.subarray(MIN_PAYLOAD_LENGTH);

    try {
      const decipher = createDecipheriv(CIPHER, this.legacyKey, iv);
      decipher.setAuthTag(tag);
      return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf8');
    } catch {
      throw new Error('No se pudo descifrar el valor.');
    }
  }

  private isValidBase64(value: string): boolean {
    if (value.length === 0 || value.length % 4 !== 0) {
      return false;
    }

    if (!/^[A-Za-z0-9+/]+={0,2}$/.test(value)) {
      return false;
    }

    const decoded = Buffer.from(value, 'base64');
    return decoded.toString('base64') === value;
  }
}
