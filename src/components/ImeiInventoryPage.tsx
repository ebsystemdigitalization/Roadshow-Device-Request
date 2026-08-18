import React, { useState, useMemo } from 'react';
import { ImeiInventoryItem, User, RoadshowRequest, PartBDeviceItem } from '../types';
import { formatRM, formatDate } from '../utils/formatters';
import { StatusBadge } from './StatusBadge';
import { ImeiUploadModal } from './ImeiUploadModal';
import {
  Barcode,
  Search,
  Filter,
  Download,
  Plus,
  Edit2,
  Trash2,
  CheckCircle2,
  Clock,
  PackageCheck,
  Smartphone,
  ExternalLink,
  X,
  Save,
  FileSpreadsheet,
  Layers,
  AlertCircle,
  AlertTriangle,
  Upload,
  Eye
} from 'lucide-react';

interface ImeiInventoryPageProps {
  currentUser: User;
  imeiList: ImeiInventoryItem[];
  requests: RoadshowRequest[];
  onUpdateImei: (item: ImeiInventoryItem) => void;
  onAddImei: (item: ImeiInventoryItem) => void;
  onDeleteImei: (id: string) => void;
  onBulkAddImeis?: (items: ImeiInventoryItem[]) => void;
  onSelectRequest?: (req: RoadshowRequest) => void;
}

export const ImeiInventoryPage: React.FC<ImeiInventoryPageProps> = ({
  currentUser,
  imeiList,
  requests,
  onUpdateImei,
  onAddImei,
  onDeleteImei,
  onBulkAddImeis,
  onSelectRequest
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [materialFilter, setMaterialFilter] = useState<string>('ALL');

  // Modal states
  const [editingItem, setEditingItem] = useState<ImeiInventoryItem | null>(null);
  const [deletingItem, setDeletingItem] = useState<ImeiInventoryItem | null>(null);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isBulkModalOpen, setIsBulkModalOpen] = useState(false);
  const [selectedUploadReq, setSelectedUploadReq] = useState<RoadshowRequest | null>(null);
  const [isImeiModalOpen, setIsImeiModalOpen] = useState(false);
  const [bulkActiveTab, setBulkActiveTab] = useState<'file' | 'paste'>('file');
  const [bulkCsvText, setBulkCsvText] = useState('');
  const [uploadedFileName, setUploadedFileName] = useState<string | null>(null);
  const [parsedItemsPreview, setParsedItemsPreview] = useState<ImeiInventoryItem[]>([]);
  const [bulkErrorMsg, setBulkErrorMsg] = useState<string | null>(null);

  // New item form state
  const [newItem, setNewItem] = useState<Partial<ImeiInventoryItem>>({
    imei: '',
    material: '',
    description: '',
    rrpRM: 0,
    requestCode: '',
    customerName: '',
    nric: '',
    sppOrder: '',
    mobileNumber: '',
    submissionRemarks: '',
    status: 'Unassigned Stock'
  });

  // Material options list
  const materialOptions = useMemo(() => {
    const set = new Set<string>();
    imeiList.forEach(item => {
      if (item.material) set.add(item.material);
    });
    return Array.from(set).sort();
  }, [imeiList]);

  // Filtered IMEIs
  const filteredList = useMemo(() => {
    return imeiList.filter(item => {
      const matchesMaterial =
        materialFilter === 'ALL' || item.material === materialFilter;

      const query = searchTerm.toLowerCase().trim();
      if (!query) return matchesMaterial;

      const matchesQuery =
        item.imei.toLowerCase().includes(query) ||
        item.material.toLowerCase().includes(query) ||
        item.description.toLowerCase().includes(query) ||
        (item.requestCode && item.requestCode.toLowerCase().includes(query)) ||
        (item.eventName && item.eventName.toLowerCase().includes(query)) ||
        (item.customerName && item.customerName.toLowerCase().includes(query)) ||
        (item.nric && item.nric.toLowerCase().includes(query)) ||
        (item.sppOrder && item.sppOrder.toLowerCase().includes(query)) ||
        (item.mobileNumber && item.mobileNumber.toLowerCase().includes(query));

      return matchesMaterial && matchesQuery;
    });
  }, [imeiList, searchTerm, materialFilter]);

  // Helper to calculate request IMEI progress
  const getRequestImeiStats = (req: RoadshowRequest) => {
    const totalUnits = (req.partB || []).reduce((sum, d) => sum + (d.quantity || 0), 0);

    const countFromPartB = (req.partB || []).reduce((acc, d) => {
      if (!d.imei || !d.imei.trim()) return acc;
      const list = d.imei.split(',').map(s => s.trim()).filter(Boolean);
      return acc + Math.max(1, list.length);
    }, 0);

    const countFromInventory = imeiList.filter(
      i => (i.requestId && i.requestId === req.id) ||
           (i.requestCode && req.requestCode && i.requestCode.trim().toLowerCase() === req.requestCode.trim().toLowerCase())
    ).length;

    const uploadedCount = Math.max(countFromPartB, countFromInventory);
    const pendingCount = Math.max(0, totalUnits - uploadedCount);
    const isPending = totalUnits > 0 && uploadedCount < totalUnits;

    return { totalUnits, uploadedCount, pendingCount, isPending };
  };

  // Order requests pending IMEI upload
  const pendingUploadRequests = useMemo(() => {
    return requests.filter(req => {
      if (req.status === 'Rejected') return false;
      const { isPending } = getRequestImeiStats(req);
      return isPending;
    });
  }, [requests, imeiList]);

  const totalPendingImeiUnits = useMemo(() => {
    return pendingUploadRequests.reduce((sum, req) => sum + getRequestImeiStats(req).pendingCount, 0);
  }, [pendingUploadRequests, imeiList]);

  // Statistics
  const stats = useMemo(() => {
    const total = imeiList.length;
    const assigned = imeiList.filter(i => !!i.requestCode).length;
    const unassigned = total - assigned;
    const pendingUploadCount = pendingUploadRequests.length;
    const uniqueModels = materialOptions.length;
    return { total, assigned, unassigned, pendingUploadCount, uniqueModels };
  }, [imeiList, materialOptions, pendingUploadRequests]);

  // Handle Export CSV
  const handleExportCsv = () => {
    let csv = `IMEI,Material,Description,RRP_RM,Request_Code,Event_Name,Requestor,Region,State,Customer_Name,NRIC,SPP_Order,Mobile_Number,Remarks\n`;
    filteredList.forEach(item => {
      const imeiEsc = `"${item.imei}"`;
      const matEsc = `"${item.material}"`;
      const descEsc = `"${item.description.replace(/"/g, '""')}"`;
      const reqCodeEsc = `"${item.requestCode || ''}"`;
      const eventEsc = `"${(item.eventName || '').replace(/"/g, '""')}"`;
      const reqNameEsc = `"${item.requestorName || ''}"`;
      const regionEsc = `"${item.region || ''}"`;
      const stateEsc = `"${item.state || ''}"`;
      const custEsc = `"${item.customerName || ''}"`;
      const nricEsc = `"${item.nric || ''}"`;
      const sppEsc = `"${item.sppOrder || ''}"`;
      const mobileEsc = `"${item.mobileNumber || ''}"`;
      const remarksEsc = `"${(item.submissionRemarks || '').replace(/"/g, '""')}"`;

      csv += `${imeiEsc},${matEsc},${descEsc},${item.rrpRM},${reqCodeEsc},${eventEsc},${reqNameEsc},${regionEsc},${stateEsc},${custEsc},${nricEsc},${sppEsc},${mobileEsc},${remarksEsc}\n`;
    });

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `IMEI_Inventory_Report_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Handle Save Single Add
  const handleSaveNewItem = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newItem.imei || !newItem.material || !newItem.description) {
      alert('IMEI Number, Material Code, and Description are required.');
      return;
    }

    const created: ImeiInventoryItem = {
      id: `imei-user-${Date.now()}`,
      imei: newItem.imei.trim(),
      material: newItem.material.trim(),
      description: newItem.description.trim(),
      rrpRM: Number(newItem.rrpRM) || 0,
      requestCode: newItem.requestCode?.trim() || undefined,
      customerName: newItem.customerName?.trim() || undefined,
      nric: newItem.nric?.trim() || undefined,
      sppOrder: newItem.sppOrder?.trim() || undefined,
      mobileNumber: newItem.mobileNumber?.trim() || undefined,
      submissionRemarks: newItem.submissionRemarks?.trim() || undefined,
      status: (newItem.status as any) || 'Unassigned Stock',
      updatedAt: new Date().toISOString()
    };

    onAddImei(created);
    setIsAddModalOpen(false);
    setNewItem({
      imei: '',
      material: '',
      description: '',
      rrpRM: 0,
      requestCode: '',
      customerName: '',
      nric: '',
      sppOrder: '',
      mobileNumber: '',
      submissionRemarks: '',
      status: 'Unassigned Stock'
    });
  };

  // Download Excel Template for IMEI Inventory
  const handleDownloadTemplate = () => {
    const headers = "Request Code,Requestor Name,Event Name,Material,Descriptions,RRP (RM),Device IMEI No,Customer Name,NRIC,SPP Order,Mobile Number,Submission Remarks,Region,State,Status\n";
    const rows = [
      `"RDR-2026-1082","MUHAMMAD RAZIF BIN ABDUL RASHID","MAHA Pahang 2026","20017453","HP-SAMSUNG-A07 5G 8+256GB-BLK",1029,"869123048571210","Ahmad Zaki","900101-14-5521","SPP-88219","0123456789","Roadshow allocation","East Coast","Pahang","Unassigned Stock"`,
      `"RDR-2026-1082","MUHAMMAD RAZIF BIN ABDUL RASHID","MAHA Pahang 2026","20018081","HP-SAMSUNG-A27 5G 8+256GB-BLK",1499,"869123048571211","Siti Aminah","920315-10-5112","SPP-88220","0198765432","Roadshow allocation","East Coast","Pahang","Unassigned Stock"`,
      `"","","","20018082","HP-SAMSUNG-S24 ULTRA 512GB-GRY",6299,"869123048571212","","","","","Buffer stock","Central","Selangor","Unassigned Stock"`
    ].join('\n');

    const csvData = headers + rows + '\n';
    const blob = new Blob([csvData], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', 'imei_inventory_excel_template.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Helper to parse CSV line respecting quotes
  const parseCsvRowLine = (line: string): string[] => {
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
  };

  // Parse raw Excel/CSV text into ImeiInventoryItem array
  const parseBulkTextToItems = (text: string): ImeiInventoryItem[] => {
    const lines = text.split(/\r?\n/).filter(l => l.trim() !== '');
    if (lines.length === 0) return [];

    const firstRowCols = parseCsvRowLine(lines[0]);
    const firstRowLower = firstRowCols.map(c => c.toLowerCase().trim());

    const hasHeader = firstRowLower.some(c =>
      c.includes('imei') || c.includes('material') || c.includes('request') || c.includes('description') || c.includes('rrp')
    );

    let reqCodeIdx = -1;
    let reqNameIdx = -1;
    let eventIdx = -1;
    let matIdx = -1;
    let descIdx = -1;
    let rrpIdx = -1;
    let imeiIdx = -1;
    let custIdx = -1;
    let nricIdx = -1;
    let sppIdx = -1;
    let mobileIdx = -1;
    let remarksIdx = -1;
    let regionIdx = -1;
    let stateIdx = -1;
    let statusIdx = -1;

    if (hasHeader) {
      firstRowLower.forEach((col, idx) => {
        if (col.includes('request code') || col === 'reqcode' || col === 'requestcode') reqCodeIdx = idx;
        else if (col.includes('requestor')) reqNameIdx = idx;
        else if (col.includes('event')) eventIdx = idx;
        else if (col.includes('material') || col === 'mat') matIdx = idx;
        else if (col.includes('description') || col.includes('desc')) descIdx = idx;
        else if (col.includes('rrp')) rrpIdx = idx;
        else if (col.includes('imei')) imeiIdx = idx;
        else if (col.includes('customer')) custIdx = idx;
        else if (col.includes('nric')) nricIdx = idx;
        else if (col.includes('spp')) sppIdx = idx;
        else if (col.includes('mobile') || col.includes('phone')) mobileIdx = idx;
        else if (col.includes('remark')) remarksIdx = idx;
        else if (col.includes('region')) regionIdx = idx;
        else if (col.includes('state')) stateIdx = idx;
        else if (col.includes('status')) statusIdx = idx;
      });
    }

    const startIndex = hasHeader ? 1 : 0;
    const parsed: ImeiInventoryItem[] = [];

    for (let i = startIndex; i < lines.length; i++) {
      const cols = parseCsvRowLine(lines[i]);
      if (cols.length === 0 || cols.every(c => !c)) continue;

      let cleanImei = '';
      let matVal = '';
      let descVal = '';
      let rrpVal = 0;
      let reqCodeVal: string | undefined = undefined;
      let reqNameVal: string | undefined = undefined;
      let eventNameVal: string | undefined = undefined;
      let custVal: string | undefined = undefined;
      let nricVal: string | undefined = undefined;
      let sppVal: string | undefined = undefined;
      let mobileVal: string | undefined = undefined;
      let remarksVal: string | undefined = undefined;
      let regionVal: string | undefined = undefined;
      let stateVal: string | undefined = undefined;
      let statusVal: 'HOO Approved' | 'Pending Approval' | 'Unassigned Stock' = 'Unassigned Stock';

      if (hasHeader) {
        if (imeiIdx !== -1) cleanImei = cols[imeiIdx] || '';
        if (matIdx !== -1) matVal = cols[matIdx] || '';
        if (descIdx !== -1) descVal = cols[descIdx] || '';
        if (rrpIdx !== -1) rrpVal = parseFloat(cols[rrpIdx]) || 0;
        if (reqCodeIdx !== -1) reqCodeVal = cols[reqCodeIdx] || undefined;
        if (reqNameIdx !== -1) reqNameVal = cols[reqNameIdx] || undefined;
        if (eventIdx !== -1) eventNameVal = cols[eventIdx] || undefined;
        if (custIdx !== -1) custVal = cols[custIdx] || undefined;
        if (nricIdx !== -1) nricVal = cols[nricIdx] || undefined;
        if (sppIdx !== -1) sppVal = cols[sppIdx] || undefined;
        if (mobileIdx !== -1) mobileVal = cols[mobileIdx] || undefined;
        if (remarksIdx !== -1) remarksVal = cols[remarksIdx] || undefined;
        if (regionIdx !== -1) regionVal = cols[regionIdx] || undefined;
        if (stateIdx !== -1) stateVal = cols[stateIdx] || undefined;
        if (statusIdx !== -1 && cols[statusIdx]) {
          const rawSt = cols[statusIdx].trim();
          if (rawSt === 'HOO Approved' || rawSt === 'Pending Approval' || rawSt === 'Unassigned Stock') {
            statusVal = rawSt;
          }
        }
      } else {
        if (cols.length >= 7) {
          reqCodeVal = cols[0] || undefined;
          reqNameVal = cols[1] || undefined;
          eventNameVal = cols[2] || undefined;
          matVal = cols[3] || '';
          descVal = cols[4] || '';
          rrpVal = parseFloat(cols[5]) || 0;
          cleanImei = cols[6] || '';
          custVal = cols[7] || undefined;
          nricVal = cols[8] || undefined;
          sppVal = cols[9] || undefined;
          mobileVal = cols[10] || undefined;
          remarksVal = cols[11] || undefined;
          if (cols[12]) regionVal = cols[12];
          if (cols[13]) stateVal = cols[13];
          if (cols[14]) {
            const rawSt = cols[14].trim();
            if (rawSt === 'HOO Approved' || rawSt === 'Pending Approval' || rawSt === 'Unassigned Stock') {
              statusVal = rawSt;
            }
          }
        } else {
          cleanImei = cols[0] || '';
          matVal = cols[1] || '';
          descVal = cols[2] || '';
          rrpVal = parseFloat(cols[3]) || 0;
          reqCodeVal = cols[4] || undefined;
        }
      }

      cleanImei = cleanImei.trim();
      if (!cleanImei) continue;

      if (!hasHeader || statusIdx === -1) {
        if (reqCodeVal) {
          statusVal = 'Pending Approval';
        } else {
          statusVal = 'Unassigned Stock';
        }
      }

      parsed.push({
        id: `imei-bulk-${Date.now()}-${i}-${cleanImei}`,
        imei: cleanImei,
        material: matVal,
        description: descVal,
        rrpRM: rrpVal,
        requestCode: reqCodeVal,
        requestorName: reqNameVal,
        eventName: eventNameVal,
        customerName: custVal,
        nric: nricVal,
        sppOrder: sppVal,
        mobileNumber: mobileVal,
        submissionRemarks: remarksVal,
        region: regionVal,
        state: stateVal,
        status: statusVal,
        updatedAt: new Date().toISOString()
      });
    }

    return parsed;
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadedFileName(file.name);
    setBulkErrorMsg(null);

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      if (text) {
        setBulkCsvText(text);
        const items = parseBulkTextToItems(text);
        setParsedItemsPreview(items);
        if (items.length === 0) {
          setBulkErrorMsg('No valid IMEI records found in the uploaded file. Please verify the template headers.');
        }
      }
    };
    reader.onerror = () => {
      setBulkErrorMsg('Failed to read uploaded template file.');
    };
    reader.readAsText(file);
  };

  const handlePasteChange = (val: string) => {
    setBulkCsvText(val);
    setBulkErrorMsg(null);
    if (val.trim()) {
      const items = parseBulkTextToItems(val);
      setParsedItemsPreview(items);
    } else {
      setParsedItemsPreview([]);
    }
  };

  // Handle Bulk CSV Import submit
  const handleParseBulkCsv = () => {
    setBulkErrorMsg(null);
    const recordsToImport = parsedItemsPreview.length > 0
      ? parsedItemsPreview
      : parseBulkTextToItems(bulkCsvText);

    if (recordsToImport.length === 0) {
      setBulkErrorMsg('No valid IMEI records parsed. Please upload or paste data using the official Excel template.');
      return;
    }

    if (onBulkAddImeis) {
      onBulkAddImeis(recordsToImport);
    } else {
      recordsToImport.forEach(p => onAddImei(p));
    }

    setIsBulkModalOpen(false);
    setBulkCsvText('');
    setUploadedFileName(null);
    setParsedItemsPreview([]);
  };

  // Save edit item
  const handleSaveEdit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingItem) return;
    onUpdateImei({
      ...editingItem,
      updatedAt: new Date().toISOString()
    });
    setEditingItem(null);
  };

  const getStatusBadge = (status: ImeiInventoryItem['status']) => {
    switch (status) {
      case 'HOO Approved':
        return (
          <span className="inline-flex items-center gap-1 font-semibold text-[11px] bg-emerald-100 text-emerald-800 border border-emerald-300 px-2.5 py-0.5 rounded-full shadow-2xs">
            <CheckCircle2 className="w-3 h-3 text-emerald-600" />
            <span>HOO Approved</span>
          </span>
        );
      case 'Pending Approval':
        return (
          <span className="inline-flex items-center gap-1 font-semibold text-[11px] bg-amber-100 text-amber-800 border border-amber-300 px-2.5 py-0.5 rounded-full shadow-2xs">
            <Clock className="w-3 h-3 text-amber-600" />
            <span>Pending Approval</span>
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 font-semibold text-[11px] bg-slate-100 text-slate-700 border border-slate-300 px-2.5 py-0.5 rounded-full shadow-2xs">
            <PackageCheck className="w-3 h-3 text-slate-500" />
            <span>Unassigned Stock</span>
          </span>
        );
    }
  };

  return (
    <div id="imei-inventory-page" className="space-y-6">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-purple-950 to-slate-900 text-white rounded-2xl p-6 shadow-xl border border-purple-900/40 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1.5">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-purple-600/80 rounded-xl shadow-inner border border-purple-400/30">
              <Barcode className="w-6 h-6 text-white" />
            </div>
            <h1 className="text-xl font-extrabold tracking-tight flex items-center gap-2">
              IMEI Inventory Management
              <span className="text-[11px] font-semibold bg-purple-500/20 text-purple-300 border border-purple-400/30 px-2.5 py-0.5 rounded-full">
                {currentUser.role} View
              </span>
            </h1>
          </div>
          <p className="text-xs text-slate-300 max-w-2xl leading-relaxed">
            Central repository for device IMEI serial numbers, roadshow allocations, and customer registration details across all approved & pending roadshow requests.
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2 flex-wrap">
          <button
            id="btn-export-imei-csv"
            onClick={handleExportCsv}
            className="inline-flex items-center gap-1.5 bg-white/10 hover:bg-white/20 text-white text-xs font-semibold px-3.5 py-2 rounded-xl border border-white/20 transition-all cursor-pointer"
          >
            <Download className="w-4 h-4" />
            <span>Export CSV</span>
          </button>
          <button
            id="btn-bulk-upload-imeis"
            onClick={() => setIsBulkModalOpen(true)}
            className="inline-flex items-center gap-1.5 bg-purple-600 hover:bg-purple-500 text-white text-xs font-semibold px-3.5 py-2 rounded-xl transition-all cursor-pointer shadow-md"
          >
            <Upload className="w-4 h-4" />
            <span>Bulk Import CSV</span>
          </button>
          <button
            id="btn-add-single-imei"
            onClick={() => setIsAddModalOpen(true)}
            className="inline-flex items-center gap-1.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold px-3.5 py-2 rounded-xl transition-all cursor-pointer shadow-md"
          >
            <Plus className="w-4 h-4" />
            <span>Add Single IMEI</span>
          </button>
        </div>
      </div>

      {/* Metric Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
          <div className="flex items-center justify-between text-slate-500 text-xs font-semibold mb-1">
            <span>Total IMEIs</span>
            <Barcode className="w-4 h-4 text-purple-600" />
          </div>
          <div className="text-2xl font-bold text-slate-900">{stats.total}</div>
          <div className="text-[11px] text-slate-400 mt-1">In system database</div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-blue-200 bg-blue-50/20 shadow-2xs">
          <div className="flex items-center justify-between text-blue-800 text-xs font-semibold mb-1">
            <span>Assigned IMEIs</span>
            <CheckCircle2 className="w-4 h-4 text-blue-600" />
          </div>
          <div className="text-2xl font-bold text-blue-900">{stats.assigned}</div>
          <div className="text-[11px] text-blue-700 mt-1">Allocated to roadshow requests</div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-amber-200 bg-amber-50/20 shadow-2xs">
          <div className="flex items-center justify-between text-amber-800 text-xs font-semibold mb-1">
            <span>Unassigned Stock</span>
            <PackageCheck className="w-4 h-4 text-amber-600" />
          </div>
          <div className="text-2xl font-bold text-amber-900">{stats.unassigned}</div>
          <div className="text-[11px] text-amber-700 mt-1">Available in inventory</div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-amber-300 bg-amber-50/50 shadow-2xs">
          <div className="flex items-center justify-between text-amber-900 text-xs font-semibold mb-1">
            <span>Pending Upload IMEI</span>
            <Clock className="w-4 h-4 text-amber-600 animate-pulse" />
          </div>
          <div className="text-2xl font-bold text-amber-900">{stats.pendingUploadCount}</div>
          <div className="text-[11px] text-amber-800 font-medium mt-1">{totalPendingImeiUnits} units pending</div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
          <div className="flex items-center justify-between text-slate-500 text-xs font-semibold mb-1">
            <span>Unique Models</span>
            <Smartphone className="w-4 h-4 text-slate-600" />
          </div>
          <div className="text-2xl font-bold text-slate-900">{stats.uniqueModels}</div>
          <div className="text-[11px] text-slate-400 mt-1">Device materials</div>
        </div>
      </div>

      {/* PENDING UPLOAD IMEI SECTION */}
      <div id="pending-upload-imei-section" className="bg-white rounded-2xl border border-amber-200/80 shadow-2xs overflow-hidden space-y-0">
        <div className="p-5 bg-gradient-to-r from-amber-500/10 via-amber-50/80 to-white border-b border-amber-200/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-amber-500 text-white rounded-xl shadow-xs">
              <Clock className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-slate-900 uppercase tracking-wider">
                  PENDING UPLOAD IMEI
                </h3>
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-100 text-amber-900 border border-amber-300">
                  {pendingUploadRequests.length} Order {pendingUploadRequests.length === 1 ? 'Request' : 'Requests'}
                </span>
              </div>
              <p className="text-xs text-slate-600 mt-0.5">
                Order requests that are still pending IMEI serial number upload ({totalPendingImeiUnits} units remaining).
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-amber-900 bg-amber-100/90 border border-amber-200 px-3 py-1.5 rounded-xl">
              {totalPendingImeiUnits} Device Units Pending
            </span>
          </div>
        </div>

        {/* Table of Order Requests Pending IMEI Upload */}
        {pendingUploadRequests.length === 0 ? (
          <div className="p-8 text-center text-slate-500 space-y-2">
            <CheckCircle2 className="w-10 h-10 text-emerald-500 mx-auto" />
            <p className="font-semibold text-slate-800 text-sm">All Order Requests Up to Date</p>
            <p className="text-xs text-slate-400">There are currently no order requests pending IMEI uploads.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-[11px] uppercase tracking-wider text-slate-500 font-bold">
                  <th className="py-3 px-4">Request Code</th>
                  <th className="py-3 px-4">Event Name & Details</th>
                  <th className="py-3 px-4">Requestor</th>
                  <th className="py-3 px-4 text-center">Request Status</th>
                  <th className="py-3 px-4 text-center">IMEI Upload Progress</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {pendingUploadRequests.map((req) => {
                  const { totalUnits, uploadedCount, pendingCount } = getRequestImeiStats(req);
                  const percent = totalUnits > 0 ? Math.round((uploadedCount / totalUnits) * 100) : 0;

                  return (
                    <tr key={req.id} className="hover:bg-amber-50/40 transition-colors">
                      <td className="py-3.5 px-4 font-mono font-bold text-blue-700 whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() => onSelectRequest && onSelectRequest(req)}
                          className="hover:underline flex items-center gap-1 cursor-pointer text-xs"
                          title="View Request Details"
                        >
                          <span>{req.requestCode}</span>
                          <ExternalLink className="w-3 h-3 opacity-70" />
                        </button>
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="font-bold text-slate-900">{req.partA.eventName || 'Roadshow Event'}</div>
                        <div className="text-[11px] text-slate-500">
                          {req.partA.state} &bull; {req.partA.region} Region
                        </div>
                      </td>
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <div className="font-semibold text-slate-800">{req.createdByName || req.partA.requestor || '—'}</div>
                        <div className="text-[10px] text-slate-400">{req.createdByEmail || ''}</div>
                      </td>
                      <td className="py-3.5 px-4 text-center whitespace-nowrap">
                        <StatusBadge status={req.status} size="sm" />
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="max-w-[160px] mx-auto space-y-1">
                          <div className="flex justify-between items-center text-[10px] font-bold">
                            <span className="text-amber-800">{uploadedCount}/{totalUnits} uploaded</span>
                            <span className="text-slate-400">{pendingCount} pending</span>
                          </div>
                          <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden border border-slate-200">
                            <div
                              className="h-full bg-gradient-to-r from-amber-500 to-emerald-500 transition-all duration-300"
                              style={{ width: `${percent}%` }}
                            />
                          </div>
                        </div>
                      </td>
                      <td className="py-3.5 px-4 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedUploadReq(req);
                              setIsImeiModalOpen(true);
                            }}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs rounded-xl transition-all shadow-2xs cursor-pointer whitespace-nowrap"
                          >
                            <Upload className="w-3.5 h-3.5" />
                            <span>Upload IMEI</span>
                          </button>
                          {onSelectRequest && (
                            <button
                              type="button"
                              onClick={() => onSelectRequest(req)}
                              className="p-1.5 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                              title="View Request Details"
                            >
                              <ExternalLink className="w-4 h-4" />
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
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs space-y-3">
        <div className="flex flex-col md:flex-row items-center justify-between gap-3">
          {/* Search Input */}
          <div className="relative flex-1 w-full">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              id="imei-search-input"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              placeholder="Search by IMEI, Material, Request Code, Customer Name, NRIC, or SPP Order..."
              className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:outline-none focus:ring-2 focus:ring-purple-500 focus:bg-white text-slate-900 placeholder-slate-400"
            />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Material Code Filter */}
          <div className="flex items-center gap-2 w-full md:w-auto">
            <select
              id="imei-material-filter"
              value={materialFilter}
              onChange={e => setMaterialFilter(e.target.value)}
              className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-purple-500 cursor-pointer"
            >
              <option value="ALL">All Device Models</option>
              {materialOptions.map(mat => (
                <option key={mat} value={mat}>
                  {mat}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Main Data Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
        <div className="px-5 py-3.5 bg-slate-50 border-b border-slate-200 flex items-center justify-between text-xs font-semibold text-slate-700">
          <div className="flex items-center gap-2">
            <Smartphone className="w-4 h-4 text-purple-600" />
            <span>IMEI Records ({filteredList.length})</span>
          </div>
          <span className="text-slate-400 font-normal">
            Showing {filteredList.length} of {imeiList.length} entries
          </span>
        </div>

        {filteredList.length === 0 ? (
          <div className="p-12 text-center text-slate-500 space-y-2">
            <Barcode className="w-12 h-12 text-slate-300 mx-auto" />
            <p className="font-semibold text-slate-700 text-sm">No IMEI records found</p>
            <p className="text-xs text-slate-400">
              Try adjusting your search terms or filters to find matching devices.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-100/70 border-b border-slate-200 text-[11px] uppercase tracking-wider text-slate-500 font-bold">
                  <th className="py-3 px-4">#</th>
                  <th className="py-3 px-4">IMEI Number</th>
                  <th className="py-3 px-4">Device Description</th>
                  <th className="py-3 px-4">Roadshow Request</th>
                  <th className="py-3 px-4">Customer Details</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {filteredList.map((item, index) => {
                  const linkedReq = requests.find(r => r.requestCode === item.requestCode || r.id === item.requestId);

                  return (
                    <tr key={item.id} className="hover:bg-purple-50/30 transition-colors">
                      <td className="py-3 px-4 text-slate-400 font-mono">{index + 1}</td>
                      <td className="py-3 px-4 font-mono font-bold text-purple-900">
                        <div className="flex items-center gap-1.5">
                          <span className="bg-purple-100 text-purple-900 border border-purple-300 px-2 py-0.5 rounded font-mono text-xs">
                            {item.imei}
                          </span>
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <div className="font-bold text-slate-900">{item.description}</div>
                        <div className="text-[11px] font-mono text-blue-700">{item.material} &bull; {formatRM(item.rrpRM)}</div>
                      </td>
                      <td className="py-3 px-4">
                        {item.requestCode ? (
                          <div>
                            <button
                              type="button"
                              onClick={() => linkedReq && onSelectRequest && onSelectRequest(linkedReq)}
                              className="font-bold text-blue-600 hover:text-blue-800 hover:underline flex items-center gap-1 text-xs cursor-pointer"
                            >
                              <span>{item.requestCode}</span>
                              <ExternalLink className="w-3 h-3" />
                            </button>
                            <div className="text-[11px] text-slate-600 font-medium truncate max-w-xs">
                              {item.eventName || linkedReq?.partA.eventName}
                            </div>
                            <div className="text-[10px] text-slate-400">
                              {item.requestorName || linkedReq?.createdByName} ({item.region || linkedReq?.partA.region})
                            </div>
                          </div>
                        ) : (
                          <span className="text-slate-400 italic">Unassigned to request</span>
                        )}
                      </td>
                      <td className="py-3 px-4">
                        {item.customerName ? (
                          <div className="space-y-0.5">
                            <div className="font-semibold text-slate-900">{item.customerName}</div>
                            <div className="text-[10px] text-slate-500 font-mono">
                              NRIC: {item.nric || 'N/A'} &bull; SPP: {item.sppOrder || 'N/A'}
                            </div>
                            {item.mobileNumber && (
                              <div className="text-[10px] text-slate-500 font-mono">
                                Tel: {item.mobileNumber}
                              </div>
                            )}
                          </div>
                        ) : (
                          <span className="text-slate-400 italic">No customer info</span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            type="button"
                            title="Edit IMEI details"
                            onClick={() => setEditingItem(item)}
                            className="p-1.5 text-slate-500 hover:text-purple-700 hover:bg-purple-100 rounded-lg transition-colors cursor-pointer"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            id={`btn-delete-imei-${item.id}`}
                            title="Delete IMEI"
                            onClick={() => setDeletingItem(item)}
                            className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* EDIT MODAL */}
      {editingItem && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden border border-slate-200 animate-in fade-in zoom-in duration-150">
            <div className="bg-slate-900 text-white px-6 py-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Barcode className="w-5 h-5 text-purple-400" />
                <h3 className="font-bold text-sm">Edit IMEI Record</h3>
              </div>
              <button
                onClick={() => setEditingItem(null)}
                className="text-slate-400 hover:text-white p-1 rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveEdit} className="p-6 space-y-4 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">IMEI Serial Number *</label>
                <input
                  type="text"
                  required
                  value={editingItem.imei}
                  onChange={e => setEditingItem({ ...editingItem, imei: e.target.value })}
                  className="w-full px-3 py-2 font-mono text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-purple-500 bg-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Material Code</label>
                  <input
                    type="text"
                    value={editingItem.material}
                    onChange={e => setEditingItem({ ...editingItem, material: e.target.value })}
                    className="w-full px-3 py-2 font-mono text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-purple-500 bg-white"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">RRP (RM)</label>
                  <input
                    type="number"
                    value={editingItem.rrpRM}
                    onChange={e => setEditingItem({ ...editingItem, rrpRM: parseFloat(e.target.value) || 0 })}
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-purple-500 bg-white"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Device Description</label>
                <input
                  type="text"
                  value={editingItem.description}
                  onChange={e => setEditingItem({ ...editingItem, description: e.target.value })}
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-purple-500 bg-white"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Request Code (Optional)</label>
                <input
                  type="text"
                  value={editingItem.requestCode || ''}
                  onChange={e => setEditingItem({ ...editingItem, requestCode: e.target.value })}
                  placeholder="e.g. RDR-2026-4012"
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-purple-500 bg-white"
                />
              </div>

              <div className="border-t border-slate-200 pt-3 space-y-3">
                <div className="font-semibold text-slate-800">Customer Registration Info</div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] text-slate-600 font-medium mb-1">Customer Name</label>
                    <input
                      type="text"
                      value={editingItem.customerName || ''}
                      onChange={e => setEditingItem({ ...editingItem, customerName: e.target.value })}
                      className="w-full px-3 py-1.5 text-xs border border-slate-300 rounded-lg"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] text-slate-600 font-medium mb-1">NRIC No.</label>
                    <input
                      type="text"
                      value={editingItem.nric || ''}
                      onChange={e => setEditingItem({ ...editingItem, nric: e.target.value })}
                      className="w-full px-3 py-1.5 text-xs border border-slate-300 rounded-lg"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] text-slate-600 font-medium mb-1">SPP Order No.</label>
                    <input
                      type="text"
                      value={editingItem.sppOrder || ''}
                      onChange={e => setEditingItem({ ...editingItem, sppOrder: e.target.value })}
                      className="w-full px-3 py-1.5 text-xs border border-slate-300 rounded-lg"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] text-slate-600 font-medium mb-1">Mobile No.</label>
                    <input
                      type="text"
                      value={editingItem.mobileNumber || ''}
                      onChange={e => setEditingItem({ ...editingItem, mobileNumber: e.target.value })}
                      className="w-full px-3 py-1.5 text-xs border border-slate-300 rounded-lg"
                    />
                  </div>
                </div>
              </div>

              <div className="pt-2 flex justify-between items-center">
                <button
                  type="button"
                  id="btn-edit-modal-delete-imei"
                  onClick={() => {
                    const itemToDel = editingItem;
                    setEditingItem(null);
                    setDeletingItem(itemToDel);
                  }}
                  className="px-3.5 py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-xl font-semibold flex items-center gap-1.5 cursor-pointer text-xs"
                >
                  <Trash2 className="w-3.5 h-3.5 text-rose-600" />
                  <span>Delete Record</span>
                </button>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setEditingItem(null)}
                    className="px-4 py-2 border border-slate-300 rounded-xl text-slate-700 hover:bg-slate-100 font-semibold cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2 bg-purple-600 hover:bg-purple-700 text-white font-semibold rounded-xl flex items-center gap-1.5 cursor-pointer"
                  >
                    <Save className="w-4 h-4" />
                    <span>Save Changes</span>
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* SINGLE ADD MODAL */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden border border-slate-200 animate-in fade-in zoom-in duration-150">
            <div className="bg-slate-900 text-white px-6 py-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Plus className="w-5 h-5 text-blue-400" />
                <h3 className="font-bold text-sm">Add New IMEI Record</h3>
              </div>
              <button
                onClick={() => setIsAddModalOpen(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveNewItem} className="p-6 space-y-4 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">IMEI Serial Number *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. 869123048571205"
                  value={newItem.imei}
                  onChange={e => setNewItem({ ...newItem, imei: e.target.value })}
                  className="w-full px-3 py-2 font-mono text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 bg-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Material Code *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. MAT-S24U-512"
                    value={newItem.material}
                    onChange={e => setNewItem({ ...newItem, material: e.target.value })}
                    className="w-full px-3 py-2 font-mono text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 bg-white"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">RRP (RM)</label>
                  <input
                    type="number"
                    placeholder="6299"
                    value={newItem.rrpRM || ''}
                    onChange={e => setNewItem({ ...newItem, rrpRM: parseFloat(e.target.value) || 0 })}
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 bg-white"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Device Description *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Galaxy S24 Ultra 512GB Titanium Gray"
                  value={newItem.description}
                  onChange={e => setNewItem({ ...newItem, description: e.target.value })}
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 bg-white"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Request Code (Optional)</label>
                <input
                  type="text"
                  placeholder="e.g. RDR-2026-4012"
                  value={newItem.requestCode || ''}
                  onChange={e => setNewItem({ ...newItem, requestCode: e.target.value })}
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 bg-white"
                />
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-4 py-2 border border-slate-300 rounded-xl text-slate-700 hover:bg-slate-100 font-semibold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl flex items-center gap-1.5 cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  <span>Create IMEI Record</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* BULK IMPORT MODAL */}
      {isBulkModalOpen && (
        <div id="modal-bulk-upload-imei-backdrop" className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full overflow-hidden border border-slate-200 animate-in fade-in zoom-in duration-150">
            <div className="bg-slate-900 text-white px-6 py-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Upload className="w-5 h-5 text-purple-400" />
                <div>
                  <h3 className="font-bold text-sm">Bulk Upload IMEI Inventory</h3>
                  <p className="text-[11px] text-slate-400 font-normal">Add multiple devices using the official Excel template</p>
                </div>
              </div>
              <button
                id="btn-close-bulk-modal"
                onClick={() => setIsBulkModalOpen(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-6 space-y-5 text-xs">
              {/* Official Template Banner */}
              <div className="bg-purple-50/90 border border-purple-200 rounded-2xl p-4 flex items-center justify-between gap-4">
                <div className="flex items-start gap-3">
                  <div className="p-2 bg-purple-100 rounded-xl text-purple-700 mt-0.5">
                    <FileSpreadsheet className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="font-bold text-slate-900 text-xs">Official Excel Template</h4>
                    <p className="text-[11px] text-slate-600 mt-0.5">
                      Download pre-formatted Excel template with columns for Request Code, Material, Descriptions, RRP, IMEI, Customer Name & NRIC.
                    </p>
                  </div>
                </div>
                <button
                  id="btn-download-excel-template"
                  type="button"
                  onClick={handleDownloadTemplate}
                  className="inline-flex items-center gap-1.5 bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs px-3.5 py-2 rounded-xl transition-colors shadow-xs flex-shrink-0 cursor-pointer"
                >
                  <Download className="w-4 h-4" />
                  <span>Download Template</span>
                </button>
              </div>

              {/* Mode Switch Tabs */}
              <div className="flex border-b border-slate-200 gap-6 text-xs font-bold">
                <button
                  type="button"
                  onClick={() => setBulkActiveTab('file')}
                  className={`pb-2.5 transition-colors cursor-pointer ${
                    bulkActiveTab === 'file'
                      ? 'border-b-2 border-purple-600 text-purple-600'
                      : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  Excel / CSV File Upload
                </button>
                <button
                  type="button"
                  onClick={() => setBulkActiveTab('paste')}
                  className={`pb-2.5 transition-colors cursor-pointer ${
                    bulkActiveTab === 'paste'
                      ? 'border-b-2 border-purple-600 text-purple-600'
                      : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  Paste Excel / CSV Data
                </button>
              </div>

              {/* File Upload Mode */}
              {bulkActiveTab === 'file' && (
                <div className="space-y-3">
                  <input
                    type="file"
                    id="imei-inventory-file-input"
                    accept=".csv,.xlsx,.xls,.txt"
                    onChange={handleFileUpload}
                    className="hidden"
                  />
                  <label
                    htmlFor="imei-inventory-file-input"
                    className="border-2 border-dashed border-slate-300 hover:border-purple-500 rounded-2xl p-6 text-center bg-slate-50/60 hover:bg-purple-50/30 transition-all cursor-pointer block"
                  >
                    <FileSpreadsheet className="w-8 h-8 text-purple-500 mx-auto mb-2" />
                    <span className="font-bold text-slate-800 block text-xs">
                      Click to choose Excel/CSV file or drag and drop
                    </span>
                    <span className="text-[11px] text-slate-500 block mt-1">
                      Supports .csv, .xlsx, or .xls file formats
                    </span>
                  </label>

                  {uploadedFileName && (
                    <div className="flex items-center justify-between bg-emerald-50 border border-emerald-200 p-3 rounded-xl text-emerald-800 font-semibold text-xs">
                      <div className="flex items-center gap-2">
                        <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                        <span>Uploaded: {uploadedFileName}</span>
                      </div>
                      <span className="text-[11px] text-emerald-700 bg-emerald-100/80 px-2 py-0.5 rounded-md font-mono">
                        {parsedItemsPreview.length} records parsed
                      </span>
                    </div>
                  )}
                </div>
              )}

              {/* Paste Mode */}
              {bulkActiveTab === 'paste' && (
                <div className="space-y-2">
                  <label className="block font-bold text-slate-700">Paste copied Excel template rows directly:</label>
                  <textarea
                    rows={6}
                    value={bulkCsvText}
                    onChange={e => handlePasteChange(e.target.value)}
                    placeholder={`Request Code,Requestor Name,Event Name,Material,Descriptions,RRP (RM),Device IMEI No,Customer Name,NRIC,SPP Order,Mobile Number,Submission Remarks\nRDR-2026-1082,MUHAMMAD RAZIF,MAHA 2026,20017453,HP-SAMSUNG-A07 5G 8+256GB-BLK,1029,869123048571210,Ahmad Zaki,900101-14-5521,SPP-88219,0123456789,Roadshow stock`}
                    className="w-full font-mono text-[11px] p-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-purple-500 bg-white"
                  />
                </div>
              )}

              {/* Parsed Preview Table */}
              {parsedItemsPreview.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-800 text-xs">
                      Parsed Preview ({parsedItemsPreview.length} records ready):
                    </span>
                  </div>
                  <div className="max-h-48 overflow-y-auto border border-slate-200 rounded-xl divide-y divide-slate-100 bg-slate-50/50">
                    {parsedItemsPreview.slice(0, 15).map((item, idx) => (
                      <div key={item.id || idx} className="p-2.5 flex items-center justify-between text-[11px] hover:bg-slate-100/80">
                        <div className="flex items-center gap-2 overflow-hidden">
                          <span className="font-mono text-slate-400 font-bold">{idx + 1}.</span>
                          <span className="font-mono font-bold text-purple-700 bg-purple-50 px-1.5 py-0.5 rounded border border-purple-200">
                            {item.imei}
                          </span>
                          <span className="font-medium text-slate-800 truncate max-w-[200px]">
                            {item.description}
                          </span>
                          <span className="text-slate-400 text-[10px]">({item.material})</span>
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          {item.requestCode && (
                            <span className="font-mono text-[10px] text-blue-700 bg-blue-50 px-1.5 py-0.5 rounded border border-blue-200">
                              {item.requestCode}
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                    {parsedItemsPreview.length > 15 && (
                      <div className="p-2 text-center text-[10px] text-slate-500 italic bg-slate-100">
                        ...and {parsedItemsPreview.length - 15} more records
                      </div>
                    )}
                  </div>
                </div>
              )}

              {bulkErrorMsg && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0" />
                  <span>{bulkErrorMsg}</span>
                </div>
              )}

              <div className="pt-3 flex justify-end gap-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsBulkModalOpen(false)}
                  className="px-4 py-2 border border-slate-300 rounded-xl text-slate-700 hover:bg-slate-100 font-semibold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  id="btn-confirm-bulk-import"
                  type="button"
                  onClick={handleParseBulkCsv}
                  className="px-5 py-2 bg-purple-600 hover:bg-purple-700 text-white font-bold rounded-xl flex items-center gap-1.5 cursor-pointer shadow-xs"
                >
                  <Upload className="w-4 h-4" />
                  <span>Upload into IMEI Inventory ({parsedItemsPreview.length})</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      {/* DELETE CONFIRMATION MODAL */}
      {deletingItem && (
        <div id="modal-delete-imei-backdrop" className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden border border-slate-200 animate-in fade-in zoom-in duration-150">
            <div className="bg-rose-900 text-white px-6 py-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-rose-300" />
                <h3 className="font-bold text-sm">Confirm Delete IMEI</h3>
              </div>
              <button
                type="button"
                onClick={() => setDeletingItem(null)}
                className="text-rose-200 hover:text-white p-1 rounded-lg cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-6 space-y-4 text-xs">
              <p className="text-slate-700 font-medium">
                Are you sure you want to delete this IMEI record from the inventory?
              </p>

              <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 space-y-1.5">
                <div className="flex items-center gap-2">
                  <span className="text-slate-500 font-medium">IMEI:</span>
                  <span className="font-mono text-purple-900 bg-purple-100 font-bold px-2 py-0.5 rounded border border-purple-300">
                    {deletingItem.imei}
                  </span>
                </div>
                <div className="text-slate-800 font-semibold">
                  {deletingItem.description}
                </div>
                <div className="text-[11px] font-mono text-slate-500">
                  Material: {deletingItem.material} &bull; RRP: {formatRM(deletingItem.rrpRM)}
                </div>
                {deletingItem.requestCode && (
                  <div className="text-[11px] text-slate-600 border-t border-slate-200 pt-1.5 mt-1">
                    Linked Request: <strong className="text-blue-700">{deletingItem.requestCode}</strong> ({deletingItem.eventName || 'Roadshow'})
                  </div>
                )}
              </div>

              <p className="text-[11px] text-slate-400">
                This action will permanently delete this device record from inventory.
              </p>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setDeletingItem(null)}
                  className="px-4 py-2 border border-slate-300 rounded-xl text-slate-700 hover:bg-slate-100 font-semibold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  id="btn-confirm-delete-imei"
                  onClick={() => {
                    onDeleteImei(deletingItem.id);
                    setDeletingItem(null);
                  }}
                  className="px-5 py-2 bg-rose-600 hover:bg-rose-700 text-white font-semibold rounded-xl flex items-center gap-1.5 cursor-pointer shadow-sm"
                >
                  <Trash2 className="w-4 h-4" />
                  <span>Confirm Delete</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* DIRECT IMEI UPLOAD MODAL FOR PENDING ORDER REQUESTS */}
      {isImeiModalOpen && selectedUploadReq && (
        <ImeiUploadModal
          isOpen={isImeiModalOpen}
          onClose={() => {
            setIsImeiModalOpen(false);
            setSelectedUploadReq(null);
          }}
          partBItems={selectedUploadReq.partB || []}
          requestCode={selectedUploadReq.requestCode}
          requestorName={selectedUploadReq.createdByName || selectedUploadReq.partA?.requestor}
          eventName={selectedUploadReq.partA?.eventName}
          region={selectedUploadReq.partA?.region}
          state={selectedUploadReq.partA?.state}
          requestId={selectedUploadReq.id}
          requestStatus={selectedUploadReq.status}
          onSaveImeis={(updatedPartB, imeiRecords) => {
            if (imeiRecords && imeiRecords.length > 0) {
              if (onBulkAddImeis) {
                onBulkAddImeis(imeiRecords);
              } else {
                imeiRecords.forEach(rec => onAddImei(rec));
              }
            }
            setIsImeiModalOpen(false);
            setSelectedUploadReq(null);
          }}
        />
      )}
    </div>
  );
};
