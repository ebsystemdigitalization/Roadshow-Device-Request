import React from 'react';
import { User, UserRole } from '../types';
import { Smartphone, Users, Layers, BarChart3, Plus, Upload, Barcode, LogOut } from 'lucide-react';

interface NavbarProps {
  currentUser: User;
  onLogout: () => void;
  activeTab: 'requests' | 'analytics' | 'admin' | 'imei-inventory';
  onSelectTab: (tab: 'requests' | 'analytics' | 'admin' | 'imei-inventory') => void;
  onOpenCreateModal?: () => void;
  onOpenInventoryModal?: () => void;
  pendingCount?: number;
}

export const Navbar: React.FC<NavbarProps> = ({
  currentUser,
  onLogout,
  activeTab,
  onSelectTab,
  onOpenCreateModal,
  onOpenInventoryModal,
  pendingCount = 0
}) => {
  const getRoleBadgeColor = (role: UserRole) => {
    switch (role) {
      case 'Sales Team': return 'bg-emerald-500/20 text-emerald-300 border-emerald-400/30';
      case 'Head of Sales': return 'bg-amber-500/20 text-amber-300 border-amber-400/30';
      case 'Device Team': return 'bg-blue-500/20 text-blue-300 border-blue-400/30';
      case 'Head of Operation': return 'bg-indigo-500/20 text-indigo-300 border-indigo-400/30';
      case 'Head of Department': return 'bg-teal-500/20 text-teal-300 border-teal-400/30';
      case 'Admin': return 'bg-purple-500/20 text-purple-300 border-purple-400/30';
      default: return 'bg-slate-700 text-slate-300 border-slate-600';
    }
  };

  return (
    <header id="app-header" className="bg-slate-900 text-white sticky top-0 z-40 shadow-md border-b border-slate-800">
      {/* Main Navbar */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-2.5 flex flex-col md:flex-row md:items-center justify-between gap-3">
        {/* Brand */}
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-500 flex items-center justify-center text-white shadow-lg shadow-blue-500/20">
            <Smartphone className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-base font-bold tracking-tight text-white flex items-center gap-2">
              Roadshow Device Request
              <span className="text-[10px] bg-blue-500/20 text-blue-300 font-semibold px-2 py-0.5 rounded border border-blue-400/30">
                Enterprise
              </span>
            </h1>
            <p className="text-[11px] text-slate-400">
              Multi-tier roadshow device approval & inventory tracking portal
            </p>
          </div>
        </div>

        {/* Center/Right Navigation Tabs, Action Buttons & User Profile */}
        <div className="flex items-center gap-2.5 flex-wrap justify-between md:justify-end">
          <nav className="flex items-center bg-slate-800/90 p-1 rounded-xl border border-slate-700/80">
            <button
              id="tab-btn-requests"
              onClick={() => onSelectTab('requests')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
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
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
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
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
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
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
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
              className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-500 text-white px-3 py-1.5 rounded-xl text-xs font-semibold shadow-sm transition-all cursor-pointer"
            >
              <Upload className="w-3.5 h-3.5" />
              <span>Upload Inventory</span>
            </button>
          )}

          {/* Create Request button for Active Sales Team users */}
          {currentUser.role === 'Sales Team' && (currentUser.userStatus || currentUser.status || 'Active') === 'Active' && onOpenCreateModal && (
            <button
              id="btn-new-request"
              onClick={onOpenCreateModal}
              className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-500 text-white px-3 py-1.5 rounded-xl text-xs font-semibold shadow-sm transition-all cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>New Request</span>
            </button>
          )}

          {/* Authenticated User Profile & Logout */}
          <div className="flex items-center gap-2 pl-2 border-l border-slate-700/80">
            <div className="flex items-center gap-2 bg-slate-800/80 px-2.5 py-1 rounded-xl border border-slate-700/60">
              <img
                src={currentUser.avatarUrl || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100'}
                alt={currentUser.name}
                className="w-7 h-7 rounded-full object-cover border border-slate-600"
              />
              <div className="text-left">
                <div className="text-xs font-semibold text-white leading-tight flex items-center gap-1.5">
                  <span>{currentUser.name}</span>
                </div>
                <div className="flex items-center gap-1 mt-0.5">
                  <span className={`text-[10px] px-1.5 py-0.2 rounded border font-medium ${getRoleBadgeColor(currentUser.role)}`}>
                    {currentUser.role}
                  </span>
                </div>
              </div>
            </div>

            <button
              id="btn-navbar-logout"
              onClick={onLogout}
              className="flex items-center gap-1.5 bg-slate-800 hover:bg-rose-900/60 hover:border-rose-700/60 text-slate-300 hover:text-rose-200 px-3 py-2 rounded-xl text-xs font-medium border border-slate-700/80 transition-all cursor-pointer"
              title="Sign out of current account"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Logout</span>
            </button>
          </div>
        </div>
      </div>
    </header>
  );
};
