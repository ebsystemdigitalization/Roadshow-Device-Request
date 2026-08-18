import React, { useState } from 'react';
import { RoadshowRequest, PartBDeviceItem, User, DeviceInventoryItem, ImeiInventoryItem } from '../types';
import { generateId, formatRM } from '../utils/formatters';
import { BulkUploadModal } from './BulkUploadModal';
import { ImeiUploadModal } from './ImeiUploadModal';
import { X, Plus, Trash2, Upload, CheckCircle2, XCircle, AlertCircle, Save, Smartphone, MessageSquare, Sparkles, Barcode } from 'lucide-react';

interface DeviceTeamEditModalProps {
  isOpen: boolean;
  onClose: () => void;
  request: RoadshowRequest;
  currentUser: User;
  onApproveByDeviceTeam: (requestId: string, updatedPartB: PartBDeviceItem[], comments: string) => void;
  onRejectByDeviceTeam: (requestId: string, reason: string) => void;
  onSaveDeviceEditsOnly: (requestId: string, updatedPartB: PartBDeviceItem[], imeiRecords?: ImeiInventoryItem[]) => void;
  deviceInventory?: DeviceInventoryItem[];
}

export const DeviceTeamEditModal: React.FC<DeviceTeamEditModalProps> = ({
  isOpen,
  onClose,
  request,
  currentUser,
  onApproveByDeviceTeam,
  onRejectByDeviceTeam,
  onSaveDeviceEditsOnly,
  deviceInventory = []
}) => {
  if (!isOpen) return null;

  const [partB, setPartB] = useState<PartBDeviceItem[]>(() =>
    (request.partB || []).map(item => {
      const isRejected = item.status === 'Rejected';
      const quantity = item.quantity ?? 1;
      const rrpRM = item.rrpRM ?? 0;
      const recQty = isRejected ? 0 : (item.recommendedQuantity ?? quantity);
      return {
        ...item,
        material: item.material || '',
        description: item.description || '',
        quantity,
        rrpRM,
        recommendedQuantity: recQty,
        totalRrpRM: item.totalRrpRM ?? (isRejected ? 0 : recQty * rrpRM),
        status: item.status || 'Approved',
        remarks: item.remarks || ''
      };
    })
  );
  const [deviceTeamComments, setDeviceTeamComments] = useState<string>('');
  const [rejectionReason, setRejectionReason] = useState<string>('');
  const [isRejecting, setIsRejecting] = useState<boolean>(false);
  const [isBulkUploadOpen, setIsBulkUploadOpen] = useState<boolean>(false);
  const [isImeiUploadOpen, setIsImeiUploadOpen] = useState<boolean>(false);
  const [validationError, setValidationError] = useState<string | null>(null);

  const handleDeviceChange = (id: string, field: keyof PartBDeviceItem, value: any) => {
    setPartB(prev =>
      prev.map(item => {
        if (item.id !== id) return item;

        const updated = { ...item, [field]: value };

        if (field === 'status') {
          updated.status = value;
          if (value === 'Rejected') {
            updated.recommendedQuantity = 0;
            updated.totalRrpRM = 0;
          } else if (value === 'Approved') {
            if (item.status === 'Rejected' || updated.recommendedQuantity === 0 || updated.recommendedQuantity === undefined) {
              updated.recommendedQuantity = updated.quantity;
            }
            const recQty = updated.recommendedQuantity ?? updated.quantity;
            updated.totalRrpRM = recQty * updated.rrpRM;
          }
        }

        // Auto search & match from Master Device Inventory
        if (field === 'material' || field === 'description') {
          const searchVal = String(value || '').trim().toLowerCase();
          if (searchVal) {
            const match = (deviceInventory || []).find(inv =>
              (inv.material || '').toLowerCase() === searchVal ||
              (inv.description || '').toLowerCase() === searchVal
            );
            if (match) {
              updated.material = match.material;
              updated.description = match.description;
              updated.rrpRM = match.rrpRM;
              const effectiveQty = updated.status === 'Rejected' ? 0 : (updated.recommendedQuantity !== undefined && updated.recommendedQuantity !== null ? updated.recommendedQuantity : updated.quantity);
              updated.totalRrpRM = effectiveQty * match.rrpRM;
              if (match.remarks) {
                updated.remarks = match.remarks;
              }
            }
          }
        }

        if (field === 'quantity' || field === 'rrpRM' || field === 'recommendedQuantity') {
          const qty = field === 'quantity' ? Math.max(1, parseInt(value, 10) || 0) : item.quantity;
          let recQty = field === 'recommendedQuantity'
            ? Math.max(0, parseInt(value, 10) || 0)
            : (item.recommendedQuantity ?? qty);
          
          if (updated.status === 'Rejected') {
            recQty = 0;
          }

          const rrp = field === 'rrpRM' ? Math.max(0, parseFloat(value) || 0) : item.rrpRM;
          
          updated.quantity = qty;
          updated.recommendedQuantity = recQty;
          updated.rrpRM = rrp;
          updated.totalRrpRM = recQty * rrp;
        }
        return updated;
      })
    );
  };

  const handleAddDeviceRow = () => {
    setPartB(prev => [
      ...prev,
      {
        id: generateId(),
        material: '',
        description: '',
        quantity: 1,
        recommendedQuantity: 1,
        rrpRM: 0,
        totalRrpRM: 0,
        status: 'Approved',
        remarks: 'Allocated from Warehouse'
      }
    ]);
  };

  const handleRemoveDeviceRow = (id: string) => {
    setPartB(prev => prev.filter(item => item.id !== id));
    setValidationError(null);
  };

  const handleImportBulkItems = (importedItems: PartBDeviceItem[], appendMode: boolean) => {
    if (appendMode) {
      setPartB(prev => [...prev, ...importedItems]);
    } else {
      setPartB(importedItems);
    }
  };

  const calculateTotalRrpSum = () => {
    return partB.reduce((acc, curr) => acc + curr.totalRrpRM, 0);
  };

  const handleApprove = () => {
    if (partB.length === 0) {
      setValidationError('Cannot approve with zero devices.');
      return;
    }
    onApproveByDeviceTeam(request.id, partB, deviceTeamComments);
    onClose();
  };

  const handleConfirmReject = () => {
    if (!(rejectionReason || '').trim()) {
      setValidationError('Please state rejection reason before rejecting.');
      return;
    }
    onRejectByDeviceTeam(request.id, rejectionReason);
    onClose();
  };

  const handleSaveDraftEdits = () => {
    onSaveDeviceEditsOnly(request.id, partB);
    onClose();
  };

  return (
    <div id="device-team-modal-backdrop" className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full overflow-hidden border border-slate-200 my-8">
        {/* Header */}
        <div className="bg-blue-900 text-white px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-blue-600 rounded-xl">
              <Smartphone className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold">Device Team Inventory Review</h2>
                <span className="text-[10px] bg-blue-500/30 text-blue-200 font-semibold px-2 py-0.5 rounded border border-blue-400/30">
                  {request.requestCode}
                </span>
              </div>
              <p className="text-xs text-slate-300">
                {request.partA.eventName} &bull; {request.partA.state}, {request.partA.region}
              </p>
            </div>
          </div>
          <button
            id="btn-close-device-team-modal"
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1.5 rounded-lg hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Validation Banner */}
        {validationError && (
          <div className="bg-rose-50 border-b border-rose-200 text-rose-800 px-6 py-3 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0" />
            <span>{validationError}</span>
          </div>
        )}

        <div className="p-6 space-y-6 max-h-[75vh] overflow-y-auto">
          {/* Quick Summary Banner of Part A Roadshow Info */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
            <div>
              <span className="text-slate-500 block">Organizer & Partner</span>
              <span className="font-semibold text-slate-800">{request.partA.organizer} ({request.partA.partner || 'N/A'})</span>
            </div>
            <div>
              <span className="text-slate-500 block">Dates</span>
              <span className="font-semibold text-slate-800">{request.partA.startDate} to {request.partA.endDate}</span>
            </div>
            <div>
              <span className="text-slate-500 block">Location</span>
              <span className="font-semibold text-slate-800">{request.partA.location}</span>
            </div>
            <div>
              <span className="text-slate-500 block">Sales Requestor</span>
              <span className="font-semibold text-slate-800">{request.partA.requestor || request.createdByName}</span>
            </div>
          </div>

          {/* Section: Device Details Editing */}
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-slate-200">
              <div>
                <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wide flex items-center gap-2">
                  <span>Device Allocation Details</span>
                  <span className="text-xs font-normal text-slate-500">
                    (Edit Material, Description, Quantity, RRP, or Remarks)
                  </span>
                </h3>
              </div>

              <div className="flex items-center gap-2">
                <button
                  id="btn-trigger-bulk-upload"
                  type="button"
                  onClick={() => setIsBulkUploadOpen(true)}
                  className="inline-flex items-center gap-1.5 bg-blue-50 hover:bg-blue-100 border border-blue-200 text-blue-700 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer"
                >
                  <Upload className="w-3.5 h-3.5" />
                  <span>Bulk Upload CSV</span>
                </button>

                <button
                  id="btn-add-device-item-device-team"
                  type="button"
                  onClick={handleAddDeviceRow}
                  className="inline-flex items-center gap-1.5 bg-slate-900 hover:bg-slate-800 text-white px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add Item</span>
                </button>
              </div>
            </div>

            {/* Table */}
            <div className="bg-blue-50/70 border border-slate-200 rounded-t-xl px-4 py-2 flex items-center justify-between text-xs">
              <div className="flex items-center gap-1.5 text-blue-900 font-medium">
                <Sparkles className="w-3.5 h-3.5 text-blue-600" />
                <span>Auto-Search: Type/Select Material or Description to auto-fill details & RRP (RM) from Master Inventory ({deviceInventory?.length || 0} items)</span>
              </div>
            </div>

            <datalist id="dev-inventory-materials">
              {(deviceInventory || []).map((inv, idx) => (
                <option key={`dev-mat-${idx}`} value={inv.material}>
                  {inv.brand ? `[${inv.brand}] ` : ''}{inv.description} (RM {inv.rrpRM}) [{inv.deviceStatus || 'In Stock'}]
                </option>
              ))}
            </datalist>

            <datalist id="dev-inventory-descriptions">
              {(deviceInventory || []).map((inv, idx) => (
                <option key={`dev-desc-${idx}`} value={inv.description}>
                  [{inv.material}]{inv.brand ? ` [${inv.brand}]` : ''} RM {inv.rrpRM} [{inv.deviceStatus || 'In Stock'}]
                </option>
              ))}
            </datalist>

            <div className="border border-slate-200 rounded-b-xl overflow-hidden shadow-sm">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-slate-100 text-slate-700 font-semibold border-b border-slate-200">
                  <tr>
                    <th className="p-2.5 w-32">1. Material</th>
                    <th className="p-2.5">2. Descriptions</th>
                    <th className="p-2.5 w-16 text-center">3. Qty</th>
                    <th className="p-2.5 w-24 text-right">4. RRP (RM)</th>
                    <th className="p-2.5 w-36 text-center bg-blue-100/70 text-blue-900 border-x border-blue-200">
                      5. Recommended Device Quantity
                    </th>
                    <th className="p-2.5 w-32 text-center bg-slate-100 text-slate-800 border-r border-slate-200">
                      6. Status
                    </th>
                    <th className="p-2.5 w-28 text-right">Total (RM)</th>
                    <th className="p-2.5 w-36">7. Device Team Remarks</th>
                    <th className="p-2.5 w-10 text-center">Del</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {partB.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="p-6 text-center text-slate-500 bg-slate-50/50">
                        <p className="text-xs font-semibold text-slate-600 mb-2">No device items currently in Part B.</p>
                        <button
                          type="button"
                          onClick={handleAddDeviceRow}
                          className="inline-flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer shadow-sm"
                        >
                          <Plus className="w-4 h-4" />
                          <span>Add Device Row</span>
                        </button>
                      </td>
                    </tr>
                  ) : (
                    partB.map(item => (
                      <tr key={item.id} className="hover:bg-slate-50">
                        <td className="p-2">
                          <input
                            id={`input-material-dev-${item.id}`}
                            type="text"
                            list="dev-inventory-materials"
                            value={item.material || ''}
                            onChange={e => handleDeviceChange(item.id, 'material', e.target.value)}
                            placeholder="Type/select material..."
                            className="w-full border border-slate-300 rounded-lg p-1.5 font-mono text-xs focus:ring-2 focus:ring-blue-500 outline-none"
                          />
                        </td>
                        <td className="p-2">
                          <input
                            type="text"
                            list="dev-inventory-descriptions"
                            value={item.description || ''}
                            onChange={e => handleDeviceChange(item.id, 'description', e.target.value)}
                            placeholder="Type/select description..."
                            className="w-full border border-slate-300 rounded-lg p-1.5 text-xs focus:ring-2 focus:ring-blue-500 outline-none"
                          />
                        </td>
                        <td className="p-2">
                          <input
                            type="number"
                            min={1}
                            value={item.quantity ?? 1}
                            onChange={e => handleDeviceChange(item.id, 'quantity', e.target.value)}
                            className="w-full border border-slate-300 rounded-lg p-1.5 text-xs text-center font-semibold focus:ring-2 focus:ring-blue-500 outline-none"
                          />
                        </td>
                        <td className="p-2">
                          <input
                            type="number"
                            min={0}
                            step={10}
                            value={item.rrpRM ?? 0}
                            onChange={e => handleDeviceChange(item.id, 'rrpRM', e.target.value)}
                            className="w-full border border-slate-300 rounded-lg p-1.5 text-xs text-right focus:ring-2 focus:ring-blue-500 outline-none"
                          />
                        </td>
                        <td className="p-2 bg-blue-50/50 border-x border-blue-100">
                          <input
                            id={`input-recommended-qty-dev-${item.id}`}
                            type="number"
                            min={0}
                            value={item.status === 'Rejected' ? 0 : (item.recommendedQuantity ?? item.quantity ?? 0)}
                            onChange={e => handleDeviceChange(item.id, 'recommendedQuantity', e.target.value)}
                            placeholder="Rec. Qty"
                            disabled={item.status === 'Rejected'}
                            className={`w-full border rounded-lg p-1.5 text-xs text-center font-bold outline-none shadow-xs ${
                              item.status === 'Rejected'
                                ? 'bg-slate-100 text-slate-400 border-slate-300 cursor-not-allowed'
                                : 'border-blue-300 text-blue-900 bg-white focus:ring-2 focus:ring-blue-500'
                            }`}
                          />
                        </td>
                        <td className="p-2 border-r border-slate-200">
                          <select
                            id={`select-status-dev-${item.id}`}
                            value={item.status || 'Approved'}
                            onChange={e => handleDeviceChange(item.id, 'status', e.target.value)}
                            className={`w-full border rounded-lg p-1.5 text-xs font-semibold outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer ${
                              (item.status || 'Approved') === 'Approved'
                                ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                                : 'bg-rose-50 text-rose-800 border-rose-300'
                            }`}
                          >
                            <option value="Approved">Approved</option>
                            <option value="Rejected">Rejected</option>
                          </select>
                        </td>
                        <td className="p-2 text-right font-bold text-slate-900 bg-slate-50 rounded-lg">
                          {formatRM(item.totalRrpRM)}
                        </td>
                        <td className="p-2">
                          <input
                            type="text"
                            value={item.remarks || ''}
                            onChange={e => handleDeviceChange(item.id, 'remarks', e.target.value)}
                            placeholder="e.g. Stock reserved Shah Alam"
                            className="w-full border border-slate-300 rounded-lg p-1.5 text-xs focus:ring-2 focus:ring-blue-500 outline-none"
                          />
                        </td>
                        <td className="p-2 text-center">
                          <button
                            id={`btn-delete-partb-dev-row-${item.id}`}
                            type="button"
                            onClick={() => handleRemoveDeviceRow(item.id)}
                            className="text-slate-400 hover:text-rose-600 p-1.5 rounded-md hover:bg-rose-50 transition-colors cursor-pointer"
                            title="Delete device item"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
                <tfoot className="bg-slate-900 text-white font-bold border-t border-slate-200">
                  <tr>
                    <td colSpan={5} className="p-3 text-right uppercase tracking-wider text-[11px]">
                      Total RRP Device Value:
                    </td>
                    <td></td>
                    <td className="p-3 text-right text-sm text-emerald-400">
                      {formatRM(calculateTotalRrpSum())}
                    </td>
                    <td colSpan={2}></td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>

          {/* Device Team Comments */}
          {!isRejecting ? (
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1 flex items-center gap-1.5">
                <MessageSquare className="w-3.5 h-3.5 text-slate-400" />
                Device Team Approval Remarks / Logistics Notes (Optional)
              </label>
              <textarea
                rows={2}
                value={deviceTeamComments}
                onChange={e => setDeviceTeamComments(e.target.value)}
                placeholder="e.g. All requested materials are available. Courier dispatched scheduled for 2 days prior to event."
                className="w-full border border-slate-300 rounded-xl p-3 text-xs focus:ring-2 focus:ring-blue-500 outline-none resize-none"
              />
            </div>
          ) : (
            <div className="bg-rose-50 border border-rose-200 rounded-xl p-4 space-y-2">
              <label className="block text-xs font-bold text-rose-900">
                State Rejection Reason (Required)
              </label>
              <textarea
                rows={2}
                value={rejectionReason}
                onChange={e => setRejectionReason(e.target.value)}
                placeholder="e.g. Requested models MAT-S24U are currently out of stock nationwide and cannot be fulfilled in time."
                className="w-full border border-rose-300 rounded-xl p-3 text-xs focus:ring-2 focus:ring-rose-500 outline-none resize-none"
              />
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="bg-slate-50 px-6 py-4 flex flex-wrap items-center justify-between gap-3 border-t border-slate-200">
          <div className="flex items-center gap-2">
            <button
              id="btn-close-device-edit"
              onClick={onClose}
              className="px-4 py-2 border border-slate-300 text-slate-700 hover:bg-slate-100 rounded-xl text-xs font-semibold transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              id="btn-save-device-edits-only"
              onClick={handleSaveDraftEdits}
              className="inline-flex items-center gap-1.5 bg-slate-200 hover:bg-slate-300 text-slate-800 px-3.5 py-2 rounded-xl text-xs font-semibold transition-colors cursor-pointer"
            >
              <Save className="w-3.5 h-3.5" />
              <span>Save Edits</span>
            </button>
          </div>

          <div className="flex items-center gap-2">
            {!isRejecting ? (
              <>
                <button
                  id="btn-initiate-reject-device"
                  onClick={() => setIsRejecting(true)}
                  className="inline-flex items-center gap-1.5 bg-rose-50 hover:bg-rose-100 border border-rose-300 text-rose-700 px-4 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer"
                >
                  <XCircle className="w-4 h-4" />
                  <span>Reject Request</span>
                </button>

                <button
                  id="btn-approve-device-team"
                  onClick={handleApprove}
                  className="inline-flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white px-5 py-2 rounded-xl text-xs font-semibold shadow-md shadow-blue-500/20 transition-all cursor-pointer"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Approved and Flow to Sales Team Acceptance</span>
                </button>
              </>
            ) : (
              <>
                <button
                  id="btn-cancel-reject-device"
                  onClick={() => setIsRejecting(false)}
                  className="px-3.5 py-2 border border-slate-300 text-slate-700 hover:bg-slate-100 rounded-xl text-xs font-semibold transition-colors cursor-pointer"
                >
                  Back
                </button>
                <button
                  id="btn-confirm-reject-device"
                  onClick={handleConfirmReject}
                  className="inline-flex items-center gap-1.5 bg-rose-600 hover:bg-rose-700 text-white px-5 py-2 rounded-xl text-xs font-semibold shadow-md shadow-rose-500/20 transition-all cursor-pointer"
                >
                  <XCircle className="w-4 h-4" />
                  <span>Confirm Rejection</span>
                </button>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Bulk Upload Modal */}
      <BulkUploadModal
        isOpen={isBulkUploadOpen}
        onClose={() => setIsBulkUploadOpen(false)}
        onImportItems={handleImportBulkItems}
      />

      {/* IMEI Upload Modal */}
      <ImeiUploadModal
        isOpen={isImeiUploadOpen}
        onClose={() => setIsImeiUploadOpen(false)}
        partBItems={partB}
        onSaveImeis={(updatedItems, imeiRecords) => {
          setPartB(updatedItems);
          if (onSaveDeviceEditsOnly && imeiRecords) {
            onSaveDeviceEditsOnly(request.id, updatedItems, imeiRecords);
          }
        }}
        requestCode={request.requestCode}
        requestorName={request.partA.requestor || request.createdByName}
        eventName={request.partA.eventName}
        region={request.partA.region}
        state={request.partA.state}
        requestId={request.id}
        requestStatus={request.status}
      />
    </div>
  );
};
