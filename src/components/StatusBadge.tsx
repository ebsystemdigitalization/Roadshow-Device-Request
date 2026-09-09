import React from 'react';
import { RequestStatus } from '../types';
import { Clock, CheckCircle2, XCircle, FileText, SearchCheck, ShieldCheck } from 'lucide-react';

interface StatusBadgeProps {
  status: RequestStatus;
  size?: 'sm' | 'md' | 'lg';
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({ status, size = 'md' }) => {
  let badgeStyle = 'bg-slate-100 text-slate-700 border-slate-200';
  let Icon = FileText;

  switch (status) {
    case 'Draft':
      badgeStyle = 'bg-slate-100 text-slate-700 border-slate-300';
      Icon = FileText;
      break;
    case 'Pending Head of Sales':
      badgeStyle = 'bg-amber-50 text-amber-800 border-amber-300';
      Icon = Clock;
      break;
    case 'Under Review':
      badgeStyle = 'bg-blue-50 text-blue-800 border-blue-300';
      Icon = SearchCheck;
      break;
    case 'Pending Sales Acceptance':
      badgeStyle = 'bg-purple-50 text-purple-800 border-purple-300';
      Icon = Clock;
      break;
    case 'Pending Head of Operation':
      badgeStyle = 'bg-indigo-50 text-indigo-800 border-indigo-300';
      Icon = Clock;
      break;
    case 'Approved':
      badgeStyle = 'bg-emerald-50 text-emerald-800 border-emerald-300';
      Icon = CheckCircle2;
      break;
    case 'Rejected':
      badgeStyle = 'bg-rose-50 text-rose-800 border-rose-300';
      Icon = XCircle;
      break;
  }

  const sizeClasses = {
    sm: 'text-xs px-2 py-0.5 gap-1',
    md: 'text-xs px-2.5 py-1 gap-1.5 font-medium',
    lg: 'text-sm px-3 py-1.5 gap-2 font-medium'
  };

  return (
    <span id={`status-badge-${status.toLowerCase().replace(/\s+/g, '-')}`} className={`inline-flex items-center rounded-full border ${badgeStyle} ${sizeClasses[size]}`}>
      <Icon className={size === 'sm' ? 'w-3 h-3' : size === 'lg' ? 'w-4 h-4' : 'w-3.5 h-3.5'} />
      <span>{status}</span>
    </span>
  );
};
