import React from 'react';
import { User, UserRole } from '../types';
import { Smartphone, Users, ShieldAlert, ChevronDown, Check, Layers, BarChart3, Plus, Upload, Barcode, LogOut } from 'lucide-react';

interface NavbarProps {
  currentUser: User;
  allUsers: User[];
  onSelectUser: (user: User) => void;
  activeTab: 'requests' | 'analytics' | 'admin' | 'imei-inventory';
  onSelectTab: (tab: 'requests' | 'analytics' | 'admin' | 'imei-inventory') => void;
  onOpenCreateModal?: () => void;
  onOpenInventoryModal?: () => void;
  onLogout?: () => void;
  pendingCount?: number;
}

export const Navbar: React.FC<NavbarProps> = ({
  currentUser,
  allUsers,
  onSelectUser,
  activeTab,
  onSelectTab,
  onOpenCreateModal,
  onOpenInventoryModal,
  onLogout,
  pendingCount = 0
}) => {
  const [dropdownOpen, setDropdownOpen] = React.useState(false);

  const getRoleBadgeColor = (role: UserRole) => {
    switch (role) {
      case 'Sales Team': return 'bg-emerald-100 text-emerald-800 border-emerald-200';
      case 'Head of Sales': return 'bg-amber-100 text-amber-800 border-amber-200';
      case 'Head of Unit': return 'bg-cyan-100 text-cyan-800 border-cyan-200';
      case 'Device Team': return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'Head of Operation': return 'bg-indigo-100 text-indigo-800 border-indigo-200';
      case 'Head of Department': return 'bg-teal-100 text-teal-800 border-teal-200';
      case 'Admin': return 'bg-purple-100 text-purple-800 border-purple-200';
    }
  };

  return (
    <header id="app-header" className="bg-slate-900 text-white sticky top-0 z-40 shadow-md">
      {/* Top Session / Persona Bar */}
      <div className="bg-slate-800/90 border-b border-slate-700/60 px-4 py-1.5 text-xs flex flex-wrap items-center justify-between gap-2">
        {currentUser.role === 'Admin' ? (
          <>
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1 font-medium text-amber-400 bg-amber-950/60 px-2 py-0.5 rounded border border-amber-800/50">
                <ShieldAlert className="w-3.5 h-3.5" />
                Interactive Persona Simulation:
              </span>
              <span className="text-slate-300">
                Switch user below to test role-specific workflows
              </span>
            </div>

            {/* Admin User Switcher Dropdown & Logout */}
            <div className="flex items-center gap-2">
              <div className="relative">
                <button
                  id="btn-user-switcher"
                  onClick={() => setDropdownOpen(!dropdownOpen)}
                  className="flex items-center gap-2 bg-slate-700/80 hover:bg-slate-700 text-slate-100 px-2.5 py-1 rounded border border-slate-600 transition-colors cursor-pointer text-xs font-medium"
                >
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                  <span>Switch Role:</span>
                  <span className="font-semibold text-white">{currentUser.name}</span>
                  <span className={`text-[10px] px-1.5 py-0.2 rounded border ${getRoleBadgeColor(currentUser.role)}`}>
                    {currentUser.role}
                  </span>
                  <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
                </button>

                {dropdownOpen && (
                  <div className="absolute right-0 mt-1 w-72 bg-white text-slate-900 rounded-lg shadow-xl border border-slate-200 py-1 z-50">
                    <div className="px-3 py-1.5 text-[11px] font-semibold text-slate-400 uppercase tracking-wider border-b border-slate-100">
                      Select Active User Persona
                    </div>
                    <div className="max-h-64 overflow-y-auto divide-y divide-slate-100">
                      {allUsers
                        .filter(u => (u.userStatus || u.status || 'Active') === 'Active')
                        .map((u) => (
                        <button
                          key={u.id}
                          onClick={() => {
                            onSelectUser(u);
                            setDropdownOpen(false);
                          }}
                          className={`w-full text-left px-3 py-2 flex items-center justify-between hover:bg-slate-50 transition-colors text-xs ${
                            u.id === currentUser.id ? 'bg-blue-50/80 font-medium' : ''
                          }`}
                        >
                          <div>
                            <div className="font-medium text-slate-800 leading-tight">{u.name}</div>
                            <div className="text-[11px] text-slate-500">{u.role} &bull; {u.region}</div>
                          </div>
                          {u.id === currentUser.id && (
                            <Check className="w-4 h-4 text-blue-600" />
                          )}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {onLogout && (
                <button
                  id="btn-navbar-logout-top"
                  onClick={onLogout}
                  className="flex items-center gap-1.5 bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 hover:text-rose-200 px-2.5 py-1 rounded border border-rose-400/30 text-xs font-semibold transition-all cursor-pointer"
                  title="Log out of the system"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span>Log Out</span>
                </button>
              )}
            </div>
          </>
        ) : (
          <div className="flex items-center justify-end gap-3 w-full ml-auto">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-400" />
              <span className="text-slate-400">Active User:</span>
              <span className="font-semibold text-white">{currentUser.name}</span>
              <span className="text-slate-400 text-[11px]">({currentUser.email})</span>
              <span className={`text-[10px] px-2 py-0.5 rounded-full border ${getRoleBadgeColor(currentUser.role)} font-semibold`}>
                {currentUser.role}
              </span>
            </div>

            {/* Non-Admin Logout Button */}
            {onLogout && (
              <button
                id="btn-navbar-logout-top"
                onClick={onLogout}
                className="flex items-center gap-1.5 bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 hover:text-rose-200 px-2.5 py-1 rounded border border-rose-400/30 text-xs font-semibold transition-all cursor-pointer"
                title="Log out of the system"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>Log Out</span>
              </button>
            )}
          </div>
        )}
      </div>

      {/* Main Navbar */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        {/* Brand */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-500 flex items-center justify-center text-white shadow-lg shadow-blue-500/20">
            <Smartphone className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-lg font-bold tracking-tight text-white flex items-center gap-2">
              Roadshow Device Request
              <span className="text-[10px] bg-blue-500/20 text-blue-300 font-semibold px-2 py-0.5 rounded border border-blue-400/30">
                Enterprise
              </span>
            </h1>
            <p className="text-xs text-slate-400">
              Multi-tier roadshow device approval & inventory tracking portal
            </p>
          </div>
        </div>

        {/* Navigation Tabs & Actions */}
        <div className="flex items-center gap-2 flex-wrap">
          <nav className="flex items-center bg-slate-800/80 p-1 rounded-lg border border-slate-700/80">
            <button
              id="tab-btn-requests"
              onClick={() => onSelectTab('requests')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                activeTab === 'requests'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-slate-300 hover:text-white hover:bg-slate-700/50'
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              <span>Requests</span>
              {pendingCount > 0 && (
                <span className="bg-amber-400 text-slate-950 font-bold text-[10px] px-1.5 py-0.2 rounded-full ml-1">
                  {pendingCount}
                </span>
              )}
            </button>

            <button
              id="tab-btn-analytics"
              onClick={() => onSelectTab('analytics')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                activeTab === 'analytics'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-slate-300 hover:text-white hover:bg-slate-700/50'
              }`}
            >
              <BarChart3 className="w-3.5 h-3.5" />
              <span>Dashboard</span>
            </button>

            {(currentUser.role === 'Device Team' || currentUser.role === 'Admin') && (
              <button
                id="tab-btn-imei-inventory"
                onClick={() => onSelectTab('imei-inventory')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                  activeTab === 'imei-inventory'
                    ? 'bg-purple-600 text-white shadow-sm font-bold'
                    : 'text-purple-300 hover:text-white hover:bg-slate-700/50'
                }`}
              >
                <Barcode className="w-3.5 h-3.5" />
                <span>IMEI Inventory</span>
              </button>
            )}

            {currentUser.role === 'Admin' && (
              <button
                id="tab-btn-admin"
                onClick={() => onSelectTab('admin')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                  activeTab === 'admin'
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'text-slate-300 hover:text-white hover:bg-slate-700/50'
                }`}
              >
                <Users className="w-3.5 h-3.5" />
                <span>User Management</span>
              </button>
            )}
          </nav>

          {/* Upload Device Inventory button for Device Team & Admin */}
          {(currentUser.role === 'Device Team' || currentUser.role === 'Admin') && onOpenInventoryModal && (
            <button
              id="btn-upload-device-inventory"
              onClick={onOpenInventoryModal}
              className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-500 text-white px-3 py-1.5 rounded-lg text-xs font-semibold shadow-sm transition-all cursor-pointer"
            >
              <Upload className="w-4 h-4" />
              <span>Upload Device Inventory</span>
            </button>
          )}

          {/* Create Request button for Active Sales Team users */}
          {currentUser.role === 'Sales Team' && (currentUser.userStatus || currentUser.status || 'Active') === 'Active' && onOpenCreateModal && (
            <button
              id="btn-new-request"
              onClick={onOpenCreateModal}
              className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-500 text-white px-3 py-1.5 rounded-lg text-xs font-semibold shadow-sm transition-all cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>New Request</span>
            </button>
          )}
        </div>
      </div>
    </header>
  );
};
