import React, { useState } from 'react';
import * as XLSX from 'xlsx';
import { DeviceInventoryItem, UserRole, DeviceStatus } from '../types';
import { parseDeviceInventoryCSV, generateSampleDeviceInventoryCSV, exportDeviceInventoryCSV, formatRM, generateId } from '../utils/formatters';
import { Upload, Download, FileText, CheckCircle2, AlertCircle, X, Layers, Plus, Trash2, Search, Database, Smartphone, Edit2, Check, FileSpreadsheet, ChevronDown } from 'lucide-react';

interface DeviceInventoryUploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  userRole: UserRole;
  currentInventory: DeviceInventoryItem[];
  onSaveInventory: (items: DeviceInventoryItem[], appendMode: boolean) => void;
  onUpdateInventoryItem?: (item: DeviceInventoryItem) => void;
  onDeleteInventoryItem?: (id: string) => void;
}

export const DeviceInventoryUploadModal: React.FC<DeviceInventoryUploadModalProps> = ({
  isOpen,
  onClose,
  userRole,
  currentInventory,
  onSaveInventory,
  onUpdateInventoryItem,
  onDeleteInventoryItem
}) => {
  const [activeView, setActiveView] = useState<'upload' | 'catalog'>('upload');
  const [csvContent, setCsvContent] = useState<string>('');
  const [appendMode, setAppendMode] = useState<boolean>(true);
  const [parsedItems, setParsedItems] = useState<DeviceInventoryItem[]>([]);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [templateDropdownOpen, setTemplateDropdownOpen] = useState<boolean>(false);

  // Search and status filter for catalog tab
  const [catalogSearch, setCatalogSearch] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');

  // Single manual item creation
  const [showSingleAdd, setShowSingleAdd] = useState<boolean>(false);
  const [newItem, setNewItem] = useState<{
    material: string;
    description: string;
    brand: string;
    rrpRM: string;
    remarks: string;
    deviceStatus: DeviceStatus;
  }>({
    material: '',
    description: '',
    brand: '',
    rrpRM: '',
    remarks: '',
    deviceStatus: 'In Stock'
  });

  // Inline editing for catalog items
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<{
    material: string;
    description: string;
    brand: string;
    rrpRM: string;
    remarks: string;
    deviceStatus: DeviceStatus;
  }>({
    material: '',
    description: '',
    brand: '',
    rrpRM: '',
    remarks: '',
    deviceStatus: 'In Stock'
  });

  const handleStartEdit = (item: DeviceInventoryItem) => {
    setEditingId(item.id);
    setEditForm({
      material: item.material,
      description: item.description,
      brand: item.brand || '',
      rrpRM: String(item.rrpRM),
      remarks: item.remarks || '',
      deviceStatus: item.deviceStatus || 'In Stock'
    });
    setErrorMsg(null);
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setEditForm({ material: '', description: '', brand: '', rrpRM: '', remarks: '', deviceStatus: 'In Stock' });
  };

  const handleSaveEdit = (id: string) => {
    if (!editForm.material.trim() || !editForm.description.trim()) {
      setErrorMsg('Material code and Descriptions are required.');
      return;
    }
    const updatedItem: DeviceInventoryItem = {
      id,
      material: editForm.material.trim(),
      description: editForm.description.trim(),
      brand: editForm.brand.trim() || undefined,
      rrpRM: parseFloat(editForm.rrpRM) || 0,
      remarks: editForm.remarks.trim(),
      deviceStatus: editForm.deviceStatus,
      updatedAt: new Date().toISOString()
    };

    if (onUpdateInventoryItem) {
      onUpdateInventoryItem(updatedItem);
    } else {
      const updatedList = currentInventory.map(item => item.id === id ? updatedItem : item);
      onSaveInventory(updatedList, false);
    }

    setEditingId(null);
    setErrorMsg(null);
    setSuccessMsg('Inventory item detail updated successfully!');
    setTimeout(() => setSuccessMsg(null), 2500);
  };

  if (!isOpen) return null;

  const handleTextChange = (text: string) => {
    setCsvContent(text);
    if (!text.trim()) {
      setParsedItems([]);
      setErrorMsg(null);
      return;
    }
    try {
      const items = parseDeviceInventoryCSV(text);
      setParsedItems(items);
      if (items.length === 0) {
        setErrorMsg('Could not parse any valid device inventory items. Ensure header format: Material, Descriptions, RRP (RM), Remarks.');
      } else {
        setErrorMsg(null);
      }
    } catch {
      setErrorMsg('Error parsing CSV format. Please check syntax.');
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const isExcel = file.name.toLowerCase().endsWith('.xlsx') || file.name.toLowerCase().endsWith('.xls');

    if (isExcel) {
      const reader = new FileReader();
      reader.onload = (event) => {
        try {
          const buffer = event.target?.result as ArrayBuffer;
          const workbook = XLSX.read(buffer, { type: 'array' });
          const firstSheetName = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[firstSheetName];
          const csvText = XLSX.utils.sheet_to_csv(worksheet);
          handleTextChange(csvText);
        } catch (err) {
          console.error(err);
          setErrorMsg('Failed to parse Excel file. Please ensure it is a valid .xlsx or .xls file.');
        }
      };
      reader.onerror = () => {
        setErrorMsg('Failed to read uploaded Excel file.');
      };
      reader.readAsArrayBuffer(file);
    } else {
      const reader = new FileReader();
      reader.onload = (event) => {
        const text = event.target?.result as string;
        if (text) {
          handleTextChange(text);
        }
      };
      reader.onerror = () => {
        setErrorMsg('Failed to read uploaded CSV file.');
      };
      reader.readAsText(file);
    }
  };

  const handleDownloadSampleCsv = () => {
    const csvData = currentInventory && currentInventory.length > 0
      ? exportDeviceInventoryCSV(currentInventory)
      : generateSampleDeviceInventoryCSV();
    const blob = new Blob([csvData], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', 'device_inventory_template.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setTemplateDropdownOpen(false);
    setSuccessMsg(`Downloaded CSV template (${currentInventory?.length || 0} items)!`);
    setTimeout(() => setSuccessMsg(null), 3000);
  };

  const handleDownloadSampleXlsx = () => {
    const defaultSamples = [
      {
        material: 'MAT-S24U-512',
        description: 'Galaxy S24 Ultra 512GB Titanium Gray',
        brand: 'Samsung',
        rrpRM: 6299,
        remarks: 'High demand roadshow stock',
        deviceStatus: 'In Stock'
      },
      {
        material: 'MAT-ZFOLD5-512',
        description: 'Galaxy Z Fold5 512GB Phantom Black',
        brand: 'Samsung',
        rrpRM: 7299,
        remarks: 'Reserved for Central region roadshows',
        deviceStatus: 'In Stock'
      },
      {
        material: 'MAT-TAB-S9U',
        description: 'Galaxy Tab S9 Ultra 512GB Graphite',
        brand: 'Samsung',
        rrpRM: 5999,
        remarks: 'Display units with security stands',
        deviceStatus: 'In Stock'
      },
      {
        material: 'MAT-GW6-PRO',
        description: 'Galaxy Watch6 Classic 47mm Bluetooth',
        brand: 'Samsung',
        rrpRM: 1799,
        remarks: 'Promo bundle stock for event registration',
        deviceStatus: 'In Stock'
      },
      {
        material: 'MAT-BP2-WHT',
        description: 'Galaxy Buds2 Pro White',
        brand: 'Samsung',
        rrpRM: 899,
        remarks: 'End of life promotional stock',
        deviceStatus: 'EOL'
      },
      {
        material: 'MAT-XM14-512',
        description: 'Xiaomi 14 512GB Black',
        brand: 'Xiaomi',
        rrpRM: 3799,
        remarks: 'Regional depot flagship stock',
        deviceStatus: 'In Stock'
      },
      {
        material: 'MAT-VIVO-X100',
        description: 'Vivo X100 Pro 512GB Sunset Orange',
        brand: 'Vivo',
        rrpRM: 4599,
        remarks: 'Southern warehouse allocated inventory',
        deviceStatus: 'In Stock'
      }
    ];

    const sourceItems = currentInventory && currentInventory.length > 0 ? currentInventory : defaultSamples;

    const rows = sourceItems.map(item => ({
      'Material': item.material,
      'Descriptions': item.description,
      'Brand': item.brand || 'Samsung',
      'RRP (RM)': item.rrpRM || 0,
      'Remarks': item.remarks || '',
      'Device Status': item.deviceStatus || 'In Stock'
    }));

    const worksheet = XLSX.utils.json_to_sheet(rows);
    worksheet['!cols'] = [
      { wch: 18 },
      { wch: 45 },
      { wch: 16 },
      { wch: 14 },
      { wch: 36 },
      { wch: 16 }
    ];

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Device_Inventory');
    XLSX.writeFile(workbook, 'device_inventory_template.xlsx');
    setTemplateDropdownOpen(false);
    setSuccessMsg(`Downloaded XLSX template (${rows.length} items)!`);
    setTimeout(() => setSuccessMsg(null), 3000);
  };

  const handleDownloadSample = () => {
    handleDownloadSampleCsv();
  };

  const handleLoadSampleData = () => {
    const sample = generateSampleDeviceInventoryCSV();
    handleTextChange(sample);
  };

  const handleConfirmImport = () => {
    if (parsedItems.length === 0) return;
    onSaveInventory(parsedItems, appendMode);
    setSuccessMsg(`Successfully ${appendMode ? 'added' : 'imported'} ${parsedItems.length} inventory items!`);
    setTimeout(() => {
      setSuccessMsg(null);
      setActiveView('catalog');
    }, 1200);
  };

  const handleAddSingleItem = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newItem.material.trim() || !newItem.description.trim()) {
      setErrorMsg('Material code and Descriptions are required.');
      return;
    }

    const item: DeviceInventoryItem = {
      id: generateId(),
      material: newItem.material.trim(),
      description: newItem.description.trim(),
      brand: newItem.brand.trim() || undefined,
      rrpRM: parseFloat(newItem.rrpRM) || 0,
      remarks: newItem.remarks.trim(),
      deviceStatus: newItem.deviceStatus || 'In Stock',
      updatedAt: new Date().toISOString()
    };

    onSaveInventory([item], true);
    setNewItem({ material: '', description: '', brand: '', rrpRM: '', remarks: '', deviceStatus: 'In Stock' });
    setShowSingleAdd(false);
    setErrorMsg(null);
    setSuccessMsg('Single inventory device added!');
    setTimeout(() => setSuccessMsg(null), 2000);
  };

  const filteredCatalog = currentInventory.filter(item => {
    const status = item.deviceStatus || 'In Stock';
    const matchesSearch =
      item.material.toLowerCase().includes(catalogSearch.toLowerCase()) ||
      item.description.toLowerCase().includes(catalogSearch.toLowerCase()) ||
      (item.brand && item.brand.toLowerCase().includes(catalogSearch.toLowerCase())) ||
      (item.remarks && item.remarks.toLowerCase().includes(catalogSearch.toLowerCase())) ||
      status.toLowerCase().includes(catalogSearch.toLowerCase());
    const matchesStatus = statusFilter === 'ALL' || status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  return (
    <div id="device-inventory-upload-modal-backdrop" className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full overflow-hidden border border-slate-200 my-8">
        
        {/* Header */}
        <div className="bg-slate-900 text-white px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-blue-600 rounded-xl shadow-md shadow-blue-500/20">
              <Database className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold">Device Inventory Management</h2>
                <span className="text-[10px] bg-blue-500/20 text-blue-300 font-semibold px-2 py-0.5 rounded border border-blue-400/30">
                  {userRole} Access
                </span>
              </div>
              <p className="text-xs text-slate-300">
                Upload and manage master device catalog details (Material, Descriptions, Brand, RRP, Remarks, Device Status)
              </p>
            </div>
          </div>
          <button
            id="btn-close-device-inventory-modal"
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1.5 rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* View Switcher Tabs */}
        <div className="bg-slate-100 border-b border-slate-200 px-6 py-2.5 flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <button
              id="tab-inventory-upload"
              onClick={() => setActiveView('upload')}
              className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                activeView === 'upload'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'bg-white text-slate-700 hover:bg-slate-200 border border-slate-200'
              }`}
            >
              <Upload className="w-3.5 h-3.5" />
              <span>Upload / Bulk Import CSV & XLSX</span>
            </button>
            <button
              id="tab-inventory-catalog"
              onClick={() => setActiveView('catalog')}
              className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                activeView === 'catalog'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'bg-white text-slate-700 hover:bg-slate-200 border border-slate-200'
              }`}
            >
              <Smartphone className="w-3.5 h-3.5" />
              <span>Inventory Catalog ({currentInventory.length} Items)</span>
            </button>
          </div>

          <div className="relative">
            <button
              id="btn-download-inventory-template"
              type="button"
              onClick={() => setTemplateDropdownOpen(!templateDropdownOpen)}
              className="inline-flex items-center gap-1.5 text-slate-700 hover:text-blue-700 bg-white hover:bg-blue-50 border border-slate-300 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer shadow-xs"
            >
              <Download className="w-3.5 h-3.5 text-blue-600" />
              <span>Download CSV & XLSX Template</span>
              <ChevronDown className="w-3.5 h-3.5 text-slate-400 ml-0.5" />
            </button>

            {templateDropdownOpen && (
              <>
                <div
                  className="fixed inset-0 z-10"
                  onClick={() => setTemplateDropdownOpen(false)}
                />
                <div className="absolute right-0 mt-1.5 w-64 bg-white rounded-xl shadow-xl border border-slate-200 py-1.5 z-20 text-xs animate-in fade-in zoom-in-95 duration-100">
                  <div className="px-3 py-1.5 text-[10px] font-bold text-slate-400 uppercase tracking-wider border-b border-slate-100">
                    Select Template Format
                  </div>
                  <button
                    id="btn-download-device-template-xlsx"
                    type="button"
                    onClick={handleDownloadSampleXlsx}
                    className="w-full text-left px-3.5 py-2.5 hover:bg-blue-50 flex items-center gap-2.5 text-slate-700 hover:text-blue-700 transition-colors cursor-pointer"
                  >
                    <div className="p-1 bg-emerald-100 text-emerald-700 rounded-md">
                      <FileSpreadsheet className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="font-bold text-slate-800">Excel Spreadsheet (.xlsx)</div>
                      <div className="text-[10px] text-slate-500">Formatted workbook with column widths</div>
                    </div>
                  </button>
                  <button
                    id="btn-download-device-template-csv"
                    type="button"
                    onClick={handleDownloadSampleCsv}
                    className="w-full text-left px-3.5 py-2.5 hover:bg-blue-50 flex items-center gap-2.5 text-slate-700 hover:text-blue-700 transition-colors cursor-pointer"
                  >
                    <div className="p-1 bg-blue-100 text-blue-700 rounded-md">
                      <Download className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="font-bold text-slate-800">CSV Data File (.csv)</div>
                      <div className="text-[10px] text-slate-500">Standard comma-separated format</div>
                    </div>
                  </button>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Required Fields Banner */}
        <div className="bg-blue-50/80 border-b border-blue-100 px-6 py-2 flex items-center gap-2 text-xs text-blue-900">
          <FileText className="w-4 h-4 text-blue-600 flex-shrink-0" />
          <span className="font-semibold text-blue-950">Supported Inventory Columns:</span>
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="bg-white border border-blue-200 text-blue-800 font-bold px-2 py-0.5 rounded text-[11px]">1. Material</span>
            <span className="bg-white border border-blue-200 text-blue-800 font-bold px-2 py-0.5 rounded text-[11px]">2. Descriptions</span>
            <span className="bg-blue-600 text-white font-bold px-2 py-0.5 rounded text-[11px] shadow-xs">3. Brand</span>
            <span className="bg-white border border-blue-200 text-blue-800 font-bold px-2 py-0.5 rounded text-[11px]">4. RRP (RM)</span>
            <span className="bg-white border border-blue-200 text-blue-800 font-bold px-2 py-0.5 rounded text-[11px]">5. Remarks</span>
            <span className="bg-white border border-blue-200 text-blue-800 font-bold px-2 py-0.5 rounded text-[11px]">6. Device Status</span>
          </div>
        </div>

        {/* Success / Error Messages */}
        {successMsg && (
          <div className="bg-emerald-50 border-b border-emerald-200 text-emerald-800 px-6 py-2.5 text-xs font-semibold flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
            <span>{successMsg}</span>
          </div>
        )}
        {errorMsg && (
          <div className="bg-rose-50 border-b border-rose-200 text-rose-800 px-6 py-2.5 text-xs font-semibold flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* Tab 1: Upload View */}
        {activeView === 'upload' && (
          <div className="p-6 space-y-5 max-h-[70vh] overflow-y-auto">
            {/* Drag & Drop File Upload Area */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="border-2 border-dashed border-slate-300 hover:border-blue-500 rounded-2xl p-5 text-center bg-slate-50/50 transition-all flex flex-col items-center justify-center">
                <div className="p-3 bg-blue-100 rounded-full text-blue-600 mb-2">
                  <Upload className="w-6 h-6" />
                </div>
                <h3 className="text-xs font-bold text-slate-800 mb-1">Upload Excel (.xlsx) / CSV File</h3>
                <p className="text-[11px] text-slate-500 mb-3">Drag `.xlsx` or `.csv` file here or browse from disk</p>
                <label className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-1.5 rounded-xl text-xs font-bold shadow-sm transition-colors cursor-pointer inline-flex items-center gap-1.5">
                  <Upload className="w-3.5 h-3.5" />
                  <span>Choose File</span>
                  <input
                    id="file-input-device-inventory"
                    type="file"
                    accept=".xlsx,.xls,.csv,.txt"
                    onChange={handleFileUpload}
                    className="hidden"
                  />
                </label>
              </div>

              {/* Sample loader card */}
              <div className="bg-slate-900 text-white rounded-2xl p-5 flex flex-col justify-between border border-slate-800">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-blue-400 bg-blue-950/80 px-2 py-0.5 rounded border border-blue-800/50">
                      Quick Start Demo
                    </span>
                    <FileSpreadsheet className="w-4 h-4 text-slate-400" />
                  </div>
                  <h4 className="text-xs font-bold text-white mb-1">Load Standard Device Catalog</h4>
                  <p className="text-[11px] text-slate-300">
                    Instantly load predefined sample inventory rows matching the required details (Material, Descriptions, Brand, RRP, Remarks, Device Status).
                  </p>
                </div>

                <div className="pt-3 flex items-center justify-between border-t border-slate-800 mt-2 flex-wrap gap-2">
                  <button
                    id="btn-load-sample-inventory"
                    onClick={handleLoadSampleData}
                    className="bg-slate-800 hover:bg-slate-700 text-blue-300 hover:text-white px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors cursor-pointer border border-slate-700"
                  >
                    Load Sample CSV
                  </button>
                  <div className="flex items-center gap-2">
                    <button
                      id="btn-download-sample-xlsx-alt"
                      onClick={handleDownloadSampleXlsx}
                      className="text-xs text-emerald-400 hover:text-emerald-300 underline cursor-pointer"
                    >
                      Download XLSX
                    </button>
                    <span className="text-slate-600">•</span>
                    <button
                      id="btn-download-sample-csv-alt"
                      onClick={handleDownloadSampleCsv}
                      className="text-xs text-slate-400 hover:text-slate-200 underline cursor-pointer"
                    >
                      Download CSV
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* CSV Copy Paste Box */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700 flex items-center justify-between">
                <span>Copy-Paste CSV Text directly:</span>
                <span className="text-[11px] font-normal text-slate-500">Comma-separated standard format</span>
              </label>
              <textarea
                id="textarea-device-inventory-csv"
                rows={4}
                value={csvContent}
                onChange={(e) => handleTextChange(e.target.value)}
                placeholder={`Material,Descriptions,Brand,RRP (RM),Remarks,Device Status\nMAT-S24U-512,Galaxy S24 Ultra 512GB Titanium Gray,Samsung,6299,High demand roadshow stock,In Stock\nMAT-BP2-WHT,Galaxy Buds2 Pro White,Samsung,899,End of life promotional stock,EOL`}
                className="w-full text-xs font-mono p-3 bg-slate-50 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:bg-white outline-none"
              />
            </div>

            {/* Mode Toggle & Summary */}
            {parsedItems.length > 0 && (
              <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-200">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
                    <span className="text-xs font-bold text-slate-800">
                      Parsed {parsedItems.length} Device Inventory Records
                    </span>
                  </div>

                  <div className="flex items-center gap-3">
                    <label className="flex items-center gap-2 text-xs font-medium text-slate-700 cursor-pointer">
                      <input
                        id="radio-inventory-mode-append"
                        type="radio"
                        name="inventoryImportMode"
                        checked={appendMode}
                        onChange={() => setAppendMode(true)}
                        className="text-blue-600 focus:ring-blue-500"
                      />
                      <span>Append to existing ({currentInventory.length})</span>
                    </label>
                    <label className="flex items-center gap-2 text-xs font-medium text-slate-700 cursor-pointer">
                      <input
                        id="radio-inventory-mode-replace"
                        type="radio"
                        name="inventoryImportMode"
                        checked={!appendMode}
                        onChange={() => setAppendMode(false)}
                        className="text-blue-600 focus:ring-blue-500"
                      />
                      <span className="text-rose-700 font-semibold">Replace catalog</span>
                    </label>
                  </div>
                </div>

                {/* Parsed Items Preview Table */}
                <div className="overflow-x-auto max-h-48 border border-slate-200 rounded-xl bg-white">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="bg-slate-100 text-slate-700 font-semibold border-b border-slate-200">
                        <th className="p-2.5">#</th>
                        <th className="p-2.5">Material</th>
                        <th className="p-2.5">Descriptions</th>
                        <th className="p-2.5">Brand</th>
                        <th className="p-2.5 text-right">RRP (RM)</th>
                        <th className="p-2.5">Remarks</th>
                        <th className="p-2.5">Device Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {parsedItems.map((item, idx) => (
                        <tr key={idx} className="hover:bg-slate-50">
                          <td className="p-2 text-slate-400 text-[11px]">{idx + 1}</td>
                          <td className="p-2 font-mono text-slate-900 font-bold">{item.material}</td>
                          <td className="p-2 text-slate-800 font-medium">{item.description}</td>
                          <td className="p-2 text-slate-700">
                            {item.brand ? (
                              <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold bg-slate-100 text-slate-700 border border-slate-200">
                                {item.brand}
                              </span>
                            ) : (
                              <span className="text-slate-400 italic text-[11px]">-</span>
                            )}
                          </td>
                          <td className="p-2 text-right text-emerald-700 font-bold">{formatRM(item.rrpRM)}</td>
                          <td className="p-2 text-slate-600 text-[11px]">{item.remarks || '-'}</td>
                          <td className="p-2">
                            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                              (item.deviceStatus || 'In Stock') === 'In Stock'
                                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                : 'bg-rose-50 text-rose-700 border-rose-200'
                            }`}>
                              {item.deviceStatus || 'In Stock'}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="flex items-center justify-between pt-1">
                  <span className="text-xs text-slate-500">
                    Ready to update master inventory data.
                  </span>
                  <button
                    id="btn-confirm-inventory-import"
                    onClick={handleConfirmImport}
                    className="inline-flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-5 py-2 rounded-xl text-xs font-bold shadow-md shadow-emerald-600/20 transition-all cursor-pointer"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Confirm & Upload Inventory</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Tab 2: Catalog View */}
        {activeView === 'catalog' && (
          <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
            {/* Catalog Toolbar */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-50 p-3 rounded-2xl border border-slate-200">
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  id="input-search-inventory-catalog"
                  type="text"
                  value={catalogSearch}
                  onChange={(e) => setCatalogSearch(e.target.value)}
                  placeholder="Search catalog by material, description, brand, status or remarks..."
                  className="w-full pl-9 pr-3 py-1.5 text-xs bg-white border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>

              <div className="flex items-center gap-2.5">
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-semibold text-slate-600">Status:</span>
                  <select
                    id="select-inventory-status-filter"
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                    className="border border-slate-300 rounded-xl px-2.5 py-1 text-xs bg-white outline-none focus:ring-2 focus:ring-blue-500 font-semibold text-slate-700"
                  >
                    <option value="ALL">All ({currentInventory.length})</option>
                    <option value="In Stock">In Stock</option>
                    <option value="EOL">EOL</option>
                  </select>
                </div>

                <button
                  id="btn-toggle-add-single-item"
                  onClick={() => setShowSingleAdd(!showSingleAdd)}
                  className="inline-flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add Single Device</span>
                </button>
              </div>
            </div>

            {/* Single Add Form overlay */}
            {showSingleAdd && (
              <form onSubmit={handleAddSingleItem} className="bg-blue-50 border border-blue-200 rounded-2xl p-4 space-y-3">
                <div className="flex items-center justify-between text-xs font-bold text-blue-900 border-b border-blue-200 pb-2">
                  <span>Add Single Device to Master Catalog</span>
                  <button type="button" onClick={() => setShowSingleAdd(false)} className="text-slate-400 hover:text-slate-600">
                    <X className="w-4 h-4" />
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3">
                  <div>
                    <label className="text-[11px] font-bold text-slate-700">1. Material *</label>
                    <input
                      id="input-new-material"
                      type="text"
                      required
                      placeholder="e.g. MAT-S24U-512"
                      value={newItem.material || ''}
                      onChange={(e) => setNewItem({ ...newItem, material: e.target.value })}
                      className="w-full p-2 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none bg-white font-mono font-bold"
                    />
                  </div>

                  <div>
                    <label className="text-[11px] font-bold text-slate-700">2. Descriptions *</label>
                    <input
                      id="input-new-description"
                      type="text"
                      required
                      placeholder="e.g. Galaxy S24 Ultra 512GB"
                      value={newItem.description || ''}
                      onChange={(e) => setNewItem({ ...newItem, description: e.target.value })}
                      className="w-full p-2 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none bg-white"
                    />
                  </div>

                  <div>
                    <label className="text-[11px] font-bold text-slate-700">3. Brand</label>
                    <input
                      id="input-new-brand"
                      type="text"
                      placeholder="e.g. Samsung / Apple / Vivo"
                      value={newItem.brand || ''}
                      onChange={(e) => setNewItem({ ...newItem, brand: e.target.value })}
                      className="w-full p-2 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none bg-white font-medium"
                    />
                  </div>

                  <div>
                    <label className="text-[11px] font-bold text-slate-700">4. RRP (RM) *</label>
                    <input
                      id="input-new-rrp"
                      type="number"
                      step="0.01"
                      required
                      placeholder="e.g. 6299"
                      value={newItem.rrpRM ?? ''}
                      onChange={(e) => setNewItem({ ...newItem, rrpRM: e.target.value })}
                      className="w-full p-2 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none bg-white font-bold text-emerald-700"
                    />
                  </div>

                  <div>
                    <label className="text-[11px] font-bold text-slate-700">5. Remarks</label>
                    <input
                      id="input-new-remarks"
                      type="text"
                      placeholder="e.g. Main warehouse stock"
                      value={newItem.remarks || ''}
                      onChange={(e) => setNewItem({ ...newItem, remarks: e.target.value })}
                      className="w-full p-2 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none bg-white"
                    />
                  </div>

                  <div>
                    <label className="text-[11px] font-bold text-slate-700">6. Device Status *</label>
                    <select
                      id="input-new-device-status"
                      value={newItem.deviceStatus || 'In Stock'}
                      onChange={(e) => setNewItem({ ...newItem, deviceStatus: e.target.value as DeviceStatus })}
                      className="w-full p-2 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none bg-white font-semibold"
                    >
                      <option value="In Stock">In Stock</option>
                      <option value="EOL">EOL</option>
                    </select>
                  </div>
                </div>

                <div className="flex justify-end gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => setShowSingleAdd(false)}
                    className="px-3 py-1.5 border border-slate-300 rounded-xl text-xs font-semibold text-slate-600 hover:bg-white cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    id="btn-submit-single-inventory-item"
                    type="submit"
                    className="px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-sm cursor-pointer"
                  >
                    Save Device Item
                  </button>
                </div>
              </form>
            )}

            {/* Catalog Table */}
            {filteredCatalog.length === 0 ? (
              <div className="text-center py-12 bg-slate-50 border border-slate-200 rounded-2xl">
                <Smartphone className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                <p className="text-xs font-bold text-slate-700">No Device Inventory Items Found</p>
                <p className="text-[11px] text-slate-500 mt-1 mb-3">
                  Upload CSV or add devices manually to populate the master inventory.
                </p>
                <button
                  onClick={() => setActiveView('upload')}
                  className="inline-flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-xl text-xs font-semibold cursor-pointer"
                >
                  <Upload className="w-4 h-4" />
                  <span>Go to Upload CSV</span>
                </button>
              </div>
            ) : (
              <div className="border border-slate-200 rounded-2xl overflow-hidden bg-white shadow-sm">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-slate-900 text-white font-semibold">
                      <th className="p-3">#</th>
                      <th className="p-3">1. Material</th>
                      <th className="p-3">2. Descriptions</th>
                      <th className="p-3">3. Brand</th>
                      <th className="p-3 text-right">4. RRP (RM)</th>
                      <th className="p-3">5. Remarks</th>
                      <th className="p-3">6. Device Status</th>
                      <th className="p-3 text-center">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredCatalog.map((item, index) => {
                      const isEditing = editingId === item.id;
                      const statusVal = item.deviceStatus || 'In Stock';
                      return (
                        <tr key={item.id} className={isEditing ? "bg-amber-50/80 transition-colors" : "hover:bg-blue-50/50 transition-colors"}>
                          <td className="p-3 text-slate-400 text-[11px] font-mono align-middle">{index + 1}</td>
                          
                          {/* 1. Material */}
                          <td className="p-2 align-middle">
                            {isEditing ? (
                              <input
                                id={`edit-material-${item.id}`}
                                type="text"
                                value={editForm.material || ''}
                                onChange={e => setEditForm(prev => ({ ...prev, material: e.target.value }))}
                                className="w-full p-1.5 text-xs font-mono font-bold text-blue-900 border border-blue-400 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                                placeholder="Material code"
                              />
                            ) : (
                              <span className="font-mono font-bold text-blue-900">{item.material}</span>
                            )}
                          </td>

                          {/* 2. Descriptions */}
                          <td className="p-2 align-middle">
                            {isEditing ? (
                              <input
                                id={`edit-desc-${item.id}`}
                                type="text"
                                value={editForm.description || ''}
                                onChange={e => setEditForm(prev => ({ ...prev, description: e.target.value }))}
                                className="w-full p-1.5 text-xs text-slate-800 font-medium border border-blue-400 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                                placeholder="Description"
                              />
                            ) : (
                              <span className="text-slate-800 font-medium">{item.description}</span>
                            )}
                          </td>

                          {/* 3. Brand */}
                          <td className="p-2 align-middle">
                            {isEditing ? (
                              <input
                                id={`edit-brand-${item.id}`}
                                type="text"
                                value={editForm.brand || ''}
                                onChange={e => setEditForm(prev => ({ ...prev, brand: e.target.value }))}
                                className="w-full p-1.5 text-xs text-slate-800 font-semibold border border-blue-400 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                                placeholder="Brand"
                              />
                            ) : (
                              item.brand ? (
                                <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-semibold bg-slate-100 text-slate-800 border border-slate-200">
                                  {item.brand}
                                </span>
                              ) : (
                                <span className="text-slate-300 italic text-[11px]">-</span>
                              )
                            )}
                          </td>

                          {/* 4. RRP (RM) */}
                          <td className="p-2 text-right align-middle">
                            {isEditing ? (
                              <input
                                id={`edit-rrp-${item.id}`}
                                type="number"
                                step="0.01"
                                value={editForm.rrpRM ?? ''}
                                onChange={e => setEditForm(prev => ({ ...prev, rrpRM: e.target.value }))}
                                className="w-28 p-1.5 text-xs font-bold text-emerald-700 text-right border border-blue-400 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                                placeholder="RRP (RM)"
                              />
                            ) : (
                              <span className="font-bold text-emerald-700">{formatRM(item.rrpRM)}</span>
                            )}
                          </td>

                          {/* 5. Remarks */}
                          <td className="p-2 align-middle">
                            {isEditing ? (
                              <input
                                id={`edit-remarks-${item.id}`}
                                type="text"
                                value={editForm.remarks || ''}
                                onChange={e => setEditForm(prev => ({ ...prev, remarks: e.target.value }))}
                                className="w-full p-1.5 text-xs text-slate-700 border border-blue-400 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                                placeholder="Remarks..."
                              />
                            ) : (
                              <span className="text-slate-600 text-[11px]">{item.remarks || <span className="text-slate-300 italic">None</span>}</span>
                            )}
                          </td>

                          {/* 6. Device Status */}
                          <td className="p-2 align-middle">
                            {isEditing ? (
                              <select
                                id={`edit-status-${item.id}`}
                                value={editForm.deviceStatus || 'In Stock'}
                                onChange={e => setEditForm(prev => ({ ...prev, deviceStatus: e.target.value as DeviceStatus }))}
                                className="w-full p-1.5 text-xs font-bold border border-blue-400 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                              >
                                <option value="In Stock">In Stock</option>
                                <option value="EOL">EOL</option>
                              </select>
                            ) : (
                              <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold border ${
                                statusVal === 'In Stock'
                                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                  : 'bg-rose-50 text-rose-700 border-rose-200'
                              }`}>
                                <span className={`w-1.5 h-1.5 rounded-full mr-1.5 ${
                                  statusVal === 'In Stock' ? 'bg-emerald-500' : 'bg-rose-500'
                                }}`}></span>
                                {statusVal}
                              </span>
                            )}
                          </td>

                          {/* Action */}
                          <td className="p-2 text-center align-middle">
                            {isEditing ? (
                              <div className="flex items-center justify-center gap-1">
                                <button
                                  id={`btn-save-edit-${item.id}`}
                                  type="button"
                                  onClick={() => handleSaveEdit(item.id)}
                                  className="bg-emerald-600 hover:bg-emerald-700 text-white px-2.5 py-1 rounded-lg text-xs font-semibold inline-flex items-center gap-1 shadow-sm transition-colors cursor-pointer"
                                  title="Save Changes"
                                >
                                  <Check className="w-3.5 h-3.5" />
                                  <span>Save</span>
                                </button>
                                <button
                                  id={`btn-cancel-edit-${item.id}`}
                                  type="button"
                                  onClick={handleCancelEdit}
                                  className="bg-slate-200 hover:bg-slate-300 text-slate-700 p-1 rounded-lg text-xs transition-colors cursor-pointer"
                                  title="Cancel Edit"
                                >
                                  <X className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            ) : (
                              <div className="flex items-center justify-center gap-1">
                                <button
                                  id={`btn-edit-inventory-${item.id}`}
                                  type="button"
                                  onClick={() => handleStartEdit(item)}
                                  className="text-slate-500 hover:text-blue-600 p-1.5 rounded-lg hover:bg-blue-50 transition-colors cursor-pointer"
                                  title="Edit Detail"
                                >
                                  <Edit2 className="w-4 h-4" />
                                </button>
                                {onDeleteInventoryItem && (
                                  <button
                                    id={`btn-delete-inventory-${item.id}`}
                                    type="button"
                                    onClick={() => onDeleteInventoryItem(item.id)}
                                    className="text-slate-400 hover:text-rose-600 p-1.5 rounded-lg hover:bg-rose-50 transition-colors cursor-pointer"
                                    title="Delete Item"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </button>
                                )}
                              </div>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* Footer */}
        <div className="bg-slate-50 border-t border-slate-200 px-6 py-3 flex items-center justify-between">
          <div className="text-[11px] text-slate-500">
            Total Inventory Items: <strong className="text-slate-800">{currentInventory.length}</strong>
          </div>
          <button
            onClick={onClose}
            className="px-5 py-2 bg-slate-800 hover:bg-slate-900 text-white rounded-xl text-xs font-semibold cursor-pointer"
          >
            Close
          </button>
        </div>

      </div>
    </div>
  );
};
