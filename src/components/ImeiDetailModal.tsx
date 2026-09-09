import React, { useState, useEffect, useRef } from 'react';
import * as XLSX from 'xlsx';
import { RoadshowRequest, ImeiInventoryItem, User } from '../types';
import { formatRM } from '../utils/formatters';
import { X, Search, Copy, Check, Barcode, Smartphone, User as UserIcon, Phone, FileText, CheckCircle2, ShieldCheck, Tag, Edit3, Save, Lock, Download, Upload, FileSpreadsheet, ChevronDown, AlertCircle } from 'lucide-react';

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

// Normalize phone number for robust duplicate matching
function normalizePhoneNumber(phone?: string): string {
  if (!phone) return '';
  let cleaned = phone.replace(/[\s\-\(\)\.]/g, '').trim();
  if (cleaned.startsWith('+60')) {
    cleaned = '0' + cleaned.slice(3);
  } else if (cleaned.startsWith('60') && cleaned.length >= 10) {
    cleaned = '0' + cleaned.slice(2);
  }
  return cleaned.toLowerCase();
}

// Query persistent system storage for existing SPP Order and Mobile Numbers
function getExistingSystemOrderAndPhoneMap(excludeRequestId?: string): {
  sppMap: Map<string, { imei: string; location: string }>;
  phoneMap: Map<string, { imei: string; location: string }>;
} {
  const sppMap = new Map<string, { imei: string; location: string }>();
  const phoneMap = new Map<string, { imei: string; location: string }>();

  if (typeof window !== 'undefined' && window.localStorage) {
    try {
      const raw = localStorage.getItem('rdr_imei_inventory');
      if (raw) {
        const list: ImeiInventoryItem[] = JSON.parse(raw);
        if (Array.isArray(list)) {
          for (const item of list) {
            if (excludeRequestId && item.requestId === excludeRequestId) {
              continue;
            }
            const loc = item.requestCode
              ? `Request ${item.requestCode}`
              : (item.eventName ? `Event "${item.eventName}"` : 'Inventory');
            if (item.sppOrder && item.sppOrder.trim()) {
              const key = item.sppOrder.trim().toLowerCase();
              if (!sppMap.has(key)) {
                sppMap.set(key, { imei: item.imei || '', location: loc });
              }
            }
            if (item.mobileNumber && item.mobileNumber.trim()) {
              const key = normalizePhoneNumber(item.mobileNumber);
              if (key && !phoneMap.has(key)) {
                phoneMap.set(key, { imei: item.imei || '', location: loc });
              }
            }
          }
        }
      }
    } catch {
      // ignore
    }
  }

  return { sppMap, phoneMap };
}

// Validate duplicate SPP Order No and Mobile No within batch and across system
function validateDetailsForDuplicates(
  records: { id?: string; imei?: string; sppOrder?: string; mobileNumber?: string }[],
  excludeRequestId?: string
): { isDuplicate: boolean; errorMsg?: string; duplicateSppOrders: Set<string>; duplicateMobileNumbers: Set<string> } {
  const duplicateSppOrders = new Set<string>();
  const duplicateMobileNumbers = new Set<string>();

  const sppCounts = new Map<string, { count: number; raw: string; imeis: string[] }>();
  const phoneCounts = new Map<string, { count: number; raw: string; imeis: string[] }>();

  records.forEach(r => {
    const rawSpp = (r.sppOrder || '').trim();
    if (rawSpp) {
      const key = rawSpp.toLowerCase();
      const existing = sppCounts.get(key) || { count: 0, raw: rawSpp, imeis: [] };
      existing.count += 1;
      if (r.imei) existing.imeis.push(r.imei);
      sppCounts.set(key, existing);
    }

    const rawPhone = (r.mobileNumber || '').trim();
    if (rawPhone) {
      const key = normalizePhoneNumber(rawPhone);
      if (key) {
        const existing = phoneCounts.get(key) || { count: 0, raw: rawPhone, imeis: [] };
        existing.count += 1;
        if (r.imei) existing.imeis.push(r.imei);
        phoneCounts.set(key, existing);
      }
    }
  });

  // 1. Check internal batch duplicates for SPP Order No
  const internalSppDupes: { spp: string; count: number }[] = [];
  sppCounts.forEach((val, key) => {
    if (val.count > 1) {
      duplicateSppOrders.add(key);
      internalSppDupes.push({ spp: val.raw, count: val.count });
    }
  });

  if (internalSppDupes.length > 0) {
    const summary = internalSppDupes
      .slice(0, 3)
      .map(d => `"${d.spp}" (found ${d.count} times)`)
      .join(', ');
    const more = internalSppDupes.length > 3 ? ` and ${internalSppDupes.length - 3} more` : '';
    return {
      isDuplicate: true,
      errorMsg: `Duplicate SPP Order No detected in upload: ${summary}${more}. Each device registration must have a unique SPP Order No.`,
      duplicateSppOrders,
      duplicateMobileNumbers
    };
  }

  // 2. Check internal batch duplicates for Mobile No
  const internalPhoneDupes: { phone: string; count: number }[] = [];
  phoneCounts.forEach((val, key) => {
    if (val.count > 1) {
      duplicateMobileNumbers.add(key);
      internalPhoneDupes.push({ phone: val.raw, count: val.count });
    }
  });

  if (internalPhoneDupes.length > 0) {
    const summary = internalPhoneDupes
      .slice(0, 3)
      .map(d => `"${d.phone}" (found ${d.count} times)`)
      .join(', ');
    const more = internalPhoneDupes.length > 3 ? ` and ${internalPhoneDupes.length - 3} more` : '';
    return {
      isDuplicate: true,
      errorMsg: `Duplicate Mobile No detected in upload: ${summary}${more}. Each customer registration must have a unique Mobile No.`,
      duplicateSppOrders,
      duplicateMobileNumbers
    };
  }

  // 3. Check cross-request system duplicates
  const { sppMap, phoneMap } = getExistingSystemOrderAndPhoneMap(excludeRequestId);

  const systemSppDupes: { spp: string; location: string }[] = [];
  records.forEach(r => {
    const rawSpp = (r.sppOrder || '').trim();
    if (rawSpp) {
      const key = rawSpp.toLowerCase();
      if (sppMap.has(key)) {
        duplicateSppOrders.add(key);
        const match = sppMap.get(key)!;
        systemSppDupes.push({ spp: rawSpp, location: match.location });
      }
    }
  });

  if (systemSppDupes.length > 0) {
    const summary = systemSppDupes
      .slice(0, 3)
      .map(d => `"${d.spp}" (already assigned in ${d.location})`)
      .join(', ');
    const more = systemSppDupes.length > 3 ? ` and ${systemSppDupes.length - 3} more` : '';
    return {
      isDuplicate: true,
      errorMsg: `Duplicate SPP Order No detected: ${summary}${more}. SPP Order numbers must be globally unique across all requests.`,
      duplicateSppOrders,
      duplicateMobileNumbers
    };
  }

  const systemPhoneDupes: { phone: string; location: string }[] = [];
  records.forEach(r => {
    const rawPhone = (r.mobileNumber || '').trim();
    if (rawPhone) {
      const key = normalizePhoneNumber(rawPhone);
      if (key && phoneMap.has(key)) {
        duplicateMobileNumbers.add(key);
        const match = phoneMap.get(key)!;
        systemPhoneDupes.push({ phone: rawPhone, location: match.location });
      }
    }
  });

  if (systemPhoneDupes.length > 0) {
    const summary = systemPhoneDupes
      .slice(0, 3)
      .map(d => `"${d.phone}" (already registered in ${d.location})`)
      .join(', ');
    const more = systemPhoneDupes.length > 3 ? ` and ${systemPhoneDupes.length - 3} more` : '';
    return {
      isDuplicate: true,
      errorMsg: `Duplicate Mobile No detected: ${summary}${more}. Mobile numbers must be unique across customer device registrations.`,
      duplicateSppOrders,
      duplicateMobileNumbers
    };
  }

  return { isDuplicate: false, duplicateSppOrders, duplicateMobileNumbers };
}

export interface ImeiDetailRecord {
  id: string;
  imei: string;
  material: string;
  description: string;
  rrpRM: number;
  customerName?: string;
  nric?: string;
  sppOrder?: string;
  mobileNumber?: string;
  submissionRemarks?: string;
  status?: string;
  source?: 'partB' | 'inventory';
}

export function extractImeiRecordsForRequest(
  request: RoadshowRequest | null,
  imeiInventory: ImeiInventoryItem[] = []
): ImeiDetailRecord[] {
  if (!request) return [];

  const records: ImeiDetailRecord[] = [];
  const seenImeis = new Set<string>();
  const seenIds = new Set<string>();

  // 1. Gather from imeiInventory matching request.id or request.requestCode
  const reqCodeLower = (request.requestCode || '').trim().toLowerCase();
  const matchingInventory = imeiInventory.filter(item => {
    if (item.requestId && item.requestId === request.id) return true;
    if (reqCodeLower && item.requestCode && item.requestCode.trim().toLowerCase() === reqCodeLower) return true;
    return false;
  });

  matchingInventory.forEach((inv, invIdx) => {
    const cleanImei = (inv.imei || '').trim();
    if (cleanImei && !seenImeis.has(cleanImei.toLowerCase())) {
      seenImeis.add(cleanImei.toLowerCase());
      let recId = inv.id || `inv-${invIdx}-${cleanImei}`;
      if (seenIds.has(recId)) {
        recId = `${recId}-${invIdx}`;
      }
      seenIds.add(recId);

      records.push({
        id: recId,
        imei: cleanImei,
        material: inv.material || 'N/A',
        description: inv.description || 'N/A',
        rrpRM: inv.rrpRM || 0,
        customerName: inv.customerName,
        nric: inv.nric,
        sppOrder: inv.sppOrder,
        mobileNumber: inv.mobileNumber,
        submissionRemarks: inv.submissionRemarks,
        status: inv.status,
        source: 'inventory'
      });
    }
  });

  // 2. Gather from request.partB
  (request.partB || []).forEach((item, idx) => {
    if (item.imei && item.imei.trim()) {
      const imeiList = item.imei.split(',').map(s => s.trim()).filter(Boolean);
      imeiList.forEach((imeiStr, iIdx) => {
        if (!seenImeis.has(imeiStr.toLowerCase())) {
          seenImeis.add(imeiStr.toLowerCase());
          let recId = `partB-${item.id || idx}-${iIdx}-${imeiStr}`;
          if (seenIds.has(recId)) {
            recId = `${recId}-${idx}-${iIdx}`;
          }
          seenIds.add(recId);

          records.push({
            id: recId,
            imei: imeiStr,
            material: item.material || 'N/A',
            description: item.description || 'N/A',
            rrpRM: item.rrpRM || 0,
            customerName: item.customerName,
            nric: item.nric,
            sppOrder: item.sppOrder,
            mobileNumber: item.mobileNumber,
            submissionRemarks: item.submissionRemarks,
            status: item.status || 'Assigned',
            source: 'partB'
          });
        } else {
          // Enrich existing inventory record if customer details were present in partB
          const existing = records.find(r => r.imei.toLowerCase() === imeiStr.toLowerCase());
          if (existing) {
            if (!existing.customerName && item.customerName) existing.customerName = item.customerName;
            if (!existing.nric && item.nric) existing.nric = item.nric;
            if (!existing.sppOrder && item.sppOrder) existing.sppOrder = item.sppOrder;
            if (!existing.mobileNumber && item.mobileNumber) existing.mobileNumber = item.mobileNumber;
            if (!existing.submissionRemarks && item.submissionRemarks) existing.submissionRemarks = item.submissionRemarks;
          }
        }
      });
    }
  });

  return records;
}

interface ImeiDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  request: RoadshowRequest | null;
  imeiInventory?: ImeiInventoryItem[];
  currentUser?: User;
  onSaveImeiDetails?: (requestId: string, updatedRecords: ImeiDetailRecord[]) => void;
}

export const ImeiDetailModal: React.FC<ImeiDetailModalProps> = ({
  isOpen,
  onClose,
  request,
  imeiInventory = [],
  currentUser,
  onSaveImeiDetails
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [copiedAll, setCopiedAll] = useState(false);
  const [recordsState, setRecordsState] = useState<ImeiDetailRecord[]>([]);
  const [isEditing, setIsEditing] = useState(false);
  const [isSaveSuccess, setIsSaveSuccess] = useState(false);
  const [uploadMessage, setUploadMessage] = useState<string | null>(null);
  const [uploadErrorMessage, setUploadErrorMessage] = useState<string | null>(null);
  const [showDownloadDropdown, setShowDownloadDropdown] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const downloadDropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (downloadDropdownRef.current && !downloadDropdownRef.current.contains(event.target as Node)) {
        setShowDownloadDropdown(false);
      }
    };
    if (showDownloadDropdown) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showDownloadDropdown]);

  useEffect(() => {
    if (isOpen && request) {
      const extracted = extractImeiRecordsForRequest(request, imeiInventory);
      setRecordsState(extracted);
      setIsSaveSuccess(false);
      setIsEditing(false);
      setUploadMessage(null);
      setUploadErrorMessage(null);
      setShowDownloadDropdown(false);
    }
  }, [isOpen, request, imeiInventory]);

  // Compute duplicate SPP orders and mobile numbers within current records for live visual warnings
  const { duplicateSppSet, duplicatePhoneSet } = React.useMemo(() => {
    const sppCounts = new Map<string, number>();
    const phoneCounts = new Map<string, number>();

    recordsState.forEach(r => {
      const spp = (r.sppOrder || '').trim().toLowerCase();
      if (spp) sppCounts.set(spp, (sppCounts.get(spp) || 0) + 1);

      const phone = normalizePhoneNumber(r.mobileNumber);
      if (phone) phoneCounts.set(phone, (phoneCounts.get(phone) || 0) + 1);
    });

    const dupSpp = new Set<string>();
    sppCounts.forEach((c, val) => {
      if (c > 1) dupSpp.add(val);
    });

    const dupPhone = new Set<string>();
    phoneCounts.forEach((c, val) => {
      if (c > 1) dupPhone.add(val);
    });

    return { duplicateSppSet: dupSpp, duplicatePhoneSet: dupPhone };
  }, [recordsState]);

  if (!isOpen || !request) return null;

  const isSalesRole = currentUser?.role === 'Sales Team' || currentUser?.role === 'Admin';
  const totalUnits = (request.partB || []).reduce((acc, d) => acc + d.quantity, 0);

  const filteredRecords = recordsState.filter(rec => {
    const q = searchTerm.toLowerCase().trim();
    if (!q) return true;
    return (
      rec.imei.toLowerCase().includes(q) ||
      rec.material.toLowerCase().includes(q) ||
      rec.description.toLowerCase().includes(q) ||
      (rec.customerName && rec.customerName.toLowerCase().includes(q)) ||
      (rec.nric && rec.nric.toLowerCase().includes(q)) ||
      (rec.sppOrder && rec.sppOrder.toLowerCase().includes(q)) ||
      (rec.mobileNumber && rec.mobileNumber.toLowerCase().includes(q)) ||
      (rec.submissionRemarks && rec.submissionRemarks.toLowerCase().includes(q))
    );
  });

  const totalRrp = recordsState.reduce((acc, curr) => acc + curr.rrpRM, 0);

  const handleCopySingle = (id: string, imei: string) => {
    navigator.clipboard.writeText(imei);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleCopyAll = () => {
    if (recordsState.length === 0) return;
    const text = recordsState.map(r => r.imei).join('\n');
    navigator.clipboard.writeText(text);
    setCopiedAll(true);
    setTimeout(() => setCopiedAll(false), 2000);
  };

  const handleFieldChange = (id: string, field: keyof ImeiDetailRecord, value: string) => {
    setRecordsState(prev =>
      prev.map(item => (item.id === id ? { ...item, [field]: value } : item))
    );
    // Clear error message when user starts making adjustments
    if (uploadErrorMessage) {
      setUploadErrorMessage(null);
    }
  };

  const handleSaveChanges = () => {
    // Validate for duplicate SPP Order No and Mobile No before saving
    const dupCheck = validateDetailsForDuplicates(recordsState, request?.id);
    if (dupCheck.isDuplicate) {
      setUploadErrorMessage(dupCheck.errorMsg || 'Cannot save: Duplicate SPP Order No or Mobile No detected.');
      setUploadMessage(null);
      return;
    }

    setUploadErrorMessage(null);
    if (onSaveImeiDetails && request) {
      onSaveImeiDetails(request.id, recordsState);
      setIsSaveSuccess(true);
      setTimeout(() => setIsSaveSuccess(false), 2500);
      setIsEditing(false);
    }
  };

  const handleBulkDownloadCsv = () => {
    if (!request || recordsState.length === 0) return;
    const headers = "Request Code,Event Name,Device IMEI Number,Material,Model Description,RRP (RM),Customer Name,NRIC No,SPP Order No,Mobile No,Submission Remarks\n";
    let rows = "";

    recordsState.forEach(item => {
      const esc = (val?: string) => `"${(val || '').replace(/"/g, '""')}"`;
      rows += `${esc(request.requestCode)},${esc(request.partA?.eventName)},${esc(item.imei)},${esc(item.material)},${esc(item.description)},${item.rrpRM},${esc(item.customerName)},${esc(item.nric)},${esc(item.sppOrder)},${esc(item.mobileNumber)},${esc(item.submissionRemarks)}\n`;
    });

    const csvContent = headers + rows;
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `${request.requestCode}_Uploaded_IMEI_Details.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setShowDownloadDropdown(false);
  };

  const handleBulkDownloadXlsx = () => {
    if (!request || recordsState.length === 0) return;

    const data = recordsState.map(item => ({
      'Request Code': request.requestCode || '',
      'Event Name': request.partA?.eventName || '',
      'Device IMEI Number': item.imei || '',
      'Material': item.material || '',
      'Model Description': item.description || '',
      'RRP (RM)': item.rrpRM || 0,
      'Customer Name': item.customerName || '',
      'NRIC No': item.nric || '',
      'SPP Order No': item.sppOrder || '',
      'Mobile No': item.mobileNumber || '',
      'Submission Remarks': item.submissionRemarks || ''
    }));

    const worksheet = XLSX.utils.json_to_sheet(data);
    worksheet['!cols'] = [
      { wch: 18 }, // Request Code
      { wch: 28 }, // Event Name
      { wch: 22 }, // Device IMEI Number
      { wch: 14 }, // Material
      { wch: 34 }, // Model Description
      { wch: 12 }, // RRP (RM)
      { wch: 20 }, // Customer Name
      { wch: 18 }, // NRIC No
      { wch: 18 }, // SPP Order No
      { wch: 16 }, // Mobile No
      { wch: 28 }  // Submission Remarks
    ];

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'IMEI_Details');
    XLSX.writeFile(workbook, `${request.requestCode}_Uploaded_IMEI_Details.xlsx`);
    setShowDownloadDropdown(false);
  };

  const applyUpdatesFromMap = (updatesByImei: Map<string, {
    customerName?: string;
    nric?: string;
    sppOrder?: string;
    mobileNumber?: string;
    submissionRemarks?: string;
  }>) => {
    let matchCount = 0;
    const updatedRecords = recordsState.map(rec => {
      const updateData = updatesByImei.get(rec.imei.toLowerCase().trim());
      if (updateData) {
        matchCount++;
        return {
          ...rec,
          customerName: updateData.customerName !== undefined ? updateData.customerName : rec.customerName,
          nric: updateData.nric !== undefined ? updateData.nric : rec.nric,
          sppOrder: updateData.sppOrder !== undefined ? updateData.sppOrder : rec.sppOrder,
          mobileNumber: updateData.mobileNumber !== undefined ? updateData.mobileNumber : rec.mobileNumber,
          submissionRemarks: updateData.submissionRemarks !== undefined ? updateData.submissionRemarks : rec.submissionRemarks
        };
      }
      return rec;
    });

    if (matchCount === 0) {
      setUploadErrorMessage('File parsed, but no matching IMEI numbers were found in this request.');
      setUploadMessage(null);
      return;
    }

    // Validate for duplicate SPP Order No or Mobile No across candidate updated records
    const dupCheck = validateDetailsForDuplicates(updatedRecords, request?.id);
    if (dupCheck.isDuplicate) {
      setUploadErrorMessage(dupCheck.errorMsg || 'Duplicate SPP Order No or Mobile No detected in uploaded file.');
      setUploadMessage(null);
      return;
    }

    setUploadErrorMessage(null);
    setRecordsState(updatedRecords);

    if (onSaveImeiDetails && request) {
      onSaveImeiDetails(request.id, updatedRecords);
    }

    setUploadMessage(`Bulk upload successful! Updated details for ${matchCount} IMEI record(s).`);
    setIsSaveSuccess(true);
    setTimeout(() => {
      setIsSaveSuccess(false);
    }, 3500);
  };

  const parseAndApplyExcel = (workbook: XLSX.WorkBook) => {
    const firstSheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[firstSheetName];
    if (!worksheet) {
      setUploadMessage('Excel sheet is empty.');
      return;
    }

    const rows = XLSX.utils.sheet_to_json(worksheet, { header: 1, raw: false, defval: '' }) as (string | number)[][];
    if (!rows || rows.length === 0) {
      setUploadMessage('Excel sheet contains no data.');
      return;
    }

    const firstRow = rows[0].map(c => String(c || '').trim());
    const firstRowLower = firstRow.map(c => c.toLowerCase());

    const isHeaderRow =
      firstRowLower.some(h =>
        h.includes('imei') ||
        h.includes('customer') ||
        h.includes('nric') ||
        h.includes('spp') ||
        h.includes('material') ||
        h.includes('request code')
      );

    let imeiIdx = -1;
    let custIdx = -1;
    let nricIdx = -1;
    let sppIdx = -1;
    let mobileIdx = -1;
    let remarksIdx = -1;

    if (isHeaderRow) {
      const findH = (substr: string) => firstRowLower.findIndex(h => h.includes(substr));
      imeiIdx = findH('imei');
      custIdx = findH('customer');
      nricIdx = findH('nric');
      sppIdx = findH('spp');
      mobileIdx = firstRowLower.findIndex(h => h.includes('mobile') || h.includes('phone') || h.includes('tel'));
      remarksIdx = firstRowLower.findIndex(h => h.includes('remark') || h.includes('submission'));
    } else {
      imeiIdx = 2;
      custIdx = 6;
      nricIdx = 7;
      sppIdx = 8;
      mobileIdx = 9;
      remarksIdx = 10;
    }

    const startIndex = isHeaderRow ? 1 : 0;
    const updatesByImei = new Map<string, {
      customerName?: string;
      nric?: string;
      sppOrder?: string;
      mobileNumber?: string;
      submissionRemarks?: string;
    }>();

    for (let i = startIndex; i < rows.length; i++) {
      const cols = rows[i].map(c => String(c || '').trim());
      if (cols.length === 0 || cols.every(c => !c)) continue;

      let imei = imeiIdx !== -1 && cols[imeiIdx] ? cols[imeiIdx].trim() : '';
      if (!imei) {
        const potentialImei = cols.find(c => /^\d{14,16}$/.test(c.trim()));
        if (potentialImei) imei = potentialImei.trim();
      }
      if (!imei) continue;

      const cust = custIdx !== -1 && cols[custIdx] !== undefined ? cols[custIdx] : undefined;
      const nricVal = nricIdx !== -1 && cols[nricIdx] !== undefined ? cols[nricIdx] : undefined;
      const sppVal = sppIdx !== -1 && cols[sppIdx] !== undefined ? cols[sppIdx] : undefined;
      const mobileVal = mobileIdx !== -1 && cols[mobileIdx] !== undefined ? cols[mobileIdx] : undefined;
      const remarksVal = remarksIdx !== -1 && cols[remarksIdx] !== undefined ? cols[remarksIdx] : undefined;

      updatesByImei.set(imei.toLowerCase(), {
        customerName: cust,
        nric: nricVal,
        sppOrder: sppVal,
        mobileNumber: mobileVal,
        submissionRemarks: remarksVal
      });
    }

    applyUpdatesFromMap(updatesByImei);
  };

  const parseAndApplyText = (text: string) => {
    const lines = text.split(/\r?\n/).filter(line => line.trim() !== '');
    if (lines.length === 0) return;

    const firstLineCols = parseCsvLine(lines[0]);
    const firstLineLower = lines[0].toLowerCase();

    const isHeaderRow =
      firstLineLower.includes('imei') ||
      firstLineLower.includes('customer') ||
      firstLineLower.includes('nric') ||
      firstLineLower.includes('spp') ||
      firstLineLower.includes('material') ||
      firstLineLower.includes('request code');

    let imeiIdx = -1;
    let custIdx = -1;
    let nricIdx = -1;
    let sppIdx = -1;
    let mobileIdx = -1;
    let remarksIdx = -1;

    if (isHeaderRow) {
      const headers = firstLineCols.map(h => h.toLowerCase().trim());
      const findH = (substr: string) => headers.findIndex(h => h.includes(substr));

      imeiIdx = findH('imei');
      custIdx = findH('customer');
      nricIdx = findH('nric');
      sppIdx = findH('spp');
      mobileIdx = headers.findIndex(h => h.includes('mobile') || h.includes('phone') || h.includes('tel'));
      remarksIdx = headers.findIndex(h => h.includes('remark') || h.includes('submission'));
    } else {
      imeiIdx = 2;
      custIdx = 6;
      nricIdx = 7;
      sppIdx = 8;
      mobileIdx = 9;
      remarksIdx = 10;
    }

    const startIndex = isHeaderRow ? 1 : 0;
    const updatesByImei = new Map<string, {
      customerName?: string;
      nric?: string;
      sppOrder?: string;
      mobileNumber?: string;
      submissionRemarks?: string;
    }>();

    for (let i = startIndex; i < lines.length; i++) {
      const cols = parseCsvLine(lines[i]);
      if (cols.length === 0) continue;

      let imei = imeiIdx !== -1 && cols[imeiIdx] ? cols[imeiIdx].trim() : '';
      if (!imei) {
        const potentialImei = cols.find(c => /^\d{14,16}$/.test(c.trim()));
        if (potentialImei) imei = potentialImei.trim();
      }
      if (!imei) continue;

      const cust = custIdx !== -1 ? cols[custIdx]?.trim() : undefined;
      const nricVal = nricIdx !== -1 ? cols[nricIdx]?.trim() : undefined;
      const sppVal = sppIdx !== -1 ? cols[sppIdx]?.trim() : undefined;
      const mobileVal = mobileIdx !== -1 ? cols[mobileIdx]?.trim() : undefined;
      const remarksVal = remarksIdx !== -1 ? cols[remarksIdx]?.trim() : undefined;

      updatesByImei.set(imei.toLowerCase(), {
        customerName: cust,
        nric: nricVal,
        sppOrder: sppVal,
        mobileNumber: mobileVal,
        submissionRemarks: remarksVal
      });
    }

    applyUpdatesFromMap(updatesByImei);
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
          parseAndApplyExcel(workbook);
        } catch (err) {
          console.error(err);
          setUploadMessage('Failed to parse Excel file. Please ensure it is a valid .xlsx or .xls file.');
        }
      };
      reader.readAsArrayBuffer(file);
    } else {
      const reader = new FileReader();
      reader.onload = (event) => {
        const text = event.target?.result as string;
        if (text) {
          parseAndApplyText(text);
        }
      };
      reader.readAsText(file);
    }

    if (e.target) e.target.value = '';
  };

  return (
    <div id="imei-detail-modal-backdrop" className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
      <div id="imei-detail-modal-card" className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-5xl w-full overflow-hidden flex flex-col max-h-[90vh] animate-in fade-in zoom-in-95 duration-150">
        
        {/* Modal Header */}
        <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-indigo-950 p-5 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-emerald-500/20 rounded-xl text-emerald-400 border border-emerald-500/30">
              <CheckCircle2 className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-bold">Uploaded IMEI Details</h3>
                <span className="px-2 py-0.5 rounded-md text-[11px] font-mono bg-indigo-500/30 text-indigo-200 border border-indigo-400/30 font-semibold">
                  {request.requestCode}
                </span>
                {isSalesRole && (
                  <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-amber-400/20 text-amber-300 border border-amber-400/30">
                    Sales Team Editable
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-300 mt-0.5 flex items-center gap-2">
                <span>{request.partA.eventName}</span>
                <span>•</span>
                <span>{request.partA.state}, {request.partA.region}</span>
              </p>
            </div>
          </div>
          <button
            id="btn-close-imei-detail-modal"
            type="button"
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white rounded-xl hover:bg-white/10 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Info & Stats Banner */}
        <div className="bg-slate-50 border-b border-slate-200 p-4 shrink-0">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            
            <div className="flex items-center gap-6">
              <div className="flex items-center gap-2">
                <Barcode className="w-4 h-4 text-emerald-600" />
                <div>
                  <div className="text-[10px] text-slate-500 uppercase font-bold tracking-wider">Uploaded Status</div>
                  <div className="text-xs font-bold text-slate-900 flex items-center gap-1.5 mt-0.5">
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-800">
                      <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                      Uploaded
                    </span>
                    <span className="text-slate-600 font-semibold">
                      ({recordsState.length} / {totalUnits} devices)
                    </span>
                  </div>
                </div>
              </div>

              <div className="h-8 w-px bg-slate-200 hidden sm:block" />

              <div className="flex items-center gap-2">
                <Tag className="w-4 h-4 text-blue-600" />
                <div>
                  <div className="text-[10px] text-slate-500 uppercase font-bold tracking-wider">Total Value</div>
                  <div className="text-xs font-bold text-slate-900 mt-0.5">
                    {formatRM(totalRrp)}
                  </div>
                </div>
              </div>
            </div>

            {/* Actions & Filter */}
            <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
              <div className="relative flex-1 sm:w-56">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Filter IMEIs or customer details..."
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                  className="w-full pl-8 pr-3 py-1.5 text-xs bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-800"
                />
              </div>

              {isSalesRole && (
                <>
                  <div className="relative" ref={downloadDropdownRef}>
                    <button
                      type="button"
                      id="btn-bulk-download-dropdown"
                      onClick={() => setShowDownloadDropdown(prev => !prev)}
                      disabled={recordsState.length === 0}
                      className="px-3 py-1.5 text-xs font-bold bg-emerald-50 border border-emerald-300 text-emerald-800 hover:bg-emerald-100 rounded-xl flex items-center gap-1.5 transition-colors shrink-0 shadow-2xs cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                      title="Bulk download current IMEI details in CSV or XLSX format"
                    >
                      <Download className="w-3.5 h-3.5 text-emerald-600" />
                      <span>Bulk Download</span>
                      <ChevronDown className={`w-3.5 h-3.5 text-emerald-600 transition-transform ${showDownloadDropdown ? 'rotate-180' : ''}`} />
                    </button>

                    {showDownloadDropdown && (
                      <div className="absolute left-0 mt-1 w-56 bg-white rounded-xl shadow-xl border border-slate-200 py-1.5 z-50 animate-in fade-in zoom-in-95 duration-100">
                        <div className="px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-400 border-b border-slate-100 mb-1">
                          Select Download Format
                        </div>
                        <button
                          type="button"
                          id="btn-download-imei-xlsx"
                          onClick={handleBulkDownloadXlsx}
                          className="w-full px-3 py-2 text-left text-xs hover:bg-emerald-50/80 flex items-center gap-2.5 transition-colors text-slate-800 cursor-pointer group"
                        >
                          <div className="p-1 bg-emerald-100 text-emerald-700 rounded-lg group-hover:bg-emerald-600 group-hover:text-white transition-colors">
                            <FileSpreadsheet className="w-4 h-4" />
                          </div>
                          <div>
                            <div className="font-bold text-slate-900">Excel Format (.xlsx)</div>
                            <div className="text-[10px] text-slate-500">Formatted spreadsheet</div>
                          </div>
                        </button>
                        <button
                          type="button"
                          id="btn-download-imei-csv"
                          onClick={handleBulkDownloadCsv}
                          className="w-full px-3 py-2 text-left text-xs hover:bg-slate-50 flex items-center gap-2.5 transition-colors text-slate-800 cursor-pointer group"
                        >
                          <div className="p-1 bg-slate-100 text-slate-700 rounded-lg group-hover:bg-slate-700 group-hover:text-white transition-colors">
                            <Download className="w-4 h-4" />
                          </div>
                          <div>
                            <div className="font-bold text-slate-900">CSV Format (.csv)</div>
                            <div className="text-[10px] text-slate-500">Standard delimited text</div>
                          </div>
                        </button>
                      </div>
                    )}
                  </div>

                  <button
                    type="button"
                    id="btn-bulk-upload-details"
                    onClick={() => fileInputRef.current?.click()}
                    className="px-3 py-1.5 text-xs font-semibold bg-indigo-50 border border-indigo-200 text-indigo-800 hover:bg-indigo-100 rounded-xl flex items-center gap-1.5 transition-colors shrink-0 shadow-2xs cursor-pointer"
                    title="Bulk upload updated Excel or CSV details"
                  >
                    <Upload className="w-3.5 h-3.5 text-indigo-600" />
                    <span>Bulk Upload</span>
                  </button>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".csv, .txt, .xlsx, .xls"
                    onChange={handleFileUpload}
                    className="hidden"
                  />
                </>
              )}

              {isSalesRole && (
                isEditing ? (
                  <button
                    type="button"
                    onClick={handleSaveChanges}
                    className="px-3 py-1.5 text-xs font-bold bg-emerald-600 text-white hover:bg-emerald-700 rounded-xl flex items-center gap-1.5 transition-colors shrink-0 shadow-2xs cursor-pointer"
                  >
                    <Save className="w-3.5 h-3.5" />
                    <span>Save Changes</span>
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => setIsEditing(true)}
                    className="px-3 py-1.5 text-xs font-semibold bg-indigo-600 text-white hover:bg-indigo-700 rounded-xl flex items-center gap-1.5 transition-colors shrink-0 shadow-2xs cursor-pointer"
                    title="Edit Customer & Order details"
                  >
                    <Edit3 className="w-3.5 h-3.5" />
                    <span>Edit Details</span>
                  </button>
                )
              )}

              <button
                type="button"
                onClick={handleCopyAll}
                disabled={recordsState.length === 0}
                className="px-3 py-1.5 text-xs font-semibold bg-white border border-slate-200 text-slate-700 hover:bg-slate-100 rounded-xl flex items-center gap-1.5 transition-colors shrink-0 shadow-2xs cursor-pointer"
                title="Copy all IMEI numbers"
              >
                {copiedAll ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-600" />
                    <span className="text-emerald-700">Copied!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5 text-slate-500" />
                    <span>Copy All IMEIs</span>
                  </>
                )}
              </button>
            </div>

          </div>
        </div>

        {/* Modal Body / Table */}
        <div className="p-5 overflow-y-auto flex-1 space-y-4">
          {uploadErrorMessage && (
            <div className="bg-rose-50 border border-rose-300 rounded-xl p-3.5 text-xs text-rose-950 flex items-start justify-between gap-3 animate-in fade-in shadow-xs">
              <div className="flex items-start gap-2.5">
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                <div className="space-y-0.5">
                  <div className="font-bold text-rose-900">Upload Validation Error</div>
                  <div className="text-rose-800 leading-relaxed font-medium">{uploadErrorMessage}</div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setUploadErrorMessage(null)}
                className="p-1 text-rose-700 hover:text-rose-900 rounded-md hover:bg-rose-100 cursor-pointer shrink-0"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {uploadMessage && (
            <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 text-xs text-emerald-900 flex items-center justify-between animate-in fade-in">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span className="font-semibold">{uploadMessage}</span>
              </div>
              <button
                type="button"
                onClick={() => setUploadMessage(null)}
                className="p-1 text-emerald-700 hover:text-emerald-900 rounded-md hover:bg-emerald-100 cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {isEditing && (
            <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-3 text-xs text-indigo-900 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Edit3 className="w-4 h-4 text-indigo-600 shrink-0" />
                <span>
                  <strong>Sales Team Edit Mode:</strong> You can edit Customer Name, NRIC No, SPP Order No, Mobile No, and Submission Remarks below or use <strong>Bulk Upload</strong>. Duplicate SPP Order No and Mobile No will be validated.
                </span>
              </div>
              <span className="text-[11px] text-indigo-700 font-semibold bg-indigo-100 px-2 py-0.5 rounded-md shrink-0">
                IMEI & Material details are locked
              </span>
            </div>
          )}

          {filteredRecords.length === 0 ? (
            <div className="py-12 text-center space-y-2">
              <Barcode className="w-10 h-10 text-slate-300 mx-auto" />
              <p className="text-slate-600 text-xs font-semibold">No IMEI records found.</p>
              <p className="text-slate-400 text-[11px]">
                {searchTerm ? 'Try adjusting your filter keyword.' : 'No IMEIs have been assigned to this request yet.'}
              </p>
            </div>
          ) : (
            <div className="border border-slate-200 rounded-xl overflow-hidden shadow-2xs">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200">
                  <tr>
                    <th className="py-3 px-3.5 w-10 text-center">#</th>
                    <th className="py-3 px-3.5">
                      Device IMEI Number
                      {isEditing && <Lock className="w-3 h-3 inline ml-1 text-slate-400" title="Read-only" />}
                    </th>
                    <th className="py-3 px-3.5">
                      Material & Model Description
                      {isEditing && <Lock className="w-3 h-3 inline ml-1 text-slate-400" title="Read-only" />}
                    </th>
                    <th className="py-3 px-3.5">
                      RRP (RM)
                      {isEditing && <Lock className="w-3 h-3 inline ml-1 text-slate-400" title="Read-only" />}
                    </th>
                    <th className="py-3 px-3.5">
                      Customer Name
                      {isEditing && <span className="text-indigo-600 font-normal text-[10px] ml-1">(Editable)</span>}
                    </th>
                    <th className="py-3 px-3.5">
                      NRIC No
                      {isEditing && <span className="text-indigo-600 font-normal text-[10px] ml-1">(Editable)</span>}
                    </th>
                    <th className="py-3 px-3.5">
                      SPP Order No
                      {isEditing && <span className="text-indigo-600 font-normal text-[10px] ml-1">(Editable)</span>}
                    </th>
                    <th className="py-3 px-3.5">
                      Mobile No
                      {isEditing && <span className="text-indigo-600 font-normal text-[10px] ml-1">(Editable)</span>}
                    </th>
                    <th className="py-3 px-3.5">
                      Submission Remarks
                      {isEditing && <span className="text-indigo-600 font-normal text-[10px] ml-1">(Editable)</span>}
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 bg-white">
                  {filteredRecords.map((item, index) => {
                    const isDuplicateSpp = Boolean(item.sppOrder && duplicateSppSet.has(item.sppOrder.trim().toLowerCase()));
                    const isDuplicatePhone = Boolean(item.mobileNumber && duplicatePhoneSet.has(normalizePhoneNumber(item.mobileNumber)));

                    return (
                      <tr key={`${item.id || 'rec'}-${index}`} className="hover:bg-slate-50 transition-colors">
                        <td className="py-3 px-3.5 text-center text-slate-400 font-medium text-[11px]">
                          {index + 1}
                        </td>
                        <td className="py-3 px-3.5">
                          <div className="flex items-center gap-1.5">
                            <span className="font-mono font-bold text-slate-900 bg-slate-100 px-2 py-1 rounded border border-slate-200 text-xs select-all">
                              {item.imei}
                            </span>
                            <button
                              type="button"
                              onClick={() => handleCopySingle(item.id, item.imei)}
                              className="p-1 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded transition-colors"
                              title="Copy IMEI"
                            >
                              {copiedId === item.id ? (
                                <Check className="w-3.5 h-3.5 text-emerald-600" />
                              ) : (
                                <Copy className="w-3.5 h-3.5" />
                              )}
                            </button>
                          </div>
                        </td>
                        <td className="py-3 px-3.5">
                          <div className="font-bold text-slate-900">{item.description}</div>
                          <div className="text-[11px] font-mono text-slate-500">{item.material}</div>
                        </td>
                        <td className="py-3 px-3.5 font-bold text-slate-800">
                          {formatRM(item.rrpRM)}
                        </td>
                        <td className="py-3 px-3.5">
                          {isEditing ? (
                            <input
                              type="text"
                              value={item.customerName || ''}
                              onChange={e => handleFieldChange(item.id, 'customerName', e.target.value)}
                              placeholder="Customer Name"
                              className="w-full min-w-[110px] px-2 py-1 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 font-medium text-slate-900 bg-white"
                            />
                          ) : item.customerName ? (
                            <div className="font-bold text-slate-900 flex items-center gap-1">
                              <UserIcon className="w-3 h-3 text-slate-400 shrink-0" />
                              <span>{item.customerName}</span>
                            </div>
                          ) : (
                            <span className="text-slate-400 italic text-[11px]">-</span>
                          )}
                        </td>
                        <td className="py-3 px-3.5">
                          {isEditing ? (
                            <input
                              type="text"
                              value={item.nric || ''}
                              onChange={e => handleFieldChange(item.id, 'nric', e.target.value)}
                              placeholder="NRIC No"
                              className="w-full min-w-[100px] px-2 py-1 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono text-slate-900 bg-white"
                            />
                          ) : item.nric ? (
                            <span className="font-mono text-slate-800 text-[11px]">
                              {item.nric}
                            </span>
                          ) : (
                            <span className="text-slate-400 italic text-[11px]">-</span>
                          )}
                        </td>
                        <td className="py-3 px-3.5">
                          {isEditing ? (
                            <div className="space-y-1">
                              <input
                                type="text"
                                value={item.sppOrder || ''}
                                onChange={e => handleFieldChange(item.id, 'sppOrder', e.target.value)}
                                placeholder="SPP Order No"
                                className={`w-full min-w-[100px] px-2 py-1 text-xs border rounded-lg focus:outline-none font-mono font-semibold transition-colors ${
                                  isDuplicateSpp
                                    ? 'border-rose-400 bg-rose-50 text-rose-800 ring-2 ring-rose-300'
                                    : 'border-slate-300 focus:ring-2 focus:ring-indigo-500 text-indigo-700 bg-white'
                                }`}
                              />
                              {isDuplicateSpp && (
                                <span className="inline-block text-[10px] font-bold text-rose-700 bg-rose-100 px-1.5 py-0.5 rounded border border-rose-300">
                                  Duplicate SPP
                                </span>
                              )}
                            </div>
                          ) : item.sppOrder ? (
                            <div className="flex items-center gap-1.5">
                              <span className={`font-mono text-[11px] font-semibold ${isDuplicateSpp ? 'text-rose-700' : 'text-indigo-700'}`}>
                                {item.sppOrder}
                              </span>
                              {isDuplicateSpp && (
                                <span className="text-[10px] font-bold text-rose-700 bg-rose-100 px-1 py-0.2 rounded border border-rose-300">
                                  Duplicate
                                </span>
                              )}
                            </div>
                          ) : (
                            <span className="text-slate-400 italic text-[11px]">-</span>
                          )}
                        </td>
                        <td className="py-3 px-3.5">
                          {isEditing ? (
                            <div className="space-y-1">
                              <input
                                type="text"
                                value={item.mobileNumber || ''}
                                onChange={e => handleFieldChange(item.id, 'mobileNumber', e.target.value)}
                                placeholder="Mobile No"
                                className={`w-full min-w-[100px] px-2 py-1 text-xs border rounded-lg focus:outline-none font-medium transition-colors ${
                                  isDuplicatePhone
                                    ? 'border-rose-400 bg-rose-50 text-rose-800 ring-2 ring-rose-300'
                                    : 'border-slate-300 focus:ring-2 focus:ring-indigo-500 text-slate-900 bg-white'
                                }`}
                              />
                              {isDuplicatePhone && (
                                <span className="inline-block text-[10px] font-bold text-rose-700 bg-rose-100 px-1.5 py-0.5 rounded border border-rose-300">
                                  Duplicate Mobile
                                </span>
                              )}
                            </div>
                          ) : item.mobileNumber ? (
                            <div className="text-[11px] text-slate-700 font-medium flex items-center gap-1">
                              <Phone className="w-3 h-3 text-slate-400 shrink-0" />
                              <span className={isDuplicatePhone ? 'text-rose-700 font-bold' : ''}>{item.mobileNumber}</span>
                              {isDuplicatePhone && (
                                <span className="text-[10px] font-bold text-rose-700 bg-rose-100 px-1 py-0.2 rounded border border-rose-300 ml-1">
                                  Duplicate
                                </span>
                              )}
                            </div>
                          ) : (
                            <span className="text-slate-400 italic text-[11px]">-</span>
                          )}
                        </td>
                        <td className="py-3 px-3.5 text-[11px] text-slate-600 max-w-xs">
                          {isEditing ? (
                            <input
                              type="text"
                              value={item.submissionRemarks || ''}
                              onChange={e => handleFieldChange(item.id, 'submissionRemarks', e.target.value)}
                              placeholder="Submission Remarks"
                              className="w-full min-w-[120px] px-2 py-1 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-900 bg-white"
                            />
                          ) : item.submissionRemarks ? (
                            <div className="flex items-start gap-1">
                              <FileText className="w-3 h-3 text-slate-400 shrink-0 mt-0.5" />
                              <span>{item.submissionRemarks}</span>
                            </div>
                          ) : (
                            <span className="text-slate-400 italic">-</span>
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

        {/* Modal Footer */}
        <div className="bg-slate-50 border-t border-slate-200 p-4 shrink-0 flex items-center justify-between">
          <div className="text-xs text-slate-500">
            Showing <strong className="text-slate-800">{filteredRecords.length}</strong> of{' '}
            <strong className="text-slate-800">{recordsState.length}</strong> IMEI records for{' '}
            <span className="font-semibold text-slate-800">{request.requestCode}</span>
          </div>

          <div className="flex items-center gap-2">
            {isSaveSuccess && (
              <span className="text-emerald-600 font-bold text-xs flex items-center gap-1 bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-200 animate-in fade-in">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                Saved Successfully!
              </span>
            )}

            {isEditing ? (
              <>
                <button
                  type="button"
                  onClick={() => {
                    if (request) setRecordsState(extractImeiRecordsForRequest(request, imeiInventory));
                    setIsEditing(false);
                  }}
                  className="px-3.5 py-2 text-xs font-semibold bg-white border border-slate-300 text-slate-700 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSaveChanges}
                  className="px-4 py-2 text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl transition-colors shadow-2xs flex items-center gap-1.5 cursor-pointer"
                >
                  <Save className="w-4 h-4" />
                  <span>Save Changes</span>
                </button>
              </>
            ) : isSalesRole ? (
              <button
                type="button"
                onClick={() => setIsEditing(true)}
                className="px-4 py-2 text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl transition-colors shadow-2xs flex items-center gap-1.5 cursor-pointer"
              >
                <Edit3 className="w-4 h-4" />
                <span>Edit IMEI Details</span>
              </button>
            ) : null}

            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold bg-slate-800 text-white hover:bg-slate-900 rounded-xl transition-colors shadow-2xs cursor-pointer"
            >
              Close
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};

