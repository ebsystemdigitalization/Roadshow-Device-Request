import React, { useState } from 'react';
import { RoadshowRequest, User, PartBDeviceItem, ImeiInventoryItem } from '../types';
import { StatusBadge } from './StatusBadge';
import { WorkflowStepper } from './WorkflowStepper';
import { ImeiUploadModal } from './ImeiUploadModal';
import { ImeiDetailModal, ImeiDetailRecord } from './ImeiDetailModal';
import { formatRM, formatDate, formatDateTime } from '../utils/formatters';
import {
  X,
  Printer,
  Edit3,
  Trash2,
  CheckCircle2,
  XCircle,
  MessageSquare,
  Building,
  MapPin,
  Calendar,
  Target,
  Users,
  Smartphone,
  History,
  Send,
  Download,
  Upload,
  AlertTriangle,
  UserCheck,
  Barcode,
  Eye
} from 'lucide-react';

interface RequestDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  request: RoadshowRequest | null;
  currentUser: User;
  imeiInventory?: ImeiInventoryItem[];
  onEditBySales?: (req: RoadshowRequest) => void;
  onDeleteBySales?: (reqId: string) => void;
  onSubmitBySales?: (req: RoadshowRequest) => void;
  onApproveByHeadOfSales?: (reqId: string, comments: string) => void;
  onRejectByHeadOfSales?: (reqId: string, reason: string) => void;
  onOpenDeviceTeamEdit?: (req: RoadshowRequest) => void;
  onSaveDeviceEditsOnly?: (reqId: string, updatedPartB: PartBDeviceItem[], imeiRecords?: ImeiInventoryItem[]) => void;
  onAcceptBySalesTeam?: (reqId: string, comments: string) => void;
  onRejectBySalesTeam?: (reqId: string, reason: string) => void;
  onApproveByHeadOfOperation?: (reqId: string, comments: string) => void;
  onRejectByHeadOfOperation?: (reqId: string, reason: string) => void;
  onSaveImeiDetails?: (requestId: string, updatedRecords: ImeiDetailRecord[]) => void;
}

export const RequestDetailModal: React.FC<RequestDetailModalProps> = ({
  isOpen,
  onClose,
  request,
  currentUser,
  imeiInventory = [],
  onEditBySales,
  onDeleteBySales,
  onSubmitBySales,
  onApproveByHeadOfSales,
  onRejectByHeadOfSales,
  onOpenDeviceTeamEdit,
  onSaveDeviceEditsOnly,
  onAcceptBySalesTeam,
  onRejectBySalesTeam,
  onApproveByHeadOfOperation,
  onRejectByHeadOfOperation,
  onSaveImeiDetails
}) => {
  if (!isOpen || !request) return null;

  const [hosComments, setHosComments] = useState('');
  const [salesComments, setSalesComments] = useState('');
  const [hooComments, setHooComments] = useState('');
  const [rejectReason, setRejectReason] = useState('');
  const [isRejecting, setIsRejecting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isImeiUploadOpen, setIsImeiUploadOpen] = useState(false);
  const [isImeiDetailOpen, setIsImeiDetailOpen] = useState(false);

  const handleSaveImeis = (updatedPartB: PartBDeviceItem[], imeiRecords?: ImeiInventoryItem[]) => {
    if (onSaveDeviceEditsOnly && request) {
      onSaveDeviceEditsOnly(request.id, updatedPartB, imeiRecords);
    }
  };

  // Role Action Capabilities
  const isHeadOfSales = currentUser.role === 'Head of Sales';
  const isPendingHos = request.status === 'Pending Head of Sales';

  const isDeviceTeam = currentUser.role === 'Device Team';
  const isUnderDeviceReview = request.status === 'Under Review';

  const isHeadOfOps = currentUser.role === 'Head of Operation';
  const isPendingHoo = request.status === 'Pending Head of Operation';

  const isPendingSalesAcceptance = request.status === 'Pending Sales Acceptance';
  const isSalesTeamMember = currentUser.role === 'Sales Team' || currentUser.role === 'Admin';

  const isOwnerSales = currentUser.role === 'Sales Team' && (request.createdByUserId === currentUser.id || currentUser.role === 'Sales Team');
  const isDraftOrRejected = request.status === 'Draft' || request.status === 'Rejected';

  const handlePrint = () => {
    window.print();
  };

  const handleConfirmHosApprove = () => {
    if (onApproveByHeadOfSales) {
      onApproveByHeadOfSales(request.id, hosComments);
      onClose();
    }
  };

  const handleConfirmHosReject = () => {
    if (!(rejectReason || '').trim()) return;
    if (onRejectByHeadOfSales) {
      onRejectByHeadOfSales(request.id, rejectReason);
      onClose();
    }
  };

  const handleConfirmSalesAccept = () => {
    if (onAcceptBySalesTeam) {
      onAcceptBySalesTeam(request.id, salesComments);
      onClose();
    }
  };

  const handleConfirmSalesReject = () => {
    if (!(rejectReason || '').trim()) return;
    if (onRejectBySalesTeam) {
      onRejectBySalesTeam(request.id, rejectReason);
      onClose();
    }
  };

  const handleConfirmHooApprove = () => {
    if (onApproveByHeadOfOperation) {
      onApproveByHeadOfOperation(request.id, hooComments);
      onClose();
    }
  };

  const handleConfirmHooReject = () => {
    if (!(rejectReason || '').trim()) return;
    if (onRejectByHeadOfOperation) {
      onRejectByHeadOfOperation(request.id, rejectReason);
      onClose();
    }
  };

  const handleExportCSV = () => {
    let csv = `Request Code,Requestor Name,Event Name,Material,Descriptions,RRP (RM),Device IMEI No,Customer Name,NRIC,SPP Order,Mobile Number,Submission Remarks,\n`;

    const requestCode = request.requestCode.includes(',') ? `"${request.requestCode}"` : request.requestCode;
    const rawRequestor = (request.partA.requestor || request.createdByName || '').trim();
    const requestorName = rawRequestor.includes(',') ? `"${rawRequestor}"` : rawRequestor;
    const rawEvent = (request.partA.eventName || '').trim();
    const eventName = rawEvent.includes(',') ? `"${rawEvent}"` : rawEvent;

    request.partB.forEach(item => {
      const isApproved = (item.status || 'Approved') === 'Approved';
      const count = isApproved ? (item.recommendedQuantity ?? item.quantity ?? 0) : 0;
      const desc = item.description.includes(',') ? `"${item.description}"` : item.description;
      const mat = item.material.includes(',') ? `"${item.material}"` : item.material;
      const rawImei = (item.imei || '').trim();
      const imei = rawImei.includes(',') ? `"${rawImei}"` : rawImei;

      const rawCust = (item.customerName || '').trim();
      const custName = rawCust.includes(',') ? `"${rawCust}"` : rawCust;

      const rawNric = (item.nric || '').trim();
      const nric = rawNric.includes(',') ? `"${rawNric}"` : rawNric;

      const rawSpp = (item.sppOrder || '').trim();
      const sppOrder = rawSpp.includes(',') ? `"${rawSpp}"` : rawSpp;

      const rawMobile = (item.mobileNumber || '').trim();
      const mobileNumber = rawMobile.includes(',') ? `"${rawMobile}"` : rawMobile;

      const rawSubRemarks = (item.submissionRemarks || '').trim();
      const submissionRemarks = rawSubRemarks.includes(',') ? `"${rawSubRemarks}"` : rawSubRemarks;

      for (let i = 0; i < count; i++) {
        csv += `${requestCode},${requestorName},${eventName},${mat},${desc},${item.rrpRM},${imei},${custName},${nric},${sppOrder},${mobileNumber},${submissionRemarks},\n`;
      }
    });

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `${request.requestCode}_requested_devices.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div id="request-detail-modal-backdrop" className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full overflow-hidden border border-slate-200 my-8">
        {/* Printable Section Header */}
        <div className="bg-slate-900 text-white px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-blue-600 rounded-xl">
              <Smartphone className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold">{request.partA.eventName}</h2>
                <span className="font-mono text-xs bg-slate-800 text-blue-300 px-2 py-0.5 rounded border border-slate-700">
                  {request.requestCode}
                </span>
              </div>
              <p className="text-xs text-slate-300">
                Created by {request.createdByName} on {formatDate(request.createdAt)}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <StatusBadge status={request.status} size="lg" />
            <button
              id="btn-close-detail-modal"
              onClick={onClose}
              className="text-slate-400 hover:text-white p-1.5 rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Modal Printable Content Area */}
        <div className="p-6 space-y-6 max-h-[75vh] overflow-y-auto print:max-h-none print:p-0">
          {/* Workflow Stepper */}
          <WorkflowStepper status={request.status} />

          {/* Part A: Roadshow Details Grid */}
          <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-5 space-y-3">
            <div className="flex items-center justify-between border-b border-slate-200 pb-2">
              <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
                <span className="w-5 h-5 rounded-full bg-blue-100 text-blue-800 flex items-center justify-center text-[10px]">A</span>
                Part A: Roadshow Event Information
              </h3>
              <span className="text-xs text-slate-500 font-medium">
                {request.partA.state} &bull; {request.partA.region} Region
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
              <div>
                <span className="text-slate-500 block mb-0.5 flex items-center gap-1">
                  <UserCheck className="w-3.5 h-3.5 text-blue-600" /> Requestor
                </span>
                <span className="font-semibold text-slate-900">{request.partA.requestor || request.createdByName}</span>
              </div>

              <div>
                <span className="text-slate-500 block mb-0.5 flex items-center gap-1">
                  <MapPin className="w-3.5 h-3.5 text-slate-400" /> Location
                </span>
                <span className="font-semibold text-slate-800">{request.partA.location}</span>
              </div>

              <div>
                <span className="text-slate-500 block mb-0.5 flex items-center gap-1">
                  <Building className="w-3.5 h-3.5 text-slate-400" /> Organizer
                </span>
                <span className="font-semibold text-slate-800">{request.partA.organizer}</span>
              </div>

              <div>
                <span className="text-slate-500 block mb-0.5 flex items-center gap-1">
                  <Users className="w-3.5 h-3.5 text-slate-400" /> Partner
                </span>
                <span className="font-semibold text-slate-800">{request.partA.partner || 'N/A'}</span>
              </div>

              <div>
                <span className="text-slate-500 block mb-0.5 flex items-center gap-1">
                  <Calendar className="w-3.5 h-3.5 text-slate-400" /> Event Duration
                </span>
                <span className="font-semibold text-slate-800">
                  {formatDate(request.partA.startDate)} to {formatDate(request.partA.endDate)}
                </span>
              </div>

              <div className="md:col-span-2">
                <span className="text-slate-500 block mb-0.5 flex items-center gap-1">
                  <Target className="w-3.5 h-3.5 text-slate-400" /> Objective
                </span>
                <span className="font-medium text-slate-700 leading-relaxed">
                  {request.partA.objective}
                </span>
              </div>
            </div>
          </div>

          {/* Part B: Device Information */}
          <div className="space-y-3">
            <div className="flex items-center justify-between border-b border-slate-200 pb-2">
              <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
                <span className="w-5 h-5 rounded-full bg-indigo-100 text-indigo-800 flex items-center justify-center text-[10px]">B</span>
                Part B: Requested Device Inventory ({request.partB.length} Items)
              </h3>

              <div className="flex items-center gap-2">
                <button
                  id="btn-view-imeis-detail"
                  type="button"
                  onClick={() => setIsImeiDetailOpen(true)}
                  className="inline-flex items-center gap-1.5 text-xs text-emerald-800 bg-emerald-50 hover:bg-emerald-100 font-bold border border-emerald-200 px-2.5 py-1 rounded-lg transition-colors cursor-pointer"
                  title="View all uploaded IMEI details"
                >
                  <Barcode className="w-3.5 h-3.5 text-emerald-600" />
                  <span>View IMEIs</span>
                </button>

                {currentUser.role !== 'Sales Team' && currentUser.role !== 'Head of Sales' && (
                  <>
                    <button
                      id="btn-export-csv-detail"
                      onClick={handleExportCSV}
                      className="inline-flex items-center gap-1 text-xs text-slate-600 hover:text-blue-600 font-medium border border-slate-200 hover:border-blue-300 bg-white px-2.5 py-1 rounded-lg transition-colors cursor-pointer"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>Export CSV</span>
                    </button>
                    <button
                      id="btn-print-detail"
                      onClick={handlePrint}
                      className="inline-flex items-center gap-1 text-xs text-slate-600 hover:text-blue-600 font-medium border border-slate-200 hover:border-blue-300 bg-white px-2.5 py-1 rounded-lg transition-colors cursor-pointer"
                    >
                      <Printer className="w-3.5 h-3.5" />
                      <span>Print</span>
                    </button>
                  </>
                )}
              </div>
            </div>

            <div className="border border-slate-200 rounded-xl overflow-hidden shadow-sm">
              {(() => {
                const isAllocatedStage = 
                  request.status === 'Pending Sales Acceptance' || 
                  request.status === 'Pending Head of Operation' || 
                  request.status === 'Approved' || 
                  request.status === 'Rejected';
                const showAllocatedDetails = (currentUser.role !== 'Sales Team' && currentUser.role !== 'Head of Sales') || isAllocatedStage;
                return (
                  <table className="w-full text-left text-xs border-collapse">
                    <thead className="bg-slate-100 text-slate-700 font-semibold border-b border-slate-200">
                      <tr>
                        <th className="p-3">#</th>
                        <th className="p-3">Material Code</th>
                        <th className="p-3">Descriptions</th>
                        <th className="p-3 text-center">Req. Qty</th>
                        {showAllocatedDetails && (
                          <>
                            <th className="p-3 text-center text-blue-900 bg-blue-50/70 border-x border-blue-200">Recommended Qty</th>
                            <th className="p-3 text-center">Status</th>
                          </>
                        )}
                        <th className="p-3 text-right">RRP (RM)</th>
                        <th className="p-3 text-right">Total RRP (RM)</th>
                        {showAllocatedDetails && (
                          <th className="p-3">Device Team Remarks</th>
                        )}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {request.partB.map((item, idx) => (
                        <tr key={item.id} className="hover:bg-slate-50">
                          <td className="p-3 text-slate-400 font-mono">{idx + 1}</td>
                          <td className="p-3 font-mono text-blue-700 font-semibold">{item.material}</td>
                          <td className="p-3 font-medium text-slate-800">
                            <div>{item.description}</div>
                            {item.imei && (
                              <div className="mt-1">
                                <span className="inline-flex items-center gap-1 font-mono text-[10px] text-purple-800 font-semibold bg-purple-50 px-1.5 py-0.5 rounded border border-purple-200">
                                  <span>IMEI:</span>
                                  <span className="font-bold">{item.imei}</span>
                                </span>
                              </div>
                            )}
                          </td>
                          <td className="p-3 text-center font-bold text-slate-900">{item.quantity}</td>
                          {showAllocatedDetails && (
                            <>
                              <td className="p-3 text-center font-bold text-blue-900 bg-blue-50/30 border-x border-blue-100">
                                {item.status === 'Rejected' ? 0 : (item.recommendedQuantity ?? item.quantity)}
                              </td>
                              <td className="p-3 text-center">
                                <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold ${
                                  (item.status || 'Approved') === 'Approved'
                                    ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                                    : 'bg-rose-100 text-rose-800 border border-rose-200'
                                }`}>
                                  {item.status || 'Approved'}
                                </span>
                              </td>
                            </>
                          )}
                          <td className="p-3 text-right text-slate-700">{formatRM(item.rrpRM)}</td>
                          <td className="p-3 text-right font-bold text-slate-900">{formatRM(item.totalRrpRM)}</td>
                          {showAllocatedDetails && (
                            <td className="p-3 text-slate-500 italic">{item.remarks || '-'}</td>
                          )}
                        </tr>
                      ))}
                    </tbody>
                    <tfoot className="bg-slate-900 text-white font-bold border-t border-slate-200">
                      <tr>
                        <td colSpan={showAllocatedDetails ? 7 : 5} className="p-3 text-right uppercase tracking-wider text-[11px]">
                          Total RRP Investment Value:
                        </td>
                        <td className="p-3 text-right text-sm text-emerald-400 font-mono">
                          {formatRM(request.totalValueRM)}
                        </td>
                        {showAllocatedDetails && <td></td>}
                      </tr>
                    </tfoot>
                  </table>
                );
              })()}
            </div>
          </div>

          {/* Part C: Rejected Requested Device Inventory (Hidden for Head of Operation) */}
          {!isHeadOfOps && (() => {
            // Gather all rejected items (both preserved historical rejectedPartB and any currently marked in partB)
            const rejectedItemsList: PartBDeviceItem[] = [];
            const seenIds = new Set<string>();

            (request.rejectedPartB || []).forEach(item => {
              if (!seenIds.has(item.id)) {
                seenIds.add(item.id);
                rejectedItemsList.push(item);
              }
            });

            (request.partB || []).forEach(item => {
              if (item.status === 'Rejected' || (request.status === 'Rejected' && item.status !== 'Approved')) {
                if (!seenIds.has(item.id)) {
                  seenIds.add(item.id);
                  rejectedItemsList.push(item);
                }
              }
            });

            const rejectedPartBItems = rejectedItemsList;

            // Check if Sales Team has accepted allocation
            const salesAcceptLog = (request.history || []).slice().reverse().find(h =>
              h.actorRole === 'Sales Team' && (
                h.action.toLowerCase().includes('accepted device allocation') ||
                h.action.toLowerCase().includes('accept allocation')
              )
            );
            const isAllocationAccepted = !!salesAcceptLog || request.status === 'Pending Head of Operation' || request.status === 'Approved';

            // Find Device Team actor / rejection info from approvals, rejectionInfo, or history
            const deviceTeamHistoryLog = (request.history || []).slice().reverse().find(h => h.actorRole === 'Device Team');

            const deviceTeamReviewer = request.deviceTeamApproval?.approvedBy
              || (request.rejectionInfo?.rejectedRole === 'Device Team' ? request.rejectionInfo.rejectedBy : null)
              || deviceTeamHistoryLog?.actorName
              || (request.rejectionInfo?.rejectedBy ? request.rejectionInfo.rejectedBy : 'Device Team');

            const deviceTeamActionDate = request.deviceTeamApproval?.approvedAt
              || (request.rejectionInfo?.rejectedRole === 'Device Team' ? request.rejectionInfo.rejectedAt : null)
              || deviceTeamHistoryLog?.timestamp
              || (request.rejectionInfo?.rejectedAt ? request.rejectionInfo.rejectedAt : request.updatedAt);

            const deviceTeamComments = request.deviceTeamApproval?.comments
              || (request.rejectionInfo?.rejectedRole === 'Device Team' ? request.rejectionInfo.reason : null)
              || deviceTeamHistoryLog?.comments
              || request.rejectionInfo?.reason;

            return (
              <div className="space-y-3 pt-1">
                <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                  <div className="flex items-center gap-2">
                    <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
                      <span className="w-5 h-5 rounded-full bg-rose-100 text-rose-800 flex items-center justify-center text-[10px] font-bold">C</span>
                      Part C: Rejected Requested Device Inventory ({rejectedPartBItems.length} Items)
                    </h3>
                  </div>
                  <div className="flex items-center gap-2">
                    {isAllocationAccepted && rejectedPartBItems.length > 0 && (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-purple-50 text-purple-700 border border-purple-200" title="Historical rejected device record preserved after Sales Team accepted allocation">
                        <CheckCircle2 className="w-3.5 h-3.5 text-purple-600" />
                        <span>Preserved Historical Record</span>
                      </span>
                    )}
                    {rejectedPartBItems.length > 0 && (
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-rose-50 text-rose-700 border border-rose-200">
                        {rejectedPartBItems.length} {rejectedPartBItems.length === 1 ? 'Item' : 'Items'} Rejected
                      </span>
                    )}
                  </div>
                </div>

                {/* Device Team Rejection Detail Banner */}
                {rejectedPartBItems.length > 0 && (
                  <div className="bg-rose-50/80 border border-rose-200/90 rounded-xl p-3.5 text-xs space-y-2">
                    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-rose-200/60 pb-2">
                      <div className="flex items-center gap-2 font-bold text-rose-900">
                        <XCircle className="w-4 h-4 text-rose-600 shrink-0" />
                        <span>Device Team Evaluation & Rejection Detail</span>
                      </div>
                      <div className="text-[11px] font-medium text-rose-800">
                        Reviewed By: <span className="font-bold">{deviceTeamReviewer}</span>
                        {deviceTeamActionDate && (
                          <span className="text-rose-600 font-normal ml-1">
                            &bull; {formatDateTime(deviceTeamActionDate)}
                          </span>
                        )}
                      </div>
                    </div>
                    {deviceTeamComments ? (
                      <p className="text-[11px] text-rose-800 italic bg-white/70 p-2 rounded-lg border border-rose-100">
                        <span className="font-semibold text-rose-900 not-italic">Device Team Remarks: </span>
                        "{deviceTeamComments}"
                      </p>
                    ) : (
                      <p className="text-[11px] text-rose-700 italic">
                        Devices rejected or non-recommended during Device Team inventory allocation review.
                      </p>
                    )}
                    {isAllocationAccepted && (
                      <div className="flex items-center gap-1.5 text-[11px] text-purple-800 bg-purple-50/80 border border-purple-200/70 px-2.5 py-1 rounded-lg">
                        <CheckCircle2 className="w-3.5 h-3.5 text-purple-600 shrink-0" />
                        <span>
                          <strong>Historical Detail Preserved:</strong> Sales Team accepted the device allocation on{' '}
                          {salesAcceptLog ? formatDateTime(salesAcceptLog.timestamp) : formatDateTime(request.updatedAt)}. Rejected requested devices remain archived in Part C.
                        </span>
                      </div>
                    )}
                  </div>
                )}

                <div className="border border-slate-200 rounded-xl overflow-hidden shadow-sm">
                  {rejectedPartBItems.length === 0 ? (
                    <div className="p-4 text-center text-xs text-slate-400 bg-slate-50/50 italic">
                      No rejected device items for this request.
                    </div>
                  ) : (
                    <table className="w-full text-left text-xs border-collapse">
                      <thead className="bg-rose-50/80 text-rose-900 font-semibold border-b border-rose-200/80">
                        <tr>
                          <th className="p-3">#</th>
                          <th className="p-3">Material Code</th>
                          <th className="p-3">Descriptions</th>
                          <th className="p-3 text-center">Req. Qty</th>
                          <th className="p-3 text-center text-rose-900 bg-rose-100/50 border-x border-rose-200">Recommended Qty</th>
                          <th className="p-3 text-center">Status</th>
                          <th className="p-3 text-right">RRP (RM)</th>
                          <th className="p-3 text-right">Total RRP (RM)</th>
                          <th className="p-3">Device Team Remarks</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 bg-white">
                        {rejectedPartBItems.map((item, idx) => (
                          <tr key={item.id} className="hover:bg-rose-50/30 transition-colors">
                            <td className="p-3 text-slate-400 font-mono">{idx + 1}</td>
                            <td className="p-3 font-mono text-rose-700 font-semibold">{item.material}</td>
                            <td className="p-3 font-medium text-slate-800">
                              <div>{item.description}</div>
                            </td>
                            <td className="p-3 text-center font-bold text-slate-900">{item.quantity}</td>
                            <td className="p-3 text-center font-bold text-rose-900 bg-rose-50/30 border-x border-rose-100">
                              0
                            </td>
                            <td className="p-3 text-center">
                              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold bg-rose-100 text-rose-800 border border-rose-200">
                                Rejected
                              </span>
                            </td>
                            <td className="p-3 text-right text-slate-700">{formatRM(item.rrpRM)}</td>
                            <td className="p-3 text-right font-bold text-slate-400 line-through">{formatRM(item.quantity * item.rrpRM)}</td>
                            <td className="p-3 text-rose-700 italic">{item.remarks || deviceTeamComments || 'Rejected during Device Team allocation review'}</td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot className="bg-slate-900 text-white font-bold border-t border-slate-200">
                        <tr>
                          <td colSpan={7} className="p-3 text-right uppercase tracking-wider text-[11px]">
                            Total Rejected RRP Value:
                          </td>
                          <td className="p-3 text-right text-sm text-rose-400 font-mono">
                            {formatRM(rejectedPartBItems.reduce((acc, curr) => acc + (curr.quantity * curr.rrpRM), 0))}
                          </td>
                          <td></td>
                        </tr>
                      </tfoot>
                    </table>
                  )}
                </div>
              </div>
            );
          })()}

          {/* Approvals Summary Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-2">
            {/* Head of Sales Signoff */}
            <div className={`p-3.5 rounded-xl border text-xs ${
              request.headOfSalesApproval
                ? 'bg-emerald-50/70 border-emerald-200'
                : request.rejectionInfo?.rejectedRole === 'Head of Sales'
                ? 'bg-rose-50/70 border-rose-200'
                : 'bg-slate-50 border-slate-200'
            }`}>
              <div className="flex items-center justify-between mb-1.5">
                <span className="font-bold text-slate-800">1. Head of Sales</span>
                {request.headOfSalesApproval ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                ) : request.rejectionInfo?.rejectedRole === 'Head of Sales' ? (
                  <XCircle className="w-4 h-4 text-rose-600" />
                ) : (
                  <span className="text-[10px] text-amber-700 font-medium">Pending</span>
                )}
              </div>
              {request.headOfSalesApproval ? (
                <div>
                  <div className="font-medium text-emerald-900">{request.headOfSalesApproval.approvedBy}</div>
                  <div className="text-[11px] text-emerald-700">{formatDateTime(request.headOfSalesApproval.approvedAt)}</div>
                  {request.headOfSalesApproval.comments && (
                    <p className="text-[11px] text-slate-600 mt-1 italic">"{request.headOfSalesApproval.comments}"</p>
                  )}
                </div>
              ) : request.rejectionInfo?.rejectedRole === 'Head of Sales' ? (
                <p className="text-[11px] text-rose-700 italic">Rejected: "{request.rejectionInfo.reason}"</p>
              ) : (
                <p className="text-[11px] text-slate-400">Awaiting Head of Sales review</p>
              )}
            </div>

            {/* Device Team Signoff */}
            <div className={`p-3.5 rounded-xl border text-xs ${
              request.deviceTeamApproval
                ? 'bg-emerald-50/70 border-emerald-200'
                : request.rejectionInfo?.rejectedRole === 'Device Team'
                ? 'bg-rose-50/70 border-rose-200'
                : 'bg-slate-50 border-slate-200'
            }`}>
              <div className="flex items-center justify-between mb-1.5">
                <span className="font-bold text-slate-800">2. Device Team</span>
                {request.deviceTeamApproval ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                ) : request.rejectionInfo?.rejectedRole === 'Device Team' ? (
                  <XCircle className="w-4 h-4 text-rose-600" />
                ) : (
                  <span className="text-[10px] text-blue-700 font-medium">Pending</span>
                )}
              </div>
              {request.deviceTeamApproval ? (
                <div>
                  <div className="font-medium text-emerald-900">{request.deviceTeamApproval.approvedBy}</div>
                  <div className="text-[11px] text-emerald-700">{formatDateTime(request.deviceTeamApproval.approvedAt)}</div>
                  {request.deviceTeamApproval.comments && (
                    <p className="text-[11px] text-slate-600 mt-1 italic">"{request.deviceTeamApproval.comments}"</p>
                  )}
                </div>
              ) : request.rejectionInfo?.rejectedRole === 'Device Team' ? (
                <p className="text-[11px] text-rose-700 italic">Rejected: "{request.rejectionInfo.reason}"</p>
              ) : (
                <p className="text-[11px] text-slate-400">Awaiting Device Team inventory review</p>
              )}
            </div>

            {/* Sales Team Acceptance */}
            <div className={`p-3.5 rounded-xl border text-xs ${
              request.status === 'Pending Head of Operation' || request.status === 'Approved'
                ? 'bg-emerald-50/70 border-emerald-200'
                : request.status === 'Pending Sales Acceptance'
                ? 'bg-purple-50/70 border-purple-200'
                : request.rejectionInfo?.rejectedRole === 'Sales Team'
                ? 'bg-rose-50/70 border-rose-200'
                : 'bg-slate-50 border-slate-200'
            }`}>
              <div className="flex items-center justify-between mb-1.5">
                <span className="font-bold text-slate-800">3. Sales Acceptance</span>
                {request.status === 'Pending Head of Operation' || request.status === 'Approved' ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                ) : request.rejectionInfo?.rejectedRole === 'Sales Team' ? (
                  <XCircle className="w-4 h-4 text-rose-600" />
                ) : request.status === 'Pending Sales Acceptance' ? (
                  <span className="text-[10px] text-purple-700 font-medium">Pending</span>
                ) : (
                  <span className="text-[10px] text-slate-400 font-medium">Upcoming</span>
                )}
              </div>
              {request.status === 'Pending Head of Operation' || request.status === 'Approved' ? (
                <div>
                  <div className="font-medium text-emerald-900">Accepted by Sales Team</div>
                  <p className="text-[11px] text-emerald-700">Allocation confirmed</p>
                </div>
              ) : request.rejectionInfo?.rejectedRole === 'Sales Team' ? (
                <p className="text-[11px] text-rose-700 italic">Declined: "{request.rejectionInfo.reason}"</p>
              ) : request.status === 'Pending Sales Acceptance' ? (
                <p className="text-[11px] text-purple-700 font-medium">Awaiting Sales Team acceptance of allocated devices</p>
              ) : (
                <p className="text-[11px] text-slate-400">Awaiting device allocation step</p>
              )}
            </div>

            {/* Head of Operation Signoff */}
            <div className={`p-3.5 rounded-xl border text-xs ${
              request.headOfOperationApproval
                ? 'bg-emerald-50/70 border-emerald-200'
                : request.rejectionInfo?.rejectedRole === 'Head of Operation'
                ? 'bg-rose-50/70 border-rose-200'
                : 'bg-slate-50 border-slate-200'
            }`}>
              <div className="flex items-center justify-between mb-1.5">
                <span className="font-bold text-slate-800">4. Head of Operation</span>
                {request.headOfOperationApproval ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                ) : request.rejectionInfo?.rejectedRole === 'Head of Operation' ? (
                  <XCircle className="w-4 h-4 text-rose-600" />
                ) : (
                  <span className="text-[10px] text-indigo-700 font-medium">Pending</span>
                )}
              </div>
              {request.headOfOperationApproval ? (
                <div>
                  <div className="font-medium text-emerald-900">{request.headOfOperationApproval.approvedBy}</div>
                  <div className="text-[11px] text-emerald-700">{formatDateTime(request.headOfOperationApproval.approvedAt)}</div>
                  {request.headOfOperationApproval.comments && (
                    <p className="text-[11px] text-slate-600 mt-1 italic">"{request.headOfOperationApproval.comments}"</p>
                  )}
                </div>
              ) : request.rejectionInfo?.rejectedRole === 'Head of Operation' ? (
                <p className="text-[11px] text-rose-700 italic">Rejected: "{request.rejectionInfo.reason}"</p>
              ) : (
                <div>
                  <p className="text-[11px] text-slate-500">Awaiting Head of Ops final approval</p>
                  {request.assignedHeadOfOperation && (
                    <div className="mt-1.5 inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-purple-100 text-purple-800 font-semibold text-[10px] border border-purple-200 shadow-xs">
                      <span>Assigned Approver:</span>
                      <span className="font-bold">{request.assignedHeadOfOperation}</span>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Audit Trail Log */}
          <div className="border border-slate-200 rounded-xl p-4 bg-slate-50/50 space-y-3">
            <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
              <History className="w-4 h-4 text-slate-500" />
              Workflow Audit History ({request.history.length} Logs)
            </h4>

            <div className="space-y-2 max-h-36 overflow-y-auto text-xs">
              {request.history.map((h) => (
                <div key={h.id} className="flex items-start gap-2 bg-white p-2.5 rounded-lg border border-slate-200/70">
                  <span className="text-[10px] font-mono text-slate-400 whitespace-nowrap pt-0.5">
                    {formatDateTime(h.timestamp)}
                  </span>
                  <div className="flex-1">
                    <span className="font-semibold text-slate-800">{h.actorName}</span>
                    <span className="text-slate-500 font-medium"> ({h.actorRole}): </span>
                    <span className="text-slate-900 font-medium">{h.action}</span>
                    {h.comments && (
                      <p className="text-[11px] text-slate-600 mt-0.5 bg-slate-50 p-1.5 rounded border border-slate-100 italic">
                        "{h.comments}"
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Head of Sales Decision Controls */}
          {isHeadOfSales && isPendingHos && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 space-y-3">
              <h4 className="text-xs font-bold text-amber-900 uppercase tracking-wider flex items-center gap-1.5">
                <MessageSquare className="w-4 h-4 text-amber-700" />
                Head of Sales Approval Decision
              </h4>

              {!isRejecting ? (
                <div className="space-y-2">
                  <textarea
                    rows={2}
                    value={hosComments}
                    onChange={e => setHosComments(e.target.value)}
                    placeholder="Enter approval comments or notes for Device Team..."
                    className="w-full border border-amber-300 rounded-lg p-2.5 text-xs outline-none focus:ring-2 focus:ring-amber-500 bg-white"
                  />
                  <div className="flex items-center justify-end gap-2">
                    <button
                      id="btn-trigger-hos-reject"
                      onClick={() => setIsRejecting(true)}
                      className="inline-flex items-center gap-1.5 bg-rose-50 hover:bg-rose-100 border border-rose-300 text-rose-700 px-4 py-2 rounded-xl text-xs font-semibold cursor-pointer"
                    >
                      <XCircle className="w-4 h-4" /> Reject Request
                    </button>
                    <button
                      id="btn-confirm-hos-approve"
                      onClick={handleConfirmHosApprove}
                      className="inline-flex items-center gap-1.5 bg-amber-600 hover:bg-amber-500 text-white px-5 py-2 rounded-xl text-xs font-semibold shadow-md shadow-amber-500/20 cursor-pointer"
                    >
                      <CheckCircle2 className="w-4 h-4" /> Approve Request
                    </button>
                  </div>
                </div>
              ) : (
                <div className="space-y-2">
                  <textarea
                    rows={2}
                    value={rejectReason}
                    onChange={e => setRejectReason(e.target.value)}
                    placeholder="Provide mandatory reason for rejection..."
                    className="w-full border border-rose-300 rounded-lg p-2.5 text-xs outline-none focus:ring-2 focus:ring-rose-500 bg-white"
                  />
                  <div className="flex items-center justify-end gap-2">
                    <button
                      onClick={() => setIsRejecting(false)}
                      className="px-3.5 py-1.5 border border-slate-300 text-slate-700 rounded-lg text-xs font-semibold cursor-pointer"
                    >
                      Cancel
                    </button>
                    <button
                      id="btn-confirm-hos-reject"
                      onClick={handleConfirmHosReject}
                      className="inline-flex items-center gap-1.5 bg-rose-600 text-white px-4 py-1.5 rounded-lg text-xs font-semibold cursor-pointer"
                    >
                      Confirm Rejection
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Sales Team Acceptance Decision Controls */}
          {isSalesTeamMember && isPendingSalesAcceptance && (
            <div className="bg-purple-50 border border-purple-200 rounded-xl p-4 space-y-3">
              <h4 className="text-xs font-bold text-purple-900 uppercase tracking-wider flex items-center gap-1.5">
                <MessageSquare className="w-4 h-4 text-purple-700" />
                Sales Team Allocation Acceptance & Review
              </h4>

              {!isRejecting ? (
                <div className="space-y-2">
                  <textarea
                    rows={2}
                    value={salesComments}
                    onChange={e => setSalesComments(e.target.value)}
                    placeholder="Enter optional acceptance comments or feedback on allocated devices..."
                    className="w-full border border-purple-300 rounded-lg p-2.5 text-xs outline-none focus:ring-2 focus:ring-purple-500 bg-white"
                  />
                  <div className="flex items-center justify-end gap-2">
                    <button
                      id="btn-trigger-sales-reject"
                      onClick={() => setIsRejecting(true)}
                      className="inline-flex items-center gap-1.5 bg-rose-50 hover:bg-rose-100 border border-rose-300 text-rose-700 px-4 py-2 rounded-xl text-xs font-semibold cursor-pointer"
                    >
                      <XCircle className="w-4 h-4" /> Decline Allocation
                    </button>
                    <button
                      id="btn-confirm-sales-accept"
                      onClick={handleConfirmSalesAccept}
                      className="inline-flex items-center gap-1.5 bg-purple-600 hover:bg-purple-500 text-white px-5 py-2 rounded-xl text-xs font-semibold shadow-md shadow-purple-500/20 cursor-pointer"
                    >
                      <CheckCircle2 className="w-4 h-4" /> Accept Allocation & Flow to Head of Operation
                    </button>
                  </div>
                </div>
              ) : (
                <div className="space-y-2">
                  <textarea
                    rows={2}
                    value={rejectReason}
                    onChange={e => setRejectReason(e.target.value)}
                    placeholder="Provide mandatory reason for declining allocation..."
                    className="w-full border border-rose-300 rounded-lg p-2.5 text-xs outline-none focus:ring-2 focus:ring-rose-500 bg-white"
                  />
                  <div className="flex items-center justify-end gap-2">
                    <button
                      onClick={() => setIsRejecting(false)}
                      className="px-3.5 py-1.5 border border-slate-300 text-slate-700 rounded-lg text-xs font-semibold cursor-pointer"
                    >
                      Cancel
                    </button>
                    <button
                      id="btn-confirm-sales-reject"
                      onClick={handleConfirmSalesReject}
                      className="inline-flex items-center gap-1.5 bg-rose-600 text-white px-4 py-1.5 rounded-lg text-xs font-semibold cursor-pointer"
                    >
                      Confirm Decline
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
          {isHeadOfOps && isPendingHoo && (
            <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-4 space-y-3">
              <h4 className="text-xs font-bold text-indigo-900 uppercase tracking-wider flex items-center gap-1.5">
                <MessageSquare className="w-4 h-4 text-indigo-700" />
                Head of Operation Final Review & Decision
              </h4>

              {!isRejecting ? (
                <div className="space-y-2">
                  <textarea
                    rows={2}
                    value={hooComments}
                    onChange={e => setHooComments(e.target.value)}
                    placeholder="Enter final operational sign-off notes or dispatch tracking code..."
                    className="w-full border border-indigo-300 rounded-lg p-2.5 text-xs outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
                  />
                  <div className="flex items-center justify-end gap-2">
                    <button
                      id="btn-trigger-hoo-reject"
                      onClick={() => setIsRejecting(true)}
                      className="inline-flex items-center gap-1.5 bg-rose-50 hover:bg-rose-100 border border-rose-300 text-rose-700 px-4 py-2 rounded-xl text-xs font-semibold cursor-pointer"
                    >
                      <XCircle className="w-4 h-4" /> Reject Request
                    </button>
                    <button
                      id="btn-confirm-hoo-approve"
                      onClick={handleConfirmHooApprove}
                      className="inline-flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-500 text-white px-5 py-2 rounded-xl text-xs font-semibold shadow-md shadow-indigo-500/20 cursor-pointer"
                    >
                      <CheckCircle2 className="w-4 h-4" /> Grant Final Approval
                    </button>
                  </div>
                </div>
              ) : (
                <div className="space-y-2">
                  <textarea
                    rows={2}
                    value={rejectReason}
                    onChange={e => setRejectReason(e.target.value)}
                    placeholder="Provide mandatory reason for rejection..."
                    className="w-full border border-rose-300 rounded-lg p-2.5 text-xs outline-none focus:ring-2 focus:ring-rose-500 bg-white"
                  />
                  <div className="flex items-center justify-end gap-2">
                    <button
                      onClick={() => setIsRejecting(false)}
                      className="px-3.5 py-1.5 border border-slate-300 text-slate-700 rounded-lg text-xs font-semibold cursor-pointer"
                    >
                      Cancel
                    </button>
                    <button
                      id="btn-confirm-hoo-reject"
                      onClick={handleConfirmHooReject}
                      className="inline-flex items-center gap-1.5 bg-rose-600 text-white px-4 py-1.5 rounded-lg text-xs font-semibold cursor-pointer"
                    >
                      Confirm Rejection
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="bg-slate-50 px-6 py-4 flex flex-wrap items-center justify-between gap-3 border-t border-slate-200">
          <button
            id="btn-close-detail-modal-footer"
            onClick={onClose}
            className="px-4 py-2 border border-slate-300 text-slate-700 hover:bg-slate-100 rounded-xl text-xs font-semibold transition-colors cursor-pointer"
          >
            Close
          </button>

          {/* Action Buttons Depending on User Role */}
          <div className="flex items-center gap-2">
            {/* Sales Team Options */}
            {isOwnerSales && isDraftOrRejected && (
              <>
                <button
                  id="btn-delete-sales-request"
                  onClick={() => {
                    if (onDeleteBySales) onDeleteBySales(request.id);
                    onClose();
                  }}
                  className="inline-flex items-center gap-1.5 bg-rose-50 hover:bg-rose-100 border border-rose-200 text-rose-700 px-3.5 py-2 rounded-xl text-xs font-semibold transition-colors cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Delete</span>
                </button>

                <button
                  id="btn-edit-sales-request"
                  onClick={() => {
                    if (onEditBySales) onEditBySales(request);
                    onClose();
                  }}
                  className="inline-flex items-center gap-1.5 bg-slate-800 hover:bg-slate-700 text-white px-3.5 py-2 rounded-xl text-xs font-semibold transition-colors cursor-pointer"
                >
                  <Edit3 className="w-3.5 h-3.5" />
                  <span>Edit Request</span>
                </button>

                {request.status === 'Draft' && onSubmitBySales && (
                  <button
                    id="btn-submit-draft-sales"
                    onClick={() => {
                      onSubmitBySales(request);
                      onClose();
                    }}
                    className="inline-flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-2 rounded-xl text-xs font-semibold shadow-md cursor-pointer"
                  >
                    <Send className="w-3.5 h-3.5" />
                    <span>Submit to Head of Sales</span>
                  </button>
                )}
              </>
            )}

            {/* Device Team Option */}
            {isDeviceTeam && isUnderDeviceReview && onOpenDeviceTeamEdit && (
              <button
                id="btn-open-device-team-inventory-editor"
                onClick={() => {
                  onOpenDeviceTeamEdit(request);
                  onClose();
                }}
                className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-5 py-2 rounded-xl text-xs font-semibold shadow-md shadow-blue-500/20 cursor-pointer"
              >
                <Smartphone className="w-4 h-4" />
                <span>Manage & Edit Devices (Device Team)</span>
              </button>
            )}

            {/* Admin Delete Option */}
            {currentUser.role === 'Admin' && (
              <button
                id="btn-delete-admin-request"
                onClick={() => setShowDeleteConfirm(true)}
                className="inline-flex items-center gap-1.5 bg-rose-600 hover:bg-rose-700 text-white px-3.5 py-2 rounded-xl text-xs font-bold transition-colors cursor-pointer shadow-sm"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Delete Request (Admin)</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Admin Request Delete Confirmation Overlay */}
      {showDeleteConfirm && (
        <div id="modal-detail-delete-backdrop" className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden border border-slate-200">
            <div className="bg-rose-600 text-white px-6 py-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-white" />
                <h3 className="text-sm font-bold">Admin Delete Confirmation</h3>
              </div>
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="text-rose-200 hover:text-white p-1 rounded-lg transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <p className="text-xs text-slate-600">
                Are you sure you want to permanently remove request <strong className="text-slate-800">{request.requestCode}</strong> ({request.partA.eventName})? This operation will remove all associated logs and allocations.
              </p>

              <div className="pt-2 flex items-center justify-end gap-2 border-t border-slate-200">
                <button
                  onClick={() => setShowDeleteConfirm(false)}
                  className="px-4 py-2 border border-slate-300 text-slate-700 rounded-xl text-xs font-semibold hover:bg-slate-50 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  id="btn-confirm-modal-detail-delete"
                  onClick={() => {
                    if (onDeleteBySales) onDeleteBySales(request.id);
                    setShowDeleteConfirm(false);
                    onClose();
                  }}
                  className="inline-flex items-center gap-1.5 bg-rose-600 hover:bg-rose-700 text-white px-5 py-2 rounded-xl text-xs font-bold shadow-md shadow-rose-500/20 cursor-pointer"
                >
                  <Trash2 className="w-4 h-4" />
                  <span>Confirm Delete</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* IMEI Upload Modal */}
      <ImeiUploadModal
        isOpen={isImeiUploadOpen}
        onClose={() => setIsImeiUploadOpen(false)}
        partBItems={request.partB || []}
        onSaveImeis={handleSaveImeis}
        requestCode={request.requestCode}
        requestorName={request.partA.requestor || request.createdByName}
        eventName={request.partA.eventName}
        region={request.partA.region}
        state={request.partA.state}
        requestId={request.id}
        requestStatus={request.status}
      />

      {/* Uploaded IMEI Details Modal */}
      <ImeiDetailModal
        isOpen={isImeiDetailOpen}
        onClose={() => setIsImeiDetailOpen(false)}
        request={request}
        imeiInventory={imeiInventory}
        currentUser={currentUser}
        onSaveImeiDetails={onSaveImeiDetails}
      />
    </div>
  );
};
