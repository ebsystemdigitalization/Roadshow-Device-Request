import React, { useState } from 'react';
import { RoadshowRequest, PartARoadshowInfo, PartBDeviceItem, User, DeviceInventoryItem, MALAYSIAN_STATES, MALAYSIAN_REGIONS } from '../types';
import { generateId, generateRequestCode, formatRM } from '../utils/formatters';
import { X, Plus, Trash2, Save, Send, Smartphone, Calendar, MapPin, Building, Target, Users, AlertCircle, Sparkles, Search, UserCheck } from 'lucide-react';

interface SalesRequestFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: User;
  editingRequest?: RoadshowRequest | null;
  onSaveRequest: (request: RoadshowRequest, isSubmit: boolean) => void;
  deviceInventory?: DeviceInventoryItem[];
}

export const SalesRequestFormModal: React.FC<SalesRequestFormModalProps> = ({
  isOpen,
  onClose,
  currentUser,
  editingRequest,
  onSaveRequest,
  deviceInventory = []
}) => {
  if (!isOpen) return null;

  const [partA, setPartA] = useState<PartARoadshowInfo>(
    editingRequest
      ? {
          requestor: editingRequest.partA?.requestor || editingRequest.createdByName || currentUser.name,
          eventName: editingRequest.partA?.eventName || '',
          location: editingRequest.partA?.location || '',
          state: editingRequest.partA?.state || currentUser.state || 'Selangor',
          region: editingRequest.partA?.region || currentUser.region || 'Central',
          organizer: editingRequest.partA?.organizer || '',
          startDate: editingRequest.partA?.startDate || '',
          endDate: editingRequest.partA?.endDate || '',
          objective: editingRequest.partA?.objective || '',
          partner: editingRequest.partA?.partner || ''
        }
      : {
          requestor: currentUser.name,
          eventName: '',
          location: '',
          state: currentUser.state || 'Selangor',
          region: currentUser.region || 'Central',
          organizer: '',
          startDate: new Date().toISOString().split('T')[0],
          endDate: new Date(Date.now() + 86400000 * 3).toISOString().split('T')[0],
          objective: '',
          partner: ''
        }
  );

  const [partB, setPartB] = useState<PartBDeviceItem[]>(
    editingRequest
      ? (editingRequest.partB || []).map(item => ({
          id: item.id || '',
          material: item.material || '',
          description: item.description || '',
          quantity: item.quantity ?? 1,
          rrpRM: item.rrpRM ?? 0,
          totalRrpRM: item.totalRrpRM ?? 0,
          recommendedQuantity: item.recommendedQuantity,
          status: item.status,
          remarks: item.remarks || ''
        }))
      : []
  );

  const [validationError, setValidationError] = useState<string | null>(null);

  // Auto update region when state changes if needed
  const handleStateChange = (selectedState: string) => {
    let region = 'Central';
    if (['Penang', 'Perak', 'Kedah', 'Perlis'].includes(selectedState)) region = 'Northern';
    else if (['Johor', 'Melaka', 'Negeri Sembilan'].includes(selectedState)) region = 'Southern';
    else if (['Pahang', 'Kelantan', 'Terengganu'].includes(selectedState)) region = 'Eastern';
    else if (selectedState === 'Sarawak') region = 'Sarawak';
    else if (['Sabah', 'Labuan'].includes(selectedState)) region = 'Sabah';

    setPartA(prev => ({ ...prev, state: selectedState, region }));
  };

  // Filter device inventory so only items with Device Status 'In Stock' are available for Part B
  const inStockInventory = (deviceInventory || []).filter(
    inv => (inv.deviceStatus || 'In Stock') === 'In Stock'
  );

  const handleDeviceChange = (id: string, field: keyof PartBDeviceItem, value: any) => {
    setPartB(prev =>
      prev.map(item => {
        if (item.id !== id) return item;

        const updated = { ...item, [field]: value };

        // Auto search & match from Master Device Inventory (In Stock only)
        if (field === 'material' || field === 'description') {
          const searchVal = String(value || '').trim().toLowerCase();
          if (searchVal) {
            const match = inStockInventory.find(inv =>
              (inv.material || '').toLowerCase() === searchVal ||
              (inv.description || '').toLowerCase() === searchVal
            );
            if (match) {
              updated.material = match.material;
              updated.description = match.description;
              updated.rrpRM = match.rrpRM;
              updated.totalRrpRM = updated.quantity * match.rrpRM;
            }
          }
        }

        if (field === 'quantity' || field === 'rrpRM') {
          const qty = field === 'quantity' ? Math.max(1, parseInt(value, 10) || 0) : item.quantity;
          const rrp = field === 'rrpRM' ? Math.max(0, parseFloat(value) || 0) : item.rrpRM;
          updated.quantity = qty;
          updated.rrpRM = rrp;
          updated.totalRrpRM = qty * rrp;
        }

        return updated;
      })
    );
  };

  const handleSelectInventoryItem = (rowId: string, item: DeviceInventoryItem) => {
    setPartB(prev =>
      prev.map(row => {
        if (row.id !== rowId) return row;
        const qty = row.quantity || 1;
        return {
          ...row,
          material: item.material,
          description: item.description,
          rrpRM: item.rrpRM,
          totalRrpRM: qty * item.rrpRM
        };
      })
    );
  };

  const handleAddDeviceRow = (inventoryItem?: DeviceInventoryItem) => {
    if (inventoryItem) {
      setPartB(prev => [
        ...prev,
        {
          id: generateId(),
          material: inventoryItem.material,
          description: inventoryItem.description,
          quantity: 1,
          rrpRM: inventoryItem.rrpRM,
          totalRrpRM: inventoryItem.rrpRM
        }
      ]);
    } else {
      setPartB(prev => [
        ...prev,
        {
          id: generateId(),
          material: '',
          description: '',
          quantity: 1,
          rrpRM: 0,
          totalRrpRM: 0
        }
      ]);
    }
  };

  const handleRemoveDeviceRow = (id: string) => {
    setPartB(prev => prev.filter(item => item.id !== id));
    setValidationError(null);
  };

  const calculateTotalRrpSum = () => {
    return partB.reduce((acc, curr) => acc + curr.totalRrpRM, 0);
  };

  const handleSubmit = (isSubmitAction: boolean) => {
    // Validate inputs
    if (!(partA.eventName || '').trim()) {
      setValidationError('Please specify Event Name.');
      return;
    }
    if (!(partA.location || '').trim()) {
      setValidationError('Please specify Event Location.');
      return;
    }
    if (!(partA.organizer || '').trim()) {
      setValidationError('Please specify Organizer.');
      return;
    }
    if (!(partA.objective || '').trim()) {
      setValidationError('Please specify Roadshow Objective.');
      return;
    }
    if (partB.length === 0) {
      setValidationError('Please add at least one device item.');
      return;
    }

    setValidationError(null);

    const now = new Date().toISOString();
    const totalValue = calculateTotalRrpSum();

    const requestToSave: RoadshowRequest = {
      id: editingRequest ? editingRequest.id : generateId(),
      requestCode: editingRequest ? editingRequest.requestCode : generateRequestCode(),
      createdByUserId: editingRequest ? editingRequest.createdByUserId : currentUser.id,
      createdByName: editingRequest ? editingRequest.createdByName : currentUser.name,
      createdByEmail: editingRequest ? editingRequest.createdByEmail : currentUser.email,
      createdAt: editingRequest ? editingRequest.createdAt : now,
      updatedAt: now,
      status: isSubmitAction ? 'Pending Head of Sales' : 'Draft',
      partA,
      partB,
      totalValueRM: totalValue,
      history: [
        ...(editingRequest ? editingRequest.history : []),
        {
          id: generateId(),
          timestamp: now,
          actorName: currentUser.name,
          actorRole: currentUser.role,
          action: isSubmitAction
            ? (editingRequest ? 'Resubmitted Request to Head of Sales' : 'Submitted Request to Head of Sales')
            : (editingRequest ? 'Updated Request Draft' : 'Created Request Draft'),
          previousStatus: editingRequest ? editingRequest.status : undefined,
          newStatus: isSubmitAction ? 'Pending Head of Sales' : 'Draft'
        }
      ]
    };

    onSaveRequest(requestToSave, isSubmitAction);
    onClose();
  };

  return (
    <div id="sales-form-modal-backdrop" className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full overflow-hidden border border-slate-200 my-8">
        {/* Header */}
        <div className="bg-slate-900 text-white px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-blue-600 rounded-xl">
              <Smartphone className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-base font-bold">
                {editingRequest ? `Edit Request (${editingRequest.requestCode})` : 'New Roadshow Device Request'}
              </h2>
              <p className="text-xs text-slate-300">
                Created by {currentUser.name} ({currentUser.role} &bull; {currentUser.region})
              </p>
            </div>
          </div>
          <button
            id="btn-close-sales-form"
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1.5 rounded-lg hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Validation Error Banner */}
        {validationError && (
          <div className="bg-rose-50 border-b border-rose-200 text-rose-800 px-6 py-3 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0" />
            <span>{validationError}</span>
          </div>
        )}

        {/* Form Body */}
        <div className="p-6 space-y-8 max-h-[75vh] overflow-y-auto">
          {/* Part A: Roadshow Information */}
          <section id="part-a-section" className="space-y-4">
            <div className="flex items-center gap-2 pb-2 border-b border-slate-200">
              <div className="w-6 h-6 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-xs font-bold">
                A
              </div>
              <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wide">
                Part A: Roadshow Information
              </h3>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Requestor */}
              <div className="md:col-span-2">
                <label className="block text-xs font-semibold text-slate-700 mb-1 flex items-center gap-1">
                  <UserCheck className="w-3.5 h-3.5 text-blue-600" />
                  1. Requestor *
                </label>
                <input
                  type="text"
                  value={partA.requestor || ''}
                  onChange={e => setPartA({ ...partA, requestor: e.target.value })}
                  placeholder="e.g. Ahmad Razak"
                  className="w-full border border-slate-300 rounded-xl px-3 py-2 text-xs bg-slate-50 font-semibold text-slate-800 focus:ring-2 focus:ring-blue-500 outline-none"
                />
                <p className="text-[11px] text-slate-400 mt-1">
                  Auto-populated based on the requestor of this request.
                </p>
              </div>

              {/* Event Name */}
              <div className="md:col-span-2">
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  2. Event Name *
                </label>
                <input
                  type="text"
                  value={partA.eventName}
                  onChange={e => setPartA({ ...partA, eventName: e.target.value })}
                  placeholder="e.g. Mid Valley Tech Mega Expo 2026"
                  className="w-full border border-slate-300 rounded-xl px-3 py-2 text-xs focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                />
              </div>

              {/* Location */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1 flex items-center gap-1">
                  <MapPin className="w-3.5 h-3.5 text-slate-400" />
                  3. Location *
                </label>
                <input
                  type="text"
                  value={partA.location}
                  onChange={e => setPartA({ ...partA, location: e.target.value })}
                  placeholder="e.g. Centre Court, Level Ground"
                  className="w-full border border-slate-300 rounded-xl px-3 py-2 text-xs focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                />
              </div>

              {/* State */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  4. State *
                </label>
                <select
                  value={partA.state}
                  onChange={e => handleStateChange(e.target.value)}
                  className="w-full border border-slate-300 rounded-xl px-3 py-2 text-xs focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none bg-white"
                >
                  {MALAYSIAN_STATES.map(s => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </div>

              {/* Region */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  5. Region *
                </label>
                <select
                  value={partA.region}
                  onChange={e => setPartA({ ...partA, region: e.target.value })}
                  className="w-full border border-slate-300 rounded-xl px-3 py-2 text-xs focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none bg-white"
                >
                  {MALAYSIAN_REGIONS.map(r => (
                    <option key={r} value={r}>{r}</option>
                  ))}
                </select>
              </div>

              {/* Organizer */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1 flex items-center gap-1">
                  <Building className="w-3.5 h-3.5 text-slate-400" />
                  6. Organizer *
                </label>
                <input
                  type="text"
                  value={partA.organizer}
                  onChange={e => setPartA({ ...partA, organizer: e.target.value })}
                  placeholder="e.g. Mid Valley Exhibition Management"
                  className="w-full border border-slate-300 rounded-xl px-3 py-2 text-xs focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                />
              </div>

              {/* Start Date */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1 flex items-center gap-1">
                  <Calendar className="w-3.5 h-3.5 text-slate-400" />
                  7. Start Date *
                </label>
                <input
                  type="date"
                  value={partA.startDate}
                  onChange={e => setPartA({ ...partA, startDate: e.target.value })}
                  className="w-full border border-slate-300 rounded-xl px-3 py-2 text-xs focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                />
              </div>

              {/* End Date */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1 flex items-center gap-1">
                  <Calendar className="w-3.5 h-3.5 text-slate-400" />
                  8. End Date *
                </label>
                <input
                  type="date"
                  value={partA.endDate}
                  onChange={e => setPartA({ ...partA, endDate: e.target.value })}
                  className="w-full border border-slate-300 rounded-xl px-3 py-2 text-xs focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                />
              </div>

              {/* Partner */}
              <div className="md:col-span-2">
                <label className="block text-xs font-semibold text-slate-700 mb-1 flex items-center gap-1">
                  <Users className="w-3.5 h-3.5 text-slate-400" />
                  9. Partner
                </label>
                <input
                  type="text"
                  value={partA.partner || ''}
                  onChange={e => setPartA({ ...partA, partner: e.target.value })}
                  placeholder="e.g. Samsung Malaysia / Apple Authorised Reseller"
                  className="w-full border border-slate-300 rounded-xl px-3 py-2 text-xs focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                />
              </div>

              {/* Objective */}
              <div className="md:col-span-2">
                <label className="block text-xs font-semibold text-slate-700 mb-1 flex items-center gap-1">
                  <Target className="w-3.5 h-3.5 text-slate-400" />
                  10. Objective *
                </label>
                <textarea
                  rows={2}
                  value={partA.objective}
                  onChange={e => setPartA({ ...partA, objective: e.target.value })}
                  placeholder="Describe key goals, targeted customer sign-ups, or marketing objective for this roadshow"
                  className="w-full border border-slate-300 rounded-xl p-3 text-xs focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none resize-none"
                />
              </div>
            </div>
          </section>

          {/* Part B: Device Information */}
          <section id="part-b-section" className="space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-200">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center text-xs font-bold">
                  B
                </div>
                <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wide">
                  Part B: Device Information
                </h3>
              </div>

              <button
                id="btn-add-device-row"
                type="button"
                onClick={handleAddDeviceRow}
                className="inline-flex items-center gap-1.5 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 text-indigo-700 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>Add Device</span>
              </button>
            </div>

            {/* Device Items Table */}
            <div className="bg-blue-50/70 border border-slate-200 rounded-t-xl px-4 py-2 flex items-center justify-between text-xs">
              <div className="flex items-center gap-1.5 text-blue-900 font-medium">
                <Sparkles className="w-3.5 h-3.5 text-blue-600" />
                <span>Auto-Search: Type/Select Material or Description to auto-fill details & RRP (RM) from In-Stock Inventory ({inStockInventory.length} items)</span>
              </div>
            </div>

            <datalist id="sales-inventory-materials">
              {inStockInventory.map((inv, idx) => (
                <option key={`sales-mat-${idx}`} value={inv.material}>
                  {inv.brand ? `[${inv.brand}] ` : ''}{inv.description} (RM {inv.rrpRM})
                </option>
              ))}
            </datalist>

            <datalist id="sales-inventory-descriptions">
              {inStockInventory.map((inv, idx) => (
                <option key={`sales-desc-${idx}`} value={inv.description}>
                  [{inv.material}]{inv.brand ? ` [${inv.brand}]` : ''} RM {inv.rrpRM}
                </option>
              ))}
            </datalist>

            <div className="border border-slate-200 rounded-b-xl overflow-hidden shadow-sm">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-slate-100 text-slate-700 font-semibold border-b border-slate-200">
                  <tr>
                    <th className="p-3 w-36">1. Material</th>
                    <th className="p-3">2. Descriptions</th>
                    <th className="p-3 w-20 text-center">3. Qty</th>
                    <th className="p-3 w-28 text-right">4. RRP (RM)</th>
                    <th className="p-3 w-32 text-right">5. Total RRP (RM)</th>
                    <th className="p-3 w-12 text-center">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {partB.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="p-6 text-center text-slate-500 bg-slate-50/50">
                        <p className="text-xs font-semibold text-slate-600 mb-2">No device items currently added to Part B.</p>
                        <button
                          type="button"
                          onClick={() => handleAddDeviceRow()}
                          className="inline-flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer shadow-sm"
                        >
                          <Plus className="w-4 h-4" />
                          <span>Add First Device Row</span>
                        </button>
                      </td>
                    </tr>
                  ) : (
                    partB.map((item) => (
                      <tr key={item.id} className="hover:bg-slate-50">
                        <td className="p-2">
                          <input
                            id={`input-material-sales-${item.id}`}
                            type="text"
                            list="sales-inventory-materials"
                            value={item.material || ''}
                            onChange={e => handleDeviceChange(item.id, 'material', e.target.value)}
                            placeholder="Type/select material..."
                            className="w-full border border-slate-300 rounded-lg p-1.5 font-mono text-xs focus:ring-2 focus:ring-blue-500 outline-none"
                          />
                        </td>
                        <td className="p-2">
                          <input
                            type="text"
                            list="sales-inventory-descriptions"
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
                        <td className="p-2 text-right font-bold text-slate-900 bg-slate-50/80 rounded-lg">
                          {formatRM(item.totalRrpRM)}
                        </td>
                        <td className="p-2 text-center">
                          <button
                            id={`btn-delete-partb-row-${item.id}`}
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
                    <td colSpan={4} className="p-3 text-right uppercase tracking-wider text-[11px]">
                      Total RRP Investment Value:
                    </td>
                    <td className="p-3 text-right text-sm text-emerald-400">
                      {formatRM(calculateTotalRrpSum())}
                    </td>
                    <td></td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </section>
        </div>

        {/* Footer Actions */}
        <div className="bg-slate-50 px-6 py-4 flex flex-wrap items-center justify-between gap-3 border-t border-slate-200">
          <button
            id="btn-cancel-sales-form"
            type="button"
            onClick={onClose}
            className="px-4 py-2 border border-slate-300 text-slate-700 hover:bg-slate-100 rounded-xl text-xs font-semibold transition-colors cursor-pointer"
          >
            Cancel
          </button>

          <div className="flex items-center gap-2">
            <button
              id="btn-save-draft"
              type="button"
              onClick={() => handleSubmit(false)}
              className="inline-flex items-center gap-1.5 bg-slate-800 hover:bg-slate-700 text-white px-4 py-2 rounded-xl text-xs font-semibold shadow-sm transition-all cursor-pointer"
            >
              <Save className="w-4 h-4 text-slate-300" />
              <span>Save as Draft</span>
            </button>

            <button
              id="btn-submit-to-hos"
              type="button"
              onClick={() => handleSubmit(true)}
              className="inline-flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-500 text-white px-5 py-2 rounded-xl text-xs font-semibold shadow-md shadow-emerald-500/20 transition-all cursor-pointer"
            >
              <Send className="w-4 h-4" />
              <span>Submit to Head of Sales</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
