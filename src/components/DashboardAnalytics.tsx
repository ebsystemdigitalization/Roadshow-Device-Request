import React, { useState } from 'react';
import { RoadshowRequest, DeviceInventoryItem, User, UserRole, MALAYSIAN_REGIONS, PartBDeviceItem } from '../types';
import { 
  formatRM, 
  inferBrandFromDescription, 
  calculateTotalRequestedValue, 
  calculateTotalRequestedUnits, 
  calculateApprovedValue, 
  calculateApprovedUnits, 
  calculateRejectedValue, 
  calculateRejectedUnits 
} from '../utils/formatters';
import { StatusBadge } from './StatusBadge';
import { 
  BarChart3, 
  TrendingUp, 
  Smartphone, 
  CheckCircle2, 
  Clock, 
  AlertTriangle, 
  MapPin, 
  DollarSign, 
  Layers, 
  Search, 
  Globe, 
  Tag, 
  Package, 
  Boxes, 
  Sparkles, 
  Filter, 
  ChevronRight,
  ChevronDown,
  X,
  PieChart,
  RotateCcw
} from 'lucide-react';

interface DashboardAnalyticsProps {
  requests: RoadshowRequest[];
  deviceInventory?: DeviceInventoryItem[];
  currentUser?: User;
}

function getBrandTheme(brandName: string) {
  const b = brandName.toLowerCase();
  if (b.includes('samsung')) {
    return {
      bg: 'bg-blue-50',
      border: 'border-blue-200',
      text: 'text-blue-700',
      badgeBg: 'bg-blue-600',
      badgeText: 'text-white',
      barBg: 'bg-blue-500',
      accent: 'text-blue-600',
      lightBg: 'bg-blue-50/50'
    };
  }
  if (b.includes('apple')) {
    return {
      bg: 'bg-slate-100',
      border: 'border-slate-300',
      text: 'text-slate-900',
      badgeBg: 'bg-slate-900',
      badgeText: 'text-white',
      barBg: 'bg-slate-800',
      accent: 'text-slate-800',
      lightBg: 'bg-slate-50'
    };
  }
  if (b.includes('xiaomi')) {
    return {
      bg: 'bg-orange-50',
      border: 'border-orange-200',
      text: 'text-orange-700',
      badgeBg: 'bg-orange-600',
      badgeText: 'text-white',
      barBg: 'bg-orange-500',
      accent: 'text-orange-600',
      lightBg: 'bg-orange-50/50'
    };
  }
  if (b.includes('vivo')) {
    return {
      bg: 'bg-indigo-50',
      border: 'border-indigo-200',
      text: 'text-indigo-700',
      badgeBg: 'bg-indigo-600',
      badgeText: 'text-white',
      barBg: 'bg-indigo-500',
      accent: 'text-indigo-600',
      lightBg: 'bg-indigo-50/50'
    };
  }
  if (b.includes('oppo')) {
    return {
      bg: 'bg-emerald-50',
      border: 'border-emerald-200',
      text: 'text-emerald-700',
      badgeBg: 'bg-emerald-600',
      badgeText: 'text-white',
      barBg: 'bg-emerald-500',
      accent: 'text-emerald-600',
      lightBg: 'bg-emerald-50/50'
    };
  }
  if (b.includes('honor')) {
    return {
      bg: 'bg-cyan-50',
      border: 'border-cyan-200',
      text: 'text-cyan-700',
      badgeBg: 'bg-cyan-600',
      badgeText: 'text-white',
      barBg: 'bg-cyan-500',
      accent: 'text-cyan-600',
      lightBg: 'bg-cyan-50/50'
    };
  }
  if (b.includes('huawei')) {
    return {
      bg: 'bg-rose-50',
      border: 'border-rose-200',
      text: 'text-rose-700',
      badgeBg: 'bg-rose-600',
      badgeText: 'text-white',
      barBg: 'bg-rose-500',
      accent: 'text-rose-600',
      lightBg: 'bg-rose-50/50'
    };
  }
  return {
    bg: 'bg-slate-50',
    border: 'border-slate-200',
    text: 'text-slate-700',
    badgeBg: 'bg-slate-700',
    badgeText: 'text-white',
    barBg: 'bg-slate-600',
    accent: 'text-slate-600',
    lightBg: 'bg-slate-50'
  };
}

export const DashboardAnalytics: React.FC<DashboardAnalyticsProps> = ({ 
  requests, 
  deviceInventory = [],
  currentUser 
}) => {
  const [selectedRegion, setSelectedRegion] = useState<string>('ALL');
  const [roadshowSearch, setRoadshowSearch] = useState('');
  const [deviceSearch, setDeviceSearch] = useState('');
  const [brandSearch, setBrandSearch] = useState('');
  const [brandFilterMode, setBrandFilterMode] = useState<'ALL' | 'APPROVED'>('ALL');

  // Check if current user role is permitted to use the Region filter
  const allowedRegionRoles: UserRole[] = [
    'Head of Department',
    'Admin',
    'Device Team',
    'Head of Operation'
  ];
  const isRegionSelectAllowed = !currentUser || allowedRegionRoles.includes(currentUser.role);

  // Active requests filtered by selected region (if allowed and active)
  const activeRequests = isRegionSelectAllowed && selectedRegion !== 'ALL'
    ? requests.filter(r => (r.partA?.region || 'Central').toLowerCase() === selectedRegion.toLowerCase())
    : requests;

  const totalRequests = activeRequests.length;
  
  // Total Value Requested: Crucially includes the total value of all requested devices and rejected devices
  const totalValueSum = activeRequests.reduce((acc, r) => acc + calculateTotalRequestedValue(r), 0);
  const totalDevicesCount = activeRequests.reduce((acc, r) => acc + calculateTotalRequestedUnits(r), 0);

  const approvedRequests = activeRequests.filter(r => r.status === 'Approved');
  const approvedValueSum = approvedRequests.reduce((acc, r) => acc + calculateApprovedValue(r), 0);
  const approvedDevicesCount = approvedRequests.reduce((acc, r) => acc + calculateApprovedUnits(r), 0);

  const rejectedValueSum = activeRequests.reduce((acc, r) => acc + calculateRejectedValue(r), 0);
  const rejectedDevicesCount = activeRequests.reduce((acc, r) => acc + calculateRejectedUnits(r), 0);

  const pendingRequests = activeRequests.filter(r => 
    r.status === 'Pending Head of Sales' || 
    r.status === 'Under Review' || 
    r.status === 'Pending Sales Acceptance' || 
    r.status === 'Pending Head of Operation'
  );

  // Region breakdown (computed with total requested value including rejected devices)
  const regionMap: Record<string, { count: number; value: number }> = {};
  requests.forEach(r => {
    const region = r.partA?.region || 'Central';
    if (!regionMap[region]) {
      regionMap[region] = { count: 0, value: 0 };
    }
    regionMap[region].count += 1;
    regionMap[region].value += calculateTotalRequestedValue(r);
  });

  // Status breakdown for active requests
  const statusCounts = {
    'Draft': activeRequests.filter(r => r.status === 'Draft').length,
    'Pending Head of Sales': activeRequests.filter(r => r.status === 'Pending Head of Sales').length,
    'Under Review': activeRequests.filter(r => r.status === 'Under Review').length,
    'Pending Sales Acceptance': activeRequests.filter(r => r.status === 'Pending Sales Acceptance').length,
    'Pending Head of Operation': activeRequests.filter(r => r.status === 'Pending Head of Operation').length,
    'Approved': activeRequests.filter(r => r.status === 'Approved').length,
    'Rejected': activeRequests.filter(r => r.status === 'Rejected').length,
  };

  // Helper to lookup brand for a device item
  const resolveDeviceBrand = (item: { material?: string; description?: string }): string => {
    const mat = (item.material || '').trim().toLowerCase();
    if (mat && deviceInventory.length > 0) {
      const invMatch = deviceInventory.find(i => i.material.trim().toLowerCase() === mat);
      if (invMatch && invMatch.brand && invMatch.brand.trim()) {
        return invMatch.brand.trim();
      }
    }
    const desc = item.description || (item as any).modelName || '';
    const inferred = inferBrandFromDescription(desc, item.material);
    if (inferred) return inferred;
    return 'Other';
  };

  // Compute Brand Aggregations based on activeRequests (including both requested partB and rejectedPartB)
  interface BrandAgg {
    brand: string;
    totalQuantity: number;
    approvedQuantity: number;
    totalValueRM: number;
    approvedValueRM: number;
    requestCount: number;
    approvedRequestCount: number;
    models: Map<string, { material: string; description: string; quantity: number; approvedQuantity: number; rrpRM: number }>;
  }

  const brandAggMap: Record<string, BrandAgg> = {};
  let totalBrandQuantitySum = 0;
  let totalApprovedBrandQuantitySum = 0;

  activeRequests.forEach(req => {
    const isApprovedReq = req.status === 'Approved';
    const seenBrandsInThisReq = new Set<string>();
    const seenApprovedBrandsInThisReq = new Set<string>();

    // Gather all requested items (partB + preserved non-duplicate items in rejectedPartB)
    const allRequestedItems: PartBDeviceItem[] = [];
    const seenItemIds = new Set<string>();

    (req.partB || []).forEach(item => {
      seenItemIds.add(item.id);
      allRequestedItems.push(item);
    });

    (req.rejectedPartB || []).forEach(item => {
      if (!seenItemIds.has(item.id)) {
        seenItemIds.add(item.id);
        allRequestedItems.push(item);
      }
    });

    allRequestedItems.forEach(item => {
      const isItemRejected = item.status === 'Rejected';
      const brand = resolveDeviceBrand(item);
      const qty = Number(item.quantity) || 0;
      const approvedQty = isApprovedReq && !isItemRejected ? (item.recommendedQuantity ?? item.quantity ?? 0) : 0;
      const rrp = Number(item.rrpRM) || 0;
      const val = qty * rrp;
      const approvedVal = approvedQty * rrp;

      if (!brandAggMap[brand]) {
        brandAggMap[brand] = {
          brand,
          totalQuantity: 0,
          approvedQuantity: 0,
          totalValueRM: 0,
          approvedValueRM: 0,
          requestCount: 0,
          approvedRequestCount: 0,
          models: new Map()
        };
      }

      brandAggMap[brand].totalQuantity += qty;
      brandAggMap[brand].approvedQuantity += approvedQty;
      brandAggMap[brand].totalValueRM += val;
      brandAggMap[brand].approvedValueRM += approvedVal;
      seenBrandsInThisReq.add(brand);
      if (approvedQty > 0) {
        seenApprovedBrandsInThisReq.add(brand);
      }

      totalBrandQuantitySum += qty;
      totalApprovedBrandQuantitySum += approvedQty;

      // Model detail tracking
      const modelKey = `${item.material || 'N/A'}___${item.description || 'Device'}`;
      const existingModel = brandAggMap[brand].models.get(modelKey);
      if (existingModel) {
        existingModel.quantity += qty;
        existingModel.approvedQuantity += approvedQty;
      } else {
        brandAggMap[brand].models.set(modelKey, {
          material: item.material || 'N/A',
          description: item.description || 'Device',
          quantity: qty,
          approvedQuantity: approvedQty,
          rrpRM: rrp
        });
      }
    });

    seenBrandsInThisReq.forEach(b => {
      if (brandAggMap[b]) {
        brandAggMap[b].requestCount += 1;
      }
    });
    seenApprovedBrandsInThisReq.forEach(b => {
      if (brandAggMap[b]) {
        brandAggMap[b].approvedRequestCount += 1;
      }
    });
  });

  const brandList = Object.values(brandAggMap)
    .filter(b => {
      // If user clicked "Approved Only" button, only show brands that have approved devices
      if (brandFilterMode === 'APPROVED' && b.approvedQuantity <= 0) {
        return false;
      }
      const q = brandSearch.toLowerCase().trim();
      if (!q) return true;
      const matchesBrand = b.brand.toLowerCase().includes(q);
      const matchesModel = Array.from(b.models.values()).some(m => {
        if (brandFilterMode === 'APPROVED' && m.approvedQuantity <= 0) return false;
        return m.description.toLowerCase().includes(q) || m.material.toLowerCase().includes(q);
      });
      return matchesBrand || matchesModel;
    })
    .sort((a, b) => {
      if (brandFilterMode === 'APPROVED') {
        return b.approvedQuantity - a.approvedQuantity;
      }
      return b.totalQuantity - a.totalQuantity;
    });

  const activeTotalBrandQuantity = brandFilterMode === 'APPROVED' ? totalApprovedBrandQuantitySum : totalBrandQuantitySum;
  const topBrand = brandList[0];

  // Filtered requests for Roadshow Info section based on activeRequests
  const filteredRoadshows = activeRequests.filter(r => {
    const query = roadshowSearch.toLowerCase().trim();
    if (!query) return true;
    const eventName = (r.partA?.eventName || '').toLowerCase();
    const requestor = (r.createdByName || r.partA?.requestor || '').toLowerCase();
    const state = (r.partA?.state || '').toLowerCase();
    const region = (r.partA?.region || '').toLowerCase();
    const code = (r.requestCode || '').toLowerCase();
    return eventName.includes(query) || requestor.includes(query) || state.includes(query) || region.includes(query) || code.includes(query);
  });

  // Aggregate devices ONLY from APPROVED requests for DEVICE INFO section based on activeRequests
  const approvedDeviceAggMap: Record<string, {
    material: string;
    description: string;
    brand: string;
    totalQuantity: number;
    rrpRM: number;
    approvedRequestCount: number;
  }> = {};

  approvedRequests.forEach(req => {
    req.partB?.forEach(item => {
      if (item.status && item.status === 'Rejected') return;

      const mat = item.material?.trim() || 'N/A';
      const desc = item.description?.trim() || (item as any).modelName?.trim() || 'N/A';
      const brand = resolveDeviceBrand(item);
      const key = `${mat}___${desc}`;

      if (!approvedDeviceAggMap[key]) {
        approvedDeviceAggMap[key] = {
          material: mat,
          description: desc,
          brand,
          totalQuantity: 0,
          rrpRM: item.rrpRM || 0,
          approvedRequestCount: 0
        };
      }
      const qty = item.quantity ?? item.recommendedQuantity ?? 0;
      approvedDeviceAggMap[key].totalQuantity += qty;
      approvedDeviceAggMap[key].approvedRequestCount += 1;
    });
  });

  const approvedDeviceAggList = Object.values(approvedDeviceAggMap)
    .sort((a, b) => b.totalQuantity - a.totalQuantity)
    .filter(d => {
      const q = deviceSearch.toLowerCase().trim();
      if (!q) return true;
      return d.material.toLowerCase().includes(q) || d.description.toLowerCase().includes(q) || (d.brand && d.brand.toLowerCase().includes(q));
    });

  return (
    <div id="dashboard-analytics-container" className="space-y-6">
      {/* Top Header & Region Selector Filter Bar for Head of Department, Admin, Device Team, and Head of Operation */}
      {isRegionSelectAllowed && (
        <div id="dashboard-region-control-bar" className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-indigo-50 text-indigo-600 rounded-xl border border-indigo-100 shrink-0">
              <Globe className="w-5 h-5" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-base font-bold text-slate-900">Roadshow Analytics Dashboard</h2>
                {currentUser?.role && (
                  <span className="text-[11px] font-semibold px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-700 border border-slate-200">
                    {currentUser.role} View
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Executive roadshow performance, approval status, and device allocation metrics.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {/* Select Region Dropdown */}
            <div className="flex items-center gap-2">
              <label htmlFor="select-region" className="text-xs font-bold text-slate-700 whitespace-nowrap flex items-center gap-1.5">
                <MapPin className="w-3.5 h-3.5 text-indigo-600" />
                Select Region:
              </label>
              <div className="relative min-w-[200px]">
                <select
                  id="select-region"
                  name="Select Region"
                  aria-label="Select Region"
                  value={selectedRegion}
                  onChange={(e) => setSelectedRegion(e.target.value)}
                  className="w-full pl-3 pr-8 py-2 bg-slate-50 hover:bg-slate-100 focus:bg-white border border-slate-300 rounded-xl text-xs font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all cursor-pointer shadow-xs appearance-none"
                >
                  <option value="ALL">All Regions (Nationwide)</option>
                  {MALAYSIAN_REGIONS.map((region) => {
                    const countForRegion = requests.filter(
                      r => (r.partA?.region || 'Central').toLowerCase() === region.toLowerCase()
                    ).length;
                    return (
                      <option key={region} value={region}>
                        {region} ({countForRegion} {countForRegion === 1 ? 'request' : 'requests'})
                      </option>
                    );
                  })}
                </select>
                <ChevronDown className="w-4 h-4 text-slate-500 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              </div>
            </div>

            {/* Reset Region Filter Button */}
            {selectedRegion !== 'ALL' && (
              <button
                type="button"
                id="btn-reset-region-filter"
                onClick={() => setSelectedRegion('ALL')}
                className="px-3 py-2 text-xs font-medium text-slate-600 hover:text-indigo-600 hover:bg-indigo-50 border border-slate-200 rounded-xl transition-colors flex items-center gap-1.5 cursor-pointer"
                title="Reset to all regions"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Reset</span>
              </button>
            )}
          </div>
        </div>
      )}

      {/* Active Region Filter Notice Badge (when specific region is selected) */}
      {isRegionSelectAllowed && selectedRegion !== 'ALL' && (
        <div className="bg-indigo-50/80 border border-indigo-200 p-3 rounded-xl flex items-center justify-between text-xs text-indigo-950">
          <div className="flex items-center gap-2">
            <span className="p-1 bg-indigo-600 text-white rounded-md">
              <MapPin className="w-3.5 h-3.5" />
            </span>
            <span>
              Filtering dashboard metrics by region: <strong className="text-indigo-900 font-bold">{selectedRegion}</strong> &bull; Showing <strong>{totalRequests}</strong> {totalRequests === 1 ? 'roadshow request' : 'roadshow requests'}
            </span>
          </div>
          <button
            type="button"
            onClick={() => setSelectedRegion('ALL')}
            className="text-xs text-indigo-700 hover:text-indigo-900 font-semibold underline cursor-pointer"
          >
            Show all regions
          </button>
        </div>
      )}

      {/* Top Banner KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* KPI 1 */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Total Requests</span>
            <div className="text-2xl font-bold text-slate-900 mt-1">{totalRequests}</div>
            <div className="text-[11px] text-slate-500 mt-0.5">
              {isRegionSelectAllowed && selectedRegion !== 'ALL' ? `In ${selectedRegion} region` : 'Across all regions & states'}
            </div>
          </div>
          <div className="p-3 bg-blue-50 text-blue-600 rounded-xl">
            <BarChart3 className="w-6 h-6" />
          </div>
        </div>

        {/* KPI 2 */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Total Value Requested</span>
              {rejectedValueSum > 0 && (
                <span className="inline-flex items-center text-[10px] font-bold bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded" title={`Includes ${formatRM(rejectedValueSum)} from rejected devices/requests`}>
                  Incl. Rejected
                </span>
              )}
            </div>
            <div className="text-2xl font-bold text-slate-900 mt-1">{formatRM(totalValueSum)}</div>
            <div className="text-[11px] text-slate-500 mt-0.5">
              {totalDevicesCount} total requested units {rejectedDevicesCount > 0 ? `(${rejectedDevicesCount} rejected)` : ''}
            </div>
          </div>
          <div className="p-3 bg-emerald-50 text-emerald-600 rounded-xl">
            <DollarSign className="w-6 h-6" />
          </div>
        </div>

        {/* KPI 3 */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Approved Value</span>
            <div className="text-2xl font-bold text-emerald-600 mt-1">{formatRM(approvedValueSum)}</div>
            <div className="text-[11px] text-slate-500 mt-0.5">{approvedRequests.length} fully approved events</div>
          </div>
          <div className="p-3 bg-emerald-100 text-emerald-700 rounded-xl">
            <CheckCircle2 className="w-6 h-6" />
          </div>
        </div>

        {/* KPI 4 */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Pending Review</span>
            <div className="text-2xl font-bold text-amber-600 mt-1">{pendingRequests.length}</div>
            <div className="text-[11px] text-slate-500 mt-0.5">Awaiting pipeline approval</div>
          </div>
          <div className="p-3 bg-amber-50 text-amber-600 rounded-xl">
            <Clock className="w-6 h-6" />
          </div>
        </div>
      </div>

      {/* Approval Pipeline Breakdown Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Status Pipeline Progress */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4 lg:col-span-2">
          <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-blue-600" />
            Approval Pipeline Breakdown
          </h3>

          <div className="space-y-3">
            {Object.entries(statusCounts).map(([statusKey, count]) => {
              const percentage = totalRequests > 0 ? Math.round((count / totalRequests) * 100) : 0;
              return (
                <div key={statusKey} className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <StatusBadge status={statusKey as any} size="sm" />
                    <span className="font-bold text-slate-800">
                      {count} requests ({percentage}%)
                    </span>
                  </div>
                  <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${
                        statusKey === 'Approved' ? 'bg-emerald-500' :
                        statusKey === 'Rejected' ? 'bg-rose-500' :
                        statusKey === 'Under Review' ? 'bg-blue-500' :
                        statusKey === 'Pending Head of Operation' ? 'bg-indigo-500' :
                        statusKey === 'Pending Head of Sales' ? 'bg-amber-500' : 'bg-slate-400'
                      }`}
                      style={{ width: `${percentage}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Region Distribution */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
              <MapPin className="w-4 h-4 text-indigo-600" />
              Requests by Region
            </h3>
            {isRegionSelectAllowed && selectedRegion !== 'ALL' && (
              <span className="text-[10px] font-bold text-indigo-700 bg-indigo-50 border border-indigo-200 px-2 py-0.5 rounded-full">
                Active: {selectedRegion}
              </span>
            )}
          </div>

          <div className="space-y-3">
            {Object.entries(regionMap).map(([regName, data]) => {
              const isSelected = isRegionSelectAllowed && selectedRegion === regName;
              return (
                <div
                  key={regName}
                  onClick={() => {
                    if (isRegionSelectAllowed) {
                      setSelectedRegion(selectedRegion === regName ? 'ALL' : regName);
                    }
                  }}
                  className={`p-3 rounded-xl border flex items-center justify-between text-xs transition-all ${
                    isSelected
                      ? 'bg-indigo-50 border-indigo-300 ring-2 ring-indigo-500/20 shadow-xs'
                      : isRegionSelectAllowed
                      ? 'bg-slate-50 border-slate-100 hover:bg-slate-100/80 hover:border-slate-200 cursor-pointer'
                      : 'bg-slate-50 border-slate-100'
                  }`}
                  title={isRegionSelectAllowed ? `Click to filter by ${regName}` : undefined}
                >
                  <div>
                    <div className="flex items-center gap-1.5 font-bold text-slate-800">
                      <span>{regName}</span>
                      {isSelected && (
                        <span className="text-[9px] px-1.5 py-0.2 bg-indigo-600 text-white rounded font-bold">
                          Filtered
                        </span>
                      )}
                    </div>
                    <div className="text-[11px] text-slate-500">{data.count} Roadshows</div>
                  </div>
                  <div className="text-right">
                    <div className="font-bold text-slate-900">{formatRM(data.value)}</div>
                    <div className="text-[10px] text-slate-400">Total RRP</div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* DEVICE BRAND INFO SECTION (Positioned after Approval Pipeline Breakdown) */}
      {/* ========================================================================= */}
      <div id="device-brand-info-section" className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-5">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-100">
          <div>
            <div className="flex flex-wrap items-center gap-2.5">
              <div className="p-2 bg-gradient-to-br from-indigo-500 to-blue-600 text-white rounded-xl shadow-xs">
                <Tag className="w-5 h-5" />
              </div>
              <h3 className="text-base font-bold text-slate-900 uppercase tracking-wider">
                DEVICE BRAND INFO
              </h3>
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
                <Boxes className="w-3 h-3 text-indigo-600" />
                {brandList.length} Active {brandList.length === 1 ? 'Brand' : 'Brands'}
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-1">
              Total quantity of device units aggregated by brand across roadshow requests.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {/* Filter Toggle: All vs Approved */}
            <div className="inline-flex p-1 bg-slate-100 rounded-xl border border-slate-200">
              <button
                type="button"
                onClick={() => setBrandFilterMode('ALL')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  brandFilterMode === 'ALL'
                    ? 'bg-white text-indigo-700 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                All Requests ({totalBrandQuantitySum} units)
              </button>
              <button
                type="button"
                onClick={() => setBrandFilterMode('APPROVED')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  brandFilterMode === 'APPROVED'
                    ? 'bg-emerald-600 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Approved Only ({totalApprovedBrandQuantitySum} units)
              </button>
            </div>

            {/* Search Input */}
            <div className="relative min-w-[200px]">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={brandSearch}
                onChange={(e) => setBrandSearch(e.target.value)}
                placeholder="Search brand or model..."
                className="w-full pl-9 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white"
              />
            </div>
          </div>
        </div>

        {/* Brand Summary KPI Strip */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
          <div className="p-4 bg-gradient-to-br from-indigo-50/80 to-blue-50/50 border border-indigo-100 rounded-xl">
            <span className="text-[11px] font-bold text-indigo-700 uppercase tracking-wider block">
              Total of Quantity Device Brand
            </span>
            <div className="text-2xl font-black text-indigo-950 mt-1 flex items-baseline gap-1.5">
              <span>{activeTotalBrandQuantity}</span>
              <span className="text-xs font-semibold text-indigo-600">units</span>
            </div>
            <p className="text-[11px] text-indigo-600/80 mt-0.5">
              {brandFilterMode === 'APPROVED' ? 'Approved device allocation units' : 'Total units requested across fleet'}
            </p>
          </div>

          <div className="p-4 bg-slate-50 border border-slate-200/80 rounded-xl">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
              Top Brand by Volume
            </span>
            <div className="text-xl font-bold text-slate-900 mt-1 truncate">
              {topBrand ? topBrand.brand : '—'}
            </div>
            <p className="text-[11px] text-slate-500 mt-0.5">
              {topBrand
                ? `${brandFilterMode === 'APPROVED' ? topBrand.approvedQuantity : topBrand.totalQuantity} units (${
                    activeTotalBrandQuantity > 0
                      ? Math.round(
                          ((brandFilterMode === 'APPROVED' ? topBrand.approvedQuantity : topBrand.totalQuantity) /
                            activeTotalBrandQuantity) *
                            100
                        )
                      : 0
                  }% share)`
                : 'No brand data'}
            </p>
          </div>

          <div className="p-4 bg-slate-50 border border-slate-200/80 rounded-xl">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
              Active Brand Portfolio
            </span>
            <div className="text-2xl font-bold text-slate-900 mt-1 flex items-baseline gap-1.5">
              <span>{brandList.length}</span>
              <span className="text-xs font-semibold text-slate-500">brands</span>
            </div>
            <p className="text-[11px] text-slate-500 mt-0.5">
              Represented in roadshow inventory
            </p>
          </div>

          <div className="p-4 bg-slate-50 border border-slate-200/80 rounded-xl">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
              {brandFilterMode === 'APPROVED' ? 'Approved Value' : 'Total Brand Value'}
            </span>
            <div className="text-xl font-bold text-emerald-700 mt-1">
              {formatRM(
                brandList.reduce(
                  (sum, b) => sum + (brandFilterMode === 'APPROVED' ? b.approvedValueRM : b.totalValueRM),
                  0
                )
              )}
            </div>
            <p className="text-[11px] text-slate-500 mt-0.5">
              Estimated RRP fleet total
            </p>
          </div>
        </div>

        {/* Brand Breakdown Grid Cards */}
        {brandList.length === 0 ? (
          <div className="py-10 text-center text-slate-400 bg-slate-50 rounded-xl border border-dashed border-slate-200">
            <Boxes className="w-8 h-8 mx-auto text-slate-300 mb-2" />
            <p className="text-xs font-medium">No device brand records matching your filter criteria.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {brandList.map((b) => {
              const theme = getBrandTheme(b.brand);
              const displayQty = brandFilterMode === 'APPROVED' ? b.approvedQuantity : b.totalQuantity;
              const displayVal = brandFilterMode === 'APPROVED' ? b.approvedValueRM : b.totalValueRM;
              const displayRoadshows = brandFilterMode === 'APPROVED' ? b.approvedRequestCount : b.requestCount;
              const sharePct = activeTotalBrandQuantity > 0 ? Math.round((displayQty / activeTotalBrandQuantity) * 100) : 0;
              const rawModels = Array.from(b.models.values());
              const modelsArray = brandFilterMode === 'APPROVED' 
                ? rawModels.filter(m => m.approvedQuantity > 0)
                : rawModels;

              return (
                <div
                  key={b.brand}
                  className={`p-5 rounded-2xl border ${theme.border} ${theme.lightBg} hover:shadow-md transition-all flex flex-col justify-between space-y-4`}
                >
                  <div>
                    {/* Card Header: Brand Badge & Share */}
                    <div className="flex items-center justify-between gap-2 mb-3">
                      <div className="flex items-center gap-2">
                        <span className={`px-3 py-1 rounded-lg text-xs font-extrabold tracking-wide ${theme.badgeBg} ${theme.badgeText} shadow-xs`}>
                          {b.brand}
                        </span>
                        <span className="text-[11px] font-medium text-slate-500">
                          {displayRoadshows} {displayRoadshows === 1 ? 'roadshow' : 'roadshows'}
                        </span>
                      </div>
                      <span className="text-xs font-bold text-slate-700 bg-white/80 border border-slate-200 px-2 py-0.5 rounded-full">
                        {sharePct}% share
                      </span>
                    </div>

                    {/* Total Quantity Device Brand Showcase */}
                    <div className="bg-white p-4 rounded-xl border border-slate-200/70 shadow-xs mb-3">
                      <div className="flex items-baseline justify-between">
                        <div>
                          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                            Total of Quantity Device Brand
                          </span>
                          <div className="text-2xl font-black text-slate-900 mt-0.5 flex items-baseline gap-1.5">
                            <span>{displayQty}</span>
                            <span className="text-xs font-bold text-slate-500">units</span>
                          </div>
                        </div>
                        <div className="text-right">
                          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                            {brandFilterMode === 'APPROVED' ? 'Approved Value' : 'Total Value'}
                          </span>
                          <span className="text-sm font-bold text-emerald-700">
                            {formatRM(displayVal)}
                          </span>
                        </div>
                      </div>

                      {/* Share Progress Bar */}
                      <div className="mt-3">
                        <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all duration-500 ${theme.barBg}`}
                            style={{ width: `${Math.max(sharePct, 4)}%` }}
                          />
                        </div>
                      </div>
                    </div>

                    {/* Models list summary */}
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between text-[11px] font-bold text-slate-600 pb-1">
                        <span>{brandFilterMode === 'APPROVED' ? 'Approved Models & Quantities' : 'Top Models & Quantities'} ({modelsArray.length}):</span>
                        <span className="text-[10px] text-slate-400">Qty</span>
                      </div>
                      <div className="space-y-1 max-h-32 overflow-y-auto pr-1">
                        {modelsArray.map((m) => {
                          const mQty = brandFilterMode === 'APPROVED' ? m.approvedQuantity : m.quantity;
                          return (
                            <div
                              key={`${m.material}-${m.description}`}
                              className="flex items-center justify-between text-[11px] bg-white/90 p-1.5 rounded-lg border border-slate-100"
                            >
                              <div className="truncate pr-2">
                                <span className="font-semibold text-slate-800">{m.description}</span>
                                <span className="text-[10px] text-slate-400 font-mono ml-1.5">[{m.material}]</span>
                              </div>
                              <span className={`font-bold px-2 py-0.5 rounded text-[10px] shrink-0 ${
                                brandFilterMode === 'APPROVED'
                                  ? 'text-emerald-900 bg-emerald-50 border border-emerald-200'
                                  : 'text-indigo-900 bg-indigo-50 border border-indigo-100'
                              }`}>
                                {mQty} pcs
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>

                  {/* Card Footer */}
                  <div className="pt-2 border-t border-slate-200/50 flex items-center justify-between text-[11px] text-slate-500">
                    <span>{modelsArray.length} unique {modelsArray.length === 1 ? 'model' : 'models'}</span>
                    <span className="font-medium text-slate-700">{displayQty} units {brandFilterMode === 'APPROVED' ? 'approved' : 'allocated'}</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Full Table View for Detailed Brand Audit */}
        <div className="mt-4 pt-4 border-t border-slate-100">
          <div className="flex items-center justify-between mb-3">
            <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
              <PieChart className="w-3.5 h-3.5 text-indigo-600" />
              Device Brand Quantity Breakdown Table
            </h4>
            <span className="text-[11px] text-slate-400">
              Showing {brandList.length} of {Object.keys(brandAggMap).length} brands
            </span>
          </div>

          <div className="overflow-x-auto rounded-xl border border-slate-200">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-bold text-slate-600 uppercase tracking-wider">
                  <th className="py-2.5 px-4">#</th>
                  <th className="py-2.5 px-4">Device Brand</th>
                  <th className="py-2.5 px-4 text-center">Total of Quantity Device Brand</th>
                  <th className="py-2.5 px-4 text-center">Approved Quantity</th>
                  <th className="py-2.5 px-4 text-center">Unique Models</th>
                  <th className="py-2.5 px-4 text-center">Roadshow Events</th>
                  <th className="py-2.5 px-4 text-right">
                    {brandFilterMode === 'APPROVED' ? 'Approved Value' : 'Total RRP Value'}
                  </th>
                  <th className="py-2.5 px-4 text-center">Fleet Share</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs text-slate-700 bg-white">
                {brandList.map((b, idx) => {
                  const theme = getBrandTheme(b.brand);
                  const sharePct = activeTotalBrandQuantity > 0 ? Math.round(((brandFilterMode === 'APPROVED' ? b.approvedQuantity : b.totalQuantity) / activeTotalBrandQuantity) * 100) : 0;
                  const uniqueModelsCount = brandFilterMode === 'APPROVED'
                    ? Array.from(b.models.values()).filter(m => m.approvedQuantity > 0).length
                    : b.models.size;
                  const roadshowsCount = brandFilterMode === 'APPROVED' ? b.approvedRequestCount : b.requestCount;
                  const valToDisplay = brandFilterMode === 'APPROVED' ? b.approvedValueRM : b.totalValueRM;

                  return (
                    <tr key={`table-${b.brand}`} className="hover:bg-slate-50/70 transition-colors">
                      <td className="py-3 px-4 text-slate-400 text-[11px]">{idx + 1}</td>
                      <td className="py-3 px-4 font-bold text-slate-900">
                        <div className="flex items-center gap-2">
                          <span className={`px-2.5 py-0.5 rounded-md text-[11px] font-bold ${theme.badgeBg} ${theme.badgeText}`}>
                            {b.brand}
                          </span>
                        </div>
                      </td>
                      <td className="py-3 px-4 text-center">
                        <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-black bg-indigo-50 text-indigo-900 border border-indigo-200">
                          <Smartphone className="w-3.5 h-3.5 text-indigo-600" />
                          <span>{b.totalQuantity} units</span>
                        </span>
                      </td>
                      <td className="py-3 px-4 text-center">
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">
                          <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                          <span>{b.approvedQuantity} units</span>
                        </span>
                      </td>
                      <td className="py-3 px-4 text-center font-semibold text-slate-800">
                        {uniqueModelsCount} models
                      </td>
                      <td className="py-3 px-4 text-center font-medium text-slate-700">
                        {roadshowsCount} roadshows
                      </td>
                      <td className="py-3 px-4 text-right font-bold text-emerald-700">
                        {formatRM(valToDisplay)}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <span className="font-bold text-slate-700">{sharePct}%</span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* DEVICE INFO Section (Placed after DEVICE BRAND INFO section) */}
      <div id="device-info-section" className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-5">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-100">
          <div>
            <div className="flex flex-wrap items-center gap-2.5">
              <h3 className="text-base font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
                <Smartphone className="w-5 h-5 text-indigo-600" />
                DEVICE INFO
              </h3>
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200/80">
                <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                Approved Requests Only
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-1">
              Material codes, device descriptions, brand names, and total quantities across all approved roadshow requests.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <div className="relative min-w-[240px]">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={deviceSearch}
                onChange={(e) => setDeviceSearch(e.target.value)}
                placeholder="Search material, description or brand..."
                className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white"
              />
            </div>
            <span className="inline-flex items-center px-3 py-1.5 rounded-xl text-xs font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200/80 whitespace-nowrap">
              {approvedDeviceAggList.length} Materials
            </span>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/80 border-y border-slate-200/80 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                <th className="py-3 px-4">Material</th>
                <th className="py-3 px-4">Description</th>
                <th className="py-3 px-4">Brand</th>
                <th className="py-3 px-4 text-center">Total Quantity</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs text-slate-700">
              {approvedDeviceAggList.length === 0 ? (
                <tr>
                  <td colSpan={4} className="py-8 text-center text-slate-400 italic">
                    No approved device materials found matching your search.
                  </td>
                </tr>
              ) : (
                approvedDeviceAggList.map((dev) => (
                  <tr key={`${dev.material}-${dev.description}`} className="hover:bg-slate-50/70 transition-colors">
                    <td className="py-3.5 px-4 whitespace-nowrap">
                      <span className="font-mono text-xs font-bold text-indigo-900 bg-indigo-50 border border-indigo-200/80 px-2.5 py-1 rounded-lg inline-block">
                        {dev.material}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 font-semibold text-slate-900">
                      <div className="flex items-center gap-2.5">
                        <div className="p-1.5 bg-slate-100 text-slate-600 rounded-lg border border-slate-200/60 shrink-0">
                          <Smartphone className="w-4 h-4 text-indigo-600" />
                        </div>
                        <div>
                          <div className="text-sm font-bold text-slate-900">{dev.description}</div>
                          <div className="text-[11px] text-slate-400 font-normal">
                            RRP: {formatRM(dev.rrpRM)} &bull; {dev.approvedRequestCount} approved {dev.approvedRequestCount === 1 ? 'request' : 'requests'}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="py-3.5 px-4">
                      {dev.brand ? (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-md text-[11px] font-bold bg-slate-100 text-slate-800 border border-slate-200">
                          {dev.brand}
                        </span>
                      ) : (
                        <span className="text-slate-400 italic text-[11px]">-</span>
                      )}
                    </td>
                    <td className="py-3.5 px-4 text-center whitespace-nowrap">
                      <span className="inline-flex items-center gap-1.5 px-3.5 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-800 border border-emerald-200/80">
                        <Smartphone className="w-3.5 h-3.5 text-emerald-600" />
                        <span>{dev.totalQuantity} units</span>
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ROADSHOW INFO Section (Placed after DEVICE INFO section) */}
      <div id="roadshow-info-section" className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-5">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-100">
          <div>
            <h3 className="text-base font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
              <Layers className="w-5 h-5 text-blue-600" />
              ROADSHOW INFO
            </h3>
            <p className="text-xs text-slate-500 mt-1">
              Detailed record of roadshow event name, requestor, state, region, and total quantity of devices.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <div className="relative min-w-[240px]">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={roadshowSearch}
                onChange={(e) => setRoadshowSearch(e.target.value)}
                placeholder="Search roadshow event, requestor, state..."
                className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white"
              />
            </div>
            <span className="inline-flex items-center px-3 py-1.5 rounded-xl text-xs font-semibold bg-slate-100 text-slate-700 border border-slate-200/80 whitespace-nowrap">
              {filteredRoadshows.length} Records
            </span>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/80 border-y border-slate-200/80 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                <th className="py-3 px-4">Event Name</th>
                <th className="py-3 px-4">Requestor</th>
                <th className="py-3 px-4">State</th>
                <th className="py-3 px-4">Region</th>
                <th className="py-3 px-4 text-center">Total Quantity Device Requested</th>
                <th className="py-3 px-4 text-center">Total Quantity Device Approved</th>
                <th className="py-3 px-4 text-center">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs text-slate-700">
              {filteredRoadshows.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-slate-400 italic">
                    No roadshow records found.
                  </td>
                </tr>
              ) : (
                filteredRoadshows.map((req) => {
                  const totalDeviceQty = calculateTotalRequestedUnits(req);
                  const totalReqValue = calculateTotalRequestedValue(req);
                  const approvedDeviceQty = calculateApprovedUnits(req);
                  const approvedReqValue = calculateApprovedValue(req);
                  const isApproved = req.status === 'Approved';
                  const requestorName = req.createdByName || req.partA?.requestor || '—';

                  return (
                    <tr key={req.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="py-3.5 px-4 font-semibold text-slate-900">
                        <div className="flex flex-col">
                          <span className="text-sm font-bold text-slate-900">{req.partA?.eventName || '—'}</span>
                          <span className="text-[11px] font-mono text-slate-400">{req.requestCode}</span>
                        </div>
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 rounded-full bg-slate-100 text-slate-600 font-bold text-[10px] flex items-center justify-center border border-slate-200">
                            {requestorName.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <div className="font-semibold text-slate-800">{requestorName}</div>
                            {req.createdByEmail && (
                              <div className="text-[10px] text-slate-400">{req.createdByEmail}</div>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="py-3.5 px-4 font-medium text-slate-800">
                        {req.partA?.state || '—'}
                      </td>
                      <td className="py-3.5 px-4">
                        <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-semibold bg-indigo-50 text-indigo-700 border border-indigo-100">
                          {req.partA?.region || 'Central'}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-blue-50 text-blue-800 border border-blue-200/80">
                          <Smartphone className="w-3.5 h-3.5 text-blue-600" />
                          <span>{totalDeviceQty} units</span>
                        </span>
                        <div className="text-[10px] text-slate-400 font-mono mt-0.5">
                          {formatRM(totalReqValue)}
                        </div>
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        {isApproved ? (
                          <>
                            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-800 border border-emerald-200/80">
                              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                              <span>{approvedDeviceQty} units</span>
                            </span>
                            <div className="text-[10px] text-emerald-700 font-mono mt-0.5">
                              {formatRM(approvedReqValue)}
                            </div>
                          </>
                        ) : (
                          <>
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-slate-100 text-slate-500 border border-slate-200">
                              <span>0 units</span>
                            </span>
                            <div className="text-[10px] text-slate-400 font-mono mt-0.5">
                              {req.status === 'Rejected' ? 'Rejected' : 'Pending Approval'}
                            </div>
                          </>
                        )}
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        <StatusBadge status={req.status} size="sm" />
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

