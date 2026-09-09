import React, { useState, useEffect } from 'react';
import * as XLSX from 'xlsx';
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
      result.push({
        ...item,
        id: item.id || `unit-${itemIdx + 1}`,
        imei: item.imei || ''
      });
    } else {
      for (let q = 1; q <= qty; q++) {
        result.push({
          ...item,
          id: `${item.id || `item-${itemIdx + 1}`}-unit-${itemIdx + 1}-${q}`,
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

// Retrieve existing system IMEIs from persistent storage
function getExistingSystemImeis(excludeRequestId?: string): Map<string, string> {
  const map = new Map<string, string>();
  if (typeof window !== 'undefined' && window.localStorage) {
    try {
      const raw = localStorage.getItem('rdr_imei_inventory');
      if (raw) {
        const list: ImeiInventoryItem[] = JSON.parse(raw);
        if (Array.isArray(list)) {
          for (const item of list) {
            if (!item.imei) continue;
            // Exclude records belonging to the current request when re-uploading/editing
            if (excludeRequestId && item.requestId === excludeRequestId) {
              continue;
            }
            const clean = item.imei.trim().toLowerCase();
            const location = item.requestCode
              ? `Request ${item.requestCode}`
              : (item.eventName ? `Event "${item.eventName}"` : 'Inventory Stock');
            map.set(clean, location);
          }
        }
      }
    } catch {
      // ignore
    }
  }
  return map;
}

// Validation function for duplicate IMEI numbers
function validateImeisForDuplicates(
  imeiEntries: { imei: string; label?: string }[],
  excludeRequestId?: string
): { isDuplicate: boolean; errorMsg?: string; duplicateImeis: Set<string> } {
  const seenMap = new Map<string, number>();
  const duplicateImeis = new Set<string>();

  imeiEntries.forEach(entry => {
    const raw = (entry.imei || '').trim();
    if (!raw) return;
    const key = raw.toLowerCase();
    seenMap.set(key, (seenMap.get(key) || 0) + 1);
  });

  const internalDuplicates: { imei: string; count: number }[] = [];
  seenMap.forEach((count, key) => {
    if (count > 1) {
      duplicateImeis.add(key);
      internalDuplicates.push({ imei: key, count });
    }
  });

  if (internalDuplicates.length > 0) {
    const summary = internalDuplicates
      .slice(0, 3)
      .map(d => `"${d.imei}" (found ${d.count} times)`)
      .join(', ');
    const more = internalDuplicates.length > 3 ? ` and ${internalDuplicates.length - 3} more` : '';
    return {
      isDuplicate: true,
      errorMsg: `Duplicate Device IMEI No detected in upload: ${summary}${more}. Each device unit must have a unique IMEI number.`,
      duplicateImeis
    };
  }

  // Check against existing system inventory records
  const existingMap = getExistingSystemImeis(excludeRequestId);
  const systemDuplicates: { imei: string; location: string }[] = [];

  imeiEntries.forEach(entry => {
    const raw = (entry.imei || '').trim();
    if (!raw) return;
    const key = raw.toLowerCase();
    if (existingMap.has(key)) {
      duplicateImeis.add(key);
      systemDuplicates.push({
        imei: raw,
        location: existingMap.get(key) || 'Existing Inventory'
      });
    }
  });

  if (systemDuplicates.length > 0) {
    const summary = systemDuplicates
      .slice(0, 3)
      .map(d => `"${d.imei}" (already in ${d.location})`)
      .join(', ');
    const more = systemDuplicates.length > 3 ? ` and ${systemDuplicates.length - 3} more` : '';
    return {
      isDuplicate: true,
      errorMsg: `Duplicate Device IMEI No detected: ${summary}${more}. Device IMEI numbers must be globally unique across the system.`,
      duplicateImeis
    };
  }

  return { isDuplicate: false, duplicateImeis: new Set() };
}

// Validation function for duplicate SPP Order No and Mobile No
function validateSppAndMobileForDuplicates(
  entries: { sppOrder?: string; mobileNumber?: string }[],
  excludeRequestId?: string
): { isDuplicate: boolean; errorMsg?: string } {
  const sppCounts = new Map<string, { count: number; raw: string }>();
  const phoneCounts = new Map<string, { count: number; raw: string }>();

  entries.forEach(r => {
    const rawSpp = (r.sppOrder || '').trim();
    if (rawSpp) {
      const key = rawSpp.toLowerCase();
      const existing = sppCounts.get(key) || { count: 0, raw: rawSpp };
      existing.count += 1;
      sppCounts.set(key, existing);
    }

    const rawPhone = (r.mobileNumber || '').trim();
    if (rawPhone) {
      let cleaned = rawPhone.replace(/[\s\-\(\)\.]/g, '').trim();
      if (cleaned.startsWith('+60')) cleaned = '0' + cleaned.slice(3);
      else if (cleaned.startsWith('60') && cleaned.length >= 10) cleaned = '0' + cleaned.slice(2);
      const key = cleaned.toLowerCase();
      if (key) {
        const existing = phoneCounts.get(key) || { count: 0, raw: rawPhone };
        existing.count += 1;
        phoneCounts.set(key, existing);
      }
    }
  });

  // Check internal batch duplicates
  const internalSpp: { spp: string; count: number }[] = [];
  sppCounts.forEach((val) => {
    if (val.count > 1) internalSpp.push({ spp: val.raw, count: val.count });
  });

  if (internalSpp.length > 0) {
    const summary = internalSpp.slice(0, 3).map(d => `"${d.spp}" (found ${d.count} times)`).join(', ');
    const more = internalSpp.length > 3 ? ` and ${internalSpp.length - 3} more` : '';
    return {
      isDuplicate: true,
      errorMsg: `Duplicate SPP Order No detected in upload: ${summary}${more}. Each device registration must have a unique SPP Order No.`
    };
  }

  const internalPhones: { phone: string; count: number }[] = [];
  phoneCounts.forEach((val) => {
    if (val.count > 1) internalPhones.push({ phone: val.raw, count: val.count });
  });

  if (internalPhones.length > 0) {
    const summary = internalPhones.slice(0, 3).map(d => `"${d.phone}" (found ${d.count} times)`).join(', ');
    const more = internalPhones.length > 3 ? ` and ${internalPhones.length - 3} more` : '';
    return {
      isDuplicate: true,
      errorMsg: `Duplicate Mobile No detected in upload: ${summary}${more}. Each customer registration must have a unique Mobile No.`
    };
  }

  // Check cross-request system duplicates from localStorage
  if (typeof window !== 'undefined' && window.localStorage) {
    try {
      const raw = localStorage.getItem('rdr_imei_inventory');
      if (raw) {
        const list: ImeiInventoryItem[] = JSON.parse(raw);
        if (Array.isArray(list)) {
          const sysSppMap = new Map<string, string>();
          const sysPhoneMap = new Map<string, string>();

          for (const item of list) {
            if (excludeRequestId && item.requestId === excludeRequestId) continue;
            const loc = item.requestCode ? `Request ${item.requestCode}` : (item.eventName ? `Event "${item.eventName}"` : 'Inventory');
            if (item.sppOrder && item.sppOrder.trim()) {
              sysSppMap.set(item.sppOrder.trim().toLowerCase(), loc);
            }
            if (item.mobileNumber && item.mobileNumber.trim()) {
              let cl = item.mobileNumber.replace(/[\s\-\(\)\.]/g, '').trim();
              if (cl.startsWith('+60')) cl = '0' + cl.slice(3);
              else if (cl.startsWith('60') && cl.length >= 10) cl = '0' + cl.slice(2);
              if (cl) sysPhoneMap.set(cl.toLowerCase(), loc);
            }
          }

          for (const entry of entries) {
            const spp = (entry.sppOrder || '').trim();
            if (spp && sysSppMap.has(spp.toLowerCase())) {
              const loc = sysSppMap.get(spp.toLowerCase());
              return {
                isDuplicate: true,
                errorMsg: `Duplicate SPP Order No detected: "${spp}" (already assigned in ${loc}). SPP Order numbers must be globally unique.`
              };
            }

            const ph = (entry.mobileNumber || '').trim();
            if (ph) {
              let cl = ph.replace(/[\s\-\(\)\.]/g, '').trim();
              if (cl.startsWith('+60')) cl = '0' + cl.slice(3);
              else if (cl.startsWith('60') && cl.length >= 10) cl = '0' + cl.slice(2);
              if (cl && sysPhoneMap.has(cl.toLowerCase())) {
                const loc = sysPhoneMap.get(cl.toLowerCase());
                return {
                  isDuplicate: true,
                  errorMsg: `Duplicate Mobile No detected: "${ph}" (already registered in ${loc}). Mobile numbers must be globally unique.`
                };
              }
            }
          }
        }
      }
    } catch {
      // ignore
    }
  }

  return { isDuplicate: false };
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
  const [items, setItems] = useState<PartBDeviceItem[]>(() => expandPartBUnits(partBItems));
  const [activeTab, setActiveTab] = useState<'manual' | 'csv'>('csv');
  const [csvText, setCsvText] = useState<string>('');
  const [uploadSuccessMsg, setUploadSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Sync state if partBItems change or modal opens
  useEffect(() => {
    if (isOpen) {
      setItems(expandPartBUnits(partBItems));
      setUploadSuccessMsg(null);
      setErrorMsg(null);
    }
  }, [isOpen, partBItems]);

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

    const reqCode = requestCode || "RDR-2026-0001";
    const reqName = requestorName || "MUHAMMAD RAZIF BIN ABDUL RASHID";
    const evtName = eventName || "MAHA Pahang 2026";

    if (items.length > 0) {
      items.forEach((item) => {
        const deviceImei = item.imei || '';
        rows += `"${reqCode}","${reqName}","${evtName}","${item.material}","${item.description.replace(/"/g, '""')}",${item.rrpRM},"${deviceImei}","${item.customerName || ''}","${item.nric || ''}","${item.sppOrder || ''}","${item.mobileNumber || ''}","${(item.submissionRemarks || '').replace(/"/g, '""')}"\n`;
      });
    } else {
      rows += `"${reqCode}","${reqName}","${evtName}","20017453","HP-SAMSUNG-A07 5G 8+256GB-BLK",1029,"",,,,,\n`;
      rows += `"${reqCode}","${reqName}","${evtName}","20018081","HP-SAMSUNG-A27 5G 8+256GB-BLK",1499,"",,,,,\n`;
    }

    const csvData = headers + rows;
    const blob = new Blob([csvData], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `${reqCode || 'PartB'}_IMEI_Template.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleDownloadSampleXlsx = () => {
    const reqCode = requestCode || "RDR-2026-0001";
    const reqName = requestorName || "MUHAMMAD RAZIF BIN ABDUL RASHID";
    const evtName = eventName || "MAHA Pahang 2026";

    const rows = (items.length > 0 ? items : [
      { material: '20017453', description: 'HP-SAMSUNG-A07 5G 8+256GB-BLK', rrpRM: 1029, imei: '', customerName: '', nric: '', sppOrder: '', mobileNumber: '', submissionRemarks: '' },
      { material: '20018081', description: 'HP-SAMSUNG-A27 5G 8+256GB-BLK', rrpRM: 1499, imei: '', customerName: '', nric: '', sppOrder: '', mobileNumber: '', submissionRemarks: '' }
    ]).map((item) => ({
      'Request Code': reqCode,
      'Requestor Name': reqName,
      'Event Name': evtName,
      'Material': item.material,
      'Descriptions': item.description,
      'RRP (RM)': item.rrpRM,
      'Device IMEI No': item.imei || '',
      'Customer Name': item.customerName || '',
      'NRIC': item.nric || '',
      'SPP Order': item.sppOrder || '',
      'Mobile Number': item.mobileNumber || '',
      'Submission Remarks': item.submissionRemarks || ''
    }));

    const worksheet = XLSX.utils.json_to_sheet(rows);
    worksheet['!cols'] = [
      { wch: 18 },
      { wch: 30 },
      { wch: 22 },
      { wch: 14 },
      { wch: 32 },
      { wch: 12 },
      { wch: 20 },
      { wch: 18 },
      { wch: 18 },
      { wch: 16 },
      { wch: 16 },
      { wch: 24 }
    ];

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'IMEI_Upload');
    XLSX.writeFile(workbook, `${reqCode || 'PartB'}_IMEI_Template.xlsx`);
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

    // Validate for duplicate IMEI numbers in upload or system
    const imeiEntries = parsedRows.filter(r => Boolean((r.imei || '').trim()));
    const dupCheck = validateImeisForDuplicates(imeiEntries, requestId);
    if (dupCheck.isDuplicate) {
      setErrorMsg(dupCheck.errorMsg || 'Duplicate Device IMEI numbers detected in the uploaded data.');
      setUploadSuccessMsg(null);
      return;
    }

    // Validate for duplicate SPP Order No and Mobile No in uploaded data
    const sppMobileCheck = validateSppAndMobileForDuplicates(parsedRows, requestId);
    if (sppMobileCheck.isDuplicate) {
      setErrorMsg(sppMobileCheck.errorMsg || 'Duplicate SPP Order No or Mobile No detected in uploaded data.');
      setUploadSuccessMsg(null);
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

    const isExcel = file.name.toLowerCase().endsWith('.xlsx') || file.name.toLowerCase().endsWith('.xls');

    if (isExcel) {
      const reader = new FileReader();
      reader.onload = event => {
        try {
          const buffer = event.target?.result as ArrayBuffer;
          const workbook = XLSX.read(buffer, { type: 'array' });
          const firstSheetName = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[firstSheetName];
          const csvText = XLSX.utils.sheet_to_csv(worksheet);
          setCsvText(csvText);
          parseAndApplyCsv(csvText);
        } catch (err) {
          console.error(err);
          setErrorMsg('Failed to parse the Excel file. Please ensure it is a valid .xlsx or .xls file.');
        }
      };
      reader.onerror = () => {
        setErrorMsg('Failed to read uploaded Excel file.');
      };
      reader.readAsArrayBuffer(file);
    } else {
      const reader = new FileReader();
      reader.onload = event => {
        const text = event.target?.result as string;
        if (text) {
          setCsvText(text);
          parseAndApplyCsv(text);
        }
      };
      reader.onerror = () => {
        setErrorMsg('Failed to read uploaded file.');
      };
      reader.readAsText(file);
    }
  };

  const handleSave = () => {
    // Validate for duplicates among assigned IMEIs before saving
    const assignedItems = items.filter(item => Boolean((item.imei || '').trim()));
    const dupCheck = validateImeisForDuplicates(
      assignedItems.map(i => ({ imei: i.imei || '' })),
      requestId
    );

    if (dupCheck.isDuplicate) {
      setErrorMsg(dupCheck.errorMsg || 'Cannot save: Duplicate Device IMEI numbers detected.');
      setUploadSuccessMsg(null);
      return;
    }

    // Validate for duplicate SPP Order No or Mobile No before saving
    const sppMobileCheck = validateSppAndMobileForDuplicates(assignedItems, requestId);
    if (sppMobileCheck.isDuplicate) {
      setErrorMsg(sppMobileCheck.errorMsg || 'Cannot save: Duplicate SPP Order No or Mobile No detected.');
      setUploadSuccessMsg(null);
      return;
    }

    const imeiInventoryRecords: ImeiInventoryItem[] = items
      .filter(item => Boolean((item.imei || '').trim()))
      .map((item, idx) => {
        const cleanImei = item.imei!.trim();
        const statusVal: 'HOO Approved' | 'Pending Approval' | 'Unassigned Stock' =
          requestStatus === 'Approved'
            ? 'HOO Approved'
            : (requestCode ? 'Pending Approval' : 'Unassigned Stock');

        return {
          id: `imei-${cleanImei}-${Date.now()}-${idx}-${Math.random().toString(36).slice(2, 6)}`,
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

  // Real-time duplicates detection for manual entry mode
  const duplicateImeisSet = React.useMemo(() => {
    const counts = new Map<string, number>();
    items.forEach(item => {
      const val = (item.imei || '').trim().toLowerCase();
      if (val) {
        counts.set(val, (counts.get(val) || 0) + 1);
      }
    });
    const dupes = new Set<string>();
    counts.forEach((cnt, val) => {
      if (cnt > 1) dupes.add(val);
    });
    return dupes;
  }, [items]);

  if (!isOpen) return null;

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
            <div className="flex items-center gap-2 flex-wrap">
              <button
                type="button"
                id="btn-download-excel-template-xlsx"
                onClick={handleDownloadSampleXlsx}
                className="inline-flex items-center gap-1.5 text-xs font-bold text-white bg-purple-600 hover:bg-purple-700 px-3 py-1.5 rounded-xl transition-all cursor-pointer shadow-xs"
              >
                <FileSpreadsheet className="w-3.5 h-3.5 text-purple-200" />
                <span>Download XLSX Template</span>
              </button>
              <button
                type="button"
                id="btn-download-excel-template-csv"
                onClick={handleDownloadSampleCsv}
                className="inline-flex items-center gap-1.5 text-xs font-bold text-purple-800 hover:text-purple-950 bg-white border border-purple-300 px-3 py-1.5 rounded-xl hover:bg-purple-100/70 transition-all cursor-pointer shadow-xs"
              >
                <Download className="w-3.5 h-3.5 text-purple-600" />
                <span>Download CSV Template</span>
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
                  Upload Excel (.xlsx) or CSV (.csv) file with Device IMEI numbers
                </p>
                <p className="text-xs text-slate-500 max-w-xl mx-auto mb-3">
                  Template Headers: <code className="bg-purple-100 text-purple-900 px-1.5 py-0.5 rounded font-mono font-semibold">Request Code, Requestor Name, Event Name, Material, Descriptions, RRP (RM), Device IMEI No, Customer Name, NRIC, SPP Order, Mobile Number, Submission Remarks</code>
                </p>
                <input
                  type="file"
                  accept=".xlsx,.xls,.csv,.txt"
                  onChange={handleFileUpload}
                  className="hidden"
                  id="imei-excel-file-input"
                />
                <label
                  htmlFor="imei-excel-file-input"
                  className="inline-flex items-center gap-2 bg-purple-600 hover:bg-purple-700 text-white font-bold px-5 py-2.5 rounded-xl cursor-pointer shadow-sm transition-all"
                >
                  <FileSpreadsheet className="w-4 h-4" />
                  <span>Choose Excel / CSV File</span>
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
                  placeholder={`Request Code,Requestor Name,Event Name,Material,Descriptions,RRP (RM),Device IMEI No,Customer Name,NRIC,SPP Order,Mobile Number,Submission Remarks\nRDR-2026-0001,MUHAMMAD RAZIF,MAHA Pahang 2026,20017453,HP-SAMSUNG-A07 5G 8+256GB-BLK,1029,354555938094204,,,,,`}
                  className="w-full font-mono text-xs p-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-purple-500 bg-white"
                />
              </div>
            </div>
          )}

          {/* Tab 2: Manual Input */}
          {activeTab === 'manual' && (
            <div className="max-h-96 overflow-y-auto border border-slate-200 rounded-2xl divide-y divide-slate-100">
              {items.map((item, idx) => {
                const isDupe = Boolean(
                  item.imei && duplicateImeisSet.has(item.imei.trim().toLowerCase())
                );
                return (
                  <div
                    key={`${item.id || 'unit'}-${idx}`}
                    className={`p-3.5 space-y-2 transition-colors text-xs ${
                      isDupe ? 'bg-rose-50/60' : 'hover:bg-slate-50/80'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-slate-400 font-bold">{idx + 1}.</span>
                        <span className="font-bold text-slate-900">{item.description}</span>
                        <span className="font-mono text-[11px] text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-200 font-semibold">
                          {item.material}
                        </span>
                        {isDupe && (
                          <span className="inline-flex items-center gap-1 font-bold text-[10px] text-rose-700 bg-rose-100 border border-rose-300 px-2 py-0.5 rounded-full">
                            <AlertCircle className="w-3 h-3 text-rose-600" />
                            <span>Duplicate IMEI</span>
                          </span>
                        )}
                      </div>
                      <span className="text-slate-500 text-[11px]">RRP: RM {item.rrpRM}</span>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5">
                      <div>
                        <div className="flex items-center justify-between mb-0.5">
                          <label className="block text-[10px] text-purple-900 font-bold">Device IMEI No *</label>
                          {isDupe && (
                            <span className="text-[10px] font-bold text-rose-600">Duplicate</span>
                          )}
                        </div>
                        <input
                          type="text"
                          placeholder="e.g. 354555938094204"
                          value={item.imei || ''}
                          onChange={e => handleFieldChange(item.id, 'imei', e.target.value)}
                          className={`w-full px-2.5 py-1.5 font-mono text-xs font-bold rounded-lg focus:ring-2 ${
                            isDupe
                              ? 'border-2 border-rose-500 bg-rose-50 text-rose-950 focus:ring-rose-500'
                              : 'border border-purple-300 rounded-lg focus:ring-2 focus:ring-purple-500 bg-purple-50/30 text-purple-950'
                          }`}
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
              );
            })}
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
