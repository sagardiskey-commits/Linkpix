import React, { useState, useEffect, useRef } from 'react';
import {
  Lock,
  Unlock,
  Eye,
  EyeOff,
  KeyRound,
  ShieldAlert,
  ArrowRight,
  Clock,
  CheckCircle2,
  Sparkles,
} from 'lucide-react';
import {
  verifyPassword,
  unlockSite,
  getRemainingLockoutSeconds,
  hasCustomPassword,
  initializeVaultCredentials,
  applyCloudVaultSetting,
  DEFAULT_SITE_PASSWORD,
  subscribeToVaultAuthChanges,
} from '../utils/vaultAuth';
import { subscribeToVaultSetting } from '../firebase';

interface PasswordWallProps {
  onUnlock: () => void;
  notificationMessage?: string | null;
}

export const PasswordWall: React.FC<PasswordWallProps> = ({ onUnlock, notificationMessage }) => {
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberDevice, setRememberDevice] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isVerifying, setIsVerifying] = useState(false);
  const [cooldownSeconds, setCooldownSeconds] = useState(0);
  const [isReady, setIsReady] = useState(false);
  const [isCustom, setIsCustom] = useState(hasCustomPassword());

  const inputRef = useRef<HTMLInputElement>(null);

  // Sync cloud credentials on mount & listen to real-time updates
  useEffect(() => {
    let isMounted = true;
    initializeVaultCredentials().then((setting) => {
      if (!isMounted) return;
      setIsCustom(Boolean(setting?.isCustom));
      setIsReady(true);
    });

    const unsub = subscribeToVaultSetting((cloudSetting) => {
      if (!isMounted) return;
      if (cloudSetting) {
        applyCloudVaultSetting(cloudSetting);
        setIsCustom(Boolean(cloudSetting.isCustom));
        setIsReady(true);
      }
    });
    const unsubAuth = subscribeToVaultAuthChanges((setting) => {
      if (!isMounted) return;
      setIsCustom(Boolean(setting.isCustom));
      setIsReady(true);
    });

    return () => {
      isMounted = false;
      unsub();
      unsubAuth();
    };
  }, []);

  // Check cooldown on mount and set timer
  useEffect(() => {
    const remaining = getRemainingLockoutSeconds();
    if (remaining > 0) {
      setCooldownSeconds(remaining);
    }
  }, []);

  useEffect(() => {
    if (cooldownSeconds <= 0) return;
    const interval = setInterval(() => {
      setCooldownSeconds((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          setErrorMessage(null);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [cooldownSeconds]);

  // Focus input automatically
  useEffect(() => {
    inputRef.current?.focus();
  }, [cooldownSeconds]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (cooldownSeconds > 0) return;
    if (!password.trim()) {
      setErrorMessage('Please enter the vault passcode.');
      return;
    }

    setIsVerifying(true);
    setErrorMessage(null);

    try {
      const result = await verifyPassword(password);
      if (result.success) {
        unlockSite(rememberDevice);
        onUnlock();
      } else {
        setErrorMessage(result.error || 'Incorrect passcode. Access denied.');
        if (result.remainingSeconds && result.remainingSeconds > 0) {
          setCooldownSeconds(result.remainingSeconds);
        }
        setPassword('');
        inputRef.current?.focus();
      }
    } catch (err) {
      console.error('Password verification error:', err);
      setErrorMessage('Verification failed. Please try again.');
    } finally {
      setIsVerifying(false);
    }
  };

  const handleUseDefault = () => {
    setPassword(DEFAULT_SITE_PASSWORD);
    setErrorMessage(null);
    inputRef.current?.focus();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-stone-900/95 backdrop-blur-md p-4 selection:bg-amber-500 selection:text-white">
      {/* Background ambient lighting */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -left-40 w-96 h-96 bg-amber-500/10 rounded-full blur-3xl" />
        <div className="absolute -bottom-40 -right-40 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl" />
      </div>

      <div className="relative w-full max-w-md bg-stone-900 border border-stone-800 rounded-3xl shadow-2xl p-6 sm:p-8 text-stone-200">
        {/* Brand Icon & Lock Header */}
        <div className="flex flex-col items-center text-center mb-6">
          <div className="relative mb-3">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-amber-500 to-amber-600 flex items-center justify-center shadow-lg shadow-amber-500/20 ring-4 ring-stone-800">
              <Lock className="w-8 h-8 text-stone-950 stroke-[2.2]" />
            </div>
            <div className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-emerald-500 flex items-center justify-center ring-2 ring-stone-900">
              <KeyRound className="w-3.5 h-3.5 text-stone-950" />
            </div>
          </div>

          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-stone-800/80 border border-stone-700 text-[11px] font-semibold tracking-wider uppercase text-amber-400 mb-2">
            <span>LinkPix</span>
            <span className="text-stone-500">•</span>
            <span>Vault Protected</span>
          </div>

          <h1 className="text-2xl font-bold text-white tracking-tight">
            Passcode Required
          </h1>
          <p className="text-xs text-stone-400 mt-1 max-w-xs leading-relaxed">
            This application is walled with password protection. Enter your master vault passcode to unlock access.
          </p>
        </div>

        {/* Error / Cooldown / Remote Sync Banner */}
        {cooldownSeconds > 0 ? (
          <div className="mb-5 p-3.5 rounded-xl border border-red-900/60 bg-red-950/40 text-red-300 text-xs flex items-center gap-2.5 animate-in fade-in">
            <Clock className="w-4 h-4 text-red-400 flex-shrink-0 animate-spin" style={{ animationDuration: '3s' }} />
            <div>
              <p className="font-semibold text-red-200">Security Cooldown Active</p>
              <p className="text-[11px] text-red-300/80 mt-0.5">
                Too many attempts. Unlock disabled for <strong className="text-white">{cooldownSeconds}s</strong>.
              </p>
            </div>
          </div>
        ) : errorMessage ? (
          <div className="mb-5 p-3 rounded-xl border border-red-900/50 bg-red-950/30 text-red-300 text-xs flex items-start gap-2 animate-in fade-in">
            <ShieldAlert className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
            <span>{errorMessage}</span>
          </div>
        ) : notificationMessage ? (
          <div className="mb-5 p-3 rounded-xl border border-amber-800/60 bg-amber-950/40 text-amber-200 text-xs flex items-start gap-2 animate-in fade-in">
            <Sparkles className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
            <span>{notificationMessage}</span>
          </div>
        ) : null}

        {/* Password Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-stone-300 mb-1.5">
              Master Vault Passcode
            </label>
            <div className="relative">
              <input
                ref={inputRef}
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  if (errorMessage) setErrorMessage(null);
                }}
                disabled={cooldownSeconds > 0 || isVerifying}
                placeholder="Enter passcode..."
                autoComplete="current-password"
                className="w-full px-4 py-3 pr-11 rounded-xl bg-stone-950/80 border border-stone-700 text-white placeholder-stone-500 text-sm focus:outline-hidden focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                tabIndex={-1}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-200 transition-colors cursor-pointer p-1"
                aria-label={showPassword ? 'Hide passcode' : 'Show passcode'}
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* Remember on Device Checkbox */}
          <div className="flex items-center justify-between text-xs text-stone-400 pt-0.5">
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={rememberDevice}
                onChange={(e) => setRememberDevice(e.target.checked)}
                className="w-4 h-4 rounded-sm bg-stone-950 border-stone-700 text-amber-500 focus:ring-amber-500/20 cursor-pointer accent-amber-500"
              />
              <span>Remember on this browser</span>
            </label>
          </div>

          {/* Unlock Action Button */}
          <button
            type="submit"
            disabled={cooldownSeconds > 0 || isVerifying || !password.trim()}
            className="w-full flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-stone-950 font-semibold text-sm shadow-lg shadow-amber-500/20 transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.99]"
          >
            {isVerifying ? (
              <span>Verifying Passcode...</span>
            ) : (
              <>
                <span>Unlock LinkPix</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </form>

        {/* Initial Setup Hint Banner if not changed yet */}
        {isReady && !isCustom && (
          <div className="mt-5 p-3 rounded-xl bg-stone-800/60 border border-stone-700/80 text-xs text-stone-300 flex items-center justify-between gap-3 animate-in fade-in">
            <div className="flex items-center gap-2 min-w-0">
              <Sparkles className="w-4 h-4 text-amber-400 flex-shrink-0" />
              <span className="truncate">
                Default passcode: <code className="px-1.5 py-0.5 rounded-md bg-stone-950 text-amber-300 font-mono font-bold text-[11px]">{DEFAULT_SITE_PASSWORD}</code>
              </span>
            </div>
            <button
              type="button"
              onClick={handleUseDefault}
              className="text-[11px] font-semibold text-amber-400 hover:text-amber-300 underline underline-offset-2 flex-shrink-0 cursor-pointer"
            >
              Fill Code
            </button>
          </div>
        )}

        <p className="text-[11px] text-stone-400 text-center mt-3">
          After unlocking, open the green <strong className="text-emerald-400">Security</strong> button in the top navigation bar to change your passcode or manage privacy settings.
        </p>

        {/* Security Info Badge Footer */}
        <div className="mt-6 pt-4 border-t border-stone-800 flex items-center justify-center gap-4 text-[11px] text-stone-500">
          <span className="flex items-center gap-1">
            <CheckCircle2 className="w-3 h-3 text-emerald-500" />
            SHA-256 Salted
          </span>
          <span>•</span>
          <span className="flex items-center gap-1">
            <CheckCircle2 className="w-3 h-3 text-emerald-500" />
            Anti-Brute Force
          </span>
        </div>
      </div>
    </div>
  );
};
