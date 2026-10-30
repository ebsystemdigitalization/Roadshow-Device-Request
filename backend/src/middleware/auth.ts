import type { NextFunction, Request, Response } from 'express';
import type { DecodedIdToken } from 'firebase-admin/auth';
import { adminAuth } from '../firebase.js';
import { profiles, isActive, linkApprovedUser } from '../userAccess.js';

declare global {
  namespace Express {
    interface Request { authenticatedUser?: DecodedIdToken; }
  }
}
export async function requireAuth(request: Request, response: Response, next: NextFunction): Promise<void> {
  const header = request.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    response.status(401).json({ message: 'Authentication token is required.' }); return;
  }
  let token: DecodedIdToken;
  try { token = await adminAuth.verifyIdToken(header.slice(7).trim()); }
  catch {
    response.status(401).json({ message: 'Authentication token is invalid or expired.' }); return;
  }
  try {
    const provider = token.firebase?.sign_in_provider;
    if (provider !== 'password' && provider !== 'saml.azure-ad') {
      response.status(403).json({ message: 'This sign-in method is not permitted.' }); return;
    }
    let snapshot = await profiles.doc(token.uid).get();
    if (!snapshot.exists && provider === 'saml.azure-ad' && token.email) {
      await linkApprovedUser(token.uid, token.email);
      snapshot = await profiles.doc(token.uid).get();
    }
    const profile = snapshot.data();
    if (!profile?.name || !profile?.role) {
      response.status(403).json({ message: 'No approved RDR profile exists for this account. Please contact the administrator.' }); return;
    }
    if (!isActive(profile)) {
      response.status(403).json({ message: 'This RDR account is inactive.' }); return;
    }
    if (provider === 'password' && profile.role !== 'Admin') {
      response.status(403).json({ message: 'Email/password login is restricted to administrators. Please use CelcomDigi SSO.' }); return;
    }
    request.authenticatedUser = token;
  } catch (error) {
    console.error('Unable to verify RDR access:', error);
    response.status(500).json({ message: 'Unable to verify your RDR access. Please try again later.' }); return;
  }
  next();
}
