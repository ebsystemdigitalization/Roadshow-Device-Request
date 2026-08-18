import React from 'react';
import { RequestStatus } from '../types';
import { Check, Clock, X, Circle } from 'lucide-react';

interface WorkflowStepperProps {
  status: RequestStatus;
}

interface Step {
  id: number;
  label: string;
  role: string;
  statusMatch: RequestStatus[];
}

export const WorkflowStepper: React.FC<WorkflowStepperProps> = ({ status }) => {
  const steps: Step[] = [
    { id: 1, label: 'Sales Request', role: 'Sales Team', statusMatch: ['Draft', 'Pending Head of Sales', 'Under Review', 'Pending Sales Acceptance', 'Pending Head of Operation', 'Approved'] },
    { id: 2, label: 'Sales Review', role: 'Head of Sales', statusMatch: ['Pending Head of Sales', 'Under Review', 'Pending Sales Acceptance', 'Pending Head of Operation', 'Approved'] },
    { id: 3, label: 'Device Allocation', role: 'Device Team', statusMatch: ['Under Review', 'Pending Sales Acceptance', 'Pending Head of Operation', 'Approved'] },
    { id: 4, label: 'Sales Acceptance', role: 'Sales Team', statusMatch: ['Pending Sales Acceptance', 'Pending Head of Operation', 'Approved'] },
    { id: 5, label: 'Operation Review', role: 'Head of Operation', statusMatch: ['Pending Head of Operation', 'Approved'] },
    { id: 6, label: 'Final Approved', role: 'System', statusMatch: ['Approved'] }
  ];

  const getStepState = (stepIndex: number) => {
    if (status === 'Rejected') {
      return 'rejected';
    }

    if (status === 'Draft' && stepIndex === 0) return 'active';
    if (status === 'Pending Head of Sales' && stepIndex === 1) return 'active';
    if (status === 'Under Review' && stepIndex === 2) return 'active';
    if (status === 'Pending Sales Acceptance' && stepIndex === 3) return 'active';
    if (status === 'Pending Head of Operation' && stepIndex === 4) return 'active';
    if (status === 'Approved') return 'completed';

    // Map statuses to step index currently waiting on
    const currentStepIndex = 
      status === 'Draft' ? 0 :
      status === 'Pending Head of Sales' ? 1 :
      status === 'Under Review' ? 2 :
      status === 'Pending Sales Acceptance' ? 3 :
      status === 'Pending Head of Operation' ? 4 : 5;

    if (stepIndex < currentStepIndex) return 'completed';
    return 'upcoming';
  };

  return (
    <div id="workflow-stepper-container" className="w-full py-4 bg-slate-50/80 rounded-xl px-4 border border-slate-200/80 my-4">
      <div className="flex items-center justify-between relative">
        {/* Background Connecting Bar */}
        <div className="absolute top-1/2 left-6 right-6 -translate-y-1/2 h-1 bg-slate-200 -z-0" />

        {steps.map((step, idx) => {
          const state = getStepState(idx);

          return (
            <div key={step.id} className="flex flex-col items-center relative z-10 bg-slate-50/80 px-2">
              {/* Circle Icon */}
              <div
                className={`w-9 h-9 rounded-full flex items-center justify-center font-medium transition-all duration-200 border-2 ${
                  state === 'completed'
                    ? 'bg-emerald-600 border-emerald-600 text-white shadow-sm shadow-emerald-200'
                    : state === 'active'
                    ? 'bg-blue-600 border-blue-600 text-white ring-4 ring-blue-100 shadow-md'
                    : state === 'rejected'
                    ? 'bg-rose-100 border-rose-500 text-rose-700'
                    : 'bg-white border-slate-300 text-slate-400'
                }`}
              >
                {state === 'completed' ? (
                  <Check className="w-5 h-5" />
                ) : state === 'rejected' ? (
                  <X className="w-5 h-5" />
                ) : state === 'active' ? (
                  <Clock className="w-4 h-4 animate-pulse" />
                ) : (
                  <span className="text-xs">{step.id}</span>
                )}
              </div>

              {/* Step Title */}
              <span className={`text-xs font-semibold mt-2 text-center ${
                state === 'active' ? 'text-blue-700' : state === 'completed' ? 'text-slate-800' : 'text-slate-500'
              }`}>
                {step.label}
              </span>

              {/* Role Sublabel */}
              <span className="text-[11px] text-slate-500 text-center">
                {step.role}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
};
