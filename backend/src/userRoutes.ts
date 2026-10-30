import { Router } from 'express';
import { db } from './firebase.js';
import { requireAuth } from './middleware/auth.js';
import { approvedUsers, profiles, emailKey, cleanUser, isActive } from './userAccess.js';
export const userRoutes = Router();
userRoutes.use(requireAuth);
userRoutes.use(async (req, res, next) => {
  try {
    const profile = (await profiles.doc(req.authenticatedUser!.uid).get()).data();
    if (req.method === 'GET' && req.path === '/') { next(); return; }
    if (profile?.role !== 'Admin' || !isActive(profile)) {
      res.status(403).json({ message: 'Only an active Admin may manage users.' }); return;
    }
    next();
  } catch { res.status(500).json({ message: 'Unable to verify administrator access.' }); }
});

const publicUser = (id: string, p: Record<string, any>) => ({
  id, name: p.name || '', email: p.email || '', role: p.role || '',
  state: p.state || '', region: p.region || '', headOfUnit: p.headOfUnit || '',
  headOfSales: p.headOfSales || '', headOfDepartment: p.headOfDepartment || '',
  userStatus: p.userStatus || p.status || 'Active', status: p.userStatus || p.status || 'Active'
});
userRoutes.get('/', async (req, res) => {
  try {
    const [registered, approved] = await Promise.all([profiles.limit(2001).get(), approvedUsers.limit(2001).get()]);
    if (registered.size > 2000 || approved.size > 2000) { res.status(409).json({ message: 'User directory exceeds 2,000 records; pagination is required.' }); return; }
    const users = registered.docs.map(d => publicUser(d.id, d.data()));
    const emails = new Set(users.map(u => u.email.trim().toLowerCase()));
    for (const d of approved.docs) {
      const p = d.data();
      if (!emails.has(p.email)) users.push(publicUser(`pending-${d.id}`, p));
    }
    const caller = (await profiles.doc(req.authenticatedUser!.uid).get()).data();
    const visible = caller?.role === 'Admin' ? users : users.filter(u => u.userStatus === 'Active');
    res.json({ users: visible.sort((a, b) => a.name.localeCompare(b.name)) });
  } catch { res.status(500).json({ message: 'Unable to load the admin directory.' }); }
});

// Atomic upsert: existing UIDs and request ownership are preserved. No deletion
// or replacement mode; fields not explicitly permitted never reach Firestore.
userRoutes.post('/import', async (req, res) => {
  let submitted: Record<string, string>[];
  try {
    if (req.body?.replaceMode) throw new Error('Replacement mode is not supported. Use add/update by email.');
    if (!Array.isArray(req.body?.users) || !req.body.users.length || req.body.users.length > 200) throw new Error('Supply 1–200 users per import.');
    submitted = req.body.users.map(cleanUser);
    if (new Set(submitted.map(p => p.email)).size !== submitted.length) throw new Error('Duplicate emails in upload.');
  } catch (e) { res.status(400).json({ message: (e as Error).message }); return; }
  try {
    await db.runTransaction(async tx => {
      const registered = await tx.get(profiles.limit(2001));
      if (registered.size > 2000) throw new Error('Directory too large for this import.');
      const refs = submitted.map(p => approvedUsers.doc(emailKey(p.email)));
      const approvals = await tx.getAll(...refs);
      const now = new Date().toISOString();
      // Validate every row before scheduling writes.
      const plans = submitted.map((p, i) => {
        const matches = registered.docs.filter(d => String(d.data().email || '').trim().toLowerCase() === p.email);
        if (matches.length > 1) throw new Error(`Multiple existing profiles use ${p.email}; resolve before importing.`);
        const match = matches[0];
        const old = approvals[i].data();
        if (old?.linkedUid && old.linkedUid !== match?.id) throw new Error(`Account binding conflict for ${p.email}.`);
        if (match?.id === req.authenticatedUser!.uid && (p.role !== 'Admin' || !isActive(p))) throw new Error('You cannot remove your own Admin access.');
        return { p, ref: refs[i], match, old };
      });
      for (const { p, ref, match, old } of plans) {
        tx.set(ref, { ...p, linkedUid: match?.id || '', createdAt: old?.createdAt || now, updatedAt: now, updatedBy: req.authenticatedUser!.uid });
        if (match) tx.update(match.ref, { ...p, updatedAt: now });
      }
    });
    res.json({ importedCount: submitted.length, message: `Saved ${submitted.length} approved user(s).` });
  } catch (e) {
    console.error('User import failed:', e);
    res.status(409).json({ message: 'Import was not saved. ' + (e as Error).message });
  }
});
