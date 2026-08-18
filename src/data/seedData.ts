import { User, RoadshowRequest, DeviceInventoryItem, ImeiInventoryItem } from '../types';

export const INITIAL_USERS: User[] = [
  {
    id: 'usr-sales-1',
    name: 'Ahmad Razak',
    email: 'ahmad.razak@company.com',
    role: 'Sales Team',
    state: 'Selangor',
    region: 'Central',
    headOfSales: "Dato' Wong Wei Sheng",
    headOfDepartment: 'Ir. Ahmad Rizal',
    userStatus: 'Active',
    avatarUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&auto=format&fit=crop&q=80'
  },
  {
    id: 'usr-sales-2',
    name: 'Farah Nadia',
    email: 'farah.nadia@company.com',
    role: 'Sales Team',
    state: 'Penang',
    region: 'Northern',
    headOfSales: 'Siti Sarah',
    headOfDepartment: 'Ir. Ahmad Rizal',
    userStatus: 'Active',
    avatarUrl: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=100&auto=format&fit=crop&q=80'
  },
  {
    id: 'usr-hos-1',
    name: "Dato' Wong Wei Sheng",
    email: 'wong.ws@company.com',
    role: 'Head of Sales',
    state: 'Kuala Lumpur',
    region: 'Central',
    headOfSales: "Dato' Wong Wei Sheng",
    headOfDepartment: 'Ir. Ahmad Rizal',
    userStatus: 'Active',
    avatarUrl: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100&auto=format&fit=crop&q=80'
  },
  {
    id: 'usr-hod-1',
    name: 'Ir. Ahmad Rizal',
    email: 'ahmad.rizal@company.com',
    role: 'Head of Department',
    state: 'Kuala Lumpur',
    region: 'Central',
    headOfSales: "Dato' Wong Wei Sheng",
    headOfDepartment: 'Ir. Ahmad Rizal',
    userStatus: 'Active',
    avatarUrl: 'https://images.unsplash.com/photo-1560250097-0b93528c311a?w=100&auto=format&fit=crop&q=80'
  },
  {
    id: 'usr-dev-1',
    name: 'Siti Sarah Abdullah',
    email: 'siti.sarah@company.com',
    role: 'Device Team',
    state: 'Kuala Lumpur',
    region: 'Central',
    headOfSales: "Dato' Wong Wei Sheng",
    headOfDepartment: 'Ir. Ahmad Rizal',
    userStatus: 'Active',
    avatarUrl: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=100&auto=format&fit=crop&q=80'
  },
  {
    id: 'usr-hoo-1',
    name: 'Michael Tan',
    email: 'michael.tan@company.com',
    role: 'Head of Operation',
    state: 'Kuala Lumpur',
    region: 'Central',
    headOfSales: "Dato' Wong Wei Sheng",
    userStatus: 'Active',
    avatarUrl: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=100&auto=format&fit=crop&q=80'
  },
  {
    id: 'usr-hoo-2',
    name: 'MASILA BT SHAMERE',
    email: 'masila.shamere@company.com',
    role: 'Head of Operation',
    state: 'Kuala Lumpur',
    region: 'Central',
    headOfSales: "Dato' Wong Wei Sheng",
    userStatus: 'Active',
    avatarUrl: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=100&auto=format&fit=crop&q=80'
  },
  {
    id: 'usr-hoo-3',
    name: 'NOORA MAT RIFIN',
    email: 'noora.rifin@company.com',
    role: 'Head of Operation',
    state: 'Kuala Lumpur',
    region: 'Central',
    headOfSales: "Dato' Wong Wei Sheng",
    userStatus: 'Active',
    avatarUrl: 'https://images.unsplash.com/photo-1580489944761-15a19d654956?w=100&auto=format&fit=crop&q=80'
  },
  {
    id: 'usr-admin-1',
    name: 'Admin System',
    email: 'admin@company.com',
    role: 'Admin',
    state: 'Kuala Lumpur',
    region: 'Central',
    headOfSales: "Dato' Wong Wei Sheng",
    userStatus: 'Active',
    avatarUrl: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=100&auto=format&fit=crop&q=80'
  }
];

export const INITIAL_REQUESTS: RoadshowRequest[] = [
  {
    id: 'req-001',
    requestCode: 'RDR-2026-1082',
    createdByUserId: 'usr-sales-1',
    createdByName: 'Ahmad Razak',
    createdByEmail: 'ahmad.razak@company.com',
    createdAt: '2026-08-01T09:30:00Z',
    updatedAt: '2026-08-01T10:15:00Z',
    status: 'Under Review',
    partA: {
      requestor: 'Ahmad Razak',
      eventName: 'Mid Valley Tech Mega Expo 2026',
      location: 'Mid Valley Exhibition Centre, Centre Court',
      state: 'Kuala Lumpur',
      region: 'Central',
      organizer: 'Mid Valley Mega Mall & Tech Hub',
      startDate: '2026-08-15',
      endDate: '2026-08-18',
      objective: 'Drive new 5G device bundle sign-ups and showcase flagship ecosystem devices during the weekend peak traffic.',
      partner: 'Samsung Malaysia'
    },
    partB: [
      {
        id: 'dev-1',
        material: 'MAT-S24U-512',
        description: 'Galaxy S24 Ultra 512GB Titanium Gray',
        quantity: 10,
        rrpRM: 6299,
        totalRrpRM: 62990,
        remarks: 'Confirmed stock reserved at Shah Alam Hub'
      },
      {
        id: 'dev-2',
        material: 'MAT-ZFLIP5-256',
        description: 'Galaxy Z Flip5 256GB Mint',
        quantity: 6,
        rrpRM: 4499,
        totalRrpRM: 26994,
        remarks: 'Display units ready with security tethers'
      },
      {
        id: 'dev-3',
        material: 'MAT-GW6-44',
        description: 'Galaxy Watch6 44mm Bluetooth',
        quantity: 12,
        rrpRM: 1199,
        totalRrpRM: 14388,
        remarks: 'Gift-with-purchase bundle stock'
      }
    ],
    totalValueRM: 104372,
    headOfSalesApproval: {
      approvedBy: "Dato' Wong Wei Sheng",
      approvedAt: '2026-08-01T11:00:00Z',
      comments: 'Approved. Expected ROI and footfall targets are well aligned.'
    },
    history: [
      {
        id: 'h-1',
        timestamp: '2026-08-01T09:30:00Z',
        actorName: 'Ahmad Razak',
        actorRole: 'Sales Team',
        action: 'Created Request Draft'
      },
      {
        id: 'h-2',
        timestamp: '2026-08-01T10:15:00Z',
        actorName: 'Ahmad Razak',
        actorRole: 'Sales Team',
        action: 'Submitted Request to Head of Sales',
        previousStatus: 'Draft',
        newStatus: 'Pending Head of Sales'
      },
      {
        id: 'h-3',
        timestamp: '2026-08-01T11:00:00Z',
        actorName: "Dato' Wong Wei Sheng",
        actorRole: 'Head of Sales',
        action: 'Approved Request',
        comments: 'Approved. Expected ROI and footfall targets are well aligned.',
        previousStatus: 'Pending Head of Sales',
        newStatus: 'Under Review'
      }
    ]
  },
  {
    id: 'req-002',
    requestCode: 'RDR-2026-2041',
    createdByUserId: 'usr-sales-2',
    createdByName: 'Farah Nadia',
    createdByEmail: 'farah.nadia@company.com',
    createdAt: '2026-08-02T08:15:00Z',
    updatedAt: '2026-08-02T08:30:00Z',
    status: 'Pending Head of Sales',
    partA: {
      requestor: 'Farah Nadia',
      eventName: 'Gurney Plaza Digital Fiesta 2026',
      location: 'Gurney Plaza Atrium, Level 1',
      state: 'Penang',
      region: 'Northern',
      organizer: 'CapitaLand Penang',
      startDate: '2026-08-22',
      endDate: '2026-08-25',
      objective: 'Promote Northern region enterprise mobile plans and hand over free device gifts to new port-in subscribers.',
      partner: 'Apple Authorised Reseller'
    },
    partB: [
      {
        id: 'dev-201',
        material: 'MAT-IP15P-256',
        description: 'iPhone 15 Pro 256GB Natural Titanium',
        quantity: 8,
        rrpRM: 5499,
        totalRrpRM: 43992
      },
      {
        id: 'dev-202',
        material: 'MAT-IP15-128',
        description: 'iPhone 15 128GB Black',
        quantity: 15,
        rrpRM: 4399,
        totalRrpRM: 65985
      },
      {
        id: 'dev-203',
        material: 'MAT-AP2-WHT',
        description: 'AirPods Pro 2nd Gen USB-C',
        quantity: 20,
        rrpRM: 1099,
        totalRrpRM: 21980
      }
    ],
    totalValueRM: 131957,
    history: [
      {
        id: 'h-201',
        timestamp: '2026-08-02T08:15:00Z',
        actorName: 'Farah Nadia',
        actorRole: 'Sales Team',
        action: 'Created Request Draft'
      },
      {
        id: 'h-202',
        timestamp: '2026-08-02T08:30:00Z',
        actorName: 'Farah Nadia',
        actorRole: 'Sales Team',
        action: 'Submitted Request to Head of Sales',
        previousStatus: 'Draft',
        newStatus: 'Pending Head of Sales'
      }
    ]
  },
  {
    id: 'req-003',
    requestCode: 'RDR-2026-3090',
    createdByUserId: 'usr-sales-1',
    createdByName: 'Ahmad Razak',
    createdByEmail: 'ahmad.razak@company.com',
    createdAt: '2026-07-28T11:00:00Z',
    updatedAt: '2026-07-29T16:00:00Z',
    status: 'Pending Head of Operation',
    partA: {
      requestor: 'Ahmad Razak',
      eventName: 'Sunway Pyramid Youth Tech Fest',
      location: 'LG2 Orange Concourse, Sunway Pyramid',
      state: 'Selangor',
      region: 'Central',
      organizer: 'Sunway Malls',
      startDate: '2026-09-01',
      endDate: '2026-09-04',
      objective: 'Target Gen-Z college students with high-value midrange 5G gaming smartphones and earbud bundles.',
      partner: 'Xiaomi Malaysia'
    },
    partB: [
      {
        id: 'dev-301',
        material: 'MAT-XM14-512',
        description: 'Xiaomi 14 512GB Black',
        quantity: 12,
        recommendedQuantity: 12,
        rrpRM: 3799,
        totalRrpRM: 45588,
        status: 'Approved',
        remarks: 'Allocated directly from regional distribution pool'
      },
      {
        id: 'dev-302',
        material: 'MAT-POCO-F6',
        description: 'POCO F6 Pro 512GB White',
        quantity: 20,
        recommendedQuantity: 20,
        rrpRM: 2299,
        totalRrpRM: 45980,
        status: 'Approved',
        remarks: 'Stock confirmed by Device Ops'
      }
    ],
    rejectedPartB: [
      {
        id: 'dev-303-rej',
        material: 'MAT-XM-PAD-6',
        description: 'Xiaomi Pad 6 256GB Gravity Gray',
        quantity: 5,
        recommendedQuantity: 0,
        rrpRM: 1499,
        totalRrpRM: 0,
        status: 'Rejected',
        remarks: 'Central warehouse inventory depleted for tablet models. Excluded from roadshow batch.'
      }
    ],
    totalValueRM: 91568,
    headOfSalesApproval: {
      approvedBy: "Dato' Wong Wei Sheng",
      approvedAt: '2026-07-28T14:20:00Z',
      comments: 'Target audience aligns with campus marketing push.'
    },
    deviceTeamApproval: {
      approvedBy: 'Siti Sarah Abdullah',
      approvedAt: '2026-07-29T16:00:00Z',
      comments: 'Device allocations verified and logistics delivery scheduled.'
    },
    history: [
      {
        id: 'h-301',
        timestamp: '2026-07-28T11:00:00Z',
        actorName: 'Ahmad Razak',
        actorRole: 'Sales Team',
        action: 'Created Request Draft'
      },
      {
        id: 'h-302',
        timestamp: '2026-07-28T12:00:00Z',
        actorName: 'Ahmad Razak',
        actorRole: 'Sales Team',
        action: 'Submitted Request to Head of Sales',
        previousStatus: 'Draft',
        newStatus: 'Pending Head of Sales'
      },
      {
        id: 'h-303',
        timestamp: '2026-07-28T14:20:00Z',
        actorName: "Dato' Wong Wei Sheng",
        actorRole: 'Head of Sales',
        action: 'Approved Request',
        comments: 'Target audience aligns with campus marketing push.',
        previousStatus: 'Pending Head of Sales',
        newStatus: 'Under Review'
      },
      {
        id: 'h-304',
        timestamp: '2026-07-29T16:00:00Z',
        actorName: 'Siti Sarah Abdullah',
        actorRole: 'Device Team',
        action: 'Approved Device Allocation',
        comments: 'Device allocations verified and logistics delivery scheduled.',
        previousStatus: 'Under Review',
        newStatus: 'Pending Head of Operation'
      }
    ]
  },
  {
    id: 'req-004',
    requestCode: 'RDR-2026-4012',
    createdByUserId: 'usr-sales-1',
    createdByName: 'Ahmad Razak',
    createdByEmail: 'ahmad.razak@company.com',
    createdAt: '2026-07-20T10:00:00Z',
    updatedAt: '2026-07-22T14:00:00Z',
    status: 'Approved',
    partA: {
      requestor: 'Ahmad Razak',
      eventName: 'Johor Bahru City Square Tech Carnival',
      location: 'City Square Atrium, Main Floor',
      state: 'Johor',
      region: 'Southern',
      organizer: 'JB City Square Management',
      startDate: '2026-08-05',
      endDate: '2026-08-08',
      objective: 'Capture cross-border visitors and Singapore weekend commuters with roaming package & device combos.',
      partner: 'Vivo Malaysia'
    },
    partB: [
      {
        id: 'dev-401',
        material: 'MAT-VIVO-X100',
        description: 'Vivo X100 Pro 512GB Sunset Orange',
        quantity: 5,
        recommendedQuantity: 5,
        rrpRM: 4599,
        totalRrpRM: 22995,
        status: 'Approved',
        remarks: 'Dispatched from Southern Depot'
      },
      {
        id: 'dev-402',
        material: 'MAT-VIVO-V30',
        description: 'Vivo V30 5G 256GB Bloom White',
        quantity: 15,
        recommendedQuantity: 15,
        rrpRM: 1999,
        totalRrpRM: 29985,
        status: 'Approved',
        remarks: 'High volume inventory allocated'
      }
    ],
    rejectedPartB: [
      {
        id: 'dev-403-rej',
        material: 'MAT-VIVO-V29E',
        description: 'Vivo V29e 5G 256GB Ice Creek Blue',
        quantity: 8,
        recommendedQuantity: 0,
        rrpRM: 1399,
        totalRrpRM: 0,
        status: 'Rejected',
        remarks: 'EOL device model discontinued from central warehouse pool.'
      }
    ],
    totalValueRM: 52980,
    headOfSalesApproval: {
      approvedBy: "Dato' Wong Wei Sheng",
      approvedAt: '2026-07-20T15:00:00Z',
      comments: 'Good opportunity in Southern Region.'
    },
    deviceTeamApproval: {
      approvedBy: 'Siti Sarah Abdullah',
      approvedAt: '2026-07-21T09:30:00Z',
      comments: 'Depot logistics confirmed.'
    },
    headOfOperationApproval: {
      approvedBy: 'Michael Tan',
      approvedAt: '2026-07-22T14:00:00Z',
      comments: 'Fully approved. Security and courier tracking code generated.'
    },
    history: [
      {
        id: 'h-401',
        timestamp: '2026-07-20T10:00:00Z',
        actorName: 'Ahmad Razak',
        actorRole: 'Sales Team',
        action: 'Created Request Draft'
      },
      {
        id: 'h-402',
        timestamp: '2026-07-20T11:00:00Z',
        actorName: 'Ahmad Razak',
        actorRole: 'Sales Team',
        action: 'Submitted Request to Head of Sales',
        previousStatus: 'Draft',
        newStatus: 'Pending Head of Sales'
      },
      {
        id: 'h-403',
        timestamp: '2026-07-20T15:00:00Z',
        actorName: "Dato' Wong Wei Sheng",
        actorRole: 'Head of Sales',
        action: 'Approved Request',
        previousStatus: 'Pending Head of Sales',
        newStatus: 'Under Review'
      },
      {
        id: 'h-404',
        timestamp: '2026-07-21T09:30:00Z',
        actorName: 'Siti Sarah Abdullah',
        actorRole: 'Device Team',
        action: 'Approved Device Allocation',
        previousStatus: 'Under Review',
        newStatus: 'Pending Head of Operation'
      },
      {
        id: 'h-405',
        timestamp: '2026-07-22T14:00:00Z',
        actorName: 'Michael Tan',
        actorRole: 'Head of Operation',
        action: 'Final Approval Granted',
        comments: 'Fully approved. Security and courier tracking code generated.',
        previousStatus: 'Pending Head of Operation',
        newStatus: 'Approved'
      }
    ]
  },
  {
    id: 'req-005',
    requestCode: 'RDR-2026-0012',
    createdByUserId: 'usr-sales-1',
    createdByName: 'Ahmad Razak',
    createdByEmail: 'ahmad.razak@company.com',
    createdAt: '2026-08-02T14:00:00Z',
    updatedAt: '2026-08-02T14:00:00Z',
    status: 'Draft',
    partA: {
      requestor: 'Ahmad Razak',
      eventName: 'IOI City Mall Smart Home & Gadget Expo',
      location: 'IOI City Mall Phase 2 Concourse',
      state: 'Selangor',
      region: 'Central',
      organizer: 'IOI Properties Group',
      startDate: '2026-09-10',
      endDate: '2026-09-14',
      objective: 'Showcase home broadband and mobile device integration for family accounts.',
      partner: 'Honor Malaysia'
    },
    partB: [
      {
        id: 'dev-501',
        material: 'MAT-HNR-M6P',
        description: 'Honor Magic6 Pro 512GB Black',
        quantity: 5,
        rrpRM: 4499,
        totalRrpRM: 22495
      }
    ],
    totalValueRM: 22495,
    history: [
      {
        id: 'h-501',
        timestamp: '2026-08-02T14:00:00Z',
        actorName: 'Ahmad Razak',
        actorRole: 'Sales Team',
        action: 'Created Request Draft'
      }
    ]
  }
];

export const INITIAL_DEVICE_INVENTORY: DeviceInventoryItem[] = [
  {
    id: 'inv-1',
    material: 'MAT-S24U-512',
    description: 'Galaxy S24 Ultra 512GB Titanium Gray',
    brand: 'Samsung',
    rrpRM: 6299,
    remarks: 'Flagship stock available in main depot',
    deviceStatus: 'In Stock'
  },
  {
    id: 'inv-2',
    material: 'MAT-ZFLIP5-256',
    description: 'Galaxy Z Flip5 256GB Mint',
    brand: 'Samsung',
    rrpRM: 4499,
    remarks: 'Display demo units ready with security locks',
    deviceStatus: 'In Stock'
  },
  {
    id: 'inv-3',
    material: 'MAT-ZFOLD5-512',
    description: 'Galaxy Z Fold5 512GB Phantom Black',
    brand: 'Samsung',
    rrpRM: 7299,
    remarks: 'Limited premium roadshow allocation',
    deviceStatus: 'In Stock'
  },
  {
    id: 'inv-4',
    material: 'MAT-TAB-S9U',
    description: 'Galaxy Tab S9 Ultra 512GB Graphite',
    brand: 'Samsung',
    rrpRM: 5999,
    remarks: 'Includes S Pen and desktop stand accessories',
    deviceStatus: 'In Stock'
  },
  {
    id: 'inv-5',
    material: 'MAT-GW6-PRO',
    description: 'Galaxy Watch6 Classic 47mm Bluetooth',
    brand: 'Samsung',
    rrpRM: 1799,
    remarks: 'Promo bundle stock for event registration',
    deviceStatus: 'In Stock'
  },
  {
    id: 'inv-6',
    material: 'MAT-BP2-WHT',
    description: 'Galaxy Buds2 Pro White',
    brand: 'Samsung',
    rrpRM: 899,
    remarks: 'Gift with purchase inventory (End of Life)',
    deviceStatus: 'EOL'
  },
  {
    id: 'inv-7',
    material: 'MAT-XM14-512',
    description: 'Xiaomi 14 512GB Black',
    brand: 'Xiaomi',
    rrpRM: 3799,
    remarks: 'Flagship series allocated stock',
    deviceStatus: 'In Stock'
  },
  {
    id: 'inv-8',
    material: 'MAT-VIVO-X100',
    description: 'Vivo X100 Pro 512GB Sunset Orange',
    brand: 'Vivo',
    rrpRM: 4599,
    remarks: 'Southern depot allocated inventory',
    deviceStatus: 'In Stock'
  }
];

export const INITIAL_IMEI_INVENTORY: ImeiInventoryItem[] = [
  {
    id: 'imei-1',
    imei: '869123048571201',
    material: 'MAT-VIVO-X100',
    description: 'Vivo X100 Pro 512GB Sunset Orange',
    rrpRM: 4599,
    requestCode: 'RDR-2026-4012',
    requestId: 'req-004',
    eventName: 'Johor Bahru City Square Tech Carnival',
    requestorName: 'Ahmad Razak',
    region: 'Southern',
    state: 'Johor',
    customerName: 'Tan Wei Kiat',
    nric: '920512-01-5433',
    sppOrder: 'SPP-JB-8821',
    mobileNumber: '+6012-7881234',
    submissionRemarks: 'Customer port-in plan verified & handheld delivered',
    status: 'HOO Approved',
    updatedAt: '2026-08-05T10:00:00Z'
  },
  {
    id: 'imei-2',
    imei: '869123048571202',
    material: 'MAT-VIVO-X100',
    description: 'Vivo X100 Pro 512GB Sunset Orange',
    rrpRM: 4599,
    requestCode: 'RDR-2026-4012',
    requestId: 'req-004',
    eventName: 'Johor Bahru City Square Tech Carnival',
    requestorName: 'Ahmad Razak',
    region: 'Southern',
    state: 'Johor',
    customerName: 'Lim Lee Chen',
    nric: '881104-07-6112',
    sppOrder: 'SPP-JB-8822',
    mobileNumber: '+6016-4129833',
    submissionRemarks: 'Corporate enterprise plan sign-up',
    status: 'HOO Approved',
    updatedAt: '2026-08-05T11:20:00Z'
  },
  {
    id: 'imei-3',
    imei: '869123048571203',
    material: 'MAT-VIVO-V30',
    description: 'Vivo V30 5G 256GB Bloom White',
    rrpRM: 1999,
    requestCode: 'RDR-2026-4012',
    requestId: 'req-004',
    eventName: 'Johor Bahru City Square Tech Carnival',
    requestorName: 'Ahmad Razak',
    region: 'Southern',
    state: 'Johor',
    customerName: 'Muhammad Hafiz',
    nric: '950321-14-5121',
    sppOrder: 'SPP-JB-8823',
    mobileNumber: '+6019-3321102',
    submissionRemarks: 'Prepaid port-in bundle',
    status: 'HOO Approved',
    updatedAt: '2026-08-06T09:15:00Z'
  },
  {
    id: 'imei-4',
    imei: '35891204100001',
    material: 'MAT-TAB-S9U',
    description: 'Galaxy Tab S9 Ultra 512GB Graphite',
    rrpRM: 5999,
    requestCode: 'RDR-2026-3090',
    requestId: 'req-003',
    eventName: 'Sunway Pyramid Campus Digital Fest 2026',
    requestorName: 'Ahmad Razak',
    region: 'Central',
    state: 'Selangor',
    customerName: 'Chong Wei Lun',
    nric: '010415-10-6331',
    sppOrder: 'SPP-SW-1042',
    mobileNumber: '+6011-2098441',
    submissionRemarks: 'Student discount device program',
    status: 'Pending Approval',
    updatedAt: '2026-08-07T14:00:00Z'
  },
  {
    id: 'imei-5',
    imei: '35891204100002',
    material: 'MAT-S24U-512',
    description: 'Galaxy S24 Ultra 512GB Titanium Gray',
    rrpRM: 6299,
    requestCode: 'RDR-2026-1082',
    requestId: 'req-001',
    eventName: 'Mid Valley Tech Mega Expo 2026',
    requestorName: 'Ahmad Razak',
    region: 'Central',
    state: 'Kuala Lumpur',
    submissionRemarks: 'Reserved stock allocation for booth demo',
    status: 'Pending Approval',
    updatedAt: '2026-08-08T16:30:00Z'
  },
  {
    id: 'imei-6',
    imei: '35891204100003',
    material: 'MAT-S24U-512',
    description: 'Galaxy S24 Ultra 512GB Titanium Gray',
    rrpRM: 6299,
    status: 'Unassigned Stock',
    updatedAt: '2026-08-08T09:00:00Z'
  },
  {
    id: 'imei-7',
    imei: '35891204100004',
    material: 'MAT-ZFLIP5-256',
    description: 'Galaxy Z Flip5 256GB Mint',
    rrpRM: 4499,
    status: 'Unassigned Stock',
    updatedAt: '2026-08-08T09:00:00Z'
  },
  {
    id: 'imei-8',
    imei: '35891204100005',
    material: 'MAT-IP15P-256',
    description: 'iPhone 15 Pro 256GB Natural Titanium',
    rrpRM: 5499,
    status: 'Unassigned Stock',
    updatedAt: '2026-08-08T09:00:00Z'
  }
];
