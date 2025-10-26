import * as jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

/**
 * Extract and verify user ID from JWT token
 * @param token - JWT token string
 * @returns User ID or null if invalid/expired
 */
export function getUserIdByJwt(token: string): number | null {
  try {
    const decoded: any = jwt.verify(token, JWT_SECRET);
    return decoded?.sub || decoded?.id || null;
  } catch (err) {
    return null;
  }
}

/**
 * Verify JWT token
 * @param token - JWT token string
 * @returns Decoded token or null if invalid
 */
export function verifyJwt(token: string): any | null {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch (err) {
    return null;
  }
}

/**
 * Decode JWT without verification (UNSAFE - only for debugging)
 * @param token - JWT token string
 * @returns Decoded payload or null
 */
export function decodeJwtUnsafe(token: string): any | null {
  try {
    return jwt.decode(token);
  } catch (err) {
    return null;
  }
}
