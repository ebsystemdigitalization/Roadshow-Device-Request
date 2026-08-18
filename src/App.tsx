import React, { useState, useEffect } from 'react';
import { RoadshowRequest, User, UserRole, PartBDeviceItem, DeviceInventoryItem, ImeiInventoryItem } from './types';
import { INITIAL_USERS, INITIAL_REQUESTS, INITIAL_DEVICE_INVENTORY, INITIAL_IMEI_INVENTORY } from './data/seedData';
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
import { generateId, isRequestForHeadOfSales, isRequestForHeadOfDepartment } from './utils/formatters';

export default function App() {
  // Load initial state from LocalStorage or seed data
  const [users, setUsers] = useState<User[]>(() => {
    const saved = localStorage.getItem('rdr_users');
    if (saved) {
      try { return JSON.parse(saved); } catch { /* ignore */ }
    }
    return INITIAL_USERS;
  });

  const [currentUser, setCurrentUser] = useState<User | null>(() => {
    const savedId = localStorage.getItem('rdr_current_user_id');
    if (savedId) {
      const savedUsers = localStorage.getItem('rdr_users');
      const allUsersList: User[] = savedUsers ? JSON.parse(savedUsers) : INITIAL_USERS;
      const found = allUsersList.find(u => u.id === savedId);
      if (found && (found.userStatus || found.status || 'Active') === 'Active') {
        return found;
      }
    }
    return null;
  });

  const [requests, setRequests] = useState<RoadshowRequest[]>(() => {
    const saved = localStorage.getItem('rdr_requests');
    if (saved) {
      try { return JSON.parse(saved); } catch { /* ignore */ }
    }
    return INITIAL_REQUESTS;
  });

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
      try { return JSON.parse(saved); } catch { /* ignore */ }
    }
    return INITIAL_IMEI_INVENTORY;
  });

  const [activeTab, setActiveTab] = useState<'requests' | 'analytics' | 'admin' | 'imei-inventory'>('requests');
  const [selectedRequest, setSelectedRequest] = useState<RoadshowRequest | null>(null);

  // Modals
  const [isSalesModalOpen, setIsSalesModalOpen] = useState<boolean>(false);
  const [editingSalesRequest, setEditingSalesRequest] = useState<RoadshowRequest | null>(null);
  const [deviceTeamEditRequest, setDeviceTeamEditRequest] = useState<RoadshowRequest | null>(null);
  const [isInventoryModalOpen, setIsInventoryModalOpen] = useState<boolean>(false);

  // Persist state updates to LocalStorage
  useEffect(() => {
    localStorage.setItem('rdr_users', JSON.stringify(users));
  }, [users]);

  useEffect(() => {
    localStorage.setItem('rdr_requests', JSON.stringify(requests));
  }, [requests]);

  useEffect(() => {
    localStorage.setItem('rdr_device_inventory', JSON.stringify(deviceInventory));
  }, [deviceInventory]);

  useEffect(() => {
    localStorage.setItem('rdr_imei_inventory', JSON.stringify(imeiInventory));
  }, [imeiInventory]);

  useEffect(() => {
    if (currentUser) {
      localStorage.setItem('rdr_current_user_id', currentUser.id);
    } else {
      localStorage.removeItem('rdr_current_user_id');
    }
  }, [currentUser]);

  // Ensure non-admin users cannot stay on 'admin' tab, and non-Device/Admin cannot stay on 'imei-inventory' tab
  useEffect(() => {
    if (!currentUser) return;
    if (currentUser.role !== 'Admin' && activeTab === 'admin') {
      setActiveTab('requests');
    }
    if (currentUser.role !== 'Admin' && currentUser.role !== 'Device Team' && activeTab === 'imei-inventory') {
      setActiveTab('requests');
    }
  }, [currentUser?.role, activeTab]);

  // Keep selectedRequest updated when requests array mutates
  useEffect(() => {
    if (selectedRequest) {
      const updated = requests.find(r => r.id === selectedRequest.id);
      if (updated) setSelectedRequest(updated);
    }
  }, [requests]);

  // Logout handler
  const handleLogout = () => {
    localStorage.removeItem('rdr_current_user_id');
    setCurrentUser(null);
    setActiveTab('requests');
    setSelectedRequest(null);
  };

  // Reset demo data handler
  const handleResetData = () => {
    localStorage.removeItem('rdr_users');
    localStorage.removeItem('rdr_requests');
    localStorage.removeItem('rdr_device_inventory');
    localStorage.removeItem('rdr_imei_inventory');
    localStorage.removeItem('rdr_current_user_id');
    setUsers(INITIAL_USERS);
    setRequests(INITIAL_REQUESTS);
    setDeviceInventory(INITIAL_DEVICE_INVENTORY);
    setImeiInventory(INITIAL_IMEI_INVENTORY);
    setCurrentUser(null);
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
  const isUserActiveSalesTeam = currentUser ? currentUser.role === 'Sales Team' && (currentUser.userStatus || currentUser.status || 'Active') === 'Active' : false;

  // Handlers for Sales Team
  const handleSaveSalesRequest = (req: RoadshowRequest, isSubmit: boolean) => {
    setRequests(prev => {
      const exists = prev.some(r => r.id === req.id);
      if (!exists && !isUserActiveSalesTeam) {
        alert('Only active Sales Team members are allowed to create new requests.');
        return prev;
      }
      if (exists) {
        return prev.map(r => (r.id === req.id ? req : r));
      }
      return [req, ...prev];
    });
  };

  const handleDeleteSalesRequest = (reqId: string) => {
    setRequests(prev => prev.filter(r => r.id !== reqId));
    if (selectedRequest?.id === reqId) setSelectedRequest(null);
  };

  const handleSubmitSalesDraft = (req: RoadshowRequest) => {
    if (!currentUser) return;
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

    setRequests(prev => prev.map(r => (r.id === req.id ? updatedReq : r)));
  };

  // --- Handlers for Head of Sales ---
  const handleApproveByHeadOfSales = (reqId: string, comments: string) => {
    if (!currentUser) return;
    const now = new Date().toISOString();
    setRequests(prev =>
      prev.map(r => {
        if (r.id !== reqId) return r;
        return {
          ...r,
          status: 'Under Review', // flows to Device Team
          updatedAt: now,
          headOfSalesApproval: {
            approvedBy: currentUser.name,
            approvedAt: now,
            comments: comments || 'Approved by Head of Sales.'
          },
          history: [
            ...r.history,
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
      })
    );
  };

  const handleRejectByHeadOfSales = (reqId: string, reason: string) => {
    if (!currentUser) return;
    const now = new Date().toISOString();
    setRequests(prev =>
      prev.map(r => {
        if (r.id !== reqId) return r;
        return {
          ...r,
          status: 'Rejected',
          updatedAt: now,
          rejectionInfo: {
            rejectedBy: currentUser.name,
            rejectedRole: 'Head of Sales',
            rejectedAt: now,
            reason
          },
          history: [
            ...r.history,
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
      })
    );
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

    setRequests(prev =>
      prev.map(r => {
        if (r.id !== reqId) return r;
        const updatedReq: RoadshowRequest = {
          ...r,
          partB: updatedPartB,
          totalValueRM: totalVal,
          updatedAt: now,
          history: [
            ...r.history,
            {
              id: generateId(),
              timestamp: now,
              actorName: currentUser?.name || 'Device Team',
              actorRole: currentUser?.role || 'Device Team',
              action: (imeiRecords && imeiRecords.length > 0)
                ? 'Uploaded IMEIs & Synced to IMEI Inventory'
                : 'Updated Device Allocation Details'
            }
          ]
        };
        if (selectedRequest && selectedRequest.id === reqId) {
          setSelectedRequest(updatedReq);
        }
        return updatedReq;
      })
    );

    const combinedRecords: ImeiInventoryItem[] = [...(imeiRecords || [])];

    updatedPartB.forEach((item) => {
      if (item.imei && item.imei.trim()) {
        const cleanImei = item.imei.trim();
        if (!combinedRecords.some(r => r.imei.toLowerCase() === cleanImei.toLowerCase())) {
          combinedRecords.push({
            id: `imei-${cleanImei}`,
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
        combinedRecords.forEach(rec => {
          const existingIdx = nextList.findIndex(
            x => x.imei.trim().toLowerCase() === rec.imei.trim().toLowerCase()
          );
          if (existingIdx !== -1) {
            nextList[existingIdx] = {
              ...nextList[existingIdx],
              ...rec,
              updatedAt: now
            };
          } else {
            nextList.unshift(rec);
          }
        });
        return nextList;
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
              actorName: currentUser?.name || 'Sales Team',
              actorRole: currentUser?.role || 'Sales Team',
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

      updatedRecords.forEach(rec => {
        const idx = nextList.findIndex(
          inv => inv.id === rec.id || inv.imei.trim().toLowerCase() === rec.imei.trim().toLowerCase()
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
            id: `imei-${rec.imei}`,
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
            status: rec.status || 'Assigned',
            updatedAt: now
          });
        }
      });
      return nextList;
    });
  };

  const handleApproveByDeviceTeam = (reqId: string, updatedPartB: PartBDeviceItem[], comments: string) => {
    if (!currentUser) return;
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

    setRequests(prev =>
      prev.map(r => {
        if (r.id !== reqId) return r;

        const existingRejected = r.rejectedPartB || [];
        const mergedRejected = [...existingRejected];
        rejectedItems.forEach(item => {
          const idx = mergedRejected.findIndex(ex => ex.id === item.id);
          if (idx !== -1) {
            mergedRejected[idx] = item;
          } else {
            mergedRejected.push(item);
          }
        });

        return {
          ...r,
          partB: updatedPartB,
          rejectedPartB: mergedRejected,
          totalValueRM: totalVal,
          status: 'Pending Sales Acceptance', // flows back to initial Sales Team for acceptance
          updatedAt: now,
          deviceTeamApproval: {
            approvedBy: currentUser.name,
            approvedAt: now,
            comments: comments || 'Device list verified and reserved.'
          },
          history: [
            ...r.history,
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
      })
    );
  };

  const handleAcceptBySalesTeam = (reqId: string, comments: string) => {
    if (!currentUser) return;
    const now = new Date().toISOString();
    setRequests(prev =>
      prev.map(r => {
        if (r.id !== reqId) return r;

        // Separate and keep devices with Status Approved for active allocation
        const approvedPartB = (r.partB || [])
          .filter(item => (item.status || 'Approved') === 'Approved')
          .map(item => {
            const recQty = item.recommendedQuantity ?? item.quantity ?? 0;
            const rrpRM = item.rrpRM ?? 0;
            return {
              ...item,
              quantity: recQty,
              recommendedQuantity: recQty,
              totalRrpRM: recQty * rrpRM,
              status: 'Approved' as const
            };
          });

        // Collect rejected devices from current partB
        const newlyRejected = (r.partB || [])
          .filter(item => item.status === 'Rejected')
          .map(item => ({
            ...item,
            recommendedQuantity: 0,
            totalRrpRM: 0,
            status: 'Rejected' as const
          }));

        // Preserve all previously rejected items plus any newly rejected items as historical detail
        const existingRejected = r.rejectedPartB || [];
        const mergedRejected = [...existingRejected];
        newlyRejected.forEach(item => {
          const idx = mergedRejected.findIndex(ex => ex.id === item.id);
          if (idx !== -1) {
            mergedRejected[idx] = item;
          } else {
            mergedRejected.push(item);
          }
        });

        const newTotalValRM = approvedPartB.reduce((acc, curr) => acc + curr.totalRrpRM, 0);
        const assignedHoo = newTotalValRM > 50000 ? 'NOORA MAT RIFIN' : 'MASILA BT SHAMERE';

        const defaultComment = `Sales Team accepted allocated devices (Total RRP RM ${newTotalValRM.toLocaleString()}; assigned approval to ${assignedHoo}).`;

        return {
          ...r,
          partB: approvedPartB,
          rejectedPartB: mergedRejected,
          totalValueRM: newTotalValRM,
          assignedHeadOfOperation: assignedHoo,
          status: 'Pending Head of Operation', // flows to Head of Operation after Sales Team accepts
          updatedAt: now,
          history: [
            ...r.history,
            {
              id: generateId(),
              timestamp: now,
              actorName: currentUser.name,
              actorRole: 'Sales Team',
              action: assignedHoo ? `Accepted Device Allocation (Assigned: ${assignedHoo})` : 'Accepted Device Allocation',
              comments: comments ? (assignedHoo ? `${comments} [Assigned to: ${assignedHoo}]` : comments) : defaultComment,
              previousStatus: 'Pending Sales Acceptance',
              newStatus: 'Pending Head of Operation'
            }
          ]
        };
      })
    );
  };

  const handleRejectBySalesTeam = (reqId: string, reason: string) => {
    if (!currentUser) return;
    const now = new Date().toISOString();
    setRequests(prev =>
      prev.map(r => {
        if (r.id !== reqId) return r;
        return {
          ...r,
          status: 'Rejected',
          updatedAt: now,
          rejectionInfo: {
            rejectedBy: currentUser.name,
            rejectedRole: 'Sales Team',
            rejectedAt: now,
            reason
          },
          history: [
            ...r.history,
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
      })
    );
  };

  const handleRejectByDeviceTeam = (reqId: string, reason: string) => {
    if (!currentUser) return;
    const now = new Date().toISOString();
    setRequests(prev =>
      prev.map(r => {
        if (r.id !== reqId) return r;
        return {
          ...r,
          status: 'Rejected',
          updatedAt: now,
          rejectionInfo: {
            rejectedBy: currentUser.name,
            rejectedRole: 'Device Team',
            rejectedAt: now,
            reason
          },
          history: [
            ...r.history,
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
      })
    );
  };

  // --- Handlers for Head of Operation ---
  const handleApproveByHeadOfOperation = (reqId: string, comments: string) => {
    if (!currentUser) return;
    const now = new Date().toISOString();
    setRequests(prev =>
      prev.map(r => {
        if (r.id !== reqId) return r;
        return {
          ...r,
          status: 'Approved', // final approval
          updatedAt: now,
          headOfOperationApproval: {
            approvedBy: currentUser.name,
            approvedAt: now,
            comments: comments || 'Final operational approval granted.'
          },
          history: [
            ...r.history,
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
      })
    );
  };

  const handleRejectByHeadOfOperation = (reqId: string, reason: string) => {
    if (!currentUser) return;
    const now = new Date().toISOString();
    setRequests(prev =>
      prev.map(r => {
        if (r.id !== reqId) return r;
        return {
          ...r,
          status: 'Rejected',
          updatedAt: now,
          rejectionInfo: {
            rejectedBy: currentUser.name,
            rejectedRole: 'Head of Operation',
            rejectedAt: now,
            reason
          },
          history: [
            ...r.history,
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
      })
    );
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
    if (currentUser && currentUser.id === updatedUser.id) {
      setCurrentUser(updatedUser);
    }
  };

  const handleDeleteUser = (userId: string) => {
    setUsers(prev => prev.filter(u => u.id !== userId));
  };

  // If user is not authenticated, display the Login Page
  if (!currentUser) {
    return <LoginPage users={users} onLogin={setCurrentUser} />;
  }

  // Calculate pending count for current role
  const pendingCountForRole = requests.filter(r => {
    if (currentUser.role === 'Head of Sales') {
      return r.status === 'Pending Head of Sales' && isRequestForHeadOfSales(r, currentUser, users);
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

  return (
    <div id="app-root" className="min-h-screen bg-slate-100/70 text-slate-900 font-sans antialiased flex flex-col">
      {/* Navbar with authenticated user info and logout */}
      <Navbar
        currentUser={currentUser}
        onLogout={handleLogout}
        activeTab={activeTab}
        onSelectTab={setActiveTab}
        pendingCount={pendingCountForRole}
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
