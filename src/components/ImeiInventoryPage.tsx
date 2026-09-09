import React, { useState, useMemo, useEffect } from 'react';
import * as XLSX from 'xlsx';
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
  Eye,
  ChevronLeft,
  ChevronRight,
  UserCheck,
  Users,
  Phone,
  CreditCard,
  ChevronDown,
  ChevronUp,
  ShieldCheck,
  Sparkles
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
  const [currentPage, setCurrentPage] = useState<number>(1);
  const ITEMS_PER_PAGE = 10;

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

  // Reset to page 1 on filter or search changes
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, materialFilter]);

  const totalPages = Math.ceil(filteredList.length / ITEMS_PER_PAGE) || 1;
  const safeCurrentPage = Math.min(Math.max(1, currentPage), totalPages);
  const startIndex = (safeCurrentPage - 1) * ITEMS_PER_PAGE;
  const paginatedList = filteredList.slice(startIndex, startIndex + ITEMS_PER_PAGE);

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

  // Completed Customer Registration state
  const [customerSearchTerm, setCustomerSearchTerm] = useState('');
  const [customerRequestFilter, setCustomerRequestFilter] = useState<string>('ALL');
  const [customerCurrentPage, setCustomerCurrentPage] = useState<number>(1);
  const [customerViewMode, setCustomerViewMode] = useState<'table' | 'grouped'>('grouped');
  const [expandedRoadshowIds, setExpandedRoadshowIds] = useState<string[]>([]);

  // Export Dropdown states
  const [exportDropdownOpen, setExportDropdownOpen] = useState<boolean>(false);
  const [customerExportDropdownOpen, setCustomerExportDropdownOpen] = useState<boolean>(false);

  // Statistics
  const stats = useMemo(() => {
    const total = imeiList.length;
    const assigned = imeiList.filter(i => !!i.requestCode).length;
    const unassigned = total - assigned;
    const pendingUploadCount = pendingUploadRequests.length;
    const uniqueModels = materialOptions.length;
    return { total, assigned, unassigned, pendingUploadCount, uniqueModels };
  }, [imeiList, materialOptions, pendingUploadRequests]);

  // Comprehensive extraction and counting of Completed Customer Registration Info
  // STRICT RULE: Only show roadshows with status 'Approved' (HOO Approved) and where IMEI is already uploaded
  const completedCustomerRecords = useMemo(() => {
    const list: Array<{
      id: string;
      imei: string;
      material: string;
      description: string;
      rrpRM: number;
      requestCode: string;
      requestId?: string;
      eventName: string;
      requestorName: string;
      region: string;
      state: string;
      customerName: string;
      nric: string;
      sppOrder: string;
      mobileNumber: string;
      submissionRemarks?: string;
      status: string;
      updatedAt?: string;
      sourceItem?: ImeiInventoryItem;
    }> = [];
    const seenImeis = new Set<string>();

    // 1. Scan imeiList for items with complete customer registration fields
    imeiList.forEach((item, index) => {
      const imei = (item.imei || '').trim();
      const cName = (item.customerName || '').trim();
      const nric = (item.nric || '').trim();
      const spp = (item.sppOrder || '').trim();
      const mobile = (item.mobileNumber || '').trim();

      // Customer registration is complete when all 4 customer fields + uploaded IMEI are present
      const isComplete = Boolean(cName && nric && spp && mobile && imei);
      if (!isComplete) return;

      // Find the associated roadshow request
      const req = requests.find(
        r => (item.requestCode && r.requestCode && r.requestCode.trim().toLowerCase() === item.requestCode.trim().toLowerCase()) ||
             (item.requestId && r.id === item.requestId)
      );

      // ONLY include if the roadshow order status is already Approved
      if (!req || req.status !== 'Approved') {
        return;
      }

      if (!seenImeis.has(imei.toLowerCase())) {
        seenImeis.add(imei.toLowerCase());

        list.push({
          id: item.id || `comp-cust-${imei}-${index}`,
          imei,
          material: item.material || req.partB?.find(b => (b.imei || '').includes(imei))?.material || 'N/A',
          description: item.description || req.partB?.find(b => (b.imei || '').includes(imei))?.description || 'Roadshow Mobile Device',
          rrpRM: item.rrpRM || req.partB?.find(b => (b.imei || '').includes(imei))?.rrpRM || 0,
          requestCode: item.requestCode || req.requestCode || 'Unassigned',
          requestId: item.requestId || req.id,
          eventName: item.eventName || req.partA?.eventName || 'Roadshow Event',
          requestorName: item.requestorName || req.createdByName || req.partA?.requestor || '—',
          region: item.region || req.partA?.region || '—',
          state: item.state || req.partA?.state || '—',
          customerName: cName,
          nric,
          sppOrder: spp,
          mobileNumber: mobile,
          submissionRemarks: item.submissionRemarks || 'Verified & Delivered',
          status: 'HOO Approved',
          updatedAt: item.updatedAt,
          sourceItem: item
        });
      }
    });

    // 2. Scan requests.partB for any direct customer registration entries from Approved requests
    requests.forEach(req => {
      // ONLY include roadshow requests that are already Approved
      if (req.status !== 'Approved') return;

      (req.partB || []).forEach((item, bIdx) => {
        const cName = (item.customerName || '').trim();
        const nric = (item.nric || '').trim();
        const spp = (item.sppOrder || '').trim();
        const mobile = (item.mobileNumber || '').trim();

        // Must have all 4 customer fields AND uploaded IMEI
        if (cName && nric && spp && mobile && item.imei && item.imei.trim()) {
          const imeiTokens = item.imei.split(',').map(s => s.trim()).filter(Boolean);
          imeiTokens.forEach((imeiStr, tokenIdx) => {
            if (!seenImeis.has(imeiStr.toLowerCase())) {
              seenImeis.add(imeiStr.toLowerCase());
              list.push({
                id: `comp-partb-${req.id}-${bIdx}-${tokenIdx}-${imeiStr}`,
                imei: imeiStr,
                material: item.material || 'N/A',
                description: item.description || 'Roadshow Mobile Device',
                rrpRM: item.rrpRM || 0,
                requestCode: req.requestCode,
                requestId: req.id,
                eventName: req.partA?.eventName || 'Roadshow Event',
                requestorName: req.createdByName || req.partA?.requestor || '—',
                region: req.partA?.region || '—',
                state: req.partA?.state || '—',
                customerName: cName,
                nric,
                sppOrder: spp,
                mobileNumber: mobile,
                submissionRemarks: item.submissionRemarks || 'Verified & Delivered',
                status: 'HOO Approved'
              });
            }
          });
        }
      });
    });

    return list;
  }, [imeiList, requests]);

  // Unique request options for customer registration filter (only from approved requests)
  const customerRequestOptions = useMemo(() => {
    const map = new Map<string, string>();
    completedCustomerRecords.forEach(rec => {
      if (rec.requestCode && rec.requestCode !== 'Unassigned') {
        map.set(rec.requestCode, `${rec.requestCode} - ${rec.eventName}`);
      }
    });
    return Array.from(map.entries());
  }, [completedCustomerRecords]);

  // Filtered Completed Customer Registrations
  const filteredCustomerRecords = useMemo(() => {
    return completedCustomerRecords.filter(rec => {
      const matchesReq =
        customerRequestFilter === 'ALL' || rec.requestCode === customerRequestFilter;

      const q = customerSearchTerm.toLowerCase().trim();
      if (!q) return matchesReq;

      const matchesQuery =
        rec.customerName.toLowerCase().includes(q) ||
        rec.nric.toLowerCase().includes(q) ||
        rec.sppOrder.toLowerCase().includes(q) ||
        rec.mobileNumber.toLowerCase().includes(q) ||
        rec.imei.toLowerCase().includes(q) ||
        rec.material.toLowerCase().includes(q) ||
        rec.description.toLowerCase().includes(q) ||
        rec.requestCode.toLowerCase().includes(q) ||
        rec.eventName.toLowerCase().includes(q) ||
        rec.requestorName.toLowerCase().includes(q) ||
        rec.region.toLowerCase().includes(q) ||
        rec.state.toLowerCase().includes(q) ||
        (rec.submissionRemarks && rec.submissionRemarks.toLowerCase().includes(q));

      return matchesReq && matchesQuery;
    });
  }, [completedCustomerRecords, customerSearchTerm, customerRequestFilter]);

  // Reset customer page on search/filter change
  useEffect(() => {
    setCustomerCurrentPage(1);
  }, [customerSearchTerm, customerRequestFilter]);

  const customerTotalPages = Math.ceil(filteredCustomerRecords.length / ITEMS_PER_PAGE) || 1;
  const customerSafePage = Math.min(Math.max(1, customerCurrentPage), customerTotalPages);
  const customerStartIndex = (customerSafePage - 1) * ITEMS_PER_PAGE;
  const paginatedCustomerRecords = filteredCustomerRecords.slice(customerStartIndex, customerStartIndex + ITEMS_PER_PAGE);

  // Grouped Roadshow Customer Summaries: Only show Approved roadshows where IMEI is uploaded
  const roadshowCustomerSummaries = useMemo(() => {
    const map = new Map<string, {
      req: RoadshowRequest;
      requestCode: string;
      eventName: string;
      region: string;
      state: string;
      requestorName: string;
      totalUnits: number;
      uploadedCount: number;
      completedCount: number;
      completedRecords: typeof completedCustomerRecords;
      completionRate: number;
    }>();

    requests.forEach(req => {
      // 1. MUST be already Approved
      if (req.status !== 'Approved') return;

      const { uploadedCount, totalUnits } = getRequestImeiStats(req);
      // 2. MUST have IMEI already uploaded
      if (uploadedCount === 0) return;

      // Filter based on active request filter
      if (customerRequestFilter !== 'ALL' && req.requestCode !== customerRequestFilter) {
        return;
      }

      const reqRecords = filteredCustomerRecords.filter(
        c => (req.requestCode && c.requestCode === req.requestCode) || (c.requestId && c.requestId === req.id)
      );

      // If there's a search term, only show roadshows matching search or having matching records
      const q = customerSearchTerm.toLowerCase().trim();
      if (q) {
        const matchesRoadshowDirectly =
          (req.requestCode || '').toLowerCase().includes(q) ||
          (req.partA?.eventName || '').toLowerCase().includes(q) ||
          (req.partA?.region || '').toLowerCase().includes(q) ||
          (req.partA?.state || '').toLowerCase().includes(q) ||
          (req.createdByName || '').toLowerCase().includes(q) ||
          (req.partA?.requestor || '').toLowerCase().includes(q);

        if (!matchesRoadshowDirectly && reqRecords.length === 0) {
          return;
        }
      }

      map.set(req.id, {
        req,
        requestCode: req.requestCode,
        eventName: req.partA?.eventName || 'Roadshow Event',
        region: req.partA?.region || '—',
        state: req.partA?.state || '—',
        requestorName: req.createdByName || req.partA?.requestor || '—',
        totalUnits: Math.max(totalUnits, uploadedCount),
        uploadedCount,
        completedCount: reqRecords.length,
        completedRecords: reqRecords,
        completionRate: uploadedCount > 0 ? Math.round((reqRecords.length / uploadedCount) * 100) : 0
      });
    });

    return Array.from(map.values()).sort((a, b) => b.completedCount - a.completedCount);
  }, [requests, filteredCustomerRecords, imeiList, customerRequestFilter, customerSearchTerm]);

  // Count metrics for customer registrations (based on Approved roadshows with uploaded IMEIs)
  const customerMetrics = useMemo(() => {
    const totalCompleted = completedCustomerRecords.length;
    const uniqueReqs = new Set(completedCustomerRecords.map(r => r.requestCode).filter(c => c && c !== 'Unassigned')).size;
    const totalValueRM = completedCustomerRecords.reduce((sum, r) => sum + (r.rrpRM || 0), 0);
    
    // Total uploaded IMEIs in approved roadshow requests
    const totalApprovedUploadedImeis = requests
      .filter(r => r.status === 'Approved')
      .reduce((sum, r) => sum + getRequestImeiStats(r).uploadedCount, 0);

    const completionRate = totalApprovedUploadedImeis > 0 
      ? Math.round((totalCompleted / totalApprovedUploadedImeis) * 100) 
      : (totalCompleted > 0 ? 100 : 0);

    return {
      totalCompleted,
      uniqueReqs,
      totalValueRM,
      totalApprovedUploadedImeis,
      completionRate
    };
  }, [completedCustomerRecords, requests, imeiList]);

  // Toggle accordion in grouped roadshow view
  const toggleRoadshowExpand = (reqId: string) => {
    setExpandedRoadshowIds(prev =>
      prev.includes(reqId) ? prev.filter(id => id !== reqId) : [...prev, reqId]
    );
  };

  // Expand / Collapse all roadshows in grouped view
  const toggleExpandAllRoadshows = () => {
    if (expandedRoadshowIds.length === roadshowCustomerSummaries.length) {
      setExpandedRoadshowIds([]);
    } else {
      setExpandedRoadshowIds(roadshowCustomerSummaries.map(s => s.req.id));
    }
  };

  // Handle Export Completed Customer Registration Info CSV
  const handleExportCompletedCustomerCsv = () => {
    let csv = `No,Customer_Name,NRIC,SPP_Order_No,Mobile_Number,Device_IMEI,Material_Code,Device_Description,RRP_RM,Request_Code,Event_Name,Requestor,Region,State,Submission_Remarks,Status\n`;
    filteredCustomerRecords.forEach((item, idx) => {
      const num = idx + 1;
      const custEsc = `"${item.customerName.replace(/"/g, '""')}"`;
      const nricEsc = `"${item.nric.replace(/"/g, '""')}"`;
      const sppEsc = `"${item.sppOrder.replace(/"/g, '""')}"`;
      const mobileEsc = `"${item.mobileNumber.replace(/"/g, '""')}"`;
      const imeiEsc = `"${item.imei}"`;
      const matEsc = `"${item.material}"`;
      const descEsc = `"${item.description.replace(/"/g, '""')}"`;
      const rrp = item.rrpRM || 0;
      const reqCodeEsc = `"${item.requestCode}"`;
      const eventEsc = `"${item.eventName.replace(/"/g, '""')}"`;
      const reqNameEsc = `"${item.requestorName.replace(/"/g, '""')}"`;
      const regionEsc = `"${item.region}"`;
      const stateEsc = `"${item.state}"`;
      const remarksEsc = `"${(item.submissionRemarks || '').replace(/"/g, '""')}"`;
      const statusEsc = `"${item.status}"`;

      csv += `${num},${custEsc},${nricEsc},${sppEsc},${mobileEsc},${imeiEsc},${matEsc},${descEsc},${rrp},${reqCodeEsc},${eventEsc},${reqNameEsc},${regionEsc},${stateEsc},${remarksEsc},${statusEsc}\n`;
    });

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `Completed_Customer_Registration_Info_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setCustomerExportDropdownOpen(false);
  };

  // Handle Export Completed Customer Registration Info XLSX
  const handleExportCompletedCustomerXlsx = () => {
    const rows = filteredCustomerRecords.map((item, idx) => ({
      'No': idx + 1,
      'Customer Name': item.customerName,
      'NRIC': item.nric,
      'SPP Order No': item.sppOrder,
      'Mobile Contact Number': item.mobileNumber,
      'Device IMEI': item.imei,
      'Material Code': item.material,
      'Model Description': item.description,
      'RRP (RM)': item.rrpRM || 0,
      'Roadshow Request Code': item.requestCode,
      'Event Name': item.eventName,
      'Requestor': item.requestorName,
      'Region': item.region,
      'State': item.state,
      'Submission Remarks': item.submissionRemarks || 'Verified & Delivered',
      'Status': item.status
    }));

    const worksheet = XLSX.utils.json_to_sheet(rows);
    worksheet['!cols'] = [
      { wch: 6 },
      { wch: 24 },
      { wch: 18 },
      { wch: 18 },
      { wch: 20 },
      { wch: 20 },
      { wch: 16 },
      { wch: 32 },
      { wch: 12 },
      { wch: 22 },
      { wch: 26 },
      { wch: 20 },
      { wch: 12 },
      { wch: 16 },
      { wch: 28 },
      { wch: 16 }
    ];

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Customer Registrations');
    XLSX.writeFile(workbook, `Completed_Customer_Registration_Info_${new Date().toISOString().slice(0, 10)}.xlsx`);
    setCustomerExportDropdownOpen(false);
  };

  // Handle Export CSV
  const handleExportCsv = () => {
    let csv = `IMEI,Material,Description,RRP_RM,Request_Code,Event_Name,Requestor,Region,State,Customer_Name,NRIC,SPP_Order,Mobile_Number,Remarks,Status\n`;
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
      const statusEsc = `"${item.status || ''}"`;

      csv += `${imeiEsc},${matEsc},${descEsc},${item.rrpRM},${reqCodeEsc},${eventEsc},${reqNameEsc},${regionEsc},${stateEsc},${custEsc},${nricEsc},${sppEsc},${mobileEsc},${remarksEsc},${statusEsc}\n`;
    });

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `IMEI_Inventory_Report_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setExportDropdownOpen(false);
  };

  // Handle Export XLSX
  const handleExportXlsx = () => {
    const rows = filteredList.map((item, idx) => ({
      'No': idx + 1,
      'Device IMEI': item.imei,
      'Material Code': item.material,
      'Device Description': item.description,
      'RRP (RM)': item.rrpRM || 0,
      'Roadshow Request Code': item.requestCode || 'Unassigned',
      'Event Name': item.eventName || '—',
      'Requestor': item.requestorName || '—',
      'Region': item.region || '—',
      'State': item.state || '—',
      'Customer Name': item.customerName || '—',
      'NRIC': item.nric || '—',
      'SPP Order No': item.sppOrder || '—',
      'Mobile Contact Number': item.mobileNumber || '—',
      'Status': item.status,
      'Submission Remarks': item.submissionRemarks || '—',
      'Last Updated': item.updatedAt ? new Date(item.updatedAt).toLocaleString() : '—'
    }));

    const worksheet = XLSX.utils.json_to_sheet(rows);
    worksheet['!cols'] = [
      { wch: 6 },
      { wch: 20 },
      { wch: 16 },
      { wch: 32 },
      { wch: 12 },
      { wch: 22 },
      { wch: 28 },
      { wch: 20 },
      { wch: 12 },
      { wch: 16 },
      { wch: 24 },
      { wch: 18 },
      { wch: 18 },
      { wch: 20 },
      { wch: 18 },
      { wch: 28 },
      { wch: 22 }
    ];

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'IMEI Inventory');
    XLSX.writeFile(workbook, `IMEI_Inventory_Report_${new Date().toISOString().slice(0, 10)}.xlsx`);
    setExportDropdownOpen(false);
  };

  // Handle Save Single Add
  const handleSaveNewItem = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newItem.imei || !newItem.material || !newItem.description) {
      alert('IMEI Number, Material Code, and Description are required.');
      return;
    }

    const cleanImei = newItem.imei.trim();
    // Check if IMEI is already registered
    const existing = imeiList.find(
      it => it.imei && it.imei.trim().toLowerCase() === cleanImei.toLowerCase()
    );
    if (existing) {
      alert(`Duplicate Device IMEI No: "${cleanImei}" already exists in inventory (assigned to ${existing.requestCode ? `Request ${existing.requestCode}` : 'Stock'}). Each device IMEI must be unique.`);
      return;
    }

    const created: ImeiInventoryItem = {
      id: `imei-user-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      imei: cleanImei,
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

  // Download CSV Template for IMEI Inventory
  const handleDownloadTemplateCsv = () => {
    const headers = "Request Code,Requestor Name,Event Name,Material,Descriptions,RRP (RM),Device IMEI No,Customer Name,NRIC,SPP Order,Mobile Number,Submission Remarks,Region,State,Status\n";
    const rows = [
      `"RDR-2026-0001","MUHAMMAD RAZIF BIN ABDUL RASHID","MAHA Pahang 2026","20017453","HP-SAMSUNG-A07 5G 8+256GB-BLK",1029,"869123048571210","Ahmad Zaki","900101-14-5521","SPP-88219","0123456789","Roadshow allocation","East Coast","Pahang","Unassigned Stock"`,
      `"RDR-2026-0001","MUHAMMAD RAZIF BIN ABDUL RASHID","MAHA Pahang 2026","20018081","HP-SAMSUNG-A27 5G 8+256GB-BLK",1499,"869123048571211","Siti Aminah","920315-10-5112","SPP-88220","0198765432","Roadshow allocation","East Coast","Pahang","Unassigned Stock"`,
      `"","","","20018082","HP-SAMSUNG-S24 ULTRA 512GB-GRY",6299,"869123048571212","","","","","Buffer stock","Central","Selangor","Unassigned Stock"`
    ].join('\n');

    const csvData = headers + rows + '\n';
    const blob = new Blob([csvData], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', 'imei_inventory_template.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Download Excel (.xlsx) Template for IMEI Inventory
  const handleDownloadTemplateXlsx = () => {
    const sampleData = [
      {
        'Request Code': 'RDR-2026-0001',
        'Requestor Name': 'MUHAMMAD RAZIF BIN ABDUL RASHID',
        'Event Name': 'MAHA Pahang 2026',
        'Material': '20017453',
        'Descriptions': 'HP-SAMSUNG-A07 5G 8+256GB-BLK',
        'RRP (RM)': 1029,
        'Device IMEI No': '869123048571210',
        'Customer Name': 'Ahmad Zaki',
        'NRIC': '900101-14-5521',
        'SPP Order': 'SPP-88219',
        'Mobile Number': '0123456789',
        'Submission Remarks': 'Roadshow allocation',
        'Region': 'East Coast',
        'State': 'Pahang',
        'Status': 'Unassigned Stock'
      },
      {
        'Request Code': 'RDR-2026-0001',
        'Requestor Name': 'MUHAMMAD RAZIF BIN ABDUL RASHID',
        'Event Name': 'MAHA Pahang 2026',
        'Material': '20018081',
        'Descriptions': 'HP-SAMSUNG-A27 5G 8+256GB-BLK',
        'RRP (RM)': 1499,
        'Device IMEI No': '869123048571211',
        'Customer Name': 'Siti Aminah',
        'NRIC': '920315-10-5112',
        'SPP Order': 'SPP-88220',
        'Mobile Number': '0198765432',
        'Submission Remarks': 'Roadshow allocation',
        'Region': 'East Coast',
        'State': 'Pahang',
        'Status': 'Unassigned Stock'
      },
      {
        'Request Code': '',
        'Requestor Name': '',
        'Event Name': '',
        'Material': '20018082',
        'Descriptions': 'HP-SAMSUNG-S24 ULTRA 512GB-GRY',
        'RRP (RM)': 6299,
        'Device IMEI No': '869123048571212',
        'Customer Name': '',
        'NRIC': '',
        'SPP Order': '',
        'Mobile Number': '',
        'Submission Remarks': 'Buffer stock',
        'Region': 'Central',
        'State': 'Selangor',
        'Status': 'Unassigned Stock'
      }
    ];

    const worksheet = XLSX.utils.json_to_sheet(sampleData);
    worksheet['!cols'] = [
      { wch: 18 },
      { wch: 32 },
      { wch: 22 },
      { wch: 14 },
      { wch: 32 },
      { wch: 12 },
      { wch: 20 },
      { wch: 18 },
      { wch: 18 },
      { wch: 16 },
      { wch: 16 },
      { wch: 24 },
      { wch: 14 },
      { wch: 14 },
      { wch: 18 }
    ];

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'IMEI_Template');
    XLSX.writeFile(workbook, 'imei_inventory_template.xlsx');
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
        id: `imei-bulk-${Date.now()}-${i}-${cleanImei}-${Math.random().toString(36).slice(2, 6)}`,
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
          setBulkCsvText(csvText);
          const items = parseBulkTextToItems(csvText);
          setParsedItemsPreview(items);
          if (items.length === 0) {
            setBulkErrorMsg('No valid IMEI records found in the uploaded Excel file. Please verify the column headers match the template.');
          }
        } catch (err) {
          console.error(err);
          setBulkErrorMsg('Failed to parse the Excel file. Please ensure it is a valid .xlsx or .xls file.');
        }
      };
      reader.onerror = () => {
        setBulkErrorMsg('Failed to read uploaded Excel file.');
      };
      reader.readAsArrayBuffer(file);
    } else {
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
    }
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

    // Validate duplicate IMEI numbers within the uploaded records
    const counts = new Map<string, number>();
    recordsToImport.forEach(rec => {
      const imeiKey = (rec.imei || '').trim().toLowerCase();
      if (imeiKey) {
        counts.set(imeiKey, (counts.get(imeiKey) || 0) + 1);
      }
    });

    const batchDuplicates: string[] = [];
    counts.forEach((cnt, imei) => {
      if (cnt > 1) batchDuplicates.push(imei);
    });

    if (batchDuplicates.length > 0) {
      setBulkErrorMsg(`Duplicate Device IMEI No detected in file: ${batchDuplicates.slice(0, 3).map(d => `"${d}"`).join(', ')}${batchDuplicates.length > 3 ? ` and ${batchDuplicates.length - 3} more` : ''}. Each device must have a unique IMEI.`);
      return;
    }

    // Check duplicates against current inventory
    const existingImeis = new Set(imeiList.map(it => (it.imei || '').trim().toLowerCase()));
    const systemDupes = recordsToImport.filter(rec => rec.imei && existingImeis.has(rec.imei.trim().toLowerCase()));

    if (systemDupes.length > 0) {
      setBulkErrorMsg(`Duplicate Device IMEI No detected: ${systemDupes.slice(0, 3).map(d => `"${d.imei}"`).join(', ')}${systemDupes.length > 3 ? ` and ${systemDupes.length - 3} more` : ''} already exist in the IMEI Inventory.`);
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
          {/* Export CSV & XLSX Dropdown */}
          <div className="relative">
            <button
              id="btn-export-imei-csv-xlsx"
              type="button"
              onClick={() => {
                setExportDropdownOpen(prev => !prev);
                setCustomerExportDropdownOpen(false);
              }}
              className="inline-flex items-center gap-1.5 bg-white/10 hover:bg-white/20 active:bg-white/25 text-white text-xs font-semibold px-3.5 py-2 rounded-xl border border-white/20 transition-all cursor-pointer shadow-xs"
            >
              <FileSpreadsheet className="w-4 h-4 text-emerald-400" />
              <span>Export CSV & XLSX</span>
              <ChevronDown className={`w-3.5 h-3.5 text-white/70 transition-transform duration-150 ${exportDropdownOpen ? 'rotate-180' : ''}`} />
            </button>

            {exportDropdownOpen && (
              <>
                <div
                  className="fixed inset-0 z-40"
                  onClick={() => setExportDropdownOpen(false)}
                />
                <div className="absolute right-0 mt-1.5 w-64 bg-white rounded-xl shadow-2xl border border-slate-200 z-50 p-1.5 animate-in fade-in zoom-in-95 duration-100">
                  <div className="px-2.5 py-1.5 text-[10px] font-bold text-slate-400 uppercase tracking-wider border-b border-slate-100 mb-1">
                    Select Download Format ({filteredList.length} records)
                  </div>
                  <button
                    type="button"
                    id="btn-download-imei-xlsx"
                    onClick={handleExportXlsx}
                    className="w-full flex items-start gap-2.5 px-3 py-2 text-left rounded-lg hover:bg-emerald-50 text-slate-700 hover:text-emerald-900 transition-colors group cursor-pointer"
                  >
                    <div className="p-1.5 bg-emerald-100 text-emerald-700 rounded-lg group-hover:bg-emerald-200 transition-colors mt-0.5">
                      <FileSpreadsheet className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="text-xs font-bold flex items-center gap-1.5">
                        <span>Excel Spreadsheet (.xlsx)</span>
                        <span className="text-[9px] bg-emerald-100 text-emerald-800 px-1.5 py-0.2 rounded font-bold">XLSX</span>
                      </div>
                      <div className="text-[11px] text-slate-500 font-normal mt-0.5 leading-snug">
                        Formatted workbook with auto-fitted column widths
                      </div>
                    </div>
                  </button>

                  <button
                    type="button"
                    id="btn-download-imei-csv"
                    onClick={handleExportCsv}
                    className="w-full flex items-start gap-2.5 px-3 py-2 text-left rounded-lg hover:bg-slate-100 text-slate-700 hover:text-slate-900 transition-colors group cursor-pointer mt-0.5"
                  >
                    <div className="p-1.5 bg-slate-100 text-slate-600 rounded-lg group-hover:bg-slate-200 transition-colors mt-0.5">
                      <Download className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="text-xs font-bold flex items-center gap-1.5">
                        <span>CSV Data File (.csv)</span>
                        <span className="text-[9px] bg-slate-100 text-slate-700 px-1.5 py-0.2 rounded font-bold">CSV</span>
                      </div>
                      <div className="text-[11px] text-slate-500 font-normal mt-0.5 leading-snug">
                        Standard comma-delimited inventory export
                      </div>
                    </div>
                  </button>
                </div>
              </>
            )}
          </div>

          <button
            id="btn-bulk-upload-imeis"
            onClick={() => setIsBulkModalOpen(true)}
            className="inline-flex items-center gap-1.5 bg-purple-600 hover:bg-purple-500 text-white text-xs font-semibold px-3.5 py-2 rounded-xl transition-all cursor-pointer shadow-md"
          >
            <Upload className="w-4 h-4" />
            <span>Bulk Import CSV & XLSX</span>
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
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-2xs">
          <div className="flex items-center justify-between text-slate-500 text-xs font-semibold mb-1">
            <span>Total IMEIs</span>
            <Barcode className="w-4 h-4 text-purple-600" />
          </div>
          <div className="text-xl font-bold text-slate-900">{stats.total}</div>
          <div className="text-[10px] text-slate-400 mt-0.5">In system database</div>
        </div>

        <div className="bg-white p-3.5 rounded-xl border border-blue-200 bg-blue-50/20 shadow-2xs">
          <div className="flex items-center justify-between text-blue-800 text-xs font-semibold mb-1">
            <span>Assigned IMEIs</span>
            <CheckCircle2 className="w-4 h-4 text-blue-600" />
          </div>
          <div className="text-xl font-bold text-blue-900">{stats.assigned}</div>
          <div className="text-[10px] text-blue-700 mt-0.5">To roadshow orders</div>
        </div>

        <div className="bg-white p-3.5 rounded-xl border border-emerald-200 bg-emerald-50/30 shadow-2xs">
          <div className="flex items-center justify-between text-emerald-800 text-xs font-semibold mb-1">
            <span>Customer Reg. Done</span>
            <UserCheck className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="text-xl font-bold text-emerald-900">{customerMetrics.totalCompleted}</div>
          <div className="text-[10px] text-emerald-700 mt-0.5">{customerMetrics.completionRate}% of assigned stock</div>
        </div>

        <div className="bg-white p-3.5 rounded-xl border border-amber-200 bg-amber-50/20 shadow-2xs">
          <div className="flex items-center justify-between text-amber-800 text-xs font-semibold mb-1">
            <span>Unassigned Stock</span>
            <PackageCheck className="w-4 h-4 text-amber-600" />
          </div>
          <div className="text-xl font-bold text-amber-900">{stats.unassigned}</div>
          <div className="text-[10px] text-amber-700 mt-0.5">Available in hub</div>
        </div>

        <div className="bg-white p-3.5 rounded-xl border border-amber-300 bg-amber-50/50 shadow-2xs">
          <div className="flex items-center justify-between text-amber-900 text-xs font-semibold mb-1">
            <span>Pending IMEI Upload</span>
            <Clock className="w-4 h-4 text-amber-600 animate-pulse" />
          </div>
          <div className="text-xl font-bold text-amber-900">{stats.pendingUploadCount}</div>
          <div className="text-[10px] text-amber-800 font-medium mt-0.5">{totalPendingImeiUnits} units pending</div>
        </div>

        <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-2xs">
          <div className="flex items-center justify-between text-slate-500 text-xs font-semibold mb-1">
            <span>Unique Models</span>
            <Smartphone className="w-4 h-4 text-slate-600" />
          </div>
          <div className="text-xl font-bold text-slate-900">{stats.uniqueModels}</div>
          <div className="text-[10px] text-slate-400 mt-0.5">Device materials</div>
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

      {/* COMPLETED CUSTOMER REGISTRATION INFO SECTION */}
      <div id="completed-customer-registration-section" className="bg-white rounded-2xl border border-emerald-200/90 shadow-2xs overflow-hidden space-y-0">
        {/* Section Header */}
        <div className="p-5 bg-gradient-to-r from-emerald-600/10 via-emerald-50/70 to-white border-b border-emerald-200/90 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex items-start sm:items-center gap-3">
            <div className="p-2.5 bg-emerald-600 text-white rounded-xl shadow-xs shrink-0">
              <UserCheck className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-base font-bold text-slate-900 uppercase tracking-wider">
                  COMPLETED CUSTOMER REGISTRATION INFO
                </h3>
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-100 text-emerald-900 border border-emerald-300">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-700" />
                  {customerMetrics.totalCompleted} {customerMetrics.totalCompleted === 1 ? 'Registration' : 'Registrations'} Completed
                </span>
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-teal-50 text-teal-800 border border-teal-200">
                  {customerMetrics.uniqueReqs} Approved {customerMetrics.uniqueReqs === 1 ? 'Roadshow' : 'Roadshows'}
                </span>
              </div>
              <p className="text-xs text-slate-600 mt-0.5 max-w-3xl">
                Populated list and count of all customer registrations where all required fields (Customer Name, NRIC, SPP Order, Mobile Number) are completely filled for Approved roadshow orders with uploaded IMEIs.
              </p>
            </div>
          </div>

          {/* Section Action Controls */}
          <div className="flex items-center gap-2 flex-wrap sm:self-auto self-start">
            {/* View Mode Toggle */}
            <div className="inline-flex bg-slate-100 p-0.5 rounded-xl border border-slate-200 text-xs font-semibold">
              <button
                type="button"
                id="btn-customer-view-table"
                onClick={() => setCustomerViewMode('table')}
                className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 cursor-pointer ${
                  customerViewMode === 'table'
                    ? 'bg-white text-emerald-800 shadow-2xs font-bold'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Barcode className="w-3.5 h-3.5" />
                <span>All Records</span>
              </button>
              <button
                type="button"
                id="btn-customer-view-grouped"
                onClick={() => setCustomerViewMode('grouped')}
                className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 cursor-pointer ${
                  customerViewMode === 'grouped'
                    ? 'bg-white text-emerald-800 shadow-2xs font-bold'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Layers className="w-3.5 h-3.5" />
                <span>By Roadshow Order</span>
              </button>
            </div>

            {/* Export Completed Customer CSV & XLSX Dropdown */}
            <div className="relative">
              <button
                type="button"
                id="btn-export-completed-customer-csv-xlsx"
                onClick={() => {
                  setCustomerExportDropdownOpen(prev => !prev);
                  setExportDropdownOpen(false);
                }}
                disabled={filteredCustomerRecords.length === 0}
                className="inline-flex items-center gap-1.5 bg-emerald-700 hover:bg-emerald-800 active:bg-emerald-900 text-white text-xs font-semibold px-3.5 py-1.5 rounded-xl transition-all shadow-2xs cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
              >
                <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-200" />
                <span>Export CSV & XLSX</span>
                <ChevronDown className={`w-3 h-3 text-emerald-200 transition-transform duration-150 ${customerExportDropdownOpen ? 'rotate-180' : ''}`} />
              </button>

              {customerExportDropdownOpen && (
                <>
                  <div
                    className="fixed inset-0 z-40"
                    onClick={() => setCustomerExportDropdownOpen(false)}
                  />
                  <div className="absolute right-0 mt-1.5 w-64 bg-white rounded-xl shadow-2xl border border-slate-200 z-50 p-1.5 animate-in fade-in zoom-in-95 duration-100">
                    <div className="px-2.5 py-1.5 text-[10px] font-bold text-slate-400 uppercase tracking-wider border-b border-slate-100 mb-1">
                      Export Customer Data ({filteredCustomerRecords.length} records)
                    </div>
                    <button
                      type="button"
                      id="btn-download-customer-xlsx"
                      onClick={handleExportCompletedCustomerXlsx}
                      className="w-full flex items-start gap-2.5 px-3 py-2 text-left rounded-lg hover:bg-emerald-50 text-slate-700 hover:text-emerald-900 transition-colors group cursor-pointer"
                    >
                      <div className="p-1.5 bg-emerald-100 text-emerald-700 rounded-lg group-hover:bg-emerald-200 transition-colors mt-0.5">
                        <FileSpreadsheet className="w-4 h-4" />
                      </div>
                      <div>
                        <div className="text-xs font-bold flex items-center gap-1.5">
                          <span>Excel Format (.xlsx)</span>
                          <span className="text-[9px] bg-emerald-100 text-emerald-800 px-1.5 py-0.2 rounded font-bold">XLSX</span>
                        </div>
                        <div className="text-[11px] text-slate-500 font-normal mt-0.5 leading-snug">
                          Structured customer identity & hardware report
                        </div>
                      </div>
                    </button>

                    <button
                      type="button"
                      id="btn-download-customer-csv"
                      onClick={handleExportCompletedCustomerCsv}
                      className="w-full flex items-start gap-2.5 px-3 py-2 text-left rounded-lg hover:bg-slate-100 text-slate-700 hover:text-slate-900 transition-colors group cursor-pointer mt-0.5"
                    >
                      <div className="p-1.5 bg-slate-100 text-slate-600 rounded-lg group-hover:bg-slate-200 transition-colors mt-0.5">
                        <Download className="w-4 h-4" />
                      </div>
                      <div>
                        <div className="text-xs font-bold flex items-center gap-1.5">
                          <span>CSV Format (.csv)</span>
                          <span className="text-[9px] bg-slate-100 text-slate-700 px-1.5 py-0.2 rounded font-bold">CSV</span>
                        </div>
                        <div className="text-[11px] text-slate-500 font-normal mt-0.5 leading-snug">
                          Standard comma-separated customer export
                        </div>
                      </div>
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Mini KPI Highlights Row */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 p-4 bg-emerald-50/20 border-b border-emerald-100 text-xs">
          <div className="bg-white p-3 rounded-xl border border-emerald-200/80 shadow-2xs">
            <div className="text-slate-500 text-[11px] font-medium flex items-center justify-between">
              <span>Completed Registrations</span>
              <UserCheck className="w-3.5 h-3.5 text-emerald-600" />
            </div>
            <div className="text-xl font-extrabold text-emerald-900 mt-0.5">
              {customerMetrics.totalCompleted}
              <span className="text-[11px] font-normal text-slate-500 ml-1">device units</span>
            </div>
            <div className="text-[10px] text-emerald-700 mt-0.5 font-medium">All 4 customer fields filled</div>
          </div>

          <div className="bg-white p-3 rounded-xl border border-teal-200/80 shadow-2xs">
            <div className="text-slate-500 text-[11px] font-medium flex items-center justify-between">
              <span>Roadshows with Customer Info</span>
              <FileSpreadsheet className="w-3.5 h-3.5 text-teal-600" />
            </div>
            <div className="text-xl font-extrabold text-teal-900 mt-0.5">
              {customerMetrics.uniqueReqs}
              <span className="text-[11px] font-normal text-slate-500 ml-1">orders</span>
            </div>
            <div className="text-[10px] text-teal-700 mt-0.5 font-medium">Active roadshow batches</div>
          </div>

          <div className="bg-white p-3 rounded-xl border border-blue-200/80 shadow-2xs">
            <div className="text-slate-500 text-[11px] font-medium flex items-center justify-between">
              <span>Delivered Devices Value</span>
              <Smartphone className="w-3.5 h-3.5 text-blue-600" />
            </div>
            <div className="text-xl font-extrabold text-blue-900 mt-0.5">
              {formatRM(customerMetrics.totalValueRM)}
            </div>
            <div className="text-[10px] text-blue-700 mt-0.5 font-medium">Registered hardware RRP</div>
          </div>

          <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-2xs">
            <div className="text-slate-500 text-[11px] font-medium flex items-center justify-between">
              <span>Registration Rate</span>
              <Sparkles className="w-3.5 h-3.5 text-amber-500" />
            </div>
            <div className="text-xl font-extrabold text-slate-900 mt-0.5">
              {customerMetrics.completionRate}%
            </div>
            <div className="text-[10px] text-slate-500 mt-0.5 font-medium">
              Of {customerMetrics.totalApprovedUploadedImeis} uploaded IMEIs in approved roadshows
            </div>
          </div>
        </div>

        {/* Section Search and Filter Bar */}
        <div className="p-4 bg-slate-50/80 border-b border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="relative flex-1 w-full">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              id="customer-search-input"
              value={customerSearchTerm}
              onChange={e => setCustomerSearchTerm(e.target.value)}
              placeholder="Filter by Customer Name, NRIC, SPP Order, Phone, IMEI, Request Code, or Event..."
              className="w-full pl-9 pr-4 py-2 bg-white border border-slate-200 rounded-xl text-xs font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500 text-slate-900 placeholder-slate-400"
            />
            {customerSearchTerm && (
              <button
                type="button"
                onClick={() => setCustomerSearchTerm('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <select
              id="customer-request-filter"
              value={customerRequestFilter}
              onChange={e => setCustomerRequestFilter(e.target.value)}
              className="bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500 cursor-pointer w-full sm:w-auto"
            >
              <option value="ALL">All Approved Requests ({completedCustomerRecords.length})</option>
              {customerRequestOptions.map(([code, label]) => (
                <option key={code} value={code}>
                  {label}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* CONTENT VIEW 1: DETAILED TABLE VIEW */}
        {customerViewMode === 'table' && (
          <div>
            {filteredCustomerRecords.length === 0 ? (
              <div className="p-10 text-center text-slate-500 space-y-2">
                <UserCheck className="w-10 h-10 text-slate-300 mx-auto" />
                <p className="font-semibold text-slate-700 text-sm">No Completed Customer Registrations Found</p>
                <p className="text-xs text-slate-400 max-w-md mx-auto">
                  {completedCustomerRecords.length === 0
                    ? 'Customer registration details will populate here automatically once roadshow orders are approved, IMEIs are uploaded, and customer information is filled.'
                    : 'No customer registration records match the active search query or roadshow filter.'}
                </p>
                {(customerSearchTerm || customerRequestFilter !== 'ALL') && (
                  <button
                    type="button"
                    onClick={() => {
                      setCustomerSearchTerm('');
                      setCustomerRequestFilter('ALL');
                    }}
                    className="inline-flex items-center gap-1 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold cursor-pointer mt-2"
                  >
                    Reset Filters
                  </button>
                )}
              </div>
            ) : (
              <>
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse min-w-[950px]">
                    <thead>
                      <tr className="bg-slate-100/80 border-b border-slate-200 text-[11px] uppercase tracking-wider text-slate-600 font-bold">
                        <th className="py-3 px-4 w-12">#</th>
                        <th className="py-3 px-4">Customer Details</th>
                        <th className="py-3 px-4">SPP Order No</th>
                        <th className="py-3 px-4">Device IMEI & Model</th>
                        <th className="py-3 px-4">Roadshow Request</th>
                        <th className="py-3 px-4">Submission Remarks</th>
                        <th className="py-3 px-4 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-xs bg-white">
                      {paginatedCustomerRecords.map((item, idx) => {
                        const linkedReq = requests.find(r => r.requestCode === item.requestCode || r.id === item.requestId);

                        return (
                          <tr key={`${item.id || 'cust'}-${customerStartIndex + idx}`} className="hover:bg-emerald-50/30 transition-colors">
                            <td className="py-3.5 px-4 text-slate-400 font-mono text-[11px]">
                              {customerStartIndex + idx + 1}
                            </td>

                            {/* Customer Details */}
                            <td className="py-3.5 px-4">
                              <div className="space-y-1">
                                <div className="font-bold text-slate-900 flex items-center gap-1.5">
                                  <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0"></span>
                                  <span>{item.customerName}</span>
                                </div>
                                <div className="flex items-center gap-2 flex-wrap text-[11px]">
                                  <span className="inline-flex items-center gap-1 font-mono text-slate-700 bg-slate-100 border border-slate-200 px-1.5 py-0.5 rounded text-[10px]">
                                    <CreditCard className="w-3 h-3 text-slate-500" />
                                    {item.nric}
                                  </span>
                                  <span className="inline-flex items-center gap-1 font-mono text-emerald-800 bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 rounded text-[10px]">
                                    <Phone className="w-3 h-3 text-emerald-600" />
                                    {item.mobileNumber}
                                  </span>
                                </div>
                              </div>
                            </td>

                            {/* SPP Order No */}
                            <td className="py-3.5 px-4 whitespace-nowrap">
                              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg font-mono font-bold text-xs bg-purple-50 text-purple-800 border border-purple-200 shadow-2xs">
                                {item.sppOrder}
                              </span>
                            </td>

                            {/* Device IMEI & Model */}
                            <td className="py-3.5 px-4">
                              <div className="space-y-0.5">
                                <div className="flex items-center gap-1.5">
                                  <span className="font-mono font-bold text-xs bg-slate-900 text-white px-2 py-0.5 rounded tracking-wide shadow-2xs">
                                    {item.imei}
                                  </span>
                                </div>
                                <div className="font-semibold text-slate-900 mt-1">{item.description}</div>
                                <div className="text-[11px] font-mono text-blue-700">
                                  {item.material} &bull; {formatRM(item.rrpRM)}
                                </div>
                              </div>
                            </td>

                            {/* Roadshow Request */}
                            <td className="py-3.5 px-4">
                              <div className="space-y-0.5">
                                {item.requestCode && item.requestCode !== 'Unassigned' ? (
                                  <button
                                    type="button"
                                    onClick={() => linkedReq && onSelectRequest && onSelectRequest(linkedReq)}
                                    className="font-bold text-blue-600 hover:text-blue-800 hover:underline flex items-center gap-1 text-xs cursor-pointer"
                                    title="View Roadshow Request Details"
                                  >
                                    <span>{item.requestCode}</span>
                                    <ExternalLink className="w-3 h-3" />
                                  </button>
                                ) : (
                                  <span className="text-slate-400 font-mono text-xs">{item.requestCode}</span>
                                )}
                                <div className="text-[11px] text-slate-700 font-medium truncate max-w-[200px]" title={item.eventName}>
                                  {item.eventName}
                                </div>
                                <div className="text-[10px] text-slate-400">
                                  {item.requestorName} &bull; {item.region} ({item.state})
                                </div>
                              </div>
                            </td>

                            {/* Submission Remarks */}
                            <td className="py-3.5 px-4">
                              <div className="max-w-[180px] text-slate-600 text-[11px] leading-relaxed">
                                <div className="flex items-center gap-1 text-emerald-700 font-semibold text-[10px] mb-0.5">
                                  <CheckCircle2 className="w-3 h-3" />
                                  <span>Fully Registered</span>
                                </div>
                                <span className="italic text-slate-500">{item.submissionRemarks || 'Verified & Delivered'}</span>
                              </div>
                            </td>

                            {/* Actions */}
                            <td className="py-3.5 px-4 text-right whitespace-nowrap">
                              <div className="flex items-center justify-end gap-1.5">
                                {linkedReq && onSelectRequest && (
                                  <button
                                    type="button"
                                    onClick={() => onSelectRequest(linkedReq)}
                                    className="p-1.5 text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded-lg transition-colors cursor-pointer"
                                    title="View Roadshow Request"
                                  >
                                    <ExternalLink className="w-3.5 h-3.5" />
                                  </button>
                                )}
                                {item.sourceItem && (
                                  <button
                                    type="button"
                                    onClick={() => setEditingItem(item.sourceItem!)}
                                    className="p-1.5 text-purple-600 hover:text-purple-800 hover:bg-purple-50 rounded-lg transition-colors cursor-pointer"
                                    title="Edit IMEI & Customer Info"
                                  >
                                    <Edit2 className="w-3.5 h-3.5" />
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

                {/* Customer Table Pagination */}
                <div className="px-5 py-3 bg-slate-50 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-600">
                  <div>
                    Showing <span className="font-semibold text-slate-900">{filteredCustomerRecords.length > 0 ? customerStartIndex + 1 : 0}</span> to <span className="font-semibold text-slate-900">{Math.min(customerStartIndex + ITEMS_PER_PAGE, filteredCustomerRecords.length)}</span> of <span className="font-semibold text-slate-900">{filteredCustomerRecords.length}</span> completed customer registrations
                  </div>

                  <div className="flex items-center gap-1.5">
                    <button
                      id="btn-customer-pagination-prev"
                      type="button"
                      onClick={() => setCustomerCurrentPage(p => Math.max(1, p - 1))}
                      disabled={customerSafePage === 1}
                      className="p-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 disabled:opacity-40 disabled:hover:bg-white text-slate-700 font-semibold transition-all cursor-pointer disabled:cursor-not-allowed flex items-center gap-1 px-2.5 text-xs"
                    >
                      <ChevronLeft className="w-3.5 h-3.5" />
                      <span>Prev</span>
                    </button>

                    <div className="flex items-center gap-1 px-1">
                      {Array.from({ length: customerTotalPages }, (_, i) => i + 1).map(page => (
                        <button
                          key={page}
                          id={`btn-customer-page-${page}`}
                          type="button"
                          onClick={() => setCustomerCurrentPage(page)}
                          className={`w-7 h-7 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                            page === customerSafePage
                              ? 'bg-emerald-600 text-white shadow-xs font-bold'
                              : 'hover:bg-slate-200 text-slate-700 bg-white border border-slate-200'
                          }`}
                        >
                          {page}
                        </button>
                      ))}
                    </div>

                    <button
                      id="btn-customer-pagination-next"
                      type="button"
                      onClick={() => setCustomerCurrentPage(p => Math.min(customerTotalPages, p + 1))}
                      disabled={customerSafePage === customerTotalPages}
                      className="p-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 disabled:opacity-40 disabled:hover:bg-white text-slate-700 font-semibold transition-all cursor-pointer disabled:cursor-not-allowed flex items-center gap-1 px-2.5 text-xs"
                    >
                      <span>Next</span>
                      <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        )}

        {/* CONTENT VIEW 2: GROUPED BY ROADSHOW ORDER REQUEST */}
        {customerViewMode === 'grouped' && (
          <div className="p-4 space-y-4">
            <div className="flex items-center justify-between text-xs text-slate-600 px-1">
              <span className="font-semibold">
                Showing {roadshowCustomerSummaries.length} Roadshow {roadshowCustomerSummaries.length === 1 ? 'Order' : 'Orders'}
              </span>
              <button
                type="button"
                onClick={toggleExpandAllRoadshows}
                className="text-emerald-700 hover:text-emerald-900 font-bold hover:underline cursor-pointer flex items-center gap-1"
              >
                {expandedRoadshowIds.length === roadshowCustomerSummaries.length ? 'Collapse All' : 'Expand All Roadshows'}
              </button>
            </div>

            {roadshowCustomerSummaries.length === 0 ? (
              <div className="p-8 text-center text-slate-500 bg-slate-50 rounded-xl border border-slate-200">
                <UserCheck className="w-8 h-8 text-slate-300 mx-auto mb-1.5" />
                <p className="font-semibold text-slate-700 text-xs">No Roadshow Requests with Customer Info</p>
              </div>
            ) : (
              <div className="space-y-3">
                {roadshowCustomerSummaries.map((summary) => {
                  const isExpanded = expandedRoadshowIds.includes(summary.req.id);
                  const isFullyCompleted = summary.completedCount > 0 && summary.completedCount >= summary.totalUnits;

                  return (
                    <div
                      key={summary.req.id}
                      id={`card-completed-roadshow-${summary.req.id}`}
                      className="border border-slate-200 rounded-xl bg-white shadow-2xs overflow-hidden transition-all hover:border-emerald-300"
                    >
                      {/* Roadshow Card Header */}
                      <div
                        onClick={() => toggleRoadshowExpand(summary.req.id)}
                        className={`p-4 flex flex-col md:flex-row md:items-center justify-between gap-3 cursor-pointer select-none transition-colors ${
                          isExpanded ? 'bg-emerald-50/40 border-b border-emerald-100' : 'hover:bg-slate-50/70'
                        }`}
                      >
                        <div className="flex items-start sm:items-center gap-3">
                          <button
                            type="button"
                            id={`btn-toggle-roadshow-${summary.req.id}`}
                            className="p-1 rounded-lg bg-slate-100 text-slate-600 hover:bg-slate-200 shrink-0 mt-0.5 sm:mt-0"
                          >
                            {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                          </button>

                          <div>
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-mono font-bold text-xs text-blue-700 bg-blue-50 border border-blue-200 px-2 py-0.5 rounded">
                                {summary.requestCode}
                              </span>
                              <h4 className="font-bold text-slate-900 text-sm">
                                {summary.eventName}
                              </h4>
                              {isFullyCompleted ? (
                                <span className="inline-flex items-center gap-1 text-[10px] font-bold bg-emerald-100 text-emerald-900 border border-emerald-300 px-2 py-0.5 rounded-full">
                                  <CheckCircle2 className="w-3 h-3 text-emerald-700" />
                                  100% Fully Registered
                                </span>
                              ) : summary.completedCount > 0 ? (
                                <span className="inline-flex items-center gap-1 text-[10px] font-bold bg-amber-100 text-amber-900 border border-amber-300 px-2 py-0.5 rounded-full">
                                  {summary.completedCount}/{summary.totalUnits} Registered ({summary.completionRate}%)
                                </span>
                              ) : (
                                <span className="text-[10px] font-semibold bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full">
                                  0/{summary.totalUnits} Registered
                                </span>
                              )}
                            </div>

                            <div className="text-xs text-slate-500 mt-1 flex items-center gap-2 flex-wrap">
                              <span>Requestor: <strong className="text-slate-700">{summary.requestorName}</strong></span>
                              <span>&bull;</span>
                              <span>Location: {summary.state} ({summary.region} Region)</span>
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-4 self-end md:self-auto">
                          {/* Progress Meter */}
                          <div className="text-right min-w-[120px]">
                            <div className="text-[11px] font-bold text-slate-800">
                              <span className="text-emerald-700 font-extrabold">{summary.completedCount}</span> / {summary.totalUnits} Customers
                            </div>
                            <div className="w-28 h-2 bg-slate-100 rounded-full overflow-hidden border border-slate-200 mt-1">
                              <div
                                className="h-full bg-gradient-to-r from-emerald-500 to-teal-600 transition-all"
                                style={{ width: `${Math.min(100, summary.completionRate)}%` }}
                              />
                            </div>
                          </div>

                          {onSelectRequest && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                onSelectRequest(summary.req);
                              }}
                              className="p-1.5 text-slate-400 hover:text-blue-700 hover:bg-blue-50 rounded-lg transition-colors cursor-pointer"
                              title="Open Full Request Details"
                            >
                              <ExternalLink className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Expanded Roadshow Customer Table */}
                      {isExpanded && (
                        <div className="p-4 bg-slate-50/50 space-y-3">
                          {summary.completedRecords.length === 0 ? (
                            <div className="p-6 text-center text-slate-400 text-xs bg-white rounded-lg border border-slate-200">
                              No customer registrations have been completed for this roadshow request yet.
                            </div>
                          ) : (
                            <div className="overflow-x-auto bg-white rounded-xl border border-slate-200">
                              <table className="w-full text-left border-collapse text-xs">
                                <thead>
                                  <tr className="bg-slate-100/70 border-b border-slate-200 text-[10px] uppercase font-bold text-slate-500">
                                    <th className="py-2.5 px-3">#</th>
                                    <th className="py-2.5 px-3">Customer Name</th>
                                    <th className="py-2.5 px-3">NRIC</th>
                                    <th className="py-2.5 px-3">SPP Order No</th>
                                    <th className="py-2.5 px-3">Mobile Contact</th>
                                    <th className="py-2.5 px-3">Device IMEI</th>
                                    <th className="py-2.5 px-3">Model Description</th>
                                    <th className="py-2.5 px-3">Submission Remarks</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                  {summary.completedRecords.map((cust, cIdx) => (
                                    <tr key={`${cust.id || 'cust'}-${cIdx}`} className="hover:bg-emerald-50/30">
                                      <td className="py-2.5 px-3 text-slate-400 font-mono text-[11px]">{cIdx + 1}</td>
                                      <td className="py-2.5 px-3 font-bold text-slate-900">{cust.customerName}</td>
                                      <td className="py-2.5 px-3 font-mono text-[11px] text-slate-700">{cust.nric}</td>
                                      <td className="py-2.5 px-3 font-mono font-bold text-purple-700">{cust.sppOrder}</td>
                                      <td className="py-2.5 px-3 font-mono text-[11px] text-emerald-800">{cust.mobileNumber}</td>
                                      <td className="py-2.5 px-3 font-mono font-bold text-slate-900">
                                        <span className="bg-slate-100 border border-slate-200 px-1.5 py-0.5 rounded">
                                          {cust.imei}
                                        </span>
                                      </td>
                                      <td className="py-2.5 px-3 text-slate-800 font-medium">
                                        <div>{cust.description}</div>
                                        <div className="text-[10px] font-mono text-blue-700">{cust.material} &bull; {formatRM(cust.rrpRM)}</div>
                                      </td>
                                      <td className="py-2.5 px-3 text-slate-500 italic text-[11px]">
                                        {cust.submissionRemarks || 'Verified & Delivered'}
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
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
        <div className="px-5 py-3.5 bg-slate-50 border-b border-slate-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 text-xs font-semibold text-slate-700">
          <div className="flex items-center gap-2">
            <Smartphone className="w-4 h-4 text-purple-600" />
            <span>IMEI Records ({filteredList.length})</span>
          </div>
          <span className="text-slate-500 font-normal">
            Showing <strong className="font-semibold text-slate-800">{filteredList.length > 0 ? startIndex + 1 : 0}</strong> to <strong className="font-semibold text-slate-800">{Math.min(startIndex + ITEMS_PER_PAGE, filteredList.length)}</strong> of <strong className="font-semibold text-slate-800">{filteredList.length}</strong> records (10 per page)
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
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse min-w-[850px]">
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
                  {paginatedList.map((item, index) => {
                    const linkedReq = requests.find(r => r.requestCode === item.requestCode || r.id === item.requestId);

                    return (
                      <tr key={`${item.id || 'imei'}-${startIndex + index}`} className="hover:bg-purple-50/30 transition-colors">
                        <td className="py-3 px-4 text-slate-400 font-mono">{startIndex + index + 1}</td>
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

            {/* Pagination Bar */}
            <div className="px-5 py-3.5 bg-slate-50 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-600">
              <div>
                Showing <span className="font-semibold text-slate-900">{filteredList.length > 0 ? startIndex + 1 : 0}</span> to <span className="font-semibold text-slate-900">{Math.min(startIndex + ITEMS_PER_PAGE, filteredList.length)}</span> of <span className="font-semibold text-slate-900">{filteredList.length}</span> IMEI records
              </div>

              <div className="flex items-center gap-1.5">
                <button
                  id="btn-imei-pagination-prev"
                  type="button"
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  disabled={safeCurrentPage === 1}
                  className="p-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 disabled:opacity-40 disabled:hover:bg-white text-slate-700 font-semibold transition-all cursor-pointer disabled:cursor-not-allowed flex items-center gap-1 px-2.5"
                >
                  <ChevronLeft className="w-4 h-4" />
                  <span>Previous</span>
                </button>

                <div className="flex items-center gap-1 px-1">
                  {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => {
                    if (totalPages > 7) {
                      if (page !== 1 && page !== totalPages && Math.abs(page - safeCurrentPage) > 1) {
                        if (page === 2 && safeCurrentPage > 3) return <span key={page} className="px-1 text-slate-400">...</span>;
                        if (page === totalPages - 1 && safeCurrentPage < totalPages - 2) return <span key={page} className="px-1 text-slate-400">...</span>;
                        return null;
                      }
                    }

                    return (
                      <button
                        key={page}
                        id={`btn-imei-page-${page}`}
                        type="button"
                        onClick={() => setCurrentPage(page)}
                        className={`w-7 h-7 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                          page === safeCurrentPage
                            ? 'bg-purple-600 text-white shadow-sm'
                            : 'hover:bg-slate-200 text-slate-700'
                        }`}
                      >
                        {page}
                      </button>
                    );
                  })}
                </div>

                <button
                  id="btn-imei-pagination-next"
                  type="button"
                  onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                  disabled={safeCurrentPage === totalPages}
                  className="p-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 disabled:opacity-40 disabled:hover:bg-white text-slate-700 font-semibold transition-all cursor-pointer disabled:cursor-not-allowed flex items-center gap-1 px-2.5"
                >
                  <span>Next</span>
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          </>
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
                  placeholder="e.g. RDR-2026-0004"
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
                  placeholder="e.g. RDR-2026-0004"
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
              <div className="bg-purple-50/90 border border-purple-200 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-start gap-3">
                  <div className="p-2 bg-purple-100 rounded-xl text-purple-700 mt-0.5 flex-shrink-0">
                    <FileSpreadsheet className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="font-bold text-slate-900 text-xs">Official Import Templates (XLSX & CSV)</h4>
                    <p className="text-[11px] text-slate-600 mt-0.5">
                      Download pre-formatted templates with sample data for Request Code, Material, Descriptions, RRP, IMEI, Customer Name & NRIC.
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0 flex-wrap">
                  <button
                    id="btn-download-excel-template-xlsx"
                    type="button"
                    onClick={handleDownloadTemplateXlsx}
                    className="inline-flex items-center gap-1.5 bg-purple-600 hover:bg-purple-700 active:bg-purple-800 text-white font-bold text-xs px-3 py-2 rounded-xl transition-all shadow-xs cursor-pointer"
                  >
                    <FileSpreadsheet className="w-3.5 h-3.5 text-purple-200" />
                    <span>Download XLSX</span>
                  </button>
                  <button
                    id="btn-download-excel-template-csv"
                    type="button"
                    onClick={handleDownloadTemplateCsv}
                    className="inline-flex items-center gap-1.5 bg-white border border-purple-300 hover:bg-purple-100/60 active:bg-purple-100 text-purple-800 font-bold text-xs px-3 py-2 rounded-xl transition-all shadow-xs cursor-pointer"
                  >
                    <Download className="w-3.5 h-3.5 text-purple-600" />
                    <span>Download CSV</span>
                  </button>
                </div>
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
                    placeholder={`Request Code,Requestor Name,Event Name,Material,Descriptions,RRP (RM),Device IMEI No,Customer Name,NRIC,SPP Order,Mobile Number,Submission Remarks\nRDR-2026-0001,MUHAMMAD RAZIF,MAHA 2026,20017453,HP-SAMSUNG-A07 5G 8+256GB-BLK,1029,869123048571210,Ahmad Zaki,900101-14-5521,SPP-88219,0123456789,Roadshow stock`}
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
                      <div key={`${item.id || 'preview'}-${idx}`} className="p-2.5 flex items-center justify-between text-[11px] hover:bg-slate-100/80">
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
