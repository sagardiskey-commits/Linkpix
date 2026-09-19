import React, { useState, useEffect } from 'react';
import {
  Smartphone,
  Copy,
  Check,
  X,
  ExternalLink,
  QrCode,
  Sparkles,
  Cloud,
} from 'lucide-react';

interface ShareDeviceModalProps {
  isOpen: boolean;
  onClose: () => void;
  userEmail?: string | null;
}

export const ShareDeviceModal: React.FC<ShareDeviceModalProps> = ({
  isOpen,
  onClose,
  userEmail,
}) => {
  const [copied, setCopied] = useState(false);
  const [useDevUrl, setUseDevUrl] = useState(false);

  // Close on Escape key press
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  // If the user hasn't clicked "Share" in AI Studio yet, ais-pre returns 404.
  // We provide both the public Shared URL and the Dev URL with clear guidance.
  const SHARED_APP_URL = 'https://ais-pre-rfjz5gnq6qgxarh4n2e6xf-838485163270.asia-southeast1.run.app';
  const DEV_APP_URL = 'https://ais-dev-rfjz5gnq6qgxarh4n2e6xf-838485163270.asia-southeast1.run.app';
  
  const appUrl = useDevUrl ? DEV_APP_URL : SHARED_APP_URL;

  const qrImageUrl = `https://api.qrserver.com/v1/create-qr-code/?size=260x260&margin=12&data=${encodeURIComponent(
    appUrl
  )}`;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(appUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2200);
    } catch {
      // ignore
    }
  };

  return (
    <div
      id="share-device-modal-backdrop"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200 overflow-y-auto"
      onClick={onClose}
    >
      <div
        id="share-device-modal-card"
        className="relative w-full max-w-md bg-white rounded-2xl shadow-2xl border border-stone-200 overflow-hidden my-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-stone-100 bg-stone-50/50">
          <div className="flex items-center gap-2 text-stone-900 font-semibold text-base">
            <Smartphone className="w-5 h-5 text-stone-700" />
            <span>Open LinkPix on Phone or Tablet</span>
          </div>
          <button
            id="share-device-modal-close-btn"
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-stone-500 hover:text-stone-900 hover:bg-stone-200/70 transition-colors cursor-pointer"
            aria-label="Close dialog"
            title="Close (Esc)"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 text-center max-h-[75vh] overflow-y-auto">
          {/* QR Code Container */}
          <div className="relative inline-block p-3 rounded-2xl bg-white border border-stone-200 shadow-xs mb-4">
            <img
              src={qrImageUrl}
              alt="Scan to open on phone"
              className="w-48 h-48 sm:w-52 sm:h-52 object-contain mx-auto rounded-lg"
              loading="eager"
            />
            <div className="absolute -bottom-2.5 left-1/2 -translate-x-1/2 px-3 py-0.5 rounded-full bg-stone-900 text-white text-[10px] font-medium tracking-wide flex items-center gap-1 shadow-xs">
              <QrCode className="w-3 h-3" />
              <span>Scan with camera</span>
            </div>
          </div>

          <h3 className="font-semibold text-stone-900 text-base mb-1">
            Scan to open instantly
          </h3>
          <p className="text-xs text-stone-500 max-w-xs mx-auto mb-4">
            Point your phone's camera at the QR code above to load the app directly on your mobile browser.
          </p>

          {/* Copy Link Input */}
          <div className="flex items-center gap-2 p-1.5 rounded-xl border border-stone-200 bg-stone-50 text-left mb-3">
            <span className="font-mono text-xs text-stone-700 truncate pl-2 flex-1">
              {appUrl}
            </span>
            <button
              id="share-modal-copy-btn"
              type="button"
              onClick={handleCopy}
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-stone-900 text-white text-xs font-medium hover:bg-stone-800 transition-colors cursor-pointer flex-shrink-0"
            >
              {copied ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Copied!</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5" />
                  <span>Copy Link</span>
                </>
              )}
            </button>
          </div>

          {/* Activation Note for Public Shared Link */}
          <div className="mb-4 p-3 rounded-xl border border-amber-200 bg-amber-50/80 text-left text-xs text-amber-900 space-y-1">
            <p className="font-semibold flex items-center gap-1.5">
              <span>Notice: If you see "URL not found"</span>
            </p>
            <p className="text-[11px] leading-relaxed text-amber-800">
              In Google AI Studio, click the <strong>"Share"</strong> button in the top-right header of your screen to publish and activate this public link for other browsers and phones.
            </p>
            <div className="pt-1 flex items-center gap-2 text-[11px]">
              <button
                type="button"
                onClick={() => setUseDevUrl(!useDevUrl)}
                className="text-amber-900 font-semibold underline underline-offset-2 cursor-pointer"
              >
                {useDevUrl ? 'Switch to Public Shared Link' : 'Switch to Creator Dev Link'}
              </button>
            </div>
          </div>

          {/* How Cloud Sync Works */}
          <div className="rounded-xl bg-stone-50 border border-stone-200/80 p-3.5 text-left text-xs space-y-2">
            <div className="flex items-center gap-2 font-medium text-stone-900">
              <Cloud className="w-4 h-4 text-sky-600" />
              <span>How your photos sync between devices:</span>
            </div>
            <ol className="list-decimal list-inside space-y-1.5 text-stone-600 pl-1 leading-relaxed">
              <li>Open the link or scan the QR code on your phone.</li>
              <li>
                Sign in with the <strong>same Google account</strong>
                {userEmail ? ` (${userEmail})` : ''}.
              </li>
              <li>
                Take photos with your phone camera — they will sync to your computer in real-time!
              </li>
            </ol>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 bg-stone-50 border-t border-stone-100 flex items-center justify-between text-xs text-stone-500">
          <span>Works on iOS, Android, macOS & Windows</span>
          <button
            id="share-device-modal-done-btn"
            type="button"
            onClick={onClose}
            className="px-5 py-2 rounded-lg bg-stone-900 text-white font-medium hover:bg-stone-800 transition-colors cursor-pointer shadow-xs"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
