import { createHash } from 'node:crypto';
import { db } from './firebase.js';

export const approvedUsers = db.collection('approved_users');
export const profiles = db.collection('users');
export const roles = ['Admin', 'Sales Team', 'Head of Sales', 'Head of Unit', 'Head of Department', 'Device Team', 'Head of Operation'];
export const emailKey = (email: string) => createHash('sha256').update(email.trim().toLowerCase()).digest('hex');
export const isActive = (p: Record<string, any>) => p.userStatus !== 'Inactive' && p.status !== 'Inactive';
export function cleanUser(input: any): Record<string, string> {
  if (!input || typeof input !== 'object') throw new Error('Invalid user record.');
  const email = typeof input.email === 'string' ? input.email.trim().toLowerCase() : '';
  const name = typeof input.name === 'string' ? input.name.trim() : '';
  if (!name || !/^[^\s@/]+@[^\s@/]+\.[^\s@/]+$/.test(email)) throw new Error('Each user needs a name and valid email.');
  if (!roles.includes(input.role)) throw new Error(`Invalid role for ${email}.`);
  const status = input.userStatus ?? input.status;
  if (status !== 'Active' && status !== 'Inactive') throw new Error(`Choose Active or Inactive for ${email}.`);
  const result: Record<string, string> = { email, name, role: input.role, userStatus: status, status };
  for (const field of ['state', 'region', 'headOfUnit', 'headOfSales', 'headOfDepartment']) {
    result[field] = typeof input[field] === 'string' ? input[field].trim() : '';
    if (result[field].length > 200) throw new Error(`Field ${field} is too long.`);
  }
  if (name.length > 200 || email.length > 254) throw new Error('Name or email is too long.');
  return result;
}

// Only the verified SAML identity may claim an approved email. Never trust a
// submitted email or automatically merge a second Firebase UID into a profile.
export async function linkApprovedUser(uid: string, email: string): Promise<void> {
  const approvalRef = approvedUsers.doc(emailKey(email));
  const profileRef = profiles.doc(uid);
  await db.runTransaction(async tx => {
    const existing = await tx.get(profileRef);
    const approval = await tx.get(approvalRef);
    if (existing.exists) return;
    const record = approval.data();
    if (!record || record.email !== email.trim().toLowerCase() || !isActive(record)) return;
    if (record.linkedUid && record.linkedUid !== uid) return;
    const profile = cleanUser(record);
    const now = new Date().toISOString();
    tx.create(profileRef, { ...profile, createdAt: now, updatedAt: now });
    tx.update(approvalRef, { linkedUid: uid, updatedAt: now });
  });
}
