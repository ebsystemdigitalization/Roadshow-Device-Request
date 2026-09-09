import React, { useState } from 'react';
import { PartBDeviceItem } from '../types';
import { parseDeviceCSV, generateSampleDeviceCSV, formatRM } from '../utils/formatters';
import { Upload, Download, FileText, CheckCircle2, AlertCircle, X, Sparkles, Layers } from 'lucide-react';

interface BulkUploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImportItems: (items: PartBDeviceItem[], appendMode: boolean) => void;
}

export const BulkUploadModal: React.FC<BulkUploadModalProps> = ({
  isOpen,
  onClose,
  onImportItems
}) => {
  const [csvContent, setCsvContent] = useState<string>('');
  const [appendMode, setAppendMode] = useState<boolean>(false);
  const [parsedItems, setParsedItems] = useState<PartBDeviceItem[]>([]);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleTextChange = (text: string) => {
    setCsvContent(text);
    if (!text.trim()) {
      setParsedItems([]);
      setErrorMsg(null);
      return;
    }
    try {
      const items = parseDeviceCSV(text);
      setParsedItems(items);
      if (items.length === 0) {
        setErrorMsg('Could not parse any valid device rows. Ensure CSV format has Material, Description, Quantity, RRP.');
      } else {
        setErrorMsg(null);
      }
    } catch {
      setErrorMsg('Error parsing CSV text format.');
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      if (text) {
        handleTextChange(text);
      }
    };
    reader.readAsText(file);
  };

  const handleDownloadSample = () => {
    const csvData = generateSampleDeviceCSV();
    const blob = new Blob([csvData], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', 'roadshow_devices_template.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleLoadSampleData = () => {
    const sample = generateSampleDeviceCSV();
    handleTextChange(sample);
  };

  const handleConfirmImport = () => {
    if (parsedItems.length === 0) return;
    onImportItems(parsedItems, appendMode);
    onClose();
  };

  const totalCalculatedValue = parsedItems.reduce((acc, curr) => acc + curr.totalRrpRM, 0);

  return (
    <div id="bulk-upload-modal-backdrop" className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl max-w-3xl w-full overflow-hidden border border-slate-200">
        {/* Header */}
        <div className="bg-slate-900 text-white px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-blue-600 rounded-lg">
              <Upload className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-base font-bold">Bulk Upload Devices</h2>
              <p className="text-xs text-slate-300">Import device list via CSV file upload or structured copy-paste</p>
            </div>
          </div>
          <button
            id="btn-close-bulk-upload"
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-5">
          {/* Action Row: Sample Template & Load Sample */}
          <div className="bg-blue-50/80 border border-blue-200 rounded-xl p-4 flex flex-wrap items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-blue-600 flex-shrink-0" />
              <span className="text-slate-700">
                CSV header format: <code className="bg-blue-100 text-blue-900 px-1.5 py-0.5 rounded font-mono font-semibold">Material, Descriptions, Quantity, RRP (RM), Remarks</code>
              </span>
            </div>
            <div className="flex items-center gap-2">
              <button
                id="btn-download-sample-csv"
                onClick={handleDownloadSample}
                className="inline-flex items-center gap-1.5 bg-white border border-blue-300 text-blue-700 hover:bg-blue-100/50 px-2.5 py-1.5 rounded-lg font-medium transition-colors cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Download Sample CSV</span>
              </button>
              <button
                id="btn-load-sample-data"
                onClick={handleLoadSampleData}
                className="inline-flex items-center gap-1.5 bg-blue-600 text-white hover:bg-blue-700 px-2.5 py-1.5 rounded-lg font-medium transition-colors cursor-pointer"
              >
                <FileText className="w-3.5 h-3.5" />
                <span>Auto-Fill Example</span>
              </button>
            </div>
          </div>

          {/* File Drag/Drop or Input */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Upload CSV File
              </label>
              <label className="border-2 border-dashed border-slate-300 hover:border-blue-500 rounded-xl p-4 flex flex-col items-center justify-center text-center cursor-pointer bg-slate-50 hover:bg-blue-50/30 transition-all group">
                <Upload className="w-8 h-8 text-slate-400 group-hover:text-blue-600 mb-2 transition-colors" />
                <span className="text-xs font-semibold text-slate-700 group-hover:text-blue-700">
                  Click to browse .csv or .txt file
                </span>
                <span className="text-[11px] text-slate-400 mt-0.5">Supports comma-separated format</span>
                <input
                  type="file"
                  accept=".csv,.txt"
                  onChange={handleFileUpload}
                  className="hidden"
                />
              </label>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Or Paste CSV Content
              </label>
              <textarea
                value={csvContent}
                onChange={(e) => handleTextChange(e.target.value)}
                placeholder="Material, Descriptions, Quantity, RRP (RM), Remarks&#10;MAT-S24U-512, Galaxy S24 Ultra, 5, 6299, Warehouse stock&#10;MAT-TAB-S9U, Galaxy Tab S9 Ultra, 3, 5999, Demo ready"
                className="w-full h-28 border border-slate-300 rounded-xl p-3 text-xs font-mono focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none resize-none"
              />
            </div>
          </div>

          {/* Error Banner */}
          {errorMsg && (
            <div className="bg-rose-50 border border-rose-200 text-rose-800 p-3 rounded-xl text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Preview Table */}
          {parsedItems.length > 0 && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  Preview Detected Devices ({parsedItems.length} items)
                </h3>
                <span className="text-xs font-semibold text-slate-900 bg-slate-100 px-2.5 py-1 rounded-md border border-slate-200">
                  Total Value: {formatRM(totalCalculatedValue)}
                </span>
              </div>

              <div className="max-h-48 overflow-y-auto border border-slate-200 rounded-xl">
                <table className="w-full text-left text-xs border-collapse">
                  <thead className="bg-slate-100 text-slate-700 font-semibold sticky top-0 border-b border-slate-200">
                    <tr>
                      <th className="p-2.5">Material</th>
                      <th className="p-2.5">Description</th>
                      <th className="p-2.5 text-center">Qty</th>
                      <th className="p-2.5 text-right">RRP (RM)</th>
                      <th className="p-2.5 text-right">Total (RM)</th>
                      <th className="p-2.5">Remarks</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {parsedItems.map((item, idx) => (
                      <tr key={idx} className="hover:bg-slate-50">
                        <td className="p-2.5 font-mono text-blue-700 font-semibold">{item.material}</td>
                        <td className="p-2.5 text-slate-800">{item.description}</td>
                        <td className="p-2.5 text-center font-semibold">{item.quantity}</td>
                        <td className="p-2.5 text-right">{formatRM(item.rrpRM)}</td>
                        <td className="p-2.5 text-right font-semibold text-slate-900">{formatRM(item.totalRrpRM)}</td>
                        <td className="p-2.5 text-slate-500 italic text-[11px]">{item.remarks || '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Import Mode Options */}
          <div className="flex items-center gap-4 text-xs pt-2 border-t border-slate-200">
            <span className="font-semibold text-slate-700">Import Mode:</span>
            <label className="flex items-center gap-1.5 cursor-pointer">
              <input
                type="radio"
                name="importMode"
                checked={!appendMode}
                onChange={() => setAppendMode(false)}
                className="text-blue-600 focus:ring-blue-500"
              />
              <span className="text-slate-800">Replace existing device list</span>
            </label>
            <label className="flex items-center gap-1.5 cursor-pointer">
              <input
                type="radio"
                name="importMode"
                checked={appendMode}
                onChange={() => setAppendMode(true)}
                className="text-blue-600 focus:ring-blue-500"
              />
              <span className="text-slate-800">Append to existing device list</span>
            </label>
          </div>
        </div>

        {/* Footer */}
        <div className="bg-slate-50 px-6 py-4 flex items-center justify-between border-t border-slate-200">
          <button
            id="btn-cancel-bulk-upload"
            onClick={onClose}
            className="px-4 py-2 border border-slate-300 text-slate-700 hover:bg-slate-100 rounded-xl text-xs font-semibold transition-colors cursor-pointer"
          >
            Cancel
          </button>

          <button
            id="btn-confirm-bulk-import"
            disabled={parsedItems.length === 0}
            onClick={handleConfirmImport}
            className={`flex items-center gap-2 px-5 py-2 rounded-xl text-xs font-semibold text-white transition-all cursor-pointer ${
              parsedItems.length > 0
                ? 'bg-blue-600 hover:bg-blue-700 shadow-md shadow-blue-500/20'
                : 'bg-slate-300 text-slate-500 cursor-not-allowed'
            }`}
          >
            <Layers className="w-4 h-4" />
            <span>Import {parsedItems.length} Devices</span>
          </button>
        </div>
      </div>
    </div>
  );
};
