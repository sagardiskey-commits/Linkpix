import React, { useState, useEffect } from 'react';
import {
  Shield,
  ShieldCheck,
  Lock,
  Download,
  Trash2,
  X,
  AlertTriangle,
  FileText,
  User,
  CheckCircle2,
  ExternalLink,
  Laptop,
  KeyRound,
  Key,
  LockKeyhole,
  RefreshCw,
} from 'lucide-react';
import { User as FirebaseUser } from 'firebase/auth';
import { exportProductsAsJson } from '../utils/storage';
import {
  changeVaultPassword,
  resetToDefaultPassword,
  DEFAULT_SITE_PASSWORD,
  hasCustomPassword,
  subscribeToVaultAuthChanges,
} from '../utils/vaultAuth';

interface SecurityModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: FirebaseUser | null;
  onClearLocalCache: () => Promise<void>;
  onWipeAllData: () => Promise<void>;
  onLockSite: () => void;
  productCount: number;
}

export const SecurityModal: React.FC<SecurityModalProps> = ({
  isOpen,
  onClose,
  user,
  onClearLocalCache,
  onWipeAllData,
  onLockSite,
  productCount,
}) => {
  const [confirmWipe, setConfirmWipe] = useState(false);
  const [isWiping, setIsWiping] = useState(false);
  const [isClearingCache, setIsClearingCache] = useState(false);
  const [exportSuccess, setExportSuccess] = useState(false);

  // Passcode change state
  const [showChangePasscode, setShowChangePasscode] = useState(false);
  const [currentPass, setCurrentPass] = useState('');
  const [newPass, setNewPass] = useState('');
  const [confirmNewPass, setConfirmNewPass] = useState('');
  const [passError, setPassError] = useState<string | null>(null);
  const [passSuccess, setPassSuccess] = useState<string | null>(null);
  const [isChangingPass, setIsChangingPass] = useState(false);
  const [isCustomPass, setIsCustomPass] = useState(hasCustomPassword());

  useEffect(() => {
    setIsCustomPass(hasCustomPassword());
    const unsub = subscribeToVaultAuthChanges((setting) => {
      setIsCustomPass(Boolean(setting.isCustom));
    });
    return () => unsub();
  }, [isOpen]);

  if (!isOpen) return null;

  const handleExport = async () => {
    try {
      const dataStr = await exportProductsAsJson();
      const blob = new Blob([dataStr], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `linkpix_export_${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      setExportSuccess(true);
      setTimeout(() => setExportSuccess(false), 3000);
    } catch (err) {
      console.error('Export error:', err);
    }
  };

  const handleClearCache = async () => {
    setIsClearingCache(true);
    try {
      await onClearLocalCache();
    } finally {
      setIsClearingCache(false);
    }
  };

  const handleExecuteWipe = async () => {
    setIsWiping(true);
    try {
      await onWipeAllData();
      setConfirmWipe(false);
      onClose();
    } finally {
      setIsWiping(false);
    }
  };

  const handleChangePasscode = async (e: React.FormEvent) => {
    e.preventDefault();
    setPassError(null);
    setPassSuccess(null);

    if (!newPass || newPass.length < 4) {
      setPassError('New passcode must be at least 4 characters.');
      return;
    }

    if (newPass !== confirmNewPass) {
      setPassError('New passcode and confirmation do not match.');
      return;
    }

    setIsChangingPass(true);
    try {
      const res = await changeVaultPassword(currentPass, newPass);
      if (res.success) {
        setPassSuccess('Passcode updated and synced across all devices!');
        setCurrentPass('');
        setNewPass('');
        setConfirmNewPass('');
        setTimeout(() => setShowChangePasscode(false), 2500);
      } else {
        setPassError(res.error || 'Failed to update passcode.');
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setPassError(`An error occurred while updating passcode: ${msg}`);
    } finally {
      setIsChangingPass(false);
    }
  };

  const handleResetPasscode = async () => {
    try {
      await resetToDefaultPassword();
      setPassSuccess(`Reset to default: "${DEFAULT_SITE_PASSWORD}" (synced across all devices)`);
      setPassError(null);
      setCurrentPass('');
      setNewPass('');
      setConfirmNewPass('');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setPassError(`Failed to reset passcode in cloud: ${msg}`);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-lg bg-white rounded-2xl shadow-2xl border border-stone-200 overflow-hidden max-h-[90vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-stone-100 bg-stone-50/70 flex-shrink-0">
          <div className="flex items-center gap-2 text-stone-900 font-semibold text-base">
            <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center">
              <ShieldCheck className="w-4 h-4" />
            </div>
            <span>Security & Privacy Center</span>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-stone-400 hover:text-stone-700 hover:bg-stone-100 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Scrollable Body */}
        <div className="p-6 overflow-y-auto space-y-6 text-sm text-stone-600">
          {/* Security Status Card */}
          <div className="rounded-xl border border-emerald-200 bg-emerald-50/50 p-4">
            <div className="flex items-center gap-2 font-semibold text-emerald-900 text-sm mb-1.5">
              <Lock className="w-4 h-4 text-emerald-600" />
              <span>Vault Protection Active</span>
            </div>
            <p className="text-xs text-emerald-800 leading-relaxed">
              Your photos and Amazon product links are protected with granular access rules, strict input validation, and user isolation.
            </p>
          </div>

          {/* Security Features Breakdown */}
          <div className="space-y-3">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-stone-400">
              Protection Mechanisms
            </h4>

            <div className="grid grid-cols-1 gap-2.5">
              {/* Cloud RLS */}
              <div className="flex items-start gap-3 p-3 rounded-xl border border-stone-200 bg-stone-50/60">
                <KeyRound className="w-4 h-4 text-stone-700 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-xs font-semibold text-stone-900">
                    Row-Level Cloud Security
                  </p>
                  <p className="text-xs text-stone-500 mt-0.5">
                    {user
                      ? `Signed in as ${user.email}. Only your authenticated account can read, write, or query your products.`
                      : 'Sign in to activate cloud row-level security. Currently protected in private local browser storage.'}
                  </p>
                </div>
              </div>

              {/* URL & Link Sanitization */}
              <div className="flex items-start gap-3 p-3 rounded-xl border border-stone-200 bg-stone-50/60">
                <Shield className="w-4 h-4 text-stone-700 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-xs font-semibold text-stone-900">
                    XSS & Script Injection Defense
                  </p>
                  <p className="text-xs text-stone-500 mt-0.5">
                    Amazon links and ASINs are sanitized to strictly allow safe HTTP/HTTPS web protocols, neutralizing script-based URL exploits.
                  </p>
                </div>
              </div>

              {/* Upload File Validation */}
              <div className="flex items-start gap-3 p-3 rounded-xl border border-stone-200 bg-stone-50/60">
                <FileText className="w-4 h-4 text-stone-700 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-xs font-semibold text-stone-900">
                    Safe Image Upload Filter
                  </p>
                  <p className="text-xs text-stone-500 mt-0.5">
                    Strict MIME type verification. Files with embedded SVG scripts, HTML, or executable extensions are blocked.
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Master Passcode & Site Wall Protection */}
          <div className="space-y-3 p-4 rounded-xl border border-amber-200 bg-amber-50/50">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-amber-100 text-amber-800 flex items-center justify-center">
                  <Key className="w-3.5 h-3.5" />
                </div>
                <div>
                  <h4 className="text-xs font-semibold text-stone-900">
                    Master Site Password Wall
                  </h4>
                  <p className="text-[11px] text-stone-500">
                    Site access is locked behind a master passcode.
                  </p>
                </div>
              </div>

              {/* Immediate Lock Button */}
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onLockSite();
                }}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-stone-900 hover:bg-stone-800 text-white text-xs font-medium transition-colors cursor-pointer shadow-2xs"
              >
                <LockKeyhole className="w-3.5 h-3.5" />
                <span>Lock Site Now</span>
              </button>
            </div>

            {/* Toggle Passcode Modification Form */}
            <div className="pt-2 border-t border-amber-200/70">
              {!showChangePasscode ? (
                <div className="flex items-center justify-between text-xs">
                  <span className="text-stone-600">
                    {isCustomPass ? 'Custom passcode configured' : 'Using initial default passcode'}
                  </span>
                  <button
                    type="button"
                    onClick={() => setShowChangePasscode(true)}
                    className="font-medium text-amber-800 hover:text-amber-900 underline underline-offset-2 cursor-pointer"
                  >
                    Change Master Passcode
                  </button>
                </div>
              ) : (
                <form onSubmit={handleChangePasscode} className="space-y-2.5 pt-1 text-xs">
                  <div>
                    <label className="block text-[11px] font-medium text-stone-700 mb-1">
                      Current Passcode
                    </label>
                    <input
                      type="password"
                      value={currentPass}
                      onChange={(e) => setCurrentPass(e.target.value)}
                      placeholder="Current passcode (e.g. linkpix)"
                      className="w-full px-3 py-1.5 rounded-lg border border-stone-300 bg-white text-stone-900 text-xs focus:outline-hidden focus:border-amber-600 focus:ring-1 focus:ring-amber-500"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-[11px] font-medium text-stone-700 mb-1">
                        New Passcode
                      </label>
                      <input
                        type="password"
                        value={newPass}
                        onChange={(e) => setNewPass(e.target.value)}
                        placeholder="Min 4 characters"
                        className="w-full px-3 py-1.5 rounded-lg border border-stone-300 bg-white text-stone-900 text-xs focus:outline-hidden focus:border-amber-600 focus:ring-1 focus:ring-amber-500"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-medium text-stone-700 mb-1">
                        Confirm New Passcode
                      </label>
                      <input
                        type="password"
                        value={confirmNewPass}
                        onChange={(e) => setConfirmNewPass(e.target.value)}
                        placeholder="Re-type new passcode"
                        className="w-full px-3 py-1.5 rounded-lg border border-stone-300 bg-white text-stone-900 text-xs focus:outline-hidden focus:border-amber-600 focus:ring-1 focus:ring-amber-500"
                      />
                    </div>
                  </div>

                  {passError && (
                    <p className="text-[11px] text-red-600 font-medium">{passError}</p>
                  )}
                  {passSuccess && (
                    <p className="text-[11px] text-emerald-700 font-medium">{passSuccess}</p>
                  )}

                  <div className="flex items-center justify-between pt-1">
                    <button
                      type="button"
                      onClick={handleResetPasscode}
                      className="text-[11px] text-stone-500 hover:text-stone-700 underline cursor-pointer"
                    >
                      Reset to default ({DEFAULT_SITE_PASSWORD})
                    </button>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setShowChangePasscode(false);
                          setPassError(null);
                          setPassSuccess(null);
                        }}
                        className="px-2.5 py-1 rounded-md border border-stone-300 bg-white text-stone-600 hover:bg-stone-50 cursor-pointer"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        disabled={isChangingPass}
                        className="px-3 py-1 rounded-md bg-amber-600 hover:bg-amber-700 text-white font-medium cursor-pointer disabled:opacity-50"
                      >
                        {isChangingPass ? 'Updating...' : 'Save Passcode'}
                      </button>
                    </div>
                  </div>
                </form>
              )}
            </div>
          </div>

          {/* Data Portability & Shared Device Controls */}
          <div className="space-y-3">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-stone-400">
              Privacy & Device Controls
            </h4>

            <div className="flex flex-col sm:flex-row gap-2.5">
              {/* Export Button */}
              <button
                type="button"
                onClick={handleExport}
                className="flex-1 flex items-center justify-center gap-2 px-3.5 py-2.5 rounded-xl border border-stone-200 bg-white hover:bg-stone-50 text-stone-800 text-xs font-medium transition-colors cursor-pointer"
              >
                {exportSuccess ? (
                  <>
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Export Downloaded</span>
                  </>
                ) : (
                  <>
                    <Download className="w-3.5 h-3.5 text-stone-500" />
                    <span>Export Vault Backup (JSON)</span>
                  </>
                )}
              </button>

              {/* Clear Local Cache */}
              <button
                type="button"
                onClick={handleClearCache}
                disabled={isClearingCache}
                className="flex-1 flex items-center justify-center gap-2 px-3.5 py-2.5 rounded-xl border border-stone-200 bg-white hover:bg-stone-50 text-stone-800 text-xs font-medium transition-colors cursor-pointer"
                title="Clears photos cached in this specific browser (useful on shared/public computers)"
              >
                <Laptop className="w-3.5 h-3.5 text-stone-500" />
                <span>{isClearingCache ? 'Clearing...' : 'Clear Device Cache'}</span>
              </button>
            </div>
            <p className="text-[11px] text-stone-400 pl-1">
              Clearing device cache removes stored photos from this computer's browser without affecting your cloud backup.
            </p>
          </div>

          {/* Danger Zone */}
          <div className="pt-3 border-t border-stone-200">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-red-500 mb-2">
              Danger Zone
            </h4>

            {!confirmWipe ? (
              <button
                type="button"
                onClick={() => setConfirmWipe(true)}
                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-red-200 text-red-600 hover:bg-red-50 text-xs font-medium transition-colors cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Erase All Stored Data ({productCount} products)</span>
              </button>
            ) : (
              <div className="rounded-xl border border-red-200 bg-red-50/60 p-3.5 space-y-2.5">
                <div className="flex items-center gap-2 text-xs font-semibold text-red-700">
                  <AlertTriangle className="w-4 h-4 text-red-600" />
                  <span>Permanently delete all product photos?</span>
                </div>
                <p className="text-xs text-red-600">
                  This will wipe all {productCount} products and images from both this device and your cloud account. This action cannot be undone.
                </p>
                <div className="flex items-center gap-2 pt-1">
                  <button
                    type="button"
                    onClick={handleExecuteWipe}
                    disabled={isWiping}
                    className="flex-1 px-3 py-1.5 rounded-lg bg-red-600 hover:bg-red-700 text-white text-xs font-medium transition-colors cursor-pointer disabled:opacity-50"
                  >
                    {isWiping ? 'Wiping...' : 'Yes, Delete Everything'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmWipe(false)}
                    className="px-3 py-1.5 rounded-lg border border-stone-300 bg-white text-stone-700 text-xs font-medium hover:bg-stone-50 cursor-pointer"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 bg-stone-50 border-t border-stone-100 flex items-center justify-between text-xs text-stone-500 flex-shrink-0">
          <span>Encrypted in transit & at rest</span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-stone-900 text-white font-medium hover:bg-stone-800 transition-colors cursor-pointer"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
