import React, { useState } from 'react';
import { User, UserRole, MALAYSIAN_STATES } from '../types';
import { parseUserCSV, generateSampleUserCSV } from '../utils/formatters';
import { Upload, Download, FileText, CheckCircle2, AlertCircle, X, Users, Layers, Sparkles } from 'lucide-react';

interface UserBulkUploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImportUsers: (users: User[], replaceMode: boolean) => void;
  existingUsers: User[];
}

export const UserBulkUploadModal: React.FC<UserBulkUploadModalProps> = ({
  isOpen,
  onClose,
  onImportUsers,
  existingUsers
}) => {
  const [csvContent, setCsvContent] = useState<string>('');
  const [replaceMode, setReplaceMode] = useState<boolean>(false);
  const [parsedUsers, setParsedUsers] = useState<User[]>([]);
  const [parseErrors, setParseErrors] = useState<string[]>([]);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleTextChange = (text: string) => {
    setCsvContent(text);
    if (!text.trim()) {
      setParsedUsers([]);
      setParseErrors([]);
      setErrorMsg(null);
      return;
    }
    try {
      const { users, errors } = parseUserCSV(text, existingUsers);
      setParsedUsers(users);
      setParseErrors(errors);

      if (users.length === 0) {
        setErrorMsg('Could not parse any valid user rows. Please ensure your CSV has Name and valid Email columns.');
      } else {
        setErrorMsg(null);
      }
    } catch {
      setErrorMsg('Error parsing CSV input. Please check your data format.');
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      if (text) {
        handleTextChange(text);
      }
    };
    reader.readAsText(file);
  };

  const handleDownloadSample = () => {
    const csvData = generateSampleUserCSV();
    const blob = new Blob([csvData], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', 'system_users_template.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleLoadSampleData = () => {
    const sample = generateSampleUserCSV();
    handleTextChange(sample);
  };

  const handleConfirmImport = () => {
    if (parsedUsers.length === 0) return;
    onImportUsers(parsedUsers, replaceMode);
    onClose();
    // Reset modal state
    setCsvContent('');
    setParsedUsers([]);
    setParseErrors([]);
  };

  const getRoleBadge = (role: UserRole) => {
    switch (role) {
      case 'Sales Team':
        return 'bg-emerald-50 text-emerald-700 border-emerald-200';
      case 'Head of Sales':
        return 'bg-amber-50 text-amber-700 border-amber-200';
      case 'Device Team':
        return 'bg-blue-50 text-blue-700 border-blue-200';
      case 'Head of Operation':
        return 'bg-indigo-50 text-indigo-700 border-indigo-200';
      case 'Head of Department':
        return 'bg-teal-50 text-teal-700 border-teal-200';
      case 'Admin':
        return 'bg-purple-50 text-purple-700 border-purple-200';
      default:
        return 'bg-slate-100 text-slate-700 border-slate-200';
    }
  };

  return (
    <div id="user-bulk-upload-modal-backdrop" className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full overflow-hidden border border-slate-200">
        {/* Header */}
        <div className="bg-slate-900 text-white px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-indigo-600 rounded-lg">
              <Upload className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-base font-bold">Bulk Upload System Users</h2>
              <p className="text-xs text-slate-300">Import user access accounts via CSV upload or copy-paste</p>
            </div>
          </div>
          <button
            id="btn-close-user-bulk-upload"
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 space-y-6 max-h-[80vh] overflow-y-auto">
          {/* Action Tools Row */}
          <div className="flex flex-wrap items-center justify-between gap-3 bg-indigo-50/50 p-4 rounded-xl border border-indigo-100">
            <div className="flex items-center gap-2">
              <label
                htmlFor="user-csv-file-input"
                className="inline-flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white px-3.5 py-2 rounded-lg text-xs font-semibold cursor-pointer shadow-sm transition-all"
              >
                <Upload className="w-4 h-4" />
                Upload CSV File
              </label>
              <input
                id="user-csv-file-input"
                type="file"
                accept=".csv,.txt"
                onChange={handleFileUpload}
                className="hidden"
              />

              <button
                type="button"
                onClick={handleDownloadSample}
                className="inline-flex items-center gap-1.5 bg-white border border-slate-300 text-slate-700 hover:bg-slate-50 px-3.5 py-2 rounded-lg text-xs font-semibold shadow-sm transition-all cursor-pointer"
              >
                <Download className="w-4 h-4 text-indigo-600" />
                Download Template (.csv)
              </button>
            </div>

            <button
              type="button"
              onClick={handleLoadSampleData}
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-indigo-700 hover:text-indigo-900 bg-white border border-indigo-200 px-3 py-2 rounded-lg shadow-sm hover:bg-indigo-50 transition-all cursor-pointer"
            >
              <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
              Fill with Sample User Data
            </button>
          </div>

          {/* Input Area */}
          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <label className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
                <FileText className="w-4 h-4 text-slate-500" />
                CSV Content / Direct Text Input
              </label>
              <span className="text-[11px] text-slate-500 font-mono">
                Format: Name, Email, Role, State, Region, Head of Sales
              </span>
            </div>

            <textarea
              id="user-csv-textarea"
              rows={5}
              value={csvContent}
              onChange={e => handleTextChange(e.target.value)}
              placeholder={`Name, Email, Role, State, Region, Head of Sales\nAhmad Razak, ahmad.razak@example.com, Sales Team, Selangor, Central, Dato' Wong Wei Sheng\nSiti Sarah, siti.sarah@example.com, Head of Sales, Penang, Northern, Siti Sarah\nWong Wei Ming, wong.wm@example.com, Device Team, Kuala Lumpur, Central, Dato' Wong Wei Sheng`}
              className="w-full border border-slate-300 rounded-xl p-3 text-xs font-mono bg-slate-50 focus:bg-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all placeholder:text-slate-400"
            />
          </div>

          {/* Parsing Errors or Warnings */}
          {errorMsg && (
            <div className="bg-rose-50 border border-rose-200 text-rose-800 p-3.5 rounded-xl text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {parseErrors.length > 0 && (
            <div className="bg-amber-50 border border-amber-200 text-amber-800 p-3.5 rounded-xl text-xs space-y-1">
              <div className="font-semibold flex items-center gap-1.5 text-amber-900">
                <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
                Parsing Warnings ({parseErrors.length}):
              </div>
              <ul className="list-disc list-inside space-y-0.5 text-[11px] text-amber-800 pl-2">
                {parseErrors.slice(0, 5).map((err, idx) => (
                  <li key={idx}>{err}</li>
                ))}
                {parseErrors.length > 5 && (
                  <li>...and {parseErrors.length - 5} more warning(s)</li>
                )}
              </ul>
            </div>
          )}

          {/* Import Mode Selection */}
          <div className="bg-slate-50 border border-slate-200 p-4 rounded-xl flex items-center justify-between gap-4">
            <div className="flex items-center gap-2.5">
              <Layers className="w-4 h-4 text-indigo-600 shrink-0" />
              <div>
                <p className="text-xs font-bold text-slate-800">Import Mode</p>
                <p className="text-[11px] text-slate-500">Choose how imported users affect existing system accounts</p>
              </div>
            </div>

            <div className="flex items-center gap-4 text-xs font-medium">
              <label className="inline-flex items-center gap-1.5 cursor-pointer">
                <input
                  type="radio"
                  name="importMode"
                  checked={!replaceMode}
                  onChange={() => setReplaceMode(false)}
                  className="text-indigo-600 focus:ring-indigo-500"
                />
                <span>Append to Existing ({existingUsers.length} Users)</span>
              </label>

              <label className="inline-flex items-center gap-1.5 cursor-pointer text-slate-700">
                <input
                  type="radio"
                  name="importMode"
                  checked={replaceMode}
                  onChange={() => setReplaceMode(true)}
                  className="text-indigo-600 focus:ring-indigo-500"
                />
                <span>Replace Existing Non-Admin Users</span>
              </label>
            </div>
          </div>

          {/* Parsed Preview Table */}
          {parsedUsers.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold text-slate-800 flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  Preview ({parsedUsers.length} Users Ready to Import)
                </h3>
                <span className="text-[11px] text-slate-500">
                  {parsedUsers.filter(u => u.role === 'Sales Team').length} Sales, {' '}
                  {parsedUsers.filter(u => u.role === 'Head of Sales').length} HOS, {' '}
                  {parsedUsers.filter(u => u.role === 'Device Team').length} Device, {' '}
                  {parsedUsers.filter(u => u.role === 'Head of Operation').length} Ops, {' '}
                  {parsedUsers.filter(u => u.role === 'Head of Department').length} HOD, {' '}
                  {parsedUsers.filter(u => u.role === 'Admin').length} Admin
                </span>
              </div>

              <div className="border border-slate-200 rounded-xl overflow-hidden max-h-56 overflow-y-auto bg-white">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-100 text-slate-700 font-semibold border-b border-slate-200 sticky top-0">
                    <tr>
                      <th className="px-3.5 py-2.5">#</th>
                      <th className="px-3.5 py-2.5">User Name</th>
                      <th className="px-3.5 py-2.5">Email</th>
                      <th className="px-3.5 py-2.5">Assigned Role</th>
                      <th className="px-3.5 py-2.5">State</th>
                      <th className="px-3.5 py-2.5">Region</th>
                      <th className="px-3.5 py-2.5">Head of Sales</th>
                      <th className="px-3.5 py-2.5">Head of Dept</th>
                      <th className="px-3.5 py-2.5">User Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {parsedUsers.map((u, idx) => {
                      const status = u.userStatus || u.status || 'Active';
                      return (
                        <tr key={u.id} className="hover:bg-slate-50">
                          <td className="px-3.5 py-2 font-mono text-[11px] text-slate-400">{idx + 1}</td>
                          <td className="px-3.5 py-2 font-medium text-slate-900 flex items-center gap-2">
                            <img
                              src={u.avatarUrl}
                              alt={u.name}
                              className="w-6 h-6 rounded-full object-cover border border-slate-200"
                            />
                            <span>{u.name}</span>
                          </td>
                          <td className="px-3.5 py-2 font-mono text-slate-600">{u.email}</td>
                          <td className="px-3.5 py-2">
                            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold border ${getRoleBadge(u.role)}`}>
                              {u.role}
                            </span>
                          </td>
                          <td className="px-3.5 py-2 text-slate-600">{u.state}</td>
                          <td className="px-3.5 py-2 font-medium text-slate-700">{u.region}</td>
                          <td className="px-3.5 py-2 font-medium text-indigo-700">{u.headOfSales || '-'}</td>
                          <td className="px-3.5 py-2 font-medium text-teal-700">{u.headOfDepartment || '-'}</td>
                          <td className="px-3.5 py-2">
                            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold border ${
                              status === 'Active' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-slate-100 text-slate-600 border-slate-300'
                            }`}>
                              {status}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="bg-slate-50 border-t border-slate-200 px-6 py-4 flex items-center justify-between">
          <div className="text-xs text-slate-500">
            {parsedUsers.length > 0 ? (
              <span className="text-emerald-700 font-medium flex items-center gap-1">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 inline" />
                {parsedUsers.length} user record(s) validated successfully
              </span>
            ) : (
              'Upload CSV or select sample data to preview'
            )}
          </div>

          <div className="flex items-center gap-3">
            <button
              id="btn-cancel-user-bulk-upload"
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-slate-300 rounded-xl text-xs font-semibold text-slate-700 hover:bg-slate-100 transition-all cursor-pointer"
            >
              Cancel
            </button>
            <button
              id="btn-confirm-user-bulk-upload"
              type="button"
              disabled={parsedUsers.length === 0}
              onClick={handleConfirmImport}
              className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 text-white rounded-xl text-xs font-semibold shadow-md shadow-indigo-500/20 transition-all cursor-pointer disabled:cursor-not-allowed"
            >
              Import {parsedUsers.length > 0 ? `${parsedUsers.length} Users` : 'Users'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
