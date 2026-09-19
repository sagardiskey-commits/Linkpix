import React, { useState } from 'react';
import {
  Camera,
  Search,
  PlusCircle,
  Smartphone,
  Cloud,
  LogOut,
  Sparkles,
  Loader2,
  ShieldCheck,
  Lock,
} from 'lucide-react';
import { ActiveTab } from '../types';
import { User } from 'firebase/auth';

interface NavbarProps {
  activeTab: ActiveTab;
  onTabChange: (tab: ActiveTab) => void;
  totalCount: number;
  user: User | null;
  onSignIn: () => Promise<void>;
  onSignOut: () => Promise<void>;
  onOpenShareModal: () => void;
  onOpenSecurityModal: () => void;
  onLockSite: () => void;
  isAuthLoading?: boolean;
}

export const Navbar: React.FC<NavbarProps> = ({
  activeTab,
  onTabChange,
  totalCount,
  user,
  onSignIn,
  onSignOut,
  onOpenShareModal,
  onOpenSecurityModal,
  onLockSite,
  isAuthLoading = false,
}) => {
  const [isSigningIn, setIsSigningIn] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);

  const handleSignInClick = async () => {
    setIsSigningIn(true);
    try {
      await onSignIn();
    } finally {
      setIsSigningIn(false);
    }
  };

  return (
    <header className="sticky top-0 z-40 bg-white/90 backdrop-blur-md border-b border-stone-200">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-2">
        {/* Brand */}
        <button
          id="brand-logo-btn"
          onClick={() => onTabChange('home')}
          className="flex items-center gap-2.5 group cursor-pointer text-left"
        >
          <div className="w-9 h-9 rounded-xl bg-stone-900 flex items-center justify-center group-hover:scale-105 transition-transform shadow-sm">
            <Camera className="w-5 h-5 text-white" strokeWidth={2.2} />
          </div>
          <div className="flex flex-col">
            <span className="font-semibold text-stone-900 text-lg tracking-tight leading-none">
              LinkPix
            </span>
            <span className="text-[11px] text-stone-400 font-normal mt-0.5 hidden sm:inline-block">
              Amazon photo vault
            </span>
          </div>
        </button>

        {/* Center Navigation Tabs */}
        <nav className="flex items-center gap-1 sm:gap-2">
          <button
            id="nav-home-btn"
            onClick={() => onTabChange('home')}
            className={`px-3 sm:px-3.5 py-1.5 rounded-lg text-sm font-medium transition-all cursor-pointer ${
              activeTab === 'home'
                ? 'bg-stone-900 text-white shadow-xs'
                : 'text-stone-600 hover:text-stone-900 hover:bg-stone-100'
            }`}
          >
            Home
          </button>
          <button
            id="nav-upload-btn"
            onClick={() => onTabChange('upload')}
            className={`inline-flex items-center gap-1.5 px-3 sm:px-3.5 py-1.5 rounded-lg text-sm font-medium transition-all cursor-pointer ${
              activeTab === 'upload'
                ? 'bg-stone-900 text-white shadow-xs'
                : 'text-stone-600 hover:text-stone-900 hover:bg-stone-100'
            }`}
          >
            <PlusCircle className="w-3.5 h-3.5 hidden xs:inline" />
            Upload
          </button>
          <button
            id="nav-lookup-btn"
            onClick={() => onTabChange('lookup')}
            className={`inline-flex items-center gap-1.5 px-3 sm:px-3.5 py-1.5 rounded-lg text-sm font-medium transition-all cursor-pointer ${
              activeTab === 'lookup'
                ? 'bg-stone-900 text-white shadow-xs'
                : 'text-stone-600 hover:text-stone-900 hover:bg-stone-100'
            }`}
          >
            <Search className="w-3.5 h-3.5 hidden xs:inline" />
            Lookup
          </button>
        </nav>

        {/* Right Action Controls: Open on device + Cloud Auth */}
        <div className="flex items-center gap-1.5 sm:gap-2">
          {/* Quick Lock Site Button */}
          <button
            id="nav-lock-site-btn"
            type="button"
            onClick={onLockSite}
            className="inline-flex items-center gap-1.5 px-2 sm:px-2.5 py-1.5 rounded-lg border border-stone-200 bg-white text-xs font-medium text-stone-700 hover:bg-stone-50 hover:text-stone-900 transition-colors cursor-pointer shadow-2xs"
            title="Lock site with master passcode"
          >
            <Lock className="w-3.5 h-3.5 text-amber-600" />
            <span className="hidden sm:inline">Lock</span>
          </button>

          {/* Security & Privacy Center Button */}
          <button
            id="nav-security-btn"
            type="button"
            onClick={onOpenSecurityModal}
            className="inline-flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-lg border border-emerald-200 bg-emerald-50 text-xs font-semibold text-emerald-800 hover:bg-emerald-100 hover:border-emerald-300 transition-colors cursor-pointer shadow-2xs"
            title="Security & Privacy Center (Change Passcode, Cache, Rules)"
          >
            <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
            <span className="inline">Security</span>
          </button>

          {/* Open on Phone / QR button */}
          <button
            id="nav-open-phone-btn"
            type="button"
            onClick={onOpenShareModal}
            className="inline-flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-lg border border-stone-200 bg-white text-xs font-medium text-stone-700 hover:bg-stone-50 hover:border-stone-300 transition-colors cursor-pointer shadow-2xs"
            title="Scan QR code to open on your phone or tablet"
          >
            <Smartphone className="w-3.5 h-3.5 text-stone-500" />
            <span className="hidden md:inline">Open on Phone</span>
          </button>

          {/* User Auth / Cloud Sync Status */}
          {user ? (
            <div className="relative">
              <button
                type="button"
                onClick={() => setShowUserMenu(!showUserMenu)}
                className="flex items-center gap-1.5 p-1 sm:px-2.5 sm:py-1 rounded-lg border border-stone-200 bg-white hover:bg-stone-50 transition-colors cursor-pointer shadow-2xs"
              >
                {user.photoURL ? (
                  <img
                    src={user.photoURL}
                    alt={user.displayName || 'User'}
                    className="w-6 h-6 rounded-full object-cover"
                  />
                ) : (
                  <div className="w-6 h-6 rounded-full bg-stone-900 text-white flex items-center justify-center text-[10px] font-bold">
                    {(user.displayName || user.email || 'U')[0].toUpperCase()}
                  </div>
                )}
                <div className="hidden sm:flex flex-col text-left">
                  <span className="text-xs font-medium text-stone-900 leading-none truncate max-w-[90px]">
                    {user.displayName?.split(' ')[0] || 'Synced'}
                  </span>
                  <span className="text-[10px] text-emerald-600 flex items-center gap-0.5 leading-tight">
                    <Cloud className="w-2.5 h-2.5" />
                    Cloud Active
                  </span>
                </div>
              </button>

              {/* User Dropdown */}
              {showUserMenu && (
                <div
                  className="absolute right-0 mt-1 w-52 bg-white rounded-xl shadow-lg border border-stone-200 py-1.5 z-50 animate-in fade-in zoom-in-95 duration-150"
                  onClick={() => setShowUserMenu(false)}
                >
                  <div className="px-3 py-2 border-b border-stone-100">
                    <p className="text-xs font-semibold text-stone-900 truncate">
                      {user.displayName || 'Google Account'}
                    </p>
                    <p className="text-[11px] text-stone-500 truncate font-mono">
                      {user.email}
                    </p>
                  </div>

                  <button
                    onClick={onOpenSecurityModal}
                    className="w-full px-3 py-2 text-left text-xs text-stone-700 hover:bg-stone-50 flex items-center gap-2 cursor-pointer transition-colors"
                  >
                    <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                    Security & Privacy
                  </button>

                  <button
                    onClick={onLockSite}
                    className="w-full px-3 py-2 text-left text-xs text-stone-700 hover:bg-stone-50 flex items-center gap-2 cursor-pointer transition-colors"
                  >
                    <Lock className="w-3.5 h-3.5 text-amber-600" />
                    Lock Site Now
                  </button>

                  <button
                    onClick={onSignOut}
                    className="w-full px-3 py-2 text-left text-xs text-red-600 hover:bg-red-50 flex items-center gap-2 cursor-pointer transition-colors border-t border-stone-100"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                    Sign Out
                  </button>
                </div>
              )}
            </div>
          ) : (
            <button
              id="nav-signin-btn"
              type="button"
              disabled={isSigningIn || isAuthLoading}
              onClick={handleSignInClick}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-stone-900 text-white text-xs font-medium hover:bg-stone-800 transition-colors cursor-pointer shadow-xs disabled:opacity-50"
              title="Sign in with Google to sync your photos across your phone and other devices"
            >
              {isSigningIn || isAuthLoading ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Cloud className="w-3.5 h-3.5 text-sky-300" />
              )}
              <span>Sign in to Sync</span>
            </button>
          )}
        </div>
      </div>
    </header>
  );
};
