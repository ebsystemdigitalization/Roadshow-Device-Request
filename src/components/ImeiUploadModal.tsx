import React, { useState, useEffect } from 'react';
import { PartBDeviceItem, ImeiInventoryItem } from '../types';
import { Upload, Download, FileText, CheckCircle2, AlertCircle, X, Smartphone, Barcode, Trash2, Save, FileSpreadsheet } from 'lucide-react';

interface ImeiUploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  partBItems: PartBDeviceItem[];
  onSaveImeis: (updatedItems: PartBDeviceItem[], imeiInventoryRecords?: ImeiInventoryItem[]) => void;
  requestCode?: string;
  requestorName?: string;
  eventName?: string;
  region?: string;
  state?: string;
  requestId?: string;
  requestStatus?: string;
}

function parseCsvLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      result.push(current.trim().replace(/^"|"$/g, ''));
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current.trim().replace(/^"|"$/g, ''));
  return result;
}

// Expand items if quantity > 1 so each unit can get an individual IMEI assigned
function expandPartBUnits(rawItems: PartBDeviceItem[]): PartBDeviceItem[] {
  const result: PartBDeviceItem[] = [];
  rawItems.forEach((item, itemIdx) => {
    const qty = Math.max(1, item.quantity || 1);
    if (qty === 1) {
      result.push({ ...item, imei: item.imei || '' });
    } else {
      for (let q = 1; q <= qty; q++) {
        result.push({
          ...item,
          id: item.id.includes('-unit-') ? item.id : `${item.id}-unit-${q}`,
          quantity: 1,
          recommendedQuantity: 1,
          totalRrpRM: item.rrpRM,
          imei: q === 1 ? (item.imei || '') : ''
        });
      }
    }
  });
  return result;
}

export const ImeiUploadModal: React.FC<ImeiUploadModalProps> = ({
  isOpen,
  onClose,
  partBItems,
  onSaveImeis,
  requestCode = '',
  requestorName = '',
  eventName = '',
  region = '',
  state = '',
  requestId = '',
  requestStatus = ''
}) => {
  if (!isOpen) return null;

  const [items, setItems] = useState<PartBDeviceItem[]>(() => expandPartBUnits(partBItems));
  const [activeTab, setActiveTab] = useState<'manual' | 'csv'>('csv');
  const [csvText, setCsvText] = useState<string>('');
  const [uploadSuccessMsg, setUploadSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Sync state if partBItems change
  useEffect(() => {
    setItems(expandPartBUnits(partBItems));
  }, [partBItems]);

  const handleFieldChange = (id: string, field: keyof PartBDeviceItem, value: string) => {
    setItems(prev =>
      prev.map(item => (item.id === id ? { ...item, [field]: value } : item))
    );
  };

  const handleClearAllImeis = () => {
    setItems(prev => prev.map(item => ({ ...item, imei: '', customerName: '', nric: '', sppOrder: '', mobileNumber: '', submissionRemarks: '' })));
    setUploadSuccessMsg(null);
    setErrorMsg(null);
  };

  const handleDownloadSampleCsv = () => {
    const headers = "Request Code,Requestor Name,Event Name,Material,Descriptions,RRP (RM),Device IMEI No,Customer Name,NRIC,SPP Order,Mobile Number,Submission Remarks\n";
    let rows = "";

    const reqCode = requestCode || "RDR-2026-9742";
    const reqName = requestorName || "MUHAMMAD RAZIF BIN ABDUL RASHID";
    const evtName = eventName || "MAHA Pahang 2026";

    if (items.length > 0) {
      items.forEach((item, idx) => {
        const sampleImei = item.imei || `35455593809${4200 + idx + 1}`;
        rows += `"${reqCode}","${reqName}","${evtName}","${item.material}","${item.description.replace(/"/g, '""')}",${item.rrpRM},"${sampleImei}","${item.customerName || ''}","${item.nric || ''}","${item.sppOrder || ''}","${item.mobileNumber || ''}","${(item.submissionRemarks || '').replace(/"/g, '""')}"\n`;
      });
    } else {
      rows += `"${reqCode}","${reqName}","${evtName}","20017453","HP-SAMSUNG-A07 5G 8+256GB-BLK",1029,"354555938094204",,,,,\n`;
      rows += `"${reqCode}","${reqName}","${evtName}","20018081","HP-SAMSUNG-A27 5G 8+256GB-BLK",1499,"354555938094104",,,,,\n`;
    }

    const csvData = headers + rows;
    const blob = new Blob([csvData], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `${reqCode || 'PartB'}_IMEI_Excel_Template.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const parseAndApplyCsv = (text: string) => {
    const lines = text.split(/\r?\n/).filter(line => line.trim() !== '');
    if (lines.length === 0) {
      setErrorMsg('Uploaded file or text is empty.');
      return;
    }

    const firstLineCols = parseCsvLine(lines[0]);
    const firstLineLower = lines[0].toLowerCase();

    const isHeaderRow =
      firstLineLower.includes('material') ||
      firstLineLower.includes('imei') ||
      firstLineLower.includes('description') ||
      firstLineLower.includes('request code');

    const startIndex = isHeaderRow ? 1 : 0;

    // Detect column indices if header row present
    let matIdx = -1;
    let descIdx = -1;
    let rrpIdx = -1;
    let imeiIdx = -1;
    let custIdx = -1;
    let nricIdx = -1;
    let sppIdx = -1;
    let mobileIdx = -1;
    let remarksIdx = -1;

    if (isHeaderRow) {
      const headers = firstLineCols.map(h => h.toLowerCase().trim());
      const findH = (substr: string) => headers.findIndex(h => h.includes(substr));

      matIdx = findH('material');
      descIdx = findH('description');
      rrpIdx = findH('rrp');
      imeiIdx = findH('imei');
      custIdx = findH('customer');
      nricIdx = findH('nric');
      sppIdx = findH('spp');
      mobileIdx = headers.findIndex(h => h.includes('mobile') || h.includes('phone') || h.includes('tel'));
      remarksIdx = headers.findIndex(h => h.includes('remark') || h.includes('submission'));
    } else {
      matIdx = 3;
      descIdx = 4;
      rrpIdx = 5;
      imeiIdx = 6;
      custIdx = 7;
      nricIdx = 8;
      sppIdx = 9;
      mobileIdx = 10;
      remarksIdx = 11;
    }

    const parsedRows: {
      material?: string;
      description?: string;
      rrpRM?: number;
      imei: string;
      customerName?: string;
      nric?: string;
      sppOrder?: string;
      mobileNumber?: string;
      submissionRemarks?: string;
    }[] = [];

    for (let i = startIndex; i < lines.length; i++) {
      const cols = parseCsvLine(lines[i]);
      if (cols.length === 0) continue;

      if (cols.length === 1 && cols[0]) {
        parsedRows.push({ imei: cols[0] });
      } else if (cols.length >= 2) {
        let extractedImei = imeiIdx !== -1 ? (cols[imeiIdx] || '') : '';
        let extractedMat = matIdx !== -1 ? (cols[matIdx] || '') : '';
        let extractedDesc = descIdx !== -1 ? (cols[descIdx] || '') : '';
        let extractedRrp = rrpIdx !== -1 ? (parseFloat(cols[rrpIdx]) || 0) : 0;
        let extractedCust = custIdx !== -1 ? (cols[custIdx] || '') : '';
        let extractedNric = nricIdx !== -1 ? (cols[nricIdx] || '') : '';
        let extractedSpp = sppIdx !== -1 ? (cols[sppIdx] || '') : '';
        let extractedMobile = mobileIdx !== -1 ? (cols[mobileIdx] || '') : '';
        let extractedRemarks = remarksIdx !== -1 ? (cols[remarksIdx] || '') : '';

        // Fallbacks for simpler CSVs without headers
        if (!isHeaderRow && !extractedImei) {
          if (cols.length === 2) {
            extractedMat = cols[0];
            extractedImei = cols[1];
          } else if (cols.length === 3) {
            extractedMat = cols[0];
            extractedDesc = cols[1];
            extractedImei = cols[2];
          } else {
            extractedImei = cols[cols.length - 1];
          }
        }

        if (extractedImei) {
          parsedRows.push({
            material: extractedMat,
            description: extractedDesc,
            rrpRM: extractedRrp,
            imei: extractedImei,
            customerName: extractedCust,
            nric: extractedNric,
            sppOrder: extractedSpp,
            mobileNumber: extractedMobile,
            submissionRemarks: extractedRemarks
          });
        }
      }
    }

    if (parsedRows.length === 0) {
      setErrorMsg('No valid IMEI rows detected in CSV data.');
      return;
    }

    // Map parsed rows sequentially or matching Material
    let matchedCount = 0;
    const currentItems = [...items];

    // Create copy of parsed rows for matching
    const unassignedParsed = [...parsedRows];
    const newItemsList = currentItems.map((item, idx) => {
      // 1. Try matching unassigned row by Material code
      const matchIdx = unassignedParsed.findIndex(
        p => p.material && p.material.toLowerCase() === item.material.toLowerCase() && p.imei
      );

      if (matchIdx !== -1) {
        const p = unassignedParsed.splice(matchIdx, 1)[0];
        matchedCount++;
        return {
          ...item,
          imei: p.imei,
          customerName: p.customerName || item.customerName || '',
          nric: p.nric || item.nric || '',
          sppOrder: p.sppOrder || item.sppOrder || '',
          mobileNumber: p.mobileNumber || item.mobileNumber || '',
          submissionRemarks: p.submissionRemarks || item.submissionRemarks || ''
        };
      }

      // 2. Fallback to index-based matching if material didn't match directly
      if (parsedRows[idx] && parsedRows[idx].imei) {
        const p = parsedRows[idx];
        matchedCount++;
        return {
          ...item,
          imei: p.imei,
          customerName: p.customerName || item.customerName || '',
          nric: p.nric || item.nric || '',
          sppOrder: p.sppOrder || item.sppOrder || '',
          mobileNumber: p.mobileNumber || item.mobileNumber || '',
          submissionRemarks: p.submissionRemarks || item.submissionRemarks || ''
        };
      }

      return item;
    });

    // If there are extra parsed rows beyond existing items, add them as new unit items
    if (parsedRows.length > newItemsList.length) {
      for (let k = newItemsList.length; k < parsedRows.length; k++) {
        const p = parsedRows[k];
        if (p.imei) {
          matchedCount++;
          newItemsList.push({
            id: `partB-imported-${Date.now()}-${k}`,
            material: p.material || '20017453',
            description: p.description || 'Roadshow Mobile Device',
            quantity: 1,
            recommendedQuantity: 1,
            rrpRM: p.rrpRM || 1029,
            totalRrpRM: p.rrpRM || 1029,
            status: 'Approved',
            imei: p.imei,
            customerName: p.customerName || '',
            nric: p.nric || '',
            sppOrder: p.sppOrder || '',
            mobileNumber: p.mobileNumber || '',
            submissionRemarks: p.submissionRemarks || ''
          });
        }
      }
    }

    setItems(newItemsList);
    setErrorMsg(null);
    setUploadSuccessMsg(`Successfully imported and mapped ${matchedCount} IMEI numbers from Excel template!`);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = event => {
      const text = event.target?.result as string;
      if (text) {
        setCsvText(text);
        parseAndApplyCsv(text);
      }
    };
    reader.readAsText(file);
  };

  const handleSave = () => {
    const imeiInventoryRecords: ImeiInventoryItem[] = items
      .filter(item => Boolean((item.imei || '').trim()))
      .map((item, idx) => {
        const cleanImei = item.imei!.trim();
        const statusVal: 'HOO Approved' | 'Pending Approval' | 'Unassigned Stock' =
          requestStatus === 'Approved'
            ? 'HOO Approved'
            : (requestCode ? 'Pending Approval' : 'Unassigned Stock');

        return {
          id: `imei-${cleanImei}`,
          imei: cleanImei,
          material: item.material || '20017453',
          description: item.description || 'Roadshow Mobile Device',
          rrpRM: item.rrpRM || 0,
          requestCode: requestCode || undefined,
          requestId: requestId || undefined,
          eventName: eventName || undefined,
          requestorName: requestorName || undefined,
          region: region || undefined,
          state: state || undefined,
          customerName: item.customerName || undefined,
          nric: item.nric || undefined,
          sppOrder: item.sppOrder || undefined,
          mobileNumber: item.mobileNumber || undefined,
          submissionRemarks: item.submissionRemarks || undefined,
          status: statusVal,
          updatedAt: new Date().toISOString()
        };
      });

    onSaveImeis(items, imeiInventoryRecords);
    onClose();
  };

  const assignedCount = items.filter(item => Boolean((item.imei || '').trim())).length;
  const totalCount = items.length;

  return (
    <div id="imei-upload-modal-backdrop" className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full overflow-hidden border border-slate-200 animate-in fade-in zoom-in duration-150 my-8">
        {/* Modal Header */}
        <div className="bg-slate-900 text-white px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-purple-600 rounded-xl shadow-inner">
              <Barcode className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold">IMEI Bulk Upload & Device Assignment</h2>
                <span className="text-[10px] font-bold bg-purple-900/90 text-purple-200 border border-purple-700/60 px-2 py-0.5 rounded-full">
                  Device Team & Admin
                </span>
              </div>
              <p className="text-xs text-slate-300">
                Bulk upload IMEIs for Part B requested device inventory using the official Excel template
              </p>
            </div>
          </div>
          <button
            id="btn-close-imei-modal"
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1.5 rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 space-y-5">
          {/* Status Bar */}
          <div className="flex flex-wrap items-center justify-between bg-purple-50/70 border border-purple-200/80 rounded-xl p-3.5 text-xs gap-3">
            <div className="flex items-center gap-2 text-purple-900 font-semibold">
              <Smartphone className="w-4 h-4 text-purple-600" />
              <span>
                Assigned IMEIs: <strong className="text-purple-700 text-sm">{assignedCount}</strong> / {totalCount} devices
              </span>
              {requestCode && (
                <span className="ml-2 font-mono text-[11px] bg-purple-100 text-purple-800 px-2 py-0.5 rounded border border-purple-200">
                  {requestCode}
                </span>
              )}
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                id="btn-download-excel-template"
                onClick={handleDownloadSampleCsv}
                className="inline-flex items-center gap-1.5 text-xs font-bold text-purple-800 hover:text-purple-950 bg-white border border-purple-300 px-3 py-1.5 rounded-xl hover:bg-purple-100/70 transition-all cursor-pointer shadow-xs"
              >
                <FileSpreadsheet className="w-4 h-4 text-purple-600" />
                <span>Download Excel Template</span>
              </button>
              {assignedCount > 0 && (
                <button
                  type="button"
                  onClick={handleClearAllImeis}
                  className="inline-flex items-center gap-1 text-xs font-semibold text-rose-700 hover:text-rose-900 bg-white border border-rose-200 px-2.5 py-1.5 rounded-xl hover:bg-rose-50 transition-colors cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Clear IMEIs</span>
                </button>
              )}
            </div>
          </div>

          {/* Mode Switch Tabs */}
          <div className="flex border-b border-slate-200 text-xs font-semibold">
            <button
              type="button"
              onClick={() => setActiveTab('csv')}
              className={`pb-2.5 px-4 border-b-2 cursor-pointer transition-colors flex items-center gap-1.5 ${
                activeTab === 'csv'
                  ? 'border-purple-600 text-purple-700'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              <Upload className="w-3.5 h-3.5" />
              <span>Excel / CSV Bulk Upload</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('manual')}
              className={`pb-2.5 px-4 border-b-2 cursor-pointer transition-colors flex items-center gap-1.5 ${
                activeTab === 'manual'
                  ? 'border-purple-600 text-purple-700'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              <Smartphone className="w-3.5 h-3.5" />
              <span>Manual Entry & Edit ({items.length} Units)</span>
            </button>
          </div>

          {/* Tab 1: CSV Upload */}
          {activeTab === 'csv' && (
            <div className="space-y-4 text-xs">
              <div className="border-2 border-dashed border-purple-300 rounded-2xl p-6 text-center bg-purple-50/30 hover:bg-purple-50/70 transition-all">
                <Upload className="w-9 h-9 text-purple-600 mx-auto mb-2" />
                <p className="font-bold text-slate-800 text-sm mb-1">
                  Upload Excel (.csv) file with Device IMEI numbers
                </p>
                <p className="text-xs text-slate-500 max-w-xl mx-auto mb-3">
                  Excel Template Headers: <code className="bg-purple-100 text-purple-900 px-1.5 py-0.5 rounded font-mono font-semibold">Request Code, Requestor Name, Event Name, Material, Descriptions, RRP (RM), Device IMEI No, Customer Name, NRIC, SPP Order, Mobile Number, Submission Remarks</code>
                </p>
                <input
                  type="file"
                  accept=".csv,.txt"
                  onChange={handleFileUpload}
                  className="hidden"
                  id="imei-excel-file-input"
                />
                <label
                  htmlFor="imei-excel-file-input"
                  className="inline-flex items-center gap-2 bg-purple-600 hover:bg-purple-700 text-white font-bold px-5 py-2.5 rounded-xl cursor-pointer shadow-sm transition-all"
                >
                  <FileSpreadsheet className="w-4 h-4" />
                  <span>Choose CSV File</span>
                </label>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Or paste Excel / CSV template content directly:</label>
                <textarea
                  rows={5}
                  value={csvText}
                  onChange={e => {
                    setCsvText(e.target.value);
                    if (e.target.value.trim()) {
                      parseAndApplyCsv(e.target.value);
                    }
                  }}
                  placeholder={`Request Code,Requestor Name,Event Name,Material,Descriptions,RRP (RM),Device IMEI No,Customer Name,NRIC,SPP Order,Mobile Number,Submission Remarks\nRDR-2026-9742,MUHAMMAD RAZIF,MAHA Pahang 2026,20017453,HP-SAMSUNG-A07 5G 8+256GB-BLK,1029,354555938094204,,,,,`}
                  className="w-full font-mono text-xs p-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-purple-500 bg-white"
                />
              </div>
            </div>
          )}

          {/* Tab 2: Manual Input */}
          {activeTab === 'manual' && (
            <div className="max-h-96 overflow-y-auto border border-slate-200 rounded-2xl divide-y divide-slate-100">
              {items.map((item, idx) => (
                <div key={item.id || `unit-item-${idx}`} className="p-3.5 space-y-2 hover:bg-slate-50/80 transition-colors text-xs">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-slate-400 font-bold">{idx + 1}.</span>
                      <span className="font-bold text-slate-900">{item.description}</span>
                      <span className="font-mono text-[11px] text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-200 font-semibold">
                        {item.material}
                      </span>
                    </div>
                    <span className="text-slate-500 text-[11px]">RRP: RM {item.rrpRM}</span>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5">
                    <div>
                      <label className="block text-[10px] text-purple-900 font-bold mb-0.5">Device IMEI No *</label>
                      <input
                        type="text"
                        placeholder="e.g. 354555938094204"
                        value={item.imei || ''}
                        onChange={e => handleFieldChange(item.id, 'imei', e.target.value)}
                        className="w-full px-2.5 py-1.5 font-mono text-xs font-bold border border-purple-300 rounded-lg focus:ring-2 focus:ring-purple-500 bg-purple-50/30 text-purple-950"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] text-slate-600 font-semibold mb-0.5">Customer Name</label>
                      <input
                        type="text"
                        placeholder="Customer name"
                        value={item.customerName || ''}
                        onChange={e => handleFieldChange(item.id, 'customerName', e.target.value)}
                        className="w-full px-2 py-1 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-purple-500 bg-white"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] text-slate-600 font-semibold mb-0.5">NRIC</label>
                      <input
                        type="text"
                        placeholder="e.g. 920101-14-5511"
                        value={item.nric || ''}
                        onChange={e => handleFieldChange(item.id, 'nric', e.target.value)}
                        className="w-full px-2 py-1 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-purple-500 bg-white"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5">
                    <div>
                      <label className="block text-[10px] text-slate-600 font-semibold mb-0.5">SPP Order</label>
                      <input
                        type="text"
                        placeholder="e.g. SPP-88902"
                        value={item.sppOrder || ''}
                        onChange={e => handleFieldChange(item.id, 'sppOrder', e.target.value)}
                        className="w-full px-2 py-1 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-purple-500 bg-white"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] text-slate-600 font-semibold mb-0.5">Mobile Number</label>
                      <input
                        type="text"
                        placeholder="e.g. 012-3456789"
                        value={item.mobileNumber || ''}
                        onChange={e => handleFieldChange(item.id, 'mobileNumber', e.target.value)}
                        className="w-full px-2 py-1 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-purple-500 bg-white"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] text-slate-600 font-semibold mb-0.5">Submission Remarks</label>
                      <input
                        type="text"
                        placeholder="Remarks"
                        value={item.submissionRemarks || ''}
                        onChange={e => handleFieldChange(item.id, 'submissionRemarks', e.target.value)}
                        className="w-full px-2 py-1 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-purple-500 bg-white"
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Feedback Messages */}
          {uploadSuccessMsg && (
            <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-900 text-xs flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
              <span className="font-medium">{uploadSuccessMsg}</span>
            </div>
          )}
          {errorMsg && (
            <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-xl text-rose-900 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0" />
              <span className="font-medium">{errorMsg}</span>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="bg-slate-50 px-6 py-4 border-t border-slate-200 flex items-center justify-between">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 border border-slate-300 rounded-xl text-slate-700 hover:bg-slate-100 font-semibold text-xs transition-colors cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            id="btn-apply-and-save-imeis"
            onClick={handleSave}
            className="inline-flex items-center gap-1.5 bg-purple-600 hover:bg-purple-700 text-white font-bold px-6 py-2.5 rounded-xl text-xs transition-colors shadow-sm cursor-pointer"
          >
            <Upload className="w-4 h-4" />
            <span>Upload into IMEI Inventory</span>
          </button>
        </div>
      </div>
    </div>
  );
};
