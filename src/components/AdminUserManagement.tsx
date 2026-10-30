import React, { useState } from 'react';
import type { User } from '../types';
import { UserBulkUploadModal } from './UserBulkUploadModal';

interface Props {
  users: User[]; currentUser: User;
  onAddUser: (u: User) => void | Promise<void>;
  onUpdateUser: (u: User) => void | Promise<void>;
  onDeleteUser: (id: string) => void | Promise<void>;
  onSwitchUserPersona: (u: User) => void;
  onBulkAddUsers?: (users: User[], replace: boolean) => void | Promise<void>;
}
const roles = ['Admin', 'Sales Team', 'Head of Sales', 'Head of Unit', 'Head of Department', 'Device Team', 'Head of Operation'];
export const AdminUserManagement: React.FC<Props> = ({ users, currentUser, onAddUser, onUpdateUser, onDeleteUser, onBulkAddUsers }) => {
  const [search, setSearch] = useState('');
  const [bulk, setBulk] = useState(false);
  const [editing, setEditing] = useState<User | null>(null);
  const [isNew, setIsNew] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const visible = users.filter(u => `${u.name} ${u.email} ${u.role}`.toLowerCase().includes(search.toLowerCase()));
  const importUsers = async (records: User[], replace: boolean) => {
    if (!onBulkAddUsers) throw new Error('Bulk upload is unavailable.');
    await onBulkAddUsers(records, replace);
    setNotice(`Saved ${records.length} user(s). Existing emails were updated; other users were kept.`);
  };
  const save = async (e: React.FormEvent) => {
    e.preventDefault(); if (!editing || busy) return;
    setBusy(true); setError('');
    try {
      await (isNew ? onAddUser(editing) : onUpdateUser(editing));
      setEditing(null); setNotice('User saved. SSO users do not need a portal password.');
    } catch (e) { setError(e instanceof Error ? e.message : 'Save failed.'); }
    finally { setBusy(false); }
  };
  const deactivate = async (u: User) => {
    if (!window.confirm(`Deactivate ${u.name}? Their request history will be retained.`)) return;
    setBusy(true); setError('');
    try { await onDeleteUser(u.id); setNotice('User deactivated.'); }
    catch (e) { setError(e instanceof Error ? e.message : 'Update failed.'); }
    finally { setBusy(false); }
  };
  return <section className="bg-white rounded-2xl p-6 shadow-sm space-y-5">
    <div className="flex flex-wrap gap-3 justify-between items-center">
      <div><h2 className="text-xl font-bold">User Management</h2><p className="text-sm text-slate-500">Approve company emails and assign RDR roles. SSO links accounts on first login.</p></div>
      <div className="flex gap-2">
        <button className="px-4 py-2 rounded-lg border" disabled={busy} onClick={() => setBulk(true)}>Upload CSV</button>
        <button className="px-4 py-2 rounded-lg bg-indigo-600 text-white" disabled={busy} onClick={() => {
          setIsNew(true); setError('');
          setEditing({ id: '', name: '', email: '', role: 'Sales Team', state: '', region: '', userStatus: 'Active' } as User);
        }}>Add user</button>
      </div>
    </div>
    {error && <p role="alert" className="p-3 bg-rose-50 text-rose-700">{error}</p>}
    {notice && <p role="status" className="p-3 bg-emerald-50 text-emerald-800">{notice}</p>}
    <input aria-label="Search users" className="border rounded-lg p-3 w-full" placeholder="Search name, email or role" value={search} onChange={e => setSearch(e.target.value)} />
    <p className="text-sm text-slate-500">{visible.length} users · Includes inactive users and accounts awaiting their first SSO login</p>
    <div className="overflow-auto max-h-[65vh]"><table className="w-full text-sm text-left"><thead><tr>{['Name', 'Email', 'Role', 'Status', 'Actions'].map(h => <th className="p-3 border-b" key={h}>{h}</th>)}</tr></thead>
      <tbody>{visible.map(u => <tr key={u.id} className="border-b">
        <td className="p-3">{u.name}</td><td className="p-3">{u.email}</td><td className="p-3">{u.role}</td><td className="p-3">{u.userStatus || u.status || 'Active'}</td>
        <td className="p-3 whitespace-nowrap"><button disabled={busy} className="text-indigo-700 mr-3" onClick={() => { setIsNew(false); setError(''); setEditing({ ...u }); }}>Edit</button>
          {u.id !== currentUser.id && <button disabled={busy || u.userStatus === 'Inactive'} className="text-rose-700" onClick={() => void deactivate(u)}>Deactivate</button>}</td>
      </tr>)}</tbody></table></div>
    {editing && <div className="fixed inset-0 bg-slate-900/60 z-50 flex items-center justify-center p-4"><form onSubmit={save} className="bg-white rounded-2xl p-6 w-full max-w-lg space-y-3 max-h-[90vh] overflow-auto">
      <h3 className="text-lg font-bold">{isNew ? 'Approve user' : 'Edit user'}</h3>
      <p className="text-sm text-slate-500">Employees use company SSO. Changing a profile does not create or reset an administrator password.</p>
      {error && <p role="alert" className="text-rose-700">{error}</p>}
      {(['name', 'email', 'state', 'region', 'headOfUnit', 'headOfSales', 'headOfDepartment'] as const).map(field => <label key={field} className="block text-sm">{({ name: 'Name', email: 'Company email', state: 'State', region: 'Region', headOfUnit: 'Head of Unit', headOfSales: 'Head of Sales', headOfDepartment: 'Head of Department' })[field]}
        <input className="block border rounded-lg p-2 w-full" type={field === 'email' ? 'email' : 'text'} required={field === 'name' || field === 'email'} disabled={busy || (!isNew && field === 'email')} value={editing[field] || ''} onChange={e => setEditing({ ...editing, [field]: e.target.value })} />
      </label>)}
      <label className="block text-sm">Role<select className="block border rounded-lg p-2 w-full" disabled={busy} value={editing.role} onChange={e => setEditing({ ...editing, role: e.target.value as User['role'] })}>{roles.map(r => <option key={r}>{r}</option>)}</select></label>
      <label className="block text-sm">Status<select className="block border rounded-lg p-2 w-full" disabled={busy} value={editing.userStatus || editing.status || 'Active'} onChange={e => setEditing({ ...editing, userStatus: e.target.value as User['userStatus'], status: e.target.value as User['status'] })}><option>Active</option><option>Inactive</option></select></label>
      <div className="flex justify-end gap-3"><button disabled={busy} type="button" onClick={() => { setEditing(null); setError(''); }}>Cancel</button><button disabled={busy} className="bg-indigo-600 text-white px-4 py-2 rounded-lg">{busy ? 'Saving…' : 'Save'}</button></div>
    </form></div>}
    <UserBulkUploadModal isOpen={bulk} onClose={() => setBulk(false)} existingUsers={users} onImportUsers={importUsers} />
  </section>;
};
