import * as crypto from 'crypto';
import {
  BadRequestException,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Inject,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import type { ToolkitOptions } from '../../core/interfaces/toolkit-options.interface';
import { TOOLKIT_OPTIONS } from '../../core/tokens';
import { matchesToolkitRoute } from '../../core/utils/route-match.util';

const DEFAULT_TIMESTAMP_TOLERANCE = 100;
const DEFAULT_REQUEST_ATTRIBUTE_NAME = 'authenticated_hmac';

type HmacRequest = {
  path: string;
  method?: string;
  originalUrl?: string;
  url?: string;
  headers: Record<string, unknown>;
  body?: unknown;
  rawBody?: Buffer | string;
} & Record<string, unknown>;

function readHeader(headers: Record<string, unknown>, headerName: string): string | null {
  const value = headers[headerName] ?? headers[headerName.toLowerCase()];

  if (typeof value !== 'string' || value.length === 0) {
    return null;
  }

  return value;
}

function getRawBody(request: HmacRequest): string {
  if (Buffer.isBuffer(request.rawBody)) {
    return request.rawBody.toString('utf8');
  }

  if (typeof request.rawBody === 'string') {
    return request.rawBody;
  }

  if (typeof request.body === 'string') {
    return request.body;
  }

  if (request.body == null) {
    return '';
  }

  return JSON.stringify(request.body);
}

function safeCompare(left: string, right: string): boolean {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);

  if (leftBuffer.length !== rightBuffer.length) {
    return false;
  }

  return crypto.timingSafeEqual(leftBuffer, rightBuffer);
}

function matchesProtectedPathPrefix(path: string, protectedPathPrefix?: string): boolean {
  if (!protectedPathPrefix) {
    return true;
  }

  return path.startsWith(protectedPathPrefix);
}

@Injectable()
export class HmacGuard implements CanActivate {
  constructor(@Inject(TOOLKIT_OPTIONS) private readonly options: ToolkitOptions) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    if (!this.options.hmac?.enabled) {
      return true;
    }

    const request = context.switchToHttp().getRequest<HmacRequest>();
    if (!matchesProtectedPathPrefix(request.path, this.options.hmac.protectedPathPrefix)) {
      return true;
    }

    if (!matchesToolkitRoute(request.path, this.options.globalMatch)) {
      return true;
    }

    const timestamp = readHeader(request.headers, 'x-timestamp');
    const signature = readHeader(request.headers, 'x-signature');
    if (!timestamp || !signature) {
      throw new BadRequestException('X-Timestamp and X-Signature headers are required');
    }

    const timestampValue = Number(timestamp);
    const timestampTolerance = this.options.hmac.timestampTolerance ?? DEFAULT_TIMESTAMP_TOLERANCE;
    if (!Number.isInteger(timestampValue) || Math.abs(Date.now() / 1000 - timestampValue) > timestampTolerance) {
      throw new ForbiddenException('Invalid HMAC timestamp');
    }

    const method = request.method?.toUpperCase() ?? 'GET';
    const uri = request.originalUrl ?? request.url ?? request.path;
    const bodyHash = crypto.createHash('sha256').update(getRawBody(request)).digest('hex');
    const message = `${method}|${uri}|${bodyHash}|${timestamp}`;
    const expectedSignature = crypto
      .createHmac('sha256', this.options.hmac.secretKey)
      .update(message)
      .digest('base64');

    if (!safeCompare(signature, expectedSignature)) {
      throw new UnauthorizedException('Invalid HMAC signature');
    }

    const requestAttributeName = this.options.hmac.requestAttributeName ?? DEFAULT_REQUEST_ATTRIBUTE_NAME;
    request[requestAttributeName] = {
      timestamp,
      signature,
      method,
      uri,
    };

    return true;
  }
}