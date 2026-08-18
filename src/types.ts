export type UserRole = 
  | 'Sales Team' 
  | 'Head of Sales' 
  | 'Device Team' 
  | 'Head of Operation' 
  | 'Head of Department'
  | 'Admin';

export type RequestStatus = 
  | 'Draft'
  | 'Pending Head of Sales'
  | 'Under Review' // Device Team stage
  | 'Pending Sales Acceptance'
  | 'Pending Head of Operation'
  | 'Approved'
  | 'Rejected';

export type UserStatus = 'Active' | 'Inactive';

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  state: string;
  region: string;
  avatarUrl?: string;
  headOfSales?: string;
  headOfDepartment?: string;
  userStatus?: UserStatus;
  status?: UserStatus;
}

export interface PartARoadshowInfo {
  requestor?: string;
  eventName: string;
  location: string;
  state: string;
  region: string;
  organizer: string;
  startDate: string;
  endDate: string;
  objective: string;
  partner: string;
}

export interface PartBDeviceItem {
  id: string;
  material: string;
  description: string;
  quantity: number;
  recommendedQuantity?: number; // 5. Recommended Device Quantity
  rrpRM: number;
  totalRrpRM: number; // calculated quantity * rrpRM
  status?: 'Approved' | 'Rejected'; // Device Allocation Status: Approved or Rejected
  remarks?: string; // Device Team remarks
  imei?: string; // Device IMEI No
  customerName?: string;
  nric?: string;
  sppOrder?: string;
  mobileNumber?: string;
  submissionRemarks?: string;
}

export type DeviceStatus = 'In Stock' | 'EOL';

export interface DeviceInventoryItem {
  id: string;
  material: string;
  description: string;
  brand?: string;
  rrpRM: number;
  remarks?: string;
  deviceStatus?: DeviceStatus;
  updatedAt?: string;
}

export interface ImeiInventoryItem {
  id: string;
  imei: string;
  material: string;
  description: string;
  rrpRM: number;
  requestCode?: string;
  requestId?: string;
  eventName?: string;
  requestorName?: string;
  region?: string;
  state?: string;
  customerName?: string;
  nric?: string;
  sppOrder?: string;
  mobileNumber?: string;
  submissionRemarks?: string;
  status: 'HOO Approved' | 'Pending Approval' | 'Unassigned Stock';
  updatedAt?: string;
}

export interface WorkflowHistoryLog {
  id: string;
  timestamp: string;
  actorName: string;
  actorRole: UserRole;
  action: string;
  comments?: string;
  previousStatus?: RequestStatus;
  newStatus?: RequestStatus;
}

export interface RoadshowRequest {
  id: string;
  requestCode: string;
  createdByUserId: string;
  createdByName: string;
  createdByEmail: string;
  createdAt: string;
  updatedAt: string;
  status: RequestStatus;
  partA: PartARoadshowInfo;
  partB: PartBDeviceItem[];
  rejectedPartB?: PartBDeviceItem[]; // Historical rejected requested devices evaluated by Device Team
  totalValueRM: number;
  assignedHeadOfOperation?: string;
  headOfSalesApproval?: {
    approvedBy: string;
    approvedAt: string;
    comments?: string;
  };
  deviceTeamApproval?: {
    approvedBy: string;
    approvedAt: string;
    comments?: string;
  };
  headOfOperationApproval?: {
    approvedBy: string;
    approvedAt: string;
    comments?: string;
  };
  rejectionInfo?: {
    rejectedBy: string;
    rejectedRole: UserRole;
    rejectedAt: string;
    reason: string;
  };
  history: WorkflowHistoryLog[];
}

export const MALAYSIAN_STATES = [
  'Selangor',
  'Kuala Lumpur',
  'Johor',
  'Penang',
  'Perak',
  'Kedah',
  'Melaka',
  'Pahang',
  'Kelantan',
  'Terengganu',
  'Negeri Sembilan',
  'Perlis',
  'Sabah',
  'Sarawak',
  'Labuan',
  'Putrajaya'
];

export const MALAYSIAN_REGIONS = [
  'Central',
  'Northern',
  'Southern',
  'Eastern',
  'Sarawak',
  'Sabah'
];
