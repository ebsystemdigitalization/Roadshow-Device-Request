import type {
  NextFunction,
  Request,
  Response
} from 'express';

import type { DecodedIdToken } from 'firebase-admin/auth';
import { adminAuth } from '../firebase.js';

declare global {
  namespace Express {
    interface Request {
      authenticatedUser?: DecodedIdToken;
    }
  }
}

export async function requireAuth(
  request: Request,
  response: Response,
  next: NextFunction
): Promise<void> {
  const authorization = request.headers.authorization;

  if (!authorization?.startsWith('Bearer ')) {
    response.status(401).json({
      message: 'Authentication token is required.'
    });
    return;
  }

  const token = authorization.substring(7);

  try {
    request.authenticatedUser =
      await adminAuth.verifyIdToken(token);

    next();
  } catch (error) {
    console.error('Invalid Firebase token:', error);

    response.status(401).json({
      message: 'Authentication token is invalid or expired.'
    });
  }
}