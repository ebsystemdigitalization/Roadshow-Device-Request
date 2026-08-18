import { PartBDeviceItem, DeviceInventoryItem, User, UserRole, UserStatus, RoadshowRequest } from '../types';

export function formatRM(value: number): string {
  return new Intl.NumberFormat('en-MY', {
    style: 'currency',
    currency: 'MYR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(value).replace('MYR', 'RM');
}

export function formatDate(dateString: string): string {
  if (!dateString) return '-';
  try {
    const d = new Date(dateString);
    if (isNaN(d.getTime())) return dateString;
    return d.toLocaleDateString('en-MY', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    });
  } catch {
    return dateString;
  }
}

export function formatDateTime(isoString: string): string {
  if (!isoString) return '-';
  try {
    const d = new Date(isoString);
    if (isNaN(d.getTime())) return isoString;
    return d.toLocaleString('en-MY', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  } catch {
    return isoString;
  }
}

/**
 * Calculates the total monetary requested value for a roadshow request.
 * Crucially includes the total value of all requested devices and rejected devices (both in partB and rejectedPartB).
 */
export function calculateTotalRequestedValue(req: RoadshowRequest): number {
  if (!req) return 0;
  const seenIds = new Set<string>();
  let total = 0;

  // Add all items in partB (using requested quantity * RRP)
  (req.partB || []).forEach(item => {
    seenIds.add(item.id);
    const qty = Number(item.quantity) || 0;
    const rrp = Number(item.rrpRM) || 0;
    total += qty * rrp;
  });

  // Add any items preserved in rejectedPartB that are not duplicated in partB
  (req.rejectedPartB || []).forEach(item => {
    if (!seenIds.has(item.id)) {
      seenIds.add(item.id);
      const qty = Number(item.quantity) || 0;
      const rrp = Number(item.rrpRM) || 0;
      total += qty * rrp;
    }
  });

  return total;
}

/**
 * Calculates the total requested units for a roadshow request, including rejected devices.
 */
export function calculateTotalRequestedUnits(req: RoadshowRequest): number {
  if (!req) return 0;
  const seenIds = new Set<string>();
  let totalUnits = 0;

  (req.partB || []).forEach(item => {
    seenIds.add(item.id);
    totalUnits += Number(item.quantity) || 0;
  });

  (req.rejectedPartB || []).forEach(item => {
    if (!seenIds.has(item.id)) {
      seenIds.add(item.id);
      totalUnits += Number(item.quantity) || 0;
    }
  });

  return totalUnits;
}

/**
 * Calculates the total approved monetary value for an approved roadshow request.
 */
export function calculateApprovedValue(req: RoadshowRequest): number {
  if (!req || req.status !== 'Approved') return 0;
  return (req.partB || []).reduce((acc, item) => {
    if (item.status === 'Rejected') return acc;
    const qty = item.recommendedQuantity !== undefined ? item.recommendedQuantity : item.quantity;
    const rrp = Number(item.rrpRM) || 0;
    return acc + ((Number(qty) || 0) * rrp);
  }, 0);
}

/**
 * Calculates the total approved units for an approved roadshow request.
 */
export function calculateApprovedUnits(req: RoadshowRequest): number {
  if (!req || req.status !== 'Approved') return 0;
  return (req.partB || []).reduce((acc, item) => {
    if (item.status === 'Rejected') return acc;
    const qty = item.recommendedQuantity !== undefined ? item.recommendedQuantity : item.quantity;
    return acc + (Number(qty) || 0);
  }, 0);
}

/**
 * Calculates the total monetary value of rejected devices (items with status === 'Rejected', reduced quantity, or from a rejected request).
 */
export function calculateRejectedValue(req: RoadshowRequest): number {
  if (!req) return 0;
  if (req.status === 'Rejected') {
    return calculateTotalRequestedValue(req);
  }
  const seenIds = new Set<string>();
  let rejectedVal = 0;

  (req.partB || []).forEach(item => {
    seenIds.add(item.id);
    const qty = Number(item.quantity) || 0;
    const rrp = Number(item.rrpRM) || 0;
    if (item.status === 'Rejected') {
      rejectedVal += qty * rrp;
    } else if (item.recommendedQuantity !== undefined && item.recommendedQuantity < qty) {
      rejectedVal += (qty - item.recommendedQuantity) * rrp;
    }
  });

  (req.rejectedPartB || []).forEach(item => {
    if (!seenIds.has(item.id)) {
      seenIds.add(item.id);
      const qty = Number(item.quantity) || 0;
      const rrp = Number(item.rrpRM) || 0;
      rejectedVal += qty * rrp;
    }
  });

  return rejectedVal;
}

/**
 * Calculates the total rejected units of devices for a roadshow request.
 */
export function calculateRejectedUnits(req: RoadshowRequest): number {
  if (!req) return 0;
  if (req.status === 'Rejected') {
    return calculateTotalRequestedUnits(req);
  }
  const seenIds = new Set<string>();
  let rejectedUnits = 0;

  (req.partB || []).forEach(item => {
    seenIds.add(item.id);
    const qty = Number(item.quantity) || 0;
    if (item.status === 'Rejected') {
      rejectedUnits += qty;
    } else if (item.recommendedQuantity !== undefined && item.recommendedQuantity < qty) {
      rejectedUnits += (qty - item.recommendedQuantity);
    }
  });

  (req.rejectedPartB || []).forEach(item => {
    if (!seenIds.has(item.id)) {
      seenIds.add(item.id);
      rejectedUnits += Number(item.quantity) || 0;
    }
  });

  return rejectedUnits;
}

export function generateId(): string {
  return Math.random().toString(36).substring(2, 9) + Date.now().toString(36);
}

export function generateRequestCode(): string {
  const year = new Date().getFullYear();
  const randomNum = Math.floor(1000 + Math.random() * 9000);
  return `RDR-${year}-${randomNum}`;
}

export function parseDeviceCSV(csvText: string): PartBDeviceItem[] {
  const lines = csvText.split(/\r?\n/).filter(line => line.trim() !== '');
  if (lines.length < 2) return [];

  const items: PartBDeviceItem[] = [];
  
  // Skip header if line 1 contains text headers
  const startIndex = lines[0].toLowerCase().includes('material') ? 1 : 0;

  for (let i = startIndex; i < lines.length; i++) {
    const cols = lines[i].split(',').map(c => c.trim().replace(/^"|"$/g, ''));
    if (cols.length >= 3) {
      const material = cols[0] || 'MAT-UNKNOWN';
      const description = cols[1] || 'Device Description';
      const quantity = parseInt(cols[2], 10) || 1;
      const rrpRM = parseFloat(cols[3]) || 0;
      let recommendedQuantity = quantity;
      let remarks = '';

      if (cols.length >= 6) {
        recommendedQuantity = parseInt(cols[4], 10) || quantity;
        remarks = cols[5] || '';
      } else {
        remarks = cols[4] || '';
      }

      items.push({
        id: generateId(),
        material,
        description,
        quantity,
        recommendedQuantity,
        rrpRM,
        totalRrpRM: recommendedQuantity * rrpRM,
        remarks
      });
    }
  }

  return items;
}

export function generateSampleDeviceCSV(): string {
  return `Material,Descriptions,Quantity,RRP (RM),Remarks
MAT-S24U-512,Galaxy S24 Ultra 512GB Titanium Gray,5,6299,Demo Stock Ready
MAT-TAB-S9U,Galaxy Tab S9 Ultra 512GB,3,5999,Display units with stands
MAT-GW6-PRO,Galaxy Watch6 Classic 47mm,10,1799,Gift with purchase units
MAT-BP2-WHT,Galaxy Buds2 Pro White,15,899,Promotional gift stock`;
}

function parseCSVColumns(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let insideQuotes = false;
  for (let j = 0; j < line.length; j++) {
    const char = line[j];
    if (char === '"') {
      if (insideQuotes && line[j + 1] === '"') {
        current += '"';
        j++;
      } else {
        insideQuotes = !insideQuotes;
      }
    } else if (char === ',' && !insideQuotes) {
      result.push(current.trim().replace(/^"|"$/g, ''));
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current.trim().replace(/^"|"$/g, ''));
  return result;
}

export function inferBrandFromDescription(description: string, material?: string): string {
  const text = `${description} ${material || ''}`.toLowerCase();
  if (text.includes('galaxy') || text.includes('samsung')) return 'Samsung';
  if (text.includes('iphone') || text.includes('ipad') || text.includes('apple') || text.includes('macbook')) return 'Apple';
  if (text.includes('xiaomi') || text.includes('poco') || text.includes('redmi')) return 'Xiaomi';
  if (text.includes('vivo')) return 'Vivo';
  if (text.includes('oppo')) return 'Oppo';
  if (text.includes('honor')) return 'Honor';
  if (text.includes('huawei')) return 'Huawei';
  if (text.includes('realme')) return 'Realme';
  return '';
}

export function parseDeviceInventoryCSV(csvText: string): DeviceInventoryItem[] {
  const lines = csvText.split(/\r?\n/).filter(line => line.trim() !== '');
  if (lines.length < 1) return [];

  const items: DeviceInventoryItem[] = [];
  
  const firstLineLower = lines[0].toLowerCase();
  const hasHeader = firstLineLower.includes('material') || firstLineLower.includes('description') || firstLineLower.includes('brand');
  const startIndex = hasHeader ? 1 : 0;

  // Header column index detection if header exists
  let matIdx = 0;
  let descIdx = 1;
  let brandIdx = -1;
  let rrpIdx = 2;
  let remIdx = 3;
  let statusIdx = 4;

  if (hasHeader) {
    const headerCols = parseCSVColumns(lines[0]).map(c => c.toLowerCase());
    headerCols.forEach((col, idx) => {
      if (col.includes('material')) matIdx = idx;
      else if (col.includes('desc')) descIdx = idx;
      else if (col.includes('brand')) brandIdx = idx;
      else if (col.includes('rrp') || col.includes('price')) rrpIdx = idx;
      else if (col.includes('remark')) remIdx = idx;
      else if (col.includes('status')) statusIdx = idx;
    });
  }

  for (let i = startIndex; i < lines.length; i++) {
    const cols = parseCSVColumns(lines[i]);
    if (cols.length >= 2) {
      const material = (hasHeader && matIdx >= 0 ? cols[matIdx] : cols[0]) || 'MAT-UNKNOWN';
      const description = (hasHeader && descIdx >= 0 ? cols[descIdx] : cols[1]) || 'Device Description';
      
      let brand = '';
      let rrpRM = 0;
      let remarks = '';
      let deviceStatus: 'In Stock' | 'EOL' = 'In Stock';

      if (hasHeader && brandIdx !== -1) {
        brand = cols[brandIdx] || '';
        rrpRM = parseFloat(cols[rrpIdx]) || 0;
        remarks = remIdx >= 0 ? cols[remIdx] || '' : '';
        if (statusIdx >= 0 && cols[statusIdx]) {
          deviceStatus = cols[statusIdx].toLowerCase().includes('eol') ? 'EOL' : 'In Stock';
        }
      } else if (cols.length >= 6) {
        // Standard 6-column format: Material, Descriptions, Brand, RRP (RM), Remarks, Device Status
        brand = cols[2] || '';
        rrpRM = parseFloat(cols[3]) || 0;
        remarks = cols[4] || '';
        if (cols[5]) {
          deviceStatus = cols[5].toLowerCase().includes('eol') ? 'EOL' : 'In Stock';
        }
      } else if (cols.length === 5) {
        // Check if column 2 is brand (text) or RRP (numeric)
        if (isNaN(parseFloat(cols[2])) && !isNaN(parseFloat(cols[3]))) {
          // Format: Material, Descriptions, Brand, RRP, Remarks/Status
          brand = cols[2] || '';
          rrpRM = parseFloat(cols[3]) || 0;
          remarks = cols[4] || '';
          if (cols[4] && (cols[4].toLowerCase() === 'in stock' || cols[4].toLowerCase() === 'eol')) {
            deviceStatus = cols[4].toLowerCase() === 'eol' ? 'EOL' : 'In Stock';
            remarks = '';
          }
        } else {
          // Format: Material, Descriptions, RRP, Remarks, Device Status
          rrpRM = parseFloat(cols[2]) || 0;
          remarks = cols[3] || '';
          if (cols[4]) {
            deviceStatus = cols[4].toLowerCase().includes('eol') ? 'EOL' : 'In Stock';
          }
        }
      } else {
        // 2-4 columns
        rrpRM = parseFloat(cols[2]) || 0;
        remarks = cols[3] || '';
        if (cols[4]) {
          deviceStatus = cols[4].toLowerCase().includes('eol') ? 'EOL' : 'In Stock';
        }
      }

      // If brand wasn't explicitly provided, infer smartly from description/material
      if (!brand.trim()) {
        brand = inferBrandFromDescription(description, material);
      }

      // Explicit status check fallback
      const explicitStatus = cols.find(c => c.toLowerCase() === 'eol' || c.toLowerCase() === 'in stock');
      if (explicitStatus) {
        deviceStatus = explicitStatus.toLowerCase() === 'eol' ? 'EOL' : 'In Stock';
      }

      items.push({
        id: generateId(),
        material,
        description,
        brand: brand.trim() || undefined,
        rrpRM,
        remarks,
        deviceStatus,
        updatedAt: new Date().toISOString()
      });
    }
  }

  return items;
}

export function exportDeviceInventoryCSV(items: DeviceInventoryItem[]): string {
  if (!items || items.length === 0) {
    return generateSampleDeviceInventoryCSV();
  }

  const header = 'Material,Descriptions,Brand,RRP (RM),Remarks,Device Status';
  const rows = items.map(item => {
    const formatField = (val: string | undefined | null) => {
      const str = val !== undefined && val !== null ? String(val).trim() : '';
      if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
        return `"${str.replace(/"/g, '""')}"`;
      }
      return str;
    };

    const material = formatField(item.material);
    const description = formatField(item.description);
    const brand = formatField(item.brand || inferBrandFromDescription(item.description, item.material));
    const rrpRM = item.rrpRM !== undefined && item.rrpRM !== null && !isNaN(Number(item.rrpRM)) ? Number(item.rrpRM) : 0;
    const remarks = formatField(item.remarks || '');
    const deviceStatus = item.deviceStatus || 'In Stock';

    return `${material},${description},${brand},${rrpRM},${remarks},${deviceStatus}`;
  });

  return [header, ...rows].join('\n');
}

export function generateSampleDeviceInventoryCSV(): string {
  return `Material,Descriptions,Brand,RRP (RM),Remarks,Device Status
MAT-S24U-512,Galaxy S24 Ultra 512GB Titanium Gray,Samsung,6299,High demand roadshow stock,In Stock
MAT-ZFOLD5-512,Galaxy Z Fold5 512GB Phantom Black,Samsung,7299,Reserved for Central region roadshows,In Stock
MAT-TAB-S9U,Galaxy Tab S9 Ultra 512GB Graphite,Samsung,5999,Display units with security stands,In Stock
MAT-GW6-PRO,Galaxy Watch6 Classic 47mm Bluetooth,Samsung,1799,Promo bundle stock for event registration,In Stock
MAT-BP2-WHT,Galaxy Buds2 Pro White,Samsung,899,End of life promotional stock,EOL
MAT-XM14-512,Xiaomi 14 512GB Black,Xiaomi,3799,Regional depot flagship stock,In Stock
MAT-VIVO-X100,Vivo X100 Pro 512GB Sunset Orange,Vivo,4599,Southern warehouse allocated inventory,In Stock`;
}

export function getRegionFromState(stateVal: string): string {
  if (['Penang', 'Perak', 'Kedah', 'Perlis'].includes(stateVal)) return 'Northern';
  if (['Johor', 'Melaka', 'Negeri Sembilan'].includes(stateVal)) return 'Southern';
  if (['Pahang', 'Kelantan', 'Terengganu'].includes(stateVal)) return 'Eastern';
  if (stateVal === 'Sarawak') return 'Sarawak';
  if (['Sabah', 'Labuan'].includes(stateVal)) return 'Sabah';
  return 'Central';
}

export function normalizeUserRole(roleStr: string): UserRole {
  const r = roleStr.trim().toLowerCase();
  if (r.includes('head of department') || r.includes('head of dept') || r === 'hod') return 'Head of Department';
  if (r.includes('head of sales') || r === 'hos') return 'Head of Sales';
  if (r.includes('device')) return 'Device Team';
  if (r.includes('head of operation') || r.includes('head of ops') || r === 'hoo') return 'Head of Operation';
  if (r.includes('admin')) return 'Admin';
  return 'Sales Team';
}

const AVATAR_LIST = [
  'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=100&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=100&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=100&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=100&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1580489944761-15a19d654956?w=100&auto=format&fit=crop&q=80'
];

export function parseUserCSV(csvText: string, existingUsers: User[] = []): { users: User[]; errors: string[] } {
  const lines = csvText.split(/\r?\n/).filter(line => line.trim() !== '');
  if (lines.length < 1) return { users: [], errors: ['CSV content is empty.'] };

  const users: User[] = [];
  const errors: string[] = [];

  const firstLineCols = lines[0].split(',').map(c => c.trim().replace(/^"|"$/g, ''));
  const firstLineLower = lines[0].toLowerCase();
  const isHeader = firstLineLower.includes('name') || firstLineLower.includes('email') || firstLineLower.includes('role');

  let hosIdx = 5;
  let hodIdx = -1;
  let statusIdx = 6;

  if (isHeader) {
    const headers = firstLineCols.map(h => h.toLowerCase().trim());
    const findHos = headers.findIndex(h => h.includes('head of sales') || h.includes('hos'));
    if (findHos !== -1) hosIdx = findHos;
    const findHod = headers.findIndex(h => h.includes('head of department') || h.includes('hod') || h.includes('dept'));
    if (findHod !== -1) hodIdx = findHod;
    const findStat = headers.findIndex(h => h.includes('status'));
    if (findStat !== -1) statusIdx = findStat;
  }

  const startIndex = isHeader ? 1 : 0;

  const existingEmails = new Set(existingUsers.map(u => u.email.toLowerCase()));
  const parsedEmailsInBatch = new Set<string>();

  for (let i = startIndex; i < lines.length; i++) {
    const rawLine = lines[i];
    const cols = rawLine.split(',').map(c => c.trim().replace(/^"|"$/g, ''));

    if (cols.length < 2) {
      errors.push(`Row ${i + 1}: Insufficient columns. Needs Name and Email.`);
      continue;
    }

    const name = cols[0];
    const email = cols[1];
    const roleInput = cols[2] || 'Sales Team';
    const stateInput = cols[3] || 'Selangor';
    const regionInput = cols[4] || '';
    const headOfSalesInput = cols[hosIdx] || "Dato' Wong Wei Sheng";
    const headOfDeptInput = hodIdx !== -1 ? cols[hodIdx] : (cols.length > 7 ? cols[6] : 'Ir. Ahmad Rizal');
    const statusInput = statusIdx !== -1 && cols[statusIdx] ? cols[statusIdx] : (cols.length > 7 ? cols[7] : (cols[6] || 'Active'));

    if (!name) {
      errors.push(`Row ${i + 1}: Name is required.`);
      continue;
    }

    if (!email || !email.includes('@')) {
      errors.push(`Row ${i + 1} ("${name}"): Invalid email address "${email}".`);
      continue;
    }

    if (existingEmails.has(email.toLowerCase()) || parsedEmailsInBatch.has(email.toLowerCase())) {
      errors.push(`Row ${i + 1} ("${name}"): Email "${email}" already exists or is duplicated in batch.`);
      continue;
    }

    parsedEmailsInBatch.add(email.toLowerCase());

    const role = normalizeUserRole(roleInput);
    const state = stateInput || 'Selangor';
    const region = regionInput || getRegionFromState(state);
    const headOfSales = role === 'Head of Sales' ? (headOfSalesInput || name) : (headOfSalesInput || "Dato' Wong Wei Sheng");
    const headOfDepartment = role === 'Head of Department' ? (headOfDeptInput || name) : (headOfDeptInput || 'Ir. Ahmad Rizal');
    const userStatus: UserStatus = (statusInput.trim().toLowerCase() === 'inactive') ? 'Inactive' : 'Active';

    const avatarUrl = AVATAR_LIST[(i - startIndex) % AVATAR_LIST.length];

    users.push({
      id: generateId(),
      name,
      email,
      role,
      state,
      region,
      headOfSales,
      headOfDepartment,
      userStatus,
      status: userStatus,
      avatarUrl
    });
  }

  return { users, errors };
}

export function generateSampleUserCSV(): string {
  return `Name, Email, Role, State, Region, Head of Sales, Head of Department, User Status
Ahmad Razak, ahmad.razak@example.com, Sales Team, Selangor, Central, Dato' Wong Wei Sheng, Ir. Ahmad Rizal, Active
Siti Sarah, siti.sarah@example.com, Head of Sales, Penang, Northern, Siti Sarah, Ir. Ahmad Rizal, Active
Wong Wei Ming, wong.wm@example.com, Device Team, Kuala Lumpur, Central, Dato' Wong Wei Sheng, Ir. Ahmad Rizal, Active
Faridah Kassim, faridah.k@example.com, Head of Operation, Johor, Southern, Dato' Wong Wei Sheng, Ir. Ahmad Rizal, Active
Ir. Ahmad Rizal, ahmad.rizal@example.com, Head of Department, Kuala Lumpur, Central, Dato' Wong Wei Sheng, Ir. Ahmad Rizal, Active
Johnathan Tan, johnathan.tan@example.com, Sales Team, Sarawak, Sarawak, Dato' Wong Wei Sheng, Ir. Ahmad Rizal, Active
Nurul Huda, nurul.huda@example.com, Sales Team, Sabah, Sabah, Dato' Wong Wei Sheng, Ir. Ahmad Rizal, Active`;
}

export function downloadUsersCSV(usersList: User[]): void {
  const headers = ['User ID', 'Name', 'Email', 'Role', 'State', 'Region', 'Head of Sales', 'Head of Department', 'User Status'];
  
  const rows = usersList.map(u => [
    `"${(u.id || '').replace(/"/g, '""')}"`,
    `"${(u.name || '').replace(/"/g, '""')}"`,
    `"${(u.email || '').replace(/"/g, '""')}"`,
    `"${(u.role || '').replace(/"/g, '""')}"`,
    `"${(u.state || '').replace(/"/g, '""')}"`,
    `"${(u.region || '').replace(/"/g, '""')}"`,
    `"${(u.headOfSales || '').replace(/"/g, '""')}"`,
    `"${(u.headOfDepartment || '').replace(/"/g, '""')}"`,
    `"${(u.userStatus || u.status || 'Active').replace(/"/g, '""')}"`
  ]);

  const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  const timestamp = new Date().toISOString().slice(0, 10);
  link.setAttribute('download', `system_users_export_${timestamp}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export function isRequestForHeadOfSales(
  request: RoadshowRequest,
  headOfSalesUser: User,
  allUsers: User[]
): boolean {
  if (!headOfSalesUser || headOfSalesUser.role !== 'Head of Sales') {
    return true;
  }

  // Head of Sales can view their own created requests
  if (
    request.createdByUserId === headOfSalesUser.id ||
    (request.createdByName && request.createdByName.trim().toLowerCase() === headOfSalesUser.name.trim().toLowerCase())
  ) {
    return true;
  }

  // Find the request creator in User Access Management (allUsers)
  const creator = (allUsers || []).find(
    u =>
      u.id === request.createdByUserId ||
      (request.createdByEmail && u.email.toLowerCase() === request.createdByEmail.toLowerCase()) ||
      (request.createdByName && u.name.toLowerCase() === request.createdByName.toLowerCase())
  );

  if (creator) {
    // Return true if the request creator is tagged to this Head of Sales in User Access Management
    const assignedHos = (creator.headOfSales || '').trim().toLowerCase();
    const currentHosName = (headOfSalesUser.name || '').trim().toLowerCase();
    const currentHosId = (headOfSalesUser.id || '').trim().toLowerCase();
    return assignedHos === currentHosName || assignedHos === currentHosId;
  }

  // Fallback if creator user is not in allUsers table
  return !headOfSalesUser.region || headOfSalesUser.region === 'ALL' || request.partA.region === headOfSalesUser.region;
}

export function isRequestForHeadOfDepartment(
  request: RoadshowRequest,
  headOfDeptUser: User,
  allUsers: User[]
): boolean {
  if (!headOfDeptUser || headOfDeptUser.role !== 'Head of Department') {
    return true;
  }

  // Head of Department can view their own created requests
  if (
    request.createdByUserId === headOfDeptUser.id ||
    (request.createdByName && request.createdByName.trim().toLowerCase() === headOfDeptUser.name.trim().toLowerCase())
  ) {
    return true;
  }

  // Find the request creator in User Access Management (allUsers)
  const creator = (allUsers || []).find(
    u =>
      u.id === request.createdByUserId ||
      (request.createdByEmail && u.email.toLowerCase() === request.createdByEmail.toLowerCase()) ||
      (request.createdByName && u.name.toLowerCase() === request.createdByName.toLowerCase())
  );

  if (creator) {
    // Return true if the request creator is tagged to this Head of Department in User Access Management
    const assignedHod = (creator.headOfDepartment || '').trim().toLowerCase();
    const currentHodName = (headOfDeptUser.name || '').trim().toLowerCase();
    const currentHodId = (headOfDeptUser.id || '').trim().toLowerCase();
    return assignedHod === currentHodName || assignedHod === currentHodId;
  }

  // Fallback if creator user is not in allUsers table
  return !headOfDeptUser.region || headOfDeptUser.region === 'ALL' || request.partA.region === headOfDeptUser.region;
}


