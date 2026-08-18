import React, { useState } from 'react';
import { User, UserRole, UserStatus, MALAYSIAN_STATES, MALAYSIAN_REGIONS } from '../types';
import { generateId, downloadUsersCSV } from '../utils/formatters';
import { Users, UserPlus, Search, Edit2, Trash2, Shield, CheckCircle2, X, AlertTriangle, Upload, Download, ChevronLeft, ChevronRight } from 'lucide-react';
import { UserBulkUploadModal } from './UserBulkUploadModal';

interface AdminUserManagementProps {
  users: User[];
  currentUser: User;
  onAddUser: (user: User) => void;
  onUpdateUser: (user: User) => void;
  onDeleteUser: (userId: string) => void;
  onBulkAddUsers?: (users: User[], replaceMode: boolean) => void;
}

export const AdminUserManagement: React.FC<AdminUserManagementProps> = ({
  users,
  currentUser,
  onAddUser,
  onUpdateUser,
  onDeleteUser,
  onBulkAddUsers
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('ALL');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 10;

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isBulkUploadOpen, setIsBulkUploadOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [userToDelete, setUserToDelete] = useState<User | null>(null);

  const handleImportUsers = (newUsers: User[], replaceMode: boolean) => {
    if (onBulkAddUsers) {
      onBulkAddUsers(newUsers, replaceMode);
    } else {
      newUsers.forEach(u => onAddUser(u));
    }
  };

  const [formData, setFormData] = useState<{
    name: string;
    email: string;
    role: UserRole;
    state: string;
    region: string;
    headOfSales: string;
    headOfDepartment: string;
    userStatus: UserStatus;
  }>({
    name: '',
    email: '',
    role: 'Sales Team',
    state: 'Selangor',
    region: 'Central',
    headOfSales: "Dato' Wong Wei Sheng",
    headOfDepartment: 'Ir. Ahmad Rizal',
    userStatus: 'Active'
  });

  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleOpenAddModal = () => {
    setEditingUser(null);
    const defaultHOS = users.find(u => u.role === 'Head of Sales')?.name || "Dato' Wong Wei Sheng";
    const defaultHOD = users.find(u => u.role === 'Head of Department')?.name || 'Ir. Ahmad Rizal';
    setFormData({
      name: '',
      email: '',
      role: 'Sales Team',
      state: 'Selangor',
      region: 'Central',
      headOfSales: defaultHOS,
      headOfDepartment: defaultHOD,
      userStatus: 'Active'
    });
    setErrorMsg(null);
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (u: User) => {
    setEditingUser(u);
    setFormData({
      name: u.name || '',
      email: u.email || '',
      role: u.role || 'Sales Team',
      state: u.state || 'Selangor',
      region: u.region || 'Central',
      headOfSales: u.headOfSales || (u.role === 'Head of Sales' ? u.name : "Dato' Wong Wei Sheng"),
      headOfDepartment: u.headOfDepartment || (u.role === 'Head of Department' ? u.name : 'Ir. Ahmad Rizal'),
      userStatus: u.userStatus || u.status || 'Active'
    });
    setErrorMsg(null);
    setIsModalOpen(true);
  };

  const handleStateChange = (stateVal: string) => {
    let region = 'Central';
    if (['Penang', 'Perak', 'Kedah', 'Perlis'].includes(stateVal)) region = 'Northern';
    else if (['Johor', 'Melaka', 'Negeri Sembilan'].includes(stateVal)) region = 'Southern';
    else if (['Pahang', 'Kelantan', 'Terengganu'].includes(stateVal)) region = 'Eastern';
    else if (stateVal === 'Sarawak') region = 'Sarawak';
    else if (['Sabah', 'Labuan'].includes(stateVal)) region = 'Sabah';

    setFormData(prev => ({ ...prev, state: stateVal, region }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      setErrorMsg('Name is required.');
      return;
    }
    if (!formData.email.trim() || !formData.email.includes('@')) {
      setErrorMsg('Valid Email address is required.');
      return;
    }

    if (editingUser) {
      onUpdateUser({
        ...editingUser,
        ...formData,
        status: formData.userStatus
      });
    } else {
      const newUser: User = {
        id: generateId(),
        ...formData,
        status: formData.userStatus,
        avatarUrl: `https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&auto=format&fit=crop&q=80`
      };
      onAddUser(newUser);
    }

    setIsModalOpen(false);
  };

  const filteredUsers = users.filter(u => {
    const userStat = u.userStatus || u.status || 'Active';
    const matchesSearch =
      u.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      u.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      u.state.toLowerCase().includes(searchTerm.toLowerCase()) ||
      userStat.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (u.headOfSales && u.headOfSales.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (u.headOfDepartment && u.headOfDepartment.toLowerCase().includes(searchTerm.toLowerCase()));
    const matchesRole = roleFilter === 'ALL' || u.role === roleFilter;
    const matchesStatus = statusFilter === 'ALL' || userStat === statusFilter;
    return matchesSearch && matchesRole && matchesStatus;
  });

  const totalPages = Math.max(1, Math.ceil(filteredUsers.length / ITEMS_PER_PAGE));
  const safeCurrentPage = Math.min(currentPage, totalPages);
  const startIndex = (safeCurrentPage - 1) * ITEMS_PER_PAGE;
  const paginatedUsers = filteredUsers.slice(startIndex, startIndex + ITEMS_PER_PAGE);

  const getRoleBadgeStyle = (role: UserRole) => {
    switch (role) {
      case 'Sales Team': return 'bg-emerald-50 text-emerald-700 border-emerald-200';
      case 'Head of Sales': return 'bg-amber-50 text-amber-700 border-amber-200';
      case 'Device Team': return 'bg-blue-50 text-blue-700 border-blue-200';
      case 'Head of Operation': return 'bg-indigo-50 text-indigo-700 border-indigo-200';
      case 'Head of Department': return 'bg-teal-50 text-teal-700 border-teal-200';
      case 'Admin': return 'bg-purple-50 text-purple-700 border-purple-200';
    }
  };

  return (
    <div id="admin-user-management-container" className="space-y-6">
      {/* Top Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white rounded-2xl p-6 shadow-md flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-2 bg-indigo-600/40 rounded-xl border border-indigo-500/30">
              <Users className="w-5 h-5 text-indigo-300" />
            </span>
            <h2 className="text-lg font-bold">User Access Management</h2>
          </div>
          <p className="text-xs text-slate-300 mt-1 max-w-xl">
            Configure system users, assign role-based authorization levels (Sales Team, Head of Sales, Device Team, Head of Operation, Head of Department, Admin) and region assignments.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 self-start md:self-auto">
          <button
            id="btn-admin-bulk-download-users"
            onClick={() => downloadUsersCSV(users)}
            className="inline-flex items-center gap-2 bg-emerald-800/80 hover:bg-emerald-700 text-emerald-100 border border-emerald-600/60 px-4 py-2.5 rounded-xl text-xs font-semibold shadow-sm transition-all cursor-pointer whitespace-nowrap"
            title="Bulk download CSV containing all system user details"
          >
            <Download className="w-4 h-4 text-emerald-300" />
            <span>Bulk Download Users ({users.length})</span>
          </button>

          <button
            id="btn-admin-bulk-upload-users"
            onClick={() => setIsBulkUploadOpen(true)}
            className="inline-flex items-center gap-2 bg-indigo-900/80 hover:bg-indigo-800 text-indigo-100 border border-indigo-700/60 px-4 py-2.5 rounded-xl text-xs font-semibold shadow-sm transition-all cursor-pointer whitespace-nowrap"
          >
            <Upload className="w-4 h-4 text-indigo-300" />
            <span>Bulk Upload Users</span>
          </button>

          <button
            id="btn-admin-add-user"
            onClick={handleOpenAddModal}
            className="inline-flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2.5 rounded-xl text-xs font-semibold shadow-md shadow-indigo-500/20 transition-all cursor-pointer whitespace-nowrap"
          >
            <UserPlus className="w-4 h-4" />
            <span>Add New System User</span>
          </button>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm flex flex-col md:flex-row items-center justify-between gap-3">
        <div className="relative w-full md:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchTerm}
            onChange={e => { setSearchTerm(e.target.value); setCurrentPage(1); }}
            placeholder="Search users by name, email or state..."
            className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-xl text-xs outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-slate-500">Filter Role:</span>
            <select
              value={roleFilter}
              onChange={e => { setRoleFilter(e.target.value); setCurrentPage(1); }}
              className="border border-slate-300 rounded-xl px-3 py-2 text-xs bg-white outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="ALL">All Roles ({users.length})</option>
              <option value="Sales Team">Sales Team</option>
              <option value="Head of Sales">Head of Sales</option>
              <option value="Device Team">Device Team</option>
              <option value="Head of Operation">Head of Operation</option>
              <option value="Head of Department">Head of Department</option>
              <option value="Admin">Admin</option>
            </select>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-slate-500">User Status:</span>
            <select
              value={statusFilter}
              onChange={e => { setStatusFilter(e.target.value); setCurrentPage(1); }}
              className="border border-slate-300 rounded-xl px-3 py-2 text-xs bg-white outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="ALL">All Status</option>
              <option value="Active">Active</option>
              <option value="Inactive">Inactive</option>
            </select>
          </div>

          <button
            id="btn-admin-download-filtered-users"
            onClick={() => downloadUsersCSV(filteredUsers)}
            className="inline-flex items-center gap-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300 px-3 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer ml-auto md:ml-0"
            title="Download CSV of currently filtered user list"
          >
            <Download className="w-3.5 h-3.5 text-slate-600" />
            <span>Export CSV ({filteredUsers.length})</span>
          </button>
        </div>
      </div>

      {/* Users Table */}
      <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
        <table className="w-full text-left text-xs border-collapse">
          <thead className="bg-slate-100 text-slate-700 font-semibold border-b border-slate-200">
            <tr>
              <th className="p-3.5">1. User Name</th>
              <th className="p-3.5">2. Email Address</th>
              <th className="p-3.5">3. Assigned Role</th>
              <th className="p-3.5">4. State</th>
              <th className="p-3.5">5. Region</th>
              <th className="p-3.5">6. Head of Sales</th>
              <th className="p-3.5">7. Head of Department</th>
              <th className="p-3.5">8. User Status</th>
              <th className="p-3.5 text-center">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {paginatedUsers.length === 0 ? (
              <tr>
                <td colSpan={9} className="p-8 text-center text-slate-500">
                  No system users match the selected search criteria or filter.
                </td>
              </tr>
            ) : (
              paginatedUsers.map((u) => {
                const currentStatus = u.userStatus || u.status || 'Active';
                return (
                  <tr key={u.id} className={`hover:bg-slate-50 transition-colors ${u.id === currentUser.id ? 'bg-indigo-50/40 font-medium' : ''}`}>
                    <td className="p-3.5">
                      <div className="flex items-center gap-3">
                        <img
                          src={u.avatarUrl || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100'}
                          alt={u.name}
                          className="w-8 h-8 rounded-full object-cover border border-slate-200"
                        />
                        <div>
                          <div className="font-semibold text-slate-900 flex items-center gap-1.5">
                            {u.name}
                            {u.id === currentUser.id && (
                              <span className="text-[10px] bg-indigo-100 text-indigo-700 font-bold px-1.5 py-0.2 rounded">
                                You
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="p-3.5 text-slate-600 font-mono">{u.email}</td>
                    <td className="p-3.5">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs border font-medium ${getRoleBadgeStyle(u.role)}`}>
                        {u.role}
                      </span>
                    </td>
                    <td className="p-3.5 text-slate-700 font-medium">{u.state}</td>
                    <td className="p-3.5 text-slate-700">{u.region}</td>
                    <td className="p-3.5 text-slate-900 font-semibold">{u.headOfSales || '-'}</td>
                    <td className="p-3.5 text-teal-800 font-semibold">{u.headOfDepartment || '-'}</td>
                    <td className="p-3.5">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs border font-semibold ${
                        currentStatus === 'Active'
                          ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                          : 'bg-slate-100 text-slate-600 border-slate-300'
                      }`}>
                        <span className={`w-1.5 h-1.5 rounded-full mr-1.5 ${
                          currentStatus === 'Active' ? 'bg-emerald-500' : 'bg-slate-400'
                        }`}></span>
                        {currentStatus}
                      </span>
                    </td>
                    <td className="p-3.5 text-center">
                      <div className="flex items-center justify-center gap-1">
                        <button
                          id={`btn-edit-user-${u.id}`}
                          onClick={() => handleOpenEditModal(u)}
                          className="text-slate-500 hover:text-indigo-600 p-1.5 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
                          title="Edit User"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        {users.length > 1 && u.id !== currentUser.id && (
                          <button
                            id={`btn-delete-user-${u.id}`}
                            onClick={() => setUserToDelete(u)}
                            className="text-slate-400 hover:text-rose-600 p-1.5 rounded-lg hover:bg-rose-50 transition-colors cursor-pointer"
                            title="Delete User"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>

        {/* Pagination Bar */}
        <div className="px-4 py-3 bg-slate-50 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-600">
          <div>
            Showing <span className="font-semibold text-slate-900">{filteredUsers.length > 0 ? startIndex + 1 : 0}</span> to <span className="font-semibold text-slate-900">{Math.min(startIndex + ITEMS_PER_PAGE, filteredUsers.length)}</span> of <span className="font-semibold text-slate-900">{filteredUsers.length}</span> users
          </div>

          <div className="flex items-center gap-1.5">
            <button
              id="btn-user-pagination-prev"
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              disabled={safeCurrentPage === 1}
              className="p-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 disabled:opacity-40 disabled:hover:bg-white text-slate-700 font-semibold transition-all cursor-pointer disabled:cursor-not-allowed flex items-center gap-1 px-2.5"
            >
              <ChevronLeft className="w-4 h-4" />
              <span>Previous</span>
            </button>

            <div className="flex items-center gap-1 px-1">
              {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => (
                <button
                  key={page}
                  id={`btn-user-page-${page}`}
                  onClick={() => setCurrentPage(page)}
                  className={`w-7 h-7 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                    page === safeCurrentPage
                      ? 'bg-indigo-600 text-white shadow-sm'
                      : 'hover:bg-slate-200 text-slate-700'
                  }`}
                >
                  {page}
                </button>
              ))}
            </div>

            <button
              id="btn-user-pagination-next"
              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
              disabled={safeCurrentPage === totalPages}
              className="p-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 disabled:opacity-40 disabled:hover:bg-white text-slate-700 font-semibold transition-all cursor-pointer disabled:cursor-not-allowed flex items-center gap-1 px-2.5"
            >
              <span>Next</span>
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Add / Edit User Modal */}
      {isModalOpen && (
        <div id="admin-user-modal-backdrop" className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden border border-slate-200">
            <div className="bg-slate-900 text-white px-6 py-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Shield className="w-5 h-5 text-indigo-400" />
                <h3 className="text-sm font-bold">
                  {editingUser ? 'Edit System User' : 'Add New System User'}
                </h3>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              {errorMsg && (
                <div className="p-3 bg-rose-50 text-rose-700 text-xs rounded-xl border border-rose-200">
                  {errorMsg}
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  1. Name *
                </label>
                <input
                  type="text"
                  value={formData.name || ''}
                  onChange={e => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g. Tan Sri Roslan Ibrahim"
                  className="w-full border border-slate-300 rounded-xl px-3 py-2 text-xs outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  2. Email *
                </label>
                <input
                  type="email"
                  value={formData.email || ''}
                  onChange={e => setFormData({ ...formData, email: e.target.value })}
                  placeholder="e.g. roslan.ibrahim@company.com"
                  className="w-full border border-slate-300 rounded-xl px-3 py-2 text-xs outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  3. Roles *
                </label>
                <select
                  value={formData.role || 'Sales Team'}
                  onChange={e => setFormData({ ...formData, role: e.target.value as UserRole })}
                  className="w-full border border-slate-300 rounded-xl px-3 py-2 text-xs bg-white outline-none focus:ring-2 focus:ring-indigo-500 font-medium"
                >
                  <option value="Sales Team">a. Sales Team</option>
                  <option value="Head of Sales">b. Head of Sales</option>
                  <option value="Device Team">c. Device Team</option>
                  <option value="Head of Operation">d. Head of Operation</option>
                  <option value="Head of Department">e. Head of Department</option>
                  <option value="Admin">f. Admin</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    4. State *
                  </label>
                  <select
                    value={formData.state || 'Selangor'}
                    onChange={e => handleStateChange(e.target.value)}
                    className="w-full border border-slate-300 rounded-xl px-3 py-2 text-xs bg-white outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    {MALAYSIAN_STATES.map(s => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    5. Region *
                  </label>
                  <select
                    value={formData.region || 'Central'}
                    onChange={e => setFormData({ ...formData, region: e.target.value })}
                    className="w-full border border-slate-300 rounded-xl px-3 py-2 text-xs bg-white outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    {MALAYSIAN_REGIONS.map(r => (
                      <option key={r} value={r}>{r}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  6. Head of Sales *
                </label>
                <div className="space-y-1.5">
                  <input
                    type="text"
                    list="head-of-sales-options"
                    value={formData.headOfSales || ''}
                    onChange={e => setFormData({ ...formData, headOfSales: e.target.value })}
                    placeholder="e.g. Dato' Wong Wei Sheng"
                    className="w-full border border-slate-300 rounded-xl px-3 py-2 text-xs outline-none focus:ring-2 focus:ring-indigo-500 font-medium"
                  />
                  <datalist id="head-of-sales-options">
                    {users.filter(u => u.role === 'Head of Sales').map(hos => (
                      <option key={hos.id} value={hos.name}>{hos.name} ({hos.region})</option>
                    ))}
                    <option value="Dato' Wong Wei Sheng" />
                    <option value="Siti Sarah" />
                  </datalist>
                  <p className="text-[11px] text-slate-400">Select or enter designated Head of Sales responsible for this user.</p>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  7. Head of Department
                </label>
                <div className="space-y-1.5">
                  <input
                    type="text"
                    list="head-of-department-options"
                    value={formData.headOfDepartment || ''}
                    onChange={e => setFormData({ ...formData, headOfDepartment: e.target.value })}
                    placeholder="e.g. Ir. Ahmad Rizal"
                    className="w-full border border-slate-300 rounded-xl px-3 py-2 text-xs outline-none focus:ring-2 focus:ring-indigo-500 font-medium"
                  />
                  <datalist id="head-of-department-options">
                    {users.filter(u => u.role === 'Head of Department').map(hod => (
                      <option key={hod.id} value={hod.name}>{hod.name} ({hod.region})</option>
                    ))}
                    <option value="Ir. Ahmad Rizal" />
                  </datalist>
                  <p className="text-[11px] text-slate-400">Select or enter designated Head of Department responsible for this user.</p>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  8. User Status *
                </label>
                <select
                  id="select-user-status"
                  value={formData.userStatus || 'Active'}
                  onChange={e => setFormData({ ...formData, userStatus: e.target.value as UserStatus })}
                  className="w-full border border-slate-300 rounded-xl px-3 py-2 text-xs bg-white outline-none focus:ring-2 focus:ring-indigo-500 font-medium"
                >
                  <option value="Active">Active</option>
                  <option value="Inactive">Inactive</option>
                </select>
              </div>

              <div className="pt-4 flex items-center justify-end gap-2 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 border border-slate-300 text-slate-700 rounded-xl text-xs font-semibold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  id="btn-save-user-form"
                  type="submit"
                  className="inline-flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-500 text-white px-5 py-2 rounded-xl text-xs font-semibold shadow-md shadow-indigo-500/20 cursor-pointer"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>{editingUser ? 'Save Changes' : 'Create User'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete User Modal */}
      {userToDelete && (
        <div id="modal-delete-user-backdrop" className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden border border-slate-200">
            <div className="bg-rose-600 text-white px-6 py-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-white" />
                <h3 className="text-sm font-bold">Delete User Access</h3>
              </div>
              <button
                onClick={() => setUserToDelete(null)}
                className="text-rose-200 hover:text-white p-1 rounded-lg transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <p className="text-xs text-slate-600">
                Are you sure you want to delete <strong className="text-slate-800">{userToDelete.name}</strong> ({userToDelete.email})? This user will no longer be able to log in or manage requests.
              </p>

              <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs space-y-1">
                <div><span className="text-slate-500">Role:</span> <span className="font-semibold text-slate-800">{userToDelete.role}</span></div>
                <div><span className="text-slate-500">State / Region:</span> <span className="font-semibold text-slate-800">{userToDelete.state} ({userToDelete.region})</span></div>
              </div>

              <div className="pt-2 flex items-center justify-end gap-2 border-t border-slate-200">
                <button
                  onClick={() => setUserToDelete(null)}
                  className="px-4 py-2 border border-slate-300 text-slate-700 rounded-xl text-xs font-semibold hover:bg-slate-50 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  id="btn-confirm-delete-user"
                  onClick={() => {
                    onDeleteUser(userToDelete.id);
                    setUserToDelete(null);
                  }}
                  className="inline-flex items-center gap-1.5 bg-rose-600 hover:bg-rose-700 text-white px-5 py-2 rounded-xl text-xs font-bold shadow-md shadow-rose-500/20 cursor-pointer"
                >
                  <Trash2 className="w-4 h-4" />
                  <span>Delete User</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Bulk Upload Users Modal */}
      <UserBulkUploadModal
        isOpen={isBulkUploadOpen}
        onClose={() => setIsBulkUploadOpen(false)}
        onImportUsers={handleImportUsers}
        existingUsers={users}
      />
    </div>
  );
};
