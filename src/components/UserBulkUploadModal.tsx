import React, { useState } from 'react';
import * as XLSX from 'xlsx';
import type { User } from '../types';
interface Props {
  isOpen: boolean; onClose: () => void; existingUsers: User[];
  onImportUsers: (users: User[], replace: boolean) => void | Promise<void>;
}
const roles = ['Admin', 'Sales Team', 'Head of Sales', 'Head of Unit', 'Head of Department', 'Device Team', 'Head of Operation'];
export const UserBulkUploadModal: React.FC<Props> = ({ isOpen, onClose, existingUsers, onImportUsers }) => {
  const [text, setText] = useState('');
  const [users, setUsers] = useState<User[]>([]);
  const [errors, setErrors] = useState<string[]>([]);
  const [saveError, setSaveError] = useState('');
  const [busy, setBusy] = useState(false);
  const parse = (value: string) => {
    setText(value); setSaveError(''); setUsers([]); setErrors([]);
    if (!value.trim()) return;
    try {
      const book = XLSX.read(value.replace(/^\uFEFF/, ''), { type: 'string', raw: true });
      const rows = XLSX.utils.sheet_to_json<string[]>(book.Sheets[book.SheetNames[0]], { header: 1, defval: '', raw: false });
      const headers = (rows[0] || []).map(h => String(h).trim().toLowerCase());
      const required = ['name', 'email', 'role', 'user status'];
      if (required.some(h => !headers.includes(h))) throw new Error('Required columns: Name, Email, Role, User Status.');
      if (new Set(headers).size !== headers.length) throw new Error('Duplicate CSV headers.');
      const parsed: User[] = []; const problems: string[] = []; const seen = new Set<string>();
      rows.slice(1).forEach((row, index) => {
        if (!row.some(v => String(v).trim())) return;
        const get = (name: string) => String(row[headers.indexOf(name)] ?? '').trim();
        const email = get('email').toLowerCase(); const name = get('name'); const role = get('role'); const status = get('user status');
        if (!name || !/^[^\s@/]+@[^\s@/]+\.[^\s@/]+$/.test(email) || !roles.includes(role) || !['Active', 'Inactive'].includes(status)) {
          problems.push(`Row ${index + 2}: check name, email, role and Active/Inactive status.`); return;
        }
        if (seen.has(email)) { problems.push(`Row ${index + 2}: duplicate email ${email}.`); return; }
        seen.add(email);
        parsed.push({ id: email, name, email, role, state: get('state'), region: get('region'), headOfUnit: get('head of unit'), headOfSales: get('head of sales'), headOfDepartment: get('head of department'), userStatus: status, status } as User);
      });
      if (parsed.length > 200) problems.push('Maximum 200 users per upload. Split the CSV into smaller files.');
      if (!parsed.length) problems.push('No valid users found.');
      setUsers(parsed); setErrors(problems);
    } catch (e) { setErrors([e instanceof Error ? e.message : 'Unable to read CSV.']); }
  };
  const confirm = async () => {
    if (busy || errors.length || !users.length) return;
    setBusy(true); setSaveError('');
    try {
      await onImportUsers(users, false);
      setText(''); setUsers([]); setErrors([]); onClose();
    } catch (e) { setSaveError(e instanceof Error ? e.message : 'Import failed. Please retry.'); }
    finally { setBusy(false); }
  };
  if (!isOpen) return null;
  const existing = new Set(existingUsers.map(u => u.email.trim().toLowerCase()));
  return <div className="fixed inset-0 z-50 bg-slate-900/60 p-4 flex items-center justify-center"><div className="bg-white p-6 rounded-2xl w-full max-w-5xl max-h-[90vh] overflow-auto space-y-4">
    <h2 className="text-xl font-bold">Upload approved users</h2>
    <p className="text-sm text-slate-600">Add or update by email. Existing users outside the CSV are kept. Inactive users cannot sign in. No passwords are created or stored.</p>
    <label className="block text-sm">Choose CSV<input disabled={busy} className="block mt-2" type="file" accept=".csv" onChange={async e => {
      const file = e.target.files?.[0]; if (!file) return;
      if (file.size > 1024 * 1024) { setErrors(['CSV must be under 1 MB.']); return; }
      try { parse(await file.text()); } catch { setErrors(['Unable to read file.']); }
    }} /></label>
    <textarea aria-label="CSV content" disabled={busy} className="w-full border rounded-lg p-3 font-mono text-xs" rows={5} value={text} onChange={e => parse(e.target.value)} placeholder="Name,Email,Role,State,Region,Head of Sales,Head of Department,User Status" />
    {!!errors.length && <div role="alert" className="p-3 bg-rose-50 text-rose-700">{errors.map((e, i) => <p key={i}>{e}</p>)}</div>}
    {saveError && <p role="alert" className="p-3 bg-rose-50 text-rose-700">{saveError}</p>}
    {!!users.length && <>
      <p className="text-sm">{users.length} rows · {users.filter(u => u.userStatus === 'Active').length} Active · {users.filter(u => u.userStatus === 'Inactive').length} Inactive · {users.filter(u => existing.has(u.email)).length} existing emails</p>
      {users.some(u => u.email.endsWith('@company.com')) && <p className="p-3 bg-amber-50 text-amber-900">This CSV includes @company.com addresses. Check they are real sign-in addresses before importing; correct placeholders in the CSV.</p>}
      <div className="overflow-auto max-h-64"><table className="w-full text-sm text-left"><thead><tr>{['Name', 'Email', 'Role', 'Status'].map(h => <th className="p-2" key={h}>{h}</th>)}</tr></thead><tbody>{users.map(u => <tr className="border-t" key={u.email}><td className="p-2">{u.name}</td><td className="p-2">{u.email}</td><td className="p-2">{u.role}</td><td className="p-2">{u.userStatus}</td></tr>)}</tbody></table></div>
    </>}
    <div className="flex justify-end gap-4"><button disabled={busy} onClick={onClose}>Cancel</button><button disabled={busy || !!errors.length || !users.length} onClick={() => void confirm()} className="px-4 py-2 rounded-lg bg-indigo-600 text-white disabled:opacity-50">{busy ? 'Saving…' : `Save ${users.length} users`}</button></div>
  </div></div>;
};
