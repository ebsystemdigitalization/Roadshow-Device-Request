import React from 'react';
import { RequestStatus } from '../types';
import { Check, Clock, X } from 'lucide-react';

interface WorkflowStepperProps {
  status: RequestStatus;
}

interface Step {
  id: number;
  label: string;
  role: string;
}

export const WorkflowStepper: React.FC<WorkflowStepperProps> = ({ status }) => {
  const steps: Step[] = [
    { id: 1, label: 'Sales Request', role: 'Sales Team' },
    { id: 2, label: 'Sales Review', role: 'Head of Sales' },
    { id: 3, label: 'Device Allocation', role: 'Device Team' },
    { id: 4, label: 'Operation Review', role: 'Head of Operation' },
    { id: 5, label: 'Final Approved', role: 'System' }
  ];

  const currentStepIndex =
    status === 'Draft' ? 0 :
    status === 'Pending Head of Sales' ? 1 :
    status === 'Under Review' ? 2 :
    status === 'Pending Sales Acceptance' || status === 'Pending Head of Operation' ? 3 :
    status === 'Approved' ? 5 : 0;

  const getStepState = (stepIndex: number) => {
    if (status === 'Rejected') return 'rejected';
    if (status === 'Approved') return 'completed';
    if (stepIndex === currentStepIndex) return 'active';
    return stepIndex < currentStepIndex ? 'completed' : 'upcoming';
  };

  return (
    <div id="workflow-stepper-container" className="w-full py-4 bg-slate-50/80 rounded-xl px-4 border border-slate-200/80 my-4">
      <div className="flex items-center justify-between relative">
        <div className="absolute top-1/2 left-6 right-6 -translate-y-1/2 h-1 bg-slate-200 -z-0" />

        {steps.map((step, idx) => {
          const state = getStepState(idx);

          return (
            <div key={step.id} className="flex flex-col items-center relative z-10 bg-slate-50/80 px-2">
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

              <span className={`text-xs font-semibold mt-2 text-center ${
                state === 'active' ? 'text-blue-700' : state === 'completed' ? 'text-slate-800' : 'text-slate-500'
              }`}>
                {step.label}
              </span>

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
