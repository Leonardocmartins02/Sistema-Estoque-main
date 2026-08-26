import { SignJWT, jwtVerify } from 'jose';

import { env } from './env';

const secret = new TextEncoder().encode(env.JWT_SECRET);
const ISSUER = 'simplestock-backend';
const EXPIRATION = '12h';

export interface AuthTokenPayload {
  sub: string;
  email: string;
}

export async function signAuthToken(payload: AuthTokenPayload): Promise<string> {
  return new SignJWT({ email: payload.email })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(payload.sub)
    .setIssuer(ISSUER)
    .setIssuedAt()
    .setExpirationTime(EXPIRATION)
    .sign(secret);
}

export async function verifyAuthToken(token: string): Promise<AuthTokenPayload> {
  const { payload } = await jwtVerify(token, secret, { issuer: ISSUER });
  if (typeof payload.sub !== 'string' || typeof payload.email !== 'string') {
    throw new Error('Token payload inválido');
  }
  return { sub: payload.sub, email: payload.email };
}
