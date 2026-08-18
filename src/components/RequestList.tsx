import React, { useState } from 'react';
import { RoadshowRequest, User, RequestStatus, ImeiInventoryItem, MALAYSIAN_STATES, MALAYSIAN_REGIONS } from '../types';
import { StatusBadge } from './StatusBadge';
import { formatRM, formatDate, isRequestForHeadOfSales, isRequestForHeadOfDepartment } from '../utils/formatters';
import { Search, Filter, Layers, Eye, Smartphone, Calendar, MapPin, AlertCircle, Clock, Plus, ChevronRight, Trash2, AlertTriangle, X, Upload, CheckCircle2, Barcode } from 'lucide-react';
import { ImeiDetailModal, ImeiDetailRecord } from './ImeiDetailModal';

interface RequestListProps {
  requests: RoadshowRequest[];
  currentUser: User;
  users?: User[];
  imeiInventory?: ImeiInventoryItem[];
  onSelectRequest: (req: RoadshowRequest) => void;
  onOpenCreateModal: () => void;
  onOpenDeviceTeamEdit?: (req: RoadshowRequest) => void;
  onDeleteRequest?: (reqId: string) => void;
  onOpenInventoryModal?: () => void;
  onSaveImeiDetails?: (requestId: string, updatedRecords: ImeiDetailRecord[]) => void;
}

export const RequestList: React.FC<RequestListProps> = ({
  requests,
  currentUser,
  users = [],
  imeiInventory = [],
  onSelectRequest,
  onOpenCreateModal,
  onOpenDeviceTeamEdit,
  onDeleteRequest,
  onOpenInventoryModal,
  onSaveImeiDetails
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [regionFilter, setRegionFilter] = useState<string>('ALL');
  const [stateFilter, setStateFilter] = useState<string>('ALL');
  const [requestToDelete, setRequestToDelete] = useState<RoadshowRequest | null>(null);
  const [selectedImeiDetailRequest, setSelectedImeiDetailRequest] = useState<RoadshowRequest | null>(null);

  // Filter requests based on user role:
  // - Sales Team only views what they submit
  // - Head of Sales only views requests for users tagged to them in User Access Management
  // - Head of Department only views requests for users tagged to them in User Access Management
  const roleBasedRequests = requests.filter(r => {
    if (currentUser.role === 'Sales Team') {
      return r.createdByUserId === currentUser.id;
    }
    if (currentUser.role === 'Head of Sales') {
      return isRequestForHeadOfSales(r, currentUser, users);
    }
    if (currentUser.role === 'Head of Department') {
      return isRequestForHeadOfDepartment(r, currentUser, users);
    }
    return true;
  });

  // Pending count tailored to current logged in role
  const pendingRoleActionRequests = roleBasedRequests.filter(r => {
    if (currentUser.role === 'Head of Sales') return r.status === 'Pending Head of Sales';
    if (currentUser.role === 'Head of Department') return r.status !== 'Approved' && r.status !== 'Rejected';
    if (currentUser.role === 'Device Team') return r.status === 'Under Review';
    if (currentUser.role === 'Head of Operation') {
      if (r.status !== 'Pending Head of Operation') return false;
      if (r.assignedHeadOfOperation && r.assignedHeadOfOperation.trim().toLowerCase() !== currentUser.name.trim().toLowerCase()) {
        return false;
      }
      return true;
    }
    if (currentUser.role === 'Sales Team') return (r.status === 'Draft' || r.status === 'Pending Sales Acceptance') && r.createdByUserId === currentUser.id;
    if (currentUser.role === 'Admin') return r.status !== 'Approved' && r.status !== 'Rejected';
    return false;
  });

  const handleViewPendingItems = () => {
    setStatusFilter('PENDING_MY_ACTION');
    setSearchTerm('');
    setRegionFilter('ALL');
    setStateFilter('ALL');

    const tableEl = document.getElementById('requests-table-card') || document.getElementById('request-list-container');
    if (tableEl) {
      tableEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  const getRolePendingText = () => {
    if (currentUser.role === 'Head of Sales') return 'pending your approval as Head of Sales';
    if (currentUser.role === 'Head of Department') return 'from users tagged to your department requiring review or progress';
    if (currentUser.role === 'Device Team') return 'under Device Team review & inventory allocation';
    if (currentUser.role === 'Head of Operation') return 'awaiting your final Head of Operation approval';
    if (currentUser.role === 'Sales Team') return 'saved in your Drafts or pending your allocation acceptance';
    if (currentUser.role === 'Admin') return 'currently requiring workflow progress or review';
    return 'pending action';
  };

  const filteredRequests = roleBasedRequests.filter(r => {
    const term = searchTerm.toLowerCase();
    const matchesSearch =
      r.requestCode.toLowerCase().includes(term) ||
      r.partA.eventName.toLowerCase().includes(term) ||
      r.partA.location.toLowerCase().includes(term) ||
      r.partA.organizer.toLowerCase().includes(term) ||
      r.createdByName.toLowerCase().includes(term);

    const matchesStatus =
      statusFilter === 'ALL'
        ? true
        : statusFilter === 'PENDING_MY_ACTION'
        ? (
            (currentUser.role === 'Head of Sales' && r.status === 'Pending Head of Sales') ||
            (currentUser.role === 'Head of Department' && r.status !== 'Approved' && r.status !== 'Rejected') ||
            (currentUser.role === 'Device Team' && r.status === 'Under Review') ||
            (currentUser.role === 'Head of Operation' && r.status === 'Pending Head of Operation' && (!r.assignedHeadOfOperation || r.assignedHeadOfOperation.trim().toLowerCase() === currentUser.name.trim().toLowerCase())) ||
            (currentUser.role === 'Sales Team' && r.createdByUserId === currentUser.id && (r.status === 'Draft' || r.status === 'Pending Sales Acceptance')) ||
            (currentUser.role === 'Admin' && r.status !== 'Approved' && r.status !== 'Rejected')
          )
        : r.status === statusFilter;

    const matchesRegion = regionFilter === 'ALL' || r.partA.region === regionFilter;
    const matchesState = stateFilter === 'ALL' || r.partA.state === stateFilter;

    return matchesSearch && matchesStatus && matchesRegion && matchesState;
  });

  const renderImeiStatusBadge = (req: RoadshowRequest, totalUnits: number) => {
    const countFromPartB = (req.partB || []).reduce((acc, d) => {
      if (!d.imei || !d.imei.trim()) return acc;
      const list = d.imei.split(',').map(s => s.trim()).filter(Boolean);
      return acc + Math.max(1, list.length);
    }, 0);

    const countFromInventory = (imeiInventory || []).filter(
      i => (i.requestId && i.requestId === req.id) || 
           (i.requestCode && req.requestCode && i.requestCode.trim().toLowerCase() === req.requestCode.trim().toLowerCase())
    ).length;

    const assignedCount = Math.max(countFromPartB, countFromInventory);

    if (totalUnits === 0) {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-medium bg-slate-100 text-slate-600 border border-slate-200">
          <Barcode className="w-3.5 h-3.5 text-slate-400" />
          <span>No Devices</span>
        </span>
      );
    }

    if (assignedCount > 0) {
      const isAll = assignedCount >= totalUnits;
      return (
        <button
          type="button"
          id={`btn-view-imeis-${req.id}`}
          onClick={(e) => {
            e.stopPropagation();
            setSelectedImeiDetailRequest(req);
          }}
          className="group flex flex-col items-start gap-0.5 cursor-pointer text-left focus:outline-none"
          title="Click to view all IMEI details"
        >
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300 group-hover:bg-emerald-200 group-hover:border-emerald-400 group-hover:shadow-xs transition-all">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
            <span>Uploaded</span>
            <Eye className="w-3 h-3 text-emerald-700 ml-0.5 opacity-80 group-hover:opacity-100 group-hover:scale-110 transition-all" />
          </span>
          <span className="text-[10px] text-emerald-700 font-medium pl-1 group-hover:underline flex items-center gap-0.5">
            {isAll ? `${assignedCount}/${totalUnits} units (View IMEIs)` : `${assignedCount}/${totalUnits} uploaded (View IMEIs)`}
          </span>
        </button>
      );
    }

    return (
      <div className="flex flex-col items-start gap-0.5">
        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-medium bg-slate-100 text-slate-600 border border-slate-200">
          <Barcode className="w-3.5 h-3.5 text-slate-400" />
          <span>Pending Upload</span>
        </span>
        <span className="text-[10px] text-slate-400 pl-1">0/{totalUnits} IMEIs</span>
      </div>
    );
  };

  return (
    <div id="request-list-container" className="space-y-5">
      {/* Role Action Notification Alert Banner */}
      {pendingRoleActionRequests.length > 0 && (
        <div className="bg-amber-500/10 border border-amber-500/30 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-amber-950">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-amber-500/20 text-amber-800 rounded-xl">
              <Clock className="w-5 h-5 animate-pulse" />
            </div>
            <div>
              <span className="font-bold text-amber-900 text-sm block">
                Action Required ({pendingRoleActionRequests.length} Requests)
              </span>
              <span>
                You have {pendingRoleActionRequests.length} roadshow requests {getRolePendingText()}.
              </span>
            </div>
          </div>

          <button
            id="btn-filter-pending-action"
            onClick={handleViewPendingItems}
            className="inline-flex items-center gap-1.5 bg-amber-600 hover:bg-amber-700 active:scale-95 text-white font-semibold px-3.5 py-1.5 rounded-xl transition-all cursor-pointer whitespace-nowrap self-start sm:self-auto shadow-sm"
          >
            <span>View Pending Items</span>
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Filter and Control Bar */}
      <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {/* Search */}
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              placeholder="Search code, event, location..."
              className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-xl text-xs outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Status Filter */}
          <div>
            <select
              value={statusFilter}
              onChange={e => setStatusFilter(e.target.value)}
              className="w-full border border-slate-300 rounded-xl px-3 py-2 text-xs bg-white outline-none focus:ring-2 focus:ring-blue-500 font-medium"
            >
              <option value="ALL">All Statuses ({roleBasedRequests.length})</option>
              <option value="PENDING_MY_ACTION">⚡ Pending My Action ({pendingRoleActionRequests.length})</option>
              <option value="Draft">Draft</option>
              <option value="Pending Head of Sales">Pending Head of Sales</option>
              <option value="Under Review">Under Review (Device Team)</option>
              <option value="Pending Sales Acceptance">Pending Sales Acceptance</option>
              <option value="Pending Head of Operation">Pending Head of Operation</option>
              <option value="Approved">Approved</option>
              <option value="Rejected">Rejected</option>
            </select>
          </div>

          {/* Region Filter */}
          <div>
            <select
              value={regionFilter}
              onChange={e => setRegionFilter(e.target.value)}
              className="w-full border border-slate-300 rounded-xl px-3 py-2 text-xs bg-white outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="ALL">All Regions</option>
              {MALAYSIAN_REGIONS.map(r => (
                <option key={r} value={r}>{r}</option>
              ))}
            </select>
          </div>

          {/* State Filter */}
          <div>
            <select
              value={stateFilter}
              onChange={e => setStateFilter(e.target.value)}
              className="w-full border border-slate-300 rounded-xl px-3 py-2 text-xs bg-white outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="ALL">All States</option>
              {MALAYSIAN_STATES.map(s => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Status Pills Quick Bar */}
        <div className="flex items-center justify-between pt-2 border-t border-slate-100 flex-wrap gap-2 text-xs">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-slate-400 font-medium">Quick Filter:</span>
            <button
              onClick={() => setStatusFilter('ALL')}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-colors cursor-pointer ${
                statusFilter === 'ALL' ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              All ({roleBasedRequests.length})
            </button>
            <button
              onClick={handleViewPendingItems}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-colors cursor-pointer ${
                statusFilter === 'PENDING_MY_ACTION' ? 'bg-amber-600 text-white' : 'bg-amber-50 text-amber-800 hover:bg-amber-100'
              }`}
            >
              ⚡ Pending My Action ({pendingRoleActionRequests.length})
            </button>
            <button
              onClick={() => setStatusFilter('Pending Head of Sales')}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-colors cursor-pointer ${
                statusFilter === 'Pending Head of Sales' ? 'bg-amber-600 text-white' : 'bg-amber-50 text-amber-800 hover:bg-amber-100'
              }`}
            >
              Head of Sales ({roleBasedRequests.filter(r => r.status === 'Pending Head of Sales').length})
            </button>
            <button
              onClick={() => setStatusFilter('Under Review')}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-colors cursor-pointer ${
                statusFilter === 'Under Review' ? 'bg-blue-600 text-white' : 'bg-blue-50 text-blue-800 hover:bg-blue-100'
              }`}
            >
              Device Team ({roleBasedRequests.filter(r => r.status === 'Under Review').length})
            </button>
            <button
              onClick={() => setStatusFilter('Pending Sales Acceptance')}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-colors cursor-pointer ${
                statusFilter === 'Pending Sales Acceptance' ? 'bg-purple-600 text-white' : 'bg-purple-50 text-purple-800 hover:bg-purple-100'
              }`}
            >
              Sales Acceptance ({roleBasedRequests.filter(r => r.status === 'Pending Sales Acceptance').length})
            </button>
            <button
              onClick={() => setStatusFilter('Pending Head of Operation')}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-colors cursor-pointer ${
                statusFilter === 'Pending Head of Operation' ? 'bg-indigo-600 text-white' : 'bg-indigo-50 text-indigo-800 hover:bg-indigo-100'
              }`}
            >
              Head of Ops ({roleBasedRequests.filter(r => r.status === 'Pending Head of Operation').length})
            </button>
            <button
              onClick={() => setStatusFilter('Approved')}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-colors cursor-pointer ${
                statusFilter === 'Approved' ? 'bg-emerald-600 text-white' : 'bg-emerald-50 text-emerald-800 hover:bg-emerald-100'
              }`}
            >
              Approved ({roleBasedRequests.filter(r => r.status === 'Approved').length})
            </button>
          </div>

          <div className="flex items-center gap-3">
            {(currentUser.role === 'Device Team' || currentUser.role === 'Admin') && onOpenInventoryModal && (
              <button
                id="btn-upload-inventory-request-list"
                onClick={onOpenInventoryModal}
                className="inline-flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded-xl text-xs font-bold shadow-sm transition-all cursor-pointer"
              >
                <Upload className="w-4 h-4" />
                <span>Upload Device Inventory</span>
              </button>
            )}

            <div className="text-slate-500">
              Showing <span className="font-bold text-slate-900">{filteredRequests.length}</span> of {roleBasedRequests.length} requests
            </div>
          </div>
        </div>
      </div>

      {/* Request List Cards/Table */}
      {filteredRequests.length === 0 ? (
        <div className="bg-white rounded-2xl p-12 border border-slate-200 text-center space-y-3">
          <Layers className="w-10 h-10 text-slate-300 mx-auto" />
          <h3 className="text-sm font-bold text-slate-700">No Roadshow Requests Found</h3>
          <p className="text-xs text-slate-400 max-w-sm mx-auto">
            No requests matched your current search and filter criteria. Try resetting the status or region filter.
          </p>
          {currentUser.role === 'Sales Team' && (currentUser.userStatus || currentUser.status || 'Active') === 'Active' && (
            <button
              onClick={onOpenCreateModal}
              className="inline-flex items-center gap-1.5 bg-emerald-600 text-white px-4 py-2 rounded-xl text-xs font-semibold hover:bg-emerald-500 transition-colors cursor-pointer mt-2"
            >
              <Plus className="w-4 h-4" />
              <span>Create New Request</span>
            </button>
          )}
        </div>
      ) : (
        <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
          <table className="w-full text-left text-xs border-collapse">
            <thead className="bg-slate-100 text-slate-700 font-semibold border-b border-slate-200">
              <tr>
                <th className="p-3.5">Code & Event</th>
                <th className="p-3.5">Location & State</th>
                <th className="p-3.5">Event Dates</th>
                <th className="p-3.5">Devices & Total RRP</th>
                <th className="p-3.5">Device IMEI Status</th>
                <th className="p-3.5">Workflow Status</th>
                <th className="p-3.5">Submitted By</th>
                <th className="p-3.5 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredRequests.map((req) => {
                const totalUnits = req.partB.reduce((acc, d) => acc + d.quantity, 0);

                const isActionNeededForRole =
                  (currentUser.role === 'Head of Sales' && req.status === 'Pending Head of Sales') ||
                  (currentUser.role === 'Device Team' && req.status === 'Under Review') ||
                  (currentUser.role === 'Head of Operation' && req.status === 'Pending Head of Operation');

                return (
                  <tr
                    key={req.id}
                    className={`hover:bg-slate-50/80 transition-colors ${
                      isActionNeededForRole ? 'bg-amber-50/30' : ''
                    }`}
                  >
                    {/* Code & Event */}
                    <td className="p-3.5">
                      <div className="font-mono text-[11px] font-bold text-blue-700 mb-0.5">
                        {req.requestCode}
                      </div>
                      <div className="font-bold text-slate-900 text-xs leading-snug">
                        {req.partA.eventName}
                      </div>
                      {req.partA.partner && (
                        <span className="text-[10px] text-slate-500 block">
                          Partner: {req.partA.partner}
                        </span>
                      )}
                    </td>

                    {/* Location & State */}
                    <td className="p-3.5">
                      <div className="font-medium text-slate-800 flex items-center gap-1">
                        <MapPin className="w-3 h-3 text-slate-400 flex-shrink-0" />
                        <span>{req.partA.location}</span>
                      </div>
                      <div className="text-[11px] text-slate-500 mt-0.5">
                        {req.partA.state} &bull; <span className="font-medium text-slate-700">{req.partA.region}</span>
                      </div>
                    </td>

                    {/* Event Dates */}
                    <td className="p-3.5 text-slate-700">
                      <div className="flex items-center gap-1 text-[11px]">
                        <Calendar className="w-3 h-3 text-slate-400 flex-shrink-0" />
                        <span>{formatDate(req.partA.startDate)}</span>
                      </div>
                      <div className="text-[10px] text-slate-400">
                        to {formatDate(req.partA.endDate)}
                      </div>
                    </td>

                    {/* Devices & RRP */}
                    <td className="p-3.5">
                      <div className="font-bold text-slate-900 font-mono">
                        {formatRM(req.totalValueRM)}
                      </div>
                      <div className="text-[11px] text-slate-500 flex items-center gap-1">
                        <Smartphone className="w-3 h-3 text-slate-400" />
                        <span>{req.partB.length} lines ({totalUnits} units)</span>
                      </div>
                    </td>

                    {/* Device IMEI Status */}
                    <td className="p-3.5">
                      {renderImeiStatusBadge(req, totalUnits)}
                    </td>

                    {/* Status */}
                    <td className="p-3.5">
                      <div className="flex flex-col items-start gap-1">
                        <StatusBadge status={req.status} />
                        {req.status === 'Pending Head of Operation' && req.assignedHeadOfOperation && (
                          <span className="text-[10px] font-semibold text-purple-800 bg-purple-50 px-1.5 py-0.5 rounded border border-purple-200">
                            Assigned: {req.assignedHeadOfOperation}
                          </span>
                        )}
                      </div>
                    </td>

                    {/* Submitted By */}
                    <td className="p-3.5 text-slate-700">
                      <div className="font-medium text-slate-800">{req.createdByName}</div>
                      <div className="text-[10px] text-slate-400">{formatDate(req.createdAt)}</div>
                    </td>

                    {/* Actions */}
                    <td className="p-3.5 text-center">
                      <div className="flex items-center justify-center gap-1.5">
                        {/* Device Team Edit Action */}
                        {currentUser.role === 'Device Team' && req.status === 'Under Review' && onOpenDeviceTeamEdit ? (
                          <button
                            id={`btn-device-edit-row-${req.id}`}
                            onClick={() => onOpenDeviceTeamEdit(req)}
                            className="inline-flex items-center gap-1 bg-blue-600 hover:bg-blue-700 text-white px-2.5 py-1 rounded-lg text-xs font-semibold shadow-sm transition-all cursor-pointer"
                          >
                            <Smartphone className="w-3.5 h-3.5" />
                            <span>Review & Edit</span>
                          </button>
                        ) : (
                          <button
                            id={`btn-view-req-${req.id}`}
                            onClick={() => onSelectRequest(req)}
                            className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                              isActionNeededForRole
                                ? 'bg-amber-600 hover:bg-amber-700 text-white shadow-sm'
                                : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                            }`}
                          >
                            <Eye className="w-3.5 h-3.5" />
                            <span>{isActionNeededForRole ? 'Review Request' : 'View Details'}</span>
                          </button>
                        )}

                        {/* Admin Remove Action */}
                        {currentUser.role === 'Admin' && onDeleteRequest && (
                          <button
                            id={`btn-admin-delete-row-${req.id}`}
                            onClick={(e) => {
                              e.stopPropagation();
                              setRequestToDelete(req);
                            }}
                            className="inline-flex items-center gap-1 bg-rose-50 hover:bg-rose-100 border border-rose-200 text-rose-700 px-2 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer"
                            title="Remove Request (Admin)"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            <span className="hidden sm:inline">Delete</span>
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Admin Request Delete Confirmation Modal */}
      {requestToDelete && (
        <div id="modal-delete-request-backdrop" className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden border border-slate-200">
            <div className="bg-rose-600 text-white px-6 py-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-white" />
                <h3 className="text-sm font-bold">Confirm Request Deletion</h3>
              </div>
              <button
                onClick={() => setRequestToDelete(null)}
                className="text-rose-200 hover:text-white p-1 rounded-lg transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <p className="text-xs text-slate-600">
                Are you sure you want to permanently remove this roadshow request? This action cannot be undone.
              </p>

              <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 space-y-1">
                <div className="text-xs font-bold text-slate-800">
                  {requestToDelete.requestCode} - {requestToDelete.partA.eventName}
                </div>
                <div className="text-[11px] text-slate-500">
                  State: <span className="font-semibold text-slate-700">{requestToDelete.partA.state}</span> ({requestToDelete.partA.region})
                </div>
                <div className="text-[11px] text-slate-500">
                  Requested by: <span className="font-semibold text-slate-700">{requestToDelete.partA.requestor || requestToDelete.createdByName}</span>
                </div>
              </div>

              <div className="pt-2 flex items-center justify-end gap-2 border-t border-slate-200">
                <button
                  onClick={() => setRequestToDelete(null)}
                  className="px-4 py-2 border border-slate-300 text-slate-700 rounded-xl text-xs font-semibold hover:bg-slate-50 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  id="btn-confirm-delete-request"
                  onClick={() => {
                    if (onDeleteRequest) {
                      onDeleteRequest(requestToDelete.id);
                    }
                    setRequestToDelete(null);
                  }}
                  className="inline-flex items-center gap-1.5 bg-rose-600 hover:bg-rose-700 text-white px-5 py-2 rounded-xl text-xs font-bold shadow-md shadow-rose-500/20 cursor-pointer"
                >
                  <Trash2 className="w-4 h-4" />
                  <span>Delete Request</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Uploaded IMEI Details Modal */}
      <ImeiDetailModal
        isOpen={!!selectedImeiDetailRequest}
        onClose={() => setSelectedImeiDetailRequest(null)}
        request={selectedImeiDetailRequest}
        imeiInventory={imeiInventory}
        currentUser={currentUser}
        onSaveImeiDetails={onSaveImeiDetails}
      />
    </div>
  );
};
