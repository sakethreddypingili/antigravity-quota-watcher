import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import os from 'os';
import type { Request, Response } from 'express';
import type { AuthSession } from '../../src/types.ts';

const COOKIE_NAME = 'ag_session';
const DEFAULT_SECRET = 'antigravity-quota-default-secret-fallback-key-32chars!';

function getSecretKey(): Buffer {
  const secret = process.env.SESSION_SECRET || DEFAULT_SECRET;
  return crypto.createHash('sha256').update(secret).digest();
}

/**
 * Encrypt session data using AES-256-GCM
 */
export function encryptSession(session: AuthSession): string {
  const key = getSecretKey();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);

  const jsonStr = JSON.stringify(session);
  const encrypted = Buffer.concat([cipher.update(jsonStr, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();

  // Format: iv:authTag:encrypted (base64url)
  return [
    iv.toString('base64url'),
    authTag.toString('base64url'),
    encrypted.toString('base64url'),
  ].join('.');
}

/**
 * Decrypt session data
 */
export function decryptSession(token: string): AuthSession | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;

    const [ivStr, tagStr, encryptedStr] = parts;
    const iv = Buffer.from(ivStr, 'base64url');
    const authTag = Buffer.from(tagStr, 'base64url');
    const encrypted = Buffer.from(encryptedStr, 'base64url');

    const key = getSecretKey();
    const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAuthTag(authTag);

    const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);
    return JSON.parse(decrypted.toString('utf8')) as AuthSession;
  } catch {
    return null;
  }
}

/**
 * Get current session from request cookies, or fallback to saved token if running on host
 */
export function getSessionFromRequest(req: Request): AuthSession | null {
  const cookieVal = req.cookies?.[COOKIE_NAME];
  if (cookieVal) {
    const session = decryptSession(cookieVal);
    if (session) return session;
  }
  return null;
}

/**
 * Set HTTP-only secure cookie for session
 */
export function setSessionCookie(res: Response, session: AuthSession, req?: Request): void {
  const token = encryptSession(session);
  const isHttps = req ? (req.secure || req.headers['x-forwarded-proto'] === 'https') : false;
  const isProduction = process.env.NODE_ENV === 'production' && isHttps;

  // Set cookie for 30 days
  res.cookie(COOKIE_NAME, token, {
    httpOnly: true,
    secure: isProduction,
    sameSite: isProduction ? 'none' : 'lax',
    path: '/',
    maxAge: 30 * 24 * 60 * 60 * 1000,
  });
}

/**
 * Clear session cookie
 */
export function clearSessionCookie(res: Response): void {
  res.clearCookie(COOKIE_NAME, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
    path: '/',
  });
}
