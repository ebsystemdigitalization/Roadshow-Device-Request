import React, { useState, useEffect } from 'react';
import { RoadshowRequest, User, UserRole, PartBDeviceItem, DeviceInventoryItem, ImeiInventoryItem } from './types';
import { INITIAL_USERS, INITIAL_DEVICE_INVENTORY, INITIAL_IMEI_INVENTORY } from './data/seedData';
import { Navbar } from './components/Navbar';
import { LoginPage } from './components/LoginPage';
import { RequestList } from './components/RequestList';
import { RequestDetailModal } from './components/RequestDetailModal';
import { SalesRequestFormModal } from './components/SalesRequestFormModal';
import { DeviceTeamEditModal } from './components/DeviceTeamEditModal';
import { AdminUserManagement } from './components/AdminUserManagement';
import { DashboardAnalytics } from './components/DashboardAnalytics';
import { DeviceInventoryUploadModal } from './components/DeviceInventoryUploadModal';
import { ImeiInventoryPage } from './components/ImeiInventoryPage';
import { ImeiDetailRecord } from './components/ImeiDetailModal';
import { generateId, isRequestForHeadOfSales, isRequestForHeadOfUnit, isRequestForHeadOfDepartment } from './utils/formatters';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { auth } from './lib/firebase';
import {
  createRequest,
  deleteRequest,
  getRequests,
  updateRequest
} from './services/requestApi';
import { getUsers } from './services/userApi';

function ensureUniqueImeiInventory(items: ImeiInventoryItem[]): ImeiInventoryItem[] {
  const seenIds = new Set<string>();
  return (items || []).map((item, index) => {
    let id = item.id || `imei-${item.imei || 'item'}-${index}`;
    if (seenIds.has(id)) {
      id = `${id}-${index}-${Math.random().toString(36).slice(2, 6)}`;
    }
    seenIds.add(id);
    return {
      ...item,
      id
    };
  });
}

export default function App() {
  // Users are loaded from Firestore after authentication.
  const [users, setUsers] = useState<User[]>([]);

  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isAuthChecking, setIsAuthChecking] = useState(true);

  const [currentUser, setCurrentUser] = useState<User>(() => {
    const savedId = localStorage.getItem('rdr_current_user_id');
    if (savedId) {
      const found = users.find(u => u.id === savedId);
      if (found) return found;
    }
    return INITIAL_USERS[0];
  });

  const [requests, setRequests] = useState<RoadshowRequest[]>([]);

  const [deviceInventory, setDeviceInventory] = useState<DeviceInventoryItem[]>(() => {
    const saved = localStorage.getItem('rdr_device_inventory');
    if (saved) {
      try { return JSON.parse(saved); } catch { /* ignore */ }
    }
    return INITIAL_DEVICE_INVENTORY;
  });

  const [imeiInventory, setImeiInventory] = useState<ImeiInventoryItem[]>(() => {
    const saved = localStorage.getItem('rdr_imei_inventory');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          return ensureUniqueImeiInventory(parsed);
        }
      } catch { /* ignore */ }
    }
    return ensureUniqueImeiInventory(INITIAL_IMEI_INVENTORY);
  });

  const [activeTab, setActiveTab] = useState<'requests' | 'analytics' | 'admin' | 'imei-inventory'>('requests');
  const [selectedRequest, setSelectedRequest] = useState<RoadshowRequest | null>(null);

  // Modals
  const [isSalesModalOpen, setIsSalesModalOpen] = useState<boolean>(false);
  const [editingSalesRequest, setEditingSalesRequest] = useState<RoadshowRequest | null>(null);
  const [deviceTeamEditRequest, setDeviceTeamEditRequest] = useState<RoadshowRequest | null>(null);
  const [isInventoryModalOpen, setIsInventoryModalOpen] = useState<boolean>(false);

  // Restore and verify the Firebase session through the Cloud Run API.
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async firebaseUser => {
      if (!firebaseUser) {
        setIsAuthenticated(false);
        setIsAuthChecking(false);
        return;
      }

      try {
        const idToken = await firebaseUser.getIdToken();

        const response = await fetch(
          `${import.meta.env.VITE_API_BASE_URL}/api/auth/me`,
          {
            method: 'GET',
            headers: {
              Accept: 'application/json',
              Authorization: `Bearer ${idToken}`
            }
          }
        );

        const payload = await response.json();

        if (!response.ok) {
          throw new Error(
            payload.message ||
            'Unable to restore your Roadshow Device Request session.'
          );
        }

        const profile = payload.user ?? payload;
        const status = profile.userStatus || profile.status || 'Active';

        if (status === 'Inactive') {
          throw new Error('This user account is inactive.');
        }

        const restoredUser: User = {
          id: profile.id || profile.uid || firebaseUser.uid,
          name: profile.name,
          email: profile.email || firebaseUser.email || '',
          role: profile.role,
          state: profile.state || '',
          region: profile.region || '',
          avatarUrl: profile.avatarUrl,
          headOfUnit: profile.headOfUnit,
          headOfSales: profile.headOfSales,
          headOfDepartment: profile.headOfDepartment,
          userStatus: profile.userStatus || 'Active',
          status: profile.status
        };

        setCurrentUser(restoredUser);
        setIsAuthenticated(true);
      } catch (error) {
        console.error('Session restoration failed:', error);

        await signOut(auth);
        setIsAuthenticated(false);
      } finally {
        setIsAuthChecking(false);
      }
    });

    return unsubscribe;
  }, []);

  // Load the user directory and requests after authentication succeeds.
  useEffect(() => {
    if (!isAuthenticated) {
      setUsers([]);
      setRequests([]);
      return;
    }

    let isCancelled = false;

    const loadApplicationData = async () => {
      try {
        const [firestoreUsers, firestoreRequests] = await Promise.all([
          getUsers(),
          getRequests()
        ]);

        if (!isCancelled) {
          setUsers(firestoreUsers);
          setRequests(firestoreRequests);
        }
      } catch (error) {
        console.error('Unable to load Firestore application data:', error);

        if (!isCancelled) {
          alert(
            error instanceof Error
              ? error.message
              : 'Unable to load the RDR application data.'
          );
        }
      }
    };

    void loadApplicationData();

    return () => {
      isCancelled = true;
    };
  }, [isAuthenticated]);

  // Persist the remaining temporary prototype data to LocalStorage.
  useEffect(() => {
    localStorage.setItem('rdr_device_inventory', JSON.stringify(deviceInventory));
  }, [deviceInventory]);

  useEffect(() => {
    localStorage.setItem('rdr_imei_inventory', JSON.stringify(imeiInventory));
  }, [imeiInventory]);

  // Ensure non-admin users cannot remain on restricted tabs.
  useEffect(() => {
    if (currentUser.role !== 'Admin' && activeTab === 'admin') {
      setActiveTab('requests');
    }
    if (
      currentUser.role !== 'Admin' &&
      currentUser.role !== 'Device Team' &&
      activeTab === 'imei-inventory'
    ) {
      setActiveTab('requests');
    }
  }, [currentUser.role, activeTab]);

  // Keep the selected request synchronized when the requests array changes.
  useEffect(() => {
    if (selectedRequest) {
      const updated = requests.find(r => r.id === selectedRequest.id);
      if (updated) setSelectedRequest(updated);
    }
  }, [requests, selectedRequest]);

  // Login & Logout Handlers
  const handleLoginSuccess = (user: User) => {
    setCurrentUser(user);
    setIsAuthenticated(true);
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
    } catch (error) {
      console.error('Logout failed:', error);
    } finally {
      setIsAuthenticated(false);
      setActiveTab('requests');

      localStorage.removeItem('rdr_is_authenticated');
      localStorage.removeItem('rdr_current_user_id');
    }
  };

  // Reset demo data handler
  const handleResetData = () => {
    localStorage.removeItem('rdr_users');
    localStorage.removeItem('rdr_requests');
    localStorage.removeItem('rdr_device_inventory');
    localStorage.removeItem('rdr_imei_inventory');
    localStorage.removeItem('rdr_current_user_id');
    localStorage.removeItem('rdr_is_authenticated');
    setUsers([]);
    setRequests([]);
    setDeviceInventory(INITIAL_DEVICE_INVENTORY);
    setImeiInventory(INITIAL_IMEI_INVENTORY);
    setCurrentUser(INITIAL_USERS[0]);
    setIsAuthenticated(false);
  };

  // Handlers for IMEI Inventory
  const handleUpdateImeiItem = (updated: ImeiInventoryItem) => {
    setImeiInventory(prev => prev.map(item => item.id === updated.id ? updated : item));
  };

  const handleAddImeiItem = (newItem: ImeiInventoryItem) => {
    setImeiInventory(prev => [newItem, ...prev]);
  };

  const handleDeleteImeiItem = (id: string) => {
    setImeiInventory(prev => prev.filter(item => item.id !== id));
  };

  const handleBulkAddImeis = (items: ImeiInventoryItem[]) => {
    setImeiInventory(prev => [...items, ...prev]);
  };

  // --- Handlers for Device Inventory (Device Team & Admin) ---
  const handleSaveInventory = (importedItems: DeviceInventoryItem[], appendMode: boolean) => {
    setDeviceInventory(prev => {
      if (!appendMode) {
        return importedItems;
      }
      // Append mode: retain existing items, append new items
      return [...prev, ...importedItems];
    });
  };

  const handleDeleteInventoryItem = (itemId: string) => {
    setDeviceInventory(prev => prev.filter(item => item.id !== itemId));
  };

  const handleUpdateInventoryItem = (updatedItem: DeviceInventoryItem) => {
    setDeviceInventory(prev =>
      prev.map(item => (item.id === updatedItem.id ? { ...updatedItem, updatedAt: new Date().toISOString() } : item))
    );
  };

  // Check if current user is active Sales Team
  const isUserActiveSalesTeam = currentUser.role === 'Sales Team' && (currentUser.userStatus || currentUser.status || 'Active') === 'Active';

  // Handlers for Sales Team
  const handleSaveSalesRequest = async (
    req: RoadshowRequest,
    _isSubmit: boolean
  ) => {
    const existingRequest = requests.find(request => request.id === req.id);

    if (!existingRequest && !isUserActiveSalesTeam) {
      alert('Only active Sales Team members are allowed to create new requests.');
      return;
    }

    try {
      if (existingRequest) {
        const savedRequest = await updateRequest(req);

        setRequests(previousRequests =>
          previousRequests.map(request =>
            request.id === savedRequest.id ? savedRequest : request
          )
        );

        return;
      }

      const createdRequest = await createRequest(req);

      setRequests(previousRequests => [createdRequest, ...previousRequests]);
    } catch (error) {
      console.error('Unable to save request:', error);

      alert(
        error instanceof Error
          ? error.message
          : 'Unable to save the roadshow request.'
      );
    }
  };

  const handleDeleteSalesRequest = async (reqId: string) => {
    try {
      await deleteRequest(reqId);

      setRequests(previousRequests =>
        previousRequests.filter(request => request.id !== reqId)
      );

      if (selectedRequest?.id === reqId) {
        setSelectedRequest(null);
      }
    } catch (error) {
      console.error('Unable to delete request:', error);

      alert(
        error instanceof Error
          ? error.message
          : 'Unable to delete the roadshow request.'
      );
    }
  };

  const persistUpdatedRequest = async (updatedRequest: RoadshowRequest) => {
    try {
      const savedRequest = await updateRequest(updatedRequest);

      setRequests(previousRequests =>
        previousRequests.map(request =>
          request.id === savedRequest.id ? savedRequest : request
        )
      );

      if (selectedRequest?.id === savedRequest.id) {
        setSelectedRequest(savedRequest);
      }
    } catch (error) {
      console.error('Unable to update request:', error);

      alert(
        error instanceof Error
          ? error.message
          : 'Unable to update the roadshow request.'
      );
    }
  };

  const handleSubmitSalesDraft = (req: RoadshowRequest) => {
    const now = new Date().toISOString();
    const updatedReq: RoadshowRequest = {
      ...req,
      status: 'Pending Head of Sales',
      updatedAt: now,
      history: [
        ...req.history,
        {
          id: generateId(),
          timestamp: now,
          actorName: currentUser.name,
          actorRole: currentUser.role,
          action: 'Submitted Request to Head of Sales',
          previousStatus: req.status,
          newStatus: 'Pending Head of Sales'
        }
      ]
    };

    void persistUpdatedRequest(updatedReq);
  };

  // --- Handlers for Head of Sales ---
  const handleApproveByHeadOfSales = (reqId: string, comments: string) => {
    const requestToUpdate = requests.find(request => request.id === reqId);

    if (!requestToUpdate) {
      alert('The roadshow request could not be found.');
      return;
    }

    const now = new Date().toISOString();

    const updatedRequest: RoadshowRequest = {
      ...requestToUpdate,
      status: 'Under Review',
      updatedAt: now,
      headOfSalesApproval: {
        approvedBy: currentUser.name,
        approvedAt: now,
        comments: comments || 'Approved by Head of Sales.'
      },
      history: [
        ...requestToUpdate.history,
        {
          id: generateId(),
          timestamp: now,
          actorName: currentUser.name,
          actorRole: 'Head of Sales',
          action: 'Approved Request',
          comments: comments || 'Approved by Head of Sales.',
          previousStatus: 'Pending Head of Sales',
          newStatus: 'Under Review'
        }
      ]
    };

    void persistUpdatedRequest(updatedRequest);
  };

  const handleRejectByHeadOfSales = (reqId: string, reason: string) => {
    const requestToUpdate = requests.find(request => request.id === reqId);

    if (!requestToUpdate) {
      alert('The roadshow request could not be found.');
      return;
    }

    const now = new Date().toISOString();

    const updatedRequest: RoadshowRequest = {
      ...requestToUpdate,
      status: 'Rejected',
      updatedAt: now,
      rejectionInfo: {
        rejectedBy: currentUser.name,
        rejectedRole: 'Head of Sales',
        rejectedAt: now,
        reason
      },
      history: [
        ...requestToUpdate.history,
        {
          id: generateId(),
          timestamp: now,
          actorName: currentUser.name,
          actorRole: 'Head of Sales',
          action: 'Rejected Request',
          comments: reason,
          previousStatus: 'Pending Head of Sales',
          newStatus: 'Rejected'
        }
      ]
    };

    void persistUpdatedRequest(updatedRequest);
  };

  // --- Handlers for Device Team ---
  const handleSaveDeviceEditsOnly = (
    reqId: string,
    updatedPartB: PartBDeviceItem[],
    imeiRecords?: ImeiInventoryItem[]
  ) => {
    const now = new Date().toISOString();
    const totalVal = updatedPartB.reduce((acc, curr) => acc + curr.totalRrpRM, 0);

    const targetReq = requests.find(r => r.id === reqId);
    const reqCode = targetReq?.requestCode;
    const reqName = targetReq?.partA.requestor || targetReq?.createdByName;
    const evtName = targetReq?.partA.eventName;
    const reg = targetReq?.partA.region;
    const st = targetReq?.partA.state;
    const reqStatus = targetReq?.status;
    const statusVal: 'HOO Approved' | 'Pending Approval' | 'Unassigned Stock' =
      reqStatus === 'Approved' ? 'HOO Approved' : (reqCode ? 'Pending Approval' : 'Unassigned Stock');

    if (!targetReq) {
      alert('The roadshow request could not be found.');
      return;
    }

    const updatedRequest: RoadshowRequest = {
      ...targetReq,
      partB: updatedPartB,
      totalValueRM: totalVal,
      updatedAt: now,
      history: [
        ...targetReq.history,
        {
          id: generateId(),
          timestamp: now,
          actorName: currentUser.name,
          actorRole: currentUser.role || 'Device Team',
          action: (imeiRecords && imeiRecords.length > 0)
            ? 'Uploaded IMEIs & Synced to IMEI Inventory'
            : 'Updated Device Allocation Details'
        }
      ]
    };

    void persistUpdatedRequest(updatedRequest);

    const combinedRecords: ImeiInventoryItem[] = [...(imeiRecords || [])];

    updatedPartB.forEach((item, idx) => {
      if (item.imei && item.imei.trim()) {
        const cleanImei = item.imei.trim();
        if (!combinedRecords.some(r => r.imei.toLowerCase() === cleanImei.toLowerCase())) {
          combinedRecords.push({
            id: `imei-${cleanImei}-${Date.now()}-${idx}-${Math.random().toString(36).slice(2, 6)}`,
            imei: cleanImei,
            material: item.material || '20017453',
            description: item.description || 'Roadshow Mobile Device',
            rrpRM: item.rrpRM || 0,
            requestCode: reqCode || undefined,
            requestId: reqId || undefined,
            eventName: evtName || undefined,
            requestorName: reqName || undefined,
            region: reg || undefined,
            state: st || undefined,
            customerName: item.customerName || undefined,
            nric: item.nric || undefined,
            sppOrder: item.sppOrder || undefined,
            mobileNumber: item.mobileNumber || undefined,
            submissionRemarks: item.submissionRemarks || undefined,
            status: statusVal,
            updatedAt: now
          });
        }
      }
    });

    if (combinedRecords.length > 0) {
      setImeiInventory(prev => {
        const nextList = [...prev];
        combinedRecords.forEach((rec, rIdx) => {
          const existingIdx = nextList.findIndex(
            x => (rec.id && x.id === rec.id) || x.imei.trim().toLowerCase() === rec.imei.trim().toLowerCase()
          );
          if (existingIdx !== -1) {
            nextList[existingIdx] = {
              ...nextList[existingIdx],
              ...rec,
              updatedAt: now
            };
          } else {
            nextList.unshift({
              ...rec,
              id: rec.id || `imei-${rec.imei}-${Date.now()}-${rIdx}-${Math.random().toString(36).slice(2, 6)}`
            });
          }
        });
        return ensureUniqueImeiInventory(nextList);
      });
    }
  };

  const handleSaveImeiDetails = (requestId: string, updatedRecords: ImeiDetailRecord[]) => {
    const now = new Date().toISOString();

    // 1. Update requests state
    setRequests(prevRequests =>
      prevRequests.map(req => {
        if (req.id !== requestId) return req;

        const updatedPartB = (req.partB || []).map(pItem => {
          if (!pItem.imei) return pItem;
          const imeiList = pItem.imei.split(',').map(s => s.trim().toLowerCase());
          const match = updatedRecords.find(r => imeiList.includes(r.imei.toLowerCase()));
          if (match) {
            return {
              ...pItem,
              customerName: match.customerName || undefined,
              nric: match.nric || undefined,
              sppOrder: match.sppOrder || undefined,
              mobileNumber: match.mobileNumber || undefined,
              submissionRemarks: match.submissionRemarks || undefined
            };
          }
          return pItem;
        });

        const updatedReq: RoadshowRequest = {
          ...req,
          partB: updatedPartB,
          updatedAt: now,
          history: [
            ...req.history,
            {
              id: generateId(),
              timestamp: now,
              actorName: currentUser.name,
              actorRole: currentUser.role || 'Sales Team',
              action: 'Updated IMEI Customer & Order Details'
            }
          ]
        };

        if (selectedRequest && selectedRequest.id === requestId) {
          setSelectedRequest(updatedReq);
        }

        return updatedReq;
      })
    );

    // 2. Update imeiInventory state
    setImeiInventory(prevInventory => {
      const nextList = [...prevInventory];
      const targetReq = requests.find(r => r.id === requestId);

      updatedRecords.forEach((rec, rIdx) => {
        const idx = nextList.findIndex(
          inv => (rec.id && inv.id === rec.id) || inv.imei.trim().toLowerCase() === rec.imei.trim().toLowerCase()
        );
        if (idx !== -1) {
          nextList[idx] = {
            ...nextList[idx],
            customerName: rec.customerName || undefined,
            nric: rec.nric || undefined,
            sppOrder: rec.sppOrder || undefined,
            mobileNumber: rec.mobileNumber || undefined,
            submissionRemarks: rec.submissionRemarks || undefined,
            updatedAt: now
          };
        } else {
          nextList.unshift({
            id: rec.id || `imei-${rec.imei}-${Date.now()}-${rIdx}-${Math.random().toString(36).slice(2, 6)}`,
            imei: rec.imei,
            material: rec.material,
            description: rec.description,
            rrpRM: rec.rrpRM,
            requestCode: targetReq?.requestCode,
            requestId: requestId,
            eventName: targetReq?.partA?.eventName,
            requestorName: targetReq?.partA?.requestor || targetReq?.createdByName,
            region: targetReq?.partA?.region,
            state: targetReq?.partA?.state,
            customerName: rec.customerName || undefined,
            nric: rec.nric || undefined,
            sppOrder: rec.sppOrder || undefined,
            mobileNumber: rec.mobileNumber || undefined,
            submissionRemarks: rec.submissionRemarks || undefined,
            status: (rec.status || 'Assigned') as ImeiInventoryItem['status'],
            updatedAt: now
          });
        }
      });
      return ensureUniqueImeiInventory(nextList);
    });
  };

  const handleApproveByDeviceTeam = (reqId: string, updatedPartB: PartBDeviceItem[], comments: string) => {
    const requestToUpdate = requests.find(request => request.id === reqId);

    if (!requestToUpdate) {
      alert('The roadshow request could not be found.');
      return;
    }

    const now = new Date().toISOString();
    // Calculate total value only for approved devices with non-zero recommended quantity
    const approvedItems = updatedPartB.filter(item => (item.status || 'Approved') === 'Approved');
    const totalVal = approvedItems.reduce((acc, curr) => {
      const recQty = curr.recommendedQuantity !== undefined ? curr.recommendedQuantity : curr.quantity;
      return acc + (recQty * curr.rrpRM);
    }, 0);

    const rejectedItems = updatedPartB
      .filter(item => item.status === 'Rejected')
      .map(item => ({
        ...item,
        recommendedQuantity: 0,
        totalRrpRM: 0,
        status: 'Rejected' as const
      }));

    const existingRejected = requestToUpdate.rejectedPartB || [];
    const mergedRejected = [...existingRejected];

    rejectedItems.forEach(item => {
      const index = mergedRejected.findIndex(existing => existing.id === item.id);

      if (index !== -1) {
        mergedRejected[index] = item;
      } else {
        mergedRejected.push(item);
      }
    });

    const updatedRequest: RoadshowRequest = {
      ...requestToUpdate,
      partB: updatedPartB,
      rejectedPartB: mergedRejected,
      totalValueRM: totalVal,
      status: 'Pending Sales Acceptance',
      updatedAt: now,
      deviceTeamApproval: {
        approvedBy: currentUser.name,
        approvedAt: now,
        comments: comments || 'Device list verified and reserved.'
      },
      history: [
        ...requestToUpdate.history,
        {
          id: generateId(),
          timestamp: now,
          actorName: currentUser.name,
          actorRole: 'Device Team',
          action: 'Approved Device Allocation & Flowed to Sales Team Acceptance',
          comments: comments || 'Device list verified and reserved.',
          previousStatus: 'Under Review',
          newStatus: 'Pending Sales Acceptance'
        }
      ]
    };

    void persistUpdatedRequest(updatedRequest);
  };

  const handleAcceptBySalesTeam = (reqId: string, comments: string) => {
    const requestToUpdate = requests.find(request => request.id === reqId);

    if (!requestToUpdate) {
      alert('The roadshow request could not be found.');
      return;
    }

    const now = new Date().toISOString();

    const approvedPartB = (requestToUpdate.partB || [])
      .filter(item => (item.status || 'Approved') === 'Approved')
      .map(item => {
        const recommendedQuantity = item.recommendedQuantity ?? item.quantity ?? 0;
        const rrpRM = item.rrpRM ?? 0;

        return {
          ...item,
          quantity: recommendedQuantity,
          recommendedQuantity,
          totalRrpRM: recommendedQuantity * rrpRM,
          status: 'Approved' as const
        };
      });

    const newlyRejected = (requestToUpdate.partB || [])
      .filter(item => item.status === 'Rejected')
      .map(item => ({
        ...item,
        recommendedQuantity: 0,
        totalRrpRM: 0,
        status: 'Rejected' as const
      }));

    const mergedRejected = [...(requestToUpdate.rejectedPartB || [])];

    newlyRejected.forEach(item => {
      const index = mergedRejected.findIndex(existing => existing.id === item.id);

      if (index !== -1) {
        mergedRejected[index] = item;
      } else {
        mergedRejected.push(item);
      }
    });

    const newTotalValRM = approvedPartB.reduce(
      (total, item) => total + item.totalRrpRM,
      0
    );

    const assignedHoo =
      newTotalValRM > 50000
        ? 'NOORA MAT RIFIN'
        : 'MASILA BT SHAMERE';

    const defaultComment =
      `Sales Team accepted allocated devices (Total RRP RM ${newTotalValRM.toLocaleString()}; assigned approval to ${assignedHoo}).`;

    const updatedRequest: RoadshowRequest = {
      ...requestToUpdate,
      partB: approvedPartB,
      rejectedPartB: mergedRejected,
      totalValueRM: newTotalValRM,
      assignedHeadOfOperation: assignedHoo,
      status: 'Pending Head of Operation',
      updatedAt: now,
      history: [
        ...requestToUpdate.history,
        {
          id: generateId(),
          timestamp: now,
          actorName: currentUser.name,
          actorRole: 'Sales Team',
          action: `Accepted Device Allocation (Assigned: ${assignedHoo})`,
          comments: comments
            ? `${comments} [Assigned to: ${assignedHoo}]`
            : defaultComment,
          previousStatus: 'Pending Sales Acceptance',
          newStatus: 'Pending Head of Operation'
        }
      ]
    };

    void persistUpdatedRequest(updatedRequest);
  };

  const handleRejectBySalesTeam = (reqId: string, reason: string) => {
    const requestToUpdate = requests.find(request => request.id === reqId);

    if (!requestToUpdate) {
      alert('The roadshow request could not be found.');
      return;
    }

    const now = new Date().toISOString();

    const updatedRequest: RoadshowRequest = {
      ...requestToUpdate,
      status: 'Rejected',
      updatedAt: now,
      rejectionInfo: {
        rejectedBy: currentUser.name,
        rejectedRole: 'Sales Team',
        rejectedAt: now,
        reason
      },
      history: [
        ...requestToUpdate.history,
        {
          id: generateId(),
          timestamp: now,
          actorName: currentUser.name,
          actorRole: 'Sales Team',
          action: 'Declined Device Allocation',
          comments: reason,
          previousStatus: 'Pending Sales Acceptance',
          newStatus: 'Rejected'
        }
      ]
    };

    void persistUpdatedRequest(updatedRequest);
  };

  const handleRejectByDeviceTeam = (reqId: string, reason: string) => {
    const requestToUpdate = requests.find(request => request.id === reqId);

    if (!requestToUpdate) {
      alert('The roadshow request could not be found.');
      return;
    }

    const now = new Date().toISOString();

    const updatedRequest: RoadshowRequest = {
      ...requestToUpdate,
      status: 'Rejected',
      updatedAt: now,
      rejectionInfo: {
        rejectedBy: currentUser.name,
        rejectedRole: 'Device Team',
        rejectedAt: now,
        reason
      },
      history: [
        ...requestToUpdate.history,
        {
          id: generateId(),
          timestamp: now,
          actorName: currentUser.name,
          actorRole: 'Device Team',
          action: 'Rejected Request',
          comments: reason,
          previousStatus: 'Under Review',
          newStatus: 'Rejected'
        }
      ]
    };

    void persistUpdatedRequest(updatedRequest);
  };

  // --- Handlers for Head of Operation ---
  const handleApproveByHeadOfOperation = (reqId: string, comments: string) => {
    const requestToUpdate = requests.find(request => request.id === reqId);

    if (!requestToUpdate) {
      alert('The roadshow request could not be found.');
      return;
    }

    const now = new Date().toISOString();

    const updatedRequest: RoadshowRequest = {
      ...requestToUpdate,
      status: 'Approved',
      updatedAt: now,
      headOfOperationApproval: {
        approvedBy: currentUser.name,
        approvedAt: now,
        comments: comments || 'Final operational approval granted.'
      },
      history: [
        ...requestToUpdate.history,
        {
          id: generateId(),
          timestamp: now,
          actorName: currentUser.name,
          actorRole: 'Head of Operation',
          action: 'Granted Final Approval',
          comments: comments || 'Final operational approval granted.',
          previousStatus: 'Pending Head of Operation',
          newStatus: 'Approved'
        }
      ]
    };

    void persistUpdatedRequest(updatedRequest);
  };

  const handleRejectByHeadOfOperation = (reqId: string, reason: string) => {
    const requestToUpdate = requests.find(request => request.id === reqId);

    if (!requestToUpdate) {
      alert('The roadshow request could not be found.');
      return;
    }

    const now = new Date().toISOString();

    const updatedRequest: RoadshowRequest = {
      ...requestToUpdate,
      status: 'Rejected',
      updatedAt: now,
      rejectionInfo: {
        rejectedBy: currentUser.name,
        rejectedRole: 'Head of Operation',
        rejectedAt: now,
        reason
      },
      history: [
        ...requestToUpdate.history,
        {
          id: generateId(),
          timestamp: now,
          actorName: currentUser.name,
          actorRole: 'Head of Operation',
          action: 'Rejected Request',
          comments: reason,
          previousStatus: 'Pending Head of Operation',
          newStatus: 'Rejected'
        }
      ]
    };

    void persistUpdatedRequest(updatedRequest);
  };

  // --- Admin User Handlers ---
  const handleAddUser = (user: User) => {
    setUsers(prev => [...prev, user]);
  };

  const handleBulkAddUsers = (newUsers: User[], replaceMode: boolean) => {
    if (replaceMode) {
      setUsers(prev => [
        ...prev.filter(u => u.role === 'Admin'),
        ...newUsers
      ]);
    } else {
      setUsers(prev => [...prev, ...newUsers]);
    }
  };

  const handleUpdateUser = (updatedUser: User) => {
    setUsers(prev => prev.map(u => (u.id === updatedUser.id ? updatedUser : u)));
    if (currentUser.id === updatedUser.id) {
      setCurrentUser(updatedUser);
    }
  };

  const handleDeleteUser = (userId: string) => {
    setUsers(prev => prev.filter(u => u.id !== userId));
  };

  // Calculate pending count for current role
  const pendingCountForRole = requests.filter(r => {
    if (currentUser.role === 'Head of Sales') {
      return r.status === 'Pending Head of Sales' && isRequestForHeadOfSales(r, currentUser, users);
    }
    if (currentUser.role === 'Head of Unit') {
      return r.status !== 'Approved' && r.status !== 'Rejected' && isRequestForHeadOfUnit(r, currentUser, users);
    }
    if (currentUser.role === 'Head of Department') {
      return r.status !== 'Approved' && r.status !== 'Rejected' && isRequestForHeadOfDepartment(r, currentUser, users);
    }
    if (currentUser.role === 'Device Team') return r.status === 'Under Review';
    if (currentUser.role === 'Head of Operation') {
      if (r.status !== 'Pending Head of Operation') return false;
      if (r.assignedHeadOfOperation && r.assignedHeadOfOperation.trim().toLowerCase() !== currentUser.name.trim().toLowerCase()) {
        return false;
      }
      return true;
    }
    if (currentUser.role === 'Sales Team') return (r.status === 'Draft' || r.status === 'Pending Sales Acceptance') && r.createdByUserId === currentUser.id;
    if (currentUser.role === 'Admin') return r.status !== 'Approved' && r.status !== 'Rejected';
    return false;
  }).length;

  if (isAuthChecking) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="text-center">
          <div className="w-10 h-10 mx-auto border-4 border-indigo-400/30 border-t-indigo-400 rounded-full animate-spin" />

          <p className="mt-4 text-sm text-slate-300">
            Restoring your secure session...
          </p>
        </div>
      </div>
    );
  }
  // If not logged in, show Login Page
  if (!isAuthenticated) {
    return <LoginPage onLoginSuccess={handleLoginSuccess} />;
  }

  return (
    <div id="app-root" className="min-h-screen bg-slate-100/70 text-slate-900 font-sans antialiased flex flex-col">
      {/* Navbar with persona switcher & logout */}
      <Navbar
        currentUser={currentUser}
        allUsers={users}
        onSelectUser={setCurrentUser}
        activeTab={activeTab}
        onSelectTab={setActiveTab}
        pendingCount={pendingCountForRole}
        onLogout={handleLogout}
        onOpenCreateModal={isUserActiveSalesTeam ? () => {
          setEditingSalesRequest(null);
          setIsSalesModalOpen(true);
        } : undefined}
        onOpenInventoryModal={() => setIsInventoryModalOpen(true)}
      />

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {activeTab === 'requests' && (
          <RequestList
            requests={requests}
            currentUser={currentUser}
            users={users}
            imeiInventory={imeiInventory}
            onSelectRequest={setSelectedRequest}
            onOpenCreateModal={isUserActiveSalesTeam ? () => {
              setEditingSalesRequest(null);
              setIsSalesModalOpen(true);
            } : () => {}}
            onOpenDeviceTeamEdit={setDeviceTeamEditRequest}
            onDeleteRequest={handleDeleteSalesRequest}
            onOpenInventoryModal={() => setIsInventoryModalOpen(true)}
            onSaveImeiDetails={handleSaveImeiDetails}
          />
        )}

        {activeTab === 'analytics' && (
          <DashboardAnalytics
            currentUser={currentUser}
            deviceInventory={deviceInventory}
            requests={
              currentUser.role === 'Sales Team'
                ? requests.filter(r => r.createdByUserId === currentUser.id)
                : currentUser.role === 'Head of Sales'
                ? requests.filter(r => isRequestForHeadOfSales(r, currentUser, users))
                : currentUser.role === 'Head of Unit'
                ? requests.filter(r => isRequestForHeadOfUnit(r, currentUser, users))
                : currentUser.role === 'Head of Department'
                ? requests.filter(r => isRequestForHeadOfDepartment(r, currentUser, users))
                : requests
            }
          />
        )}

        {activeTab === 'admin' && currentUser.role === 'Admin' && (
          <AdminUserManagement
            users={users}
            currentUser={currentUser}
            onAddUser={handleAddUser}
            onBulkAddUsers={handleBulkAddUsers}
            onUpdateUser={handleUpdateUser}
            onDeleteUser={handleDeleteUser}
            onSwitchUserPersona={setCurrentUser}
          />
        )}

        {activeTab === 'imei-inventory' && (currentUser.role === 'Device Team' || currentUser.role === 'Admin') && (
          <ImeiInventoryPage
            currentUser={currentUser}
            imeiList={imeiInventory}
            requests={requests}
            onUpdateImei={handleUpdateImeiItem}
            onAddImei={handleAddImeiItem}
            onDeleteImei={handleDeleteImeiItem}
            onBulkAddImeis={handleBulkAddImeis}
            onSelectRequest={setSelectedRequest}
          />
        )}
      </main>

      {/* Footer */}
      <footer className="bg-white border-t border-slate-200 py-4 text-center text-xs text-slate-500">
        <div className="max-w-7xl mx-auto px-4">
          <p className="font-medium">Roadshow Device Request System &bull; Enterprise Workflow Edition</p>
          <p className="text-[11px] text-slate-400 mt-0.5">
            Role-based multi-tier approval for Sales Team, Head of Sales, Device Team, Head of Operation, and Admin.
          </p>
        </div>
      </footer>

      {/* Request Detail Modal */}
      {selectedRequest && (
        <RequestDetailModal
          isOpen={!!selectedRequest}
          onClose={() => setSelectedRequest(null)}
          request={selectedRequest}
          currentUser={currentUser}
          imeiInventory={imeiInventory}
          onEditBySales={(req) => {
            setEditingSalesRequest(req);
            setIsSalesModalOpen(true);
          }}
          onDeleteBySales={handleDeleteSalesRequest}
          onSubmitBySales={handleSubmitSalesDraft}
          onApproveByHeadOfSales={handleApproveByHeadOfSales}
          onRejectByHeadOfSales={handleRejectByHeadOfSales}
          onOpenDeviceTeamEdit={setDeviceTeamEditRequest}
          onSaveDeviceEditsOnly={handleSaveDeviceEditsOnly}
          onAcceptBySalesTeam={handleAcceptBySalesTeam}
          onRejectBySalesTeam={handleRejectBySalesTeam}
          onApproveByHeadOfOperation={handleApproveByHeadOfOperation}
          onRejectByHeadOfOperation={handleRejectByHeadOfOperation}
          onSaveImeiDetails={handleSaveImeiDetails}
        />
      )}

      {/* Sales Team Form Modal */}
      {isSalesModalOpen && (
        <SalesRequestFormModal
          isOpen={isSalesModalOpen}
          onClose={() => {
            setIsSalesModalOpen(false);
            setEditingSalesRequest(null);
          }}
          currentUser={currentUser}
          editingRequest={editingSalesRequest}
          existingRequests={requests}
          onSaveRequest={handleSaveSalesRequest}
          deviceInventory={deviceInventory}
        />
      )}

      {/* Device Team Edit Modal */}
      {deviceTeamEditRequest && (
        <DeviceTeamEditModal
          isOpen={!!deviceTeamEditRequest}
          onClose={() => setDeviceTeamEditRequest(null)}
          request={deviceTeamEditRequest}
          currentUser={currentUser}
          onSaveDeviceEditsOnly={handleSaveDeviceEditsOnly}
          onApproveByDeviceTeam={handleApproveByDeviceTeam}
          onRejectByDeviceTeam={handleRejectByDeviceTeam}
          deviceInventory={deviceInventory}
        />
      )}

      {/* Device Inventory Upload & Management Modal (Device Team & Admin) */}
      <DeviceInventoryUploadModal
        isOpen={isInventoryModalOpen}
        onClose={() => setIsInventoryModalOpen(false)}
        userRole={currentUser.role}
        currentInventory={deviceInventory}
        onSaveInventory={handleSaveInventory}
        onUpdateInventoryItem={handleUpdateInventoryItem}
        onDeleteInventoryItem={handleDeleteInventoryItem}
      />
    </div>
  );
}
