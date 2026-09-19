import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Camera, X, RefreshCw, AlertCircle, Check, Trash2 } from 'lucide-react';

interface CameraModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCapture: (files: File[]) => void;
}

export const CameraModal: React.FC<CameraModalProps> = ({ isOpen, onClose, onCapture }) => {
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('environment');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [capturedPhotos, setCapturedPhotos] = useState<Array<{ file: File; preview: string }>>([]);
  const [flash, setFlash] = useState(false);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const stopTracks = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  }, []);

  const startCamera = useCallback(
    async (mode: 'user' | 'environment') => {
      setIsLoading(true);
      setErrorMsg(null);
      stopTracks();

      try {
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
          throw new Error('Camera access is not supported by your browser or in this environment.');
        }

        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: mode,
            width: { ideal: 1920 },
            height: { ideal: 1080 },
          },
          audio: false,
        });

        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play().catch(() => {});
        }
        setIsLoading(false);
      } catch (err: any) {
        console.error('Camera error:', err);
        setIsLoading(false);
        setErrorMsg(
          err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError'
            ? 'Camera permission was denied. Please allow camera access in your browser or use "Choose file" instead.'
            : 'Could not access the camera. Check camera hardware or choose a file from your device instead.'
        );
      }
    },
    [stopTracks]
  );

  useEffect(() => {
    if (isOpen) {
      setCapturedPhotos([]);
      startCamera(facingMode);
    } else {
      stopTracks();
    }
    return () => {
      stopTracks();
    };
  }, [isOpen, facingMode, startCamera, stopTracks]);

  const handleCapture = () => {
    const video = videoRef.current;
    if (!video) return;

    // Trigger visual flash
    setFlash(true);
    setTimeout(() => setFlash(false), 150);

    const width = video.videoWidth || 1280;
    const height = video.videoHeight || 720;

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.drawImage(video, 0, 0, width, height);

    canvas.toBlob(
      (blob) => {
        if (!blob) return;
        const file = new File([blob], `photo-${Date.now()}-${capturedPhotos.length + 1}.jpg`, {
          type: 'image/jpeg',
        });
        const previewUrl = URL.createObjectURL(blob);
        setCapturedPhotos((prev) => [...prev, { file, preview: previewUrl }]);
      },
      'image/jpeg',
      0.92
    );
  };

  const handleRemoveCaptured = (index: number) => {
    setCapturedPhotos((prev) => prev.filter((_, i) => i !== index));
  };

  const handleFinish = () => {
    if (capturedPhotos.length > 0) {
      onCapture(capturedPhotos.map((p) => p.file));
      onClose();
    }
  };

  const toggleFacingMode = () => {
    setFacingMode((prev) => (prev === 'environment' ? 'user' : 'environment'));
  };

  // Handle ESC key to dismiss camera
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

  return (
    <div
      id="camera-modal-overlay"
      className="fixed inset-0 z-[100] bg-black/90 flex flex-col items-center justify-between p-4 sm:p-6"
    >
      {/* Top Header */}
      <div className="w-full max-w-2xl flex items-center justify-between z-10">
        <div className="flex items-center gap-2">
          <span className="text-white font-medium text-sm">Take Product Photos</span>
          {capturedPhotos.length > 0 && (
            <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 text-xs font-semibold border border-emerald-500/30">
              {capturedPhotos.length} {capturedPhotos.length === 1 ? 'photo' : 'photos'} ready
            </span>
          )}
        </div>

        <button
          id="close-camera-btn"
          type="button"
          onClick={onClose}
          className="w-9 h-9 rounded-full bg-white/15 hover:bg-white/25 flex items-center justify-center text-white transition-colors cursor-pointer"
          title="Close camera"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {errorMsg ? (
        <div className="text-center px-6 max-w-md bg-stone-900 border border-stone-800 p-8 rounded-2xl my-auto">
          <div className="w-12 h-12 rounded-full bg-red-500/10 text-red-400 flex items-center justify-center mx-auto mb-4">
            <AlertCircle className="w-6 h-6" />
          </div>
          <h3 className="text-white font-medium text-lg mb-2">Camera Unavailable</h3>
          <p className="text-stone-300 text-sm mb-6 leading-relaxed">{errorMsg}</p>
          <button
            id="camera-error-close-btn"
            type="button"
            onClick={onClose}
            className="px-5 py-2.5 rounded-xl bg-white text-stone-900 font-medium text-sm hover:bg-stone-100 transition-colors cursor-pointer"
          >
            Use File Upload Instead
          </button>
        </div>
      ) : (
        <div className="flex flex-col items-center w-full max-w-2xl my-auto">
          {/* Viewfinder */}
          <div className="relative w-full aspect-[4/3] sm:aspect-video bg-stone-950 rounded-2xl overflow-hidden shadow-2xl border border-stone-800 flex items-center justify-center">
            {isLoading && (
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-stone-950/80 text-white z-10">
                <RefreshCw className="w-8 h-8 animate-spin text-stone-400 mb-2" />
                <span className="text-xs text-stone-400">Starting camera preview...</span>
              </div>
            )}

            {flash && <div className="absolute inset-0 bg-white z-20 pointer-events-none" />}

            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="w-full h-full object-cover"
            />

            <div className="absolute bottom-3 left-3 px-2.5 py-1 rounded-md bg-black/60 backdrop-blur-xs text-[11px] text-white/80 font-mono">
              {facingMode === 'environment' ? 'Rear Camera' : 'Front Camera'}
            </div>
          </div>

          {/* Captured Thumbnails Strip */}
          {capturedPhotos.length > 0 && (
            <div className="w-full mt-3 px-1">
              <div className="flex items-center gap-2 overflow-x-auto py-1">
                {capturedPhotos.map((photo, idx) => (
                  <div
                    key={idx}
                    className="relative flex-shrink-0 w-14 h-14 rounded-lg overflow-hidden border-2 border-emerald-500 shadow-md group"
                  >
                    <img
                      src={photo.preview}
                      alt={`Snap ${idx + 1}`}
                      className="w-full h-full object-cover"
                    />
                    <button
                      type="button"
                      onClick={() => handleRemoveCaptured(idx)}
                      className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex items-center justify-center text-white transition-opacity cursor-pointer"
                      title="Remove snap"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                    <span className="absolute bottom-0 right-0 bg-black/70 text-white text-[9px] px-1 font-mono">
                      #{idx + 1}
                    </span>
                  </div>
                ))}
                <span className="text-xs text-stone-400 whitespace-nowrap pl-2">
                  Snap more, or click Done
                </span>
              </div>
            </div>
          )}

          {/* Shutter controls */}
          <div className="flex items-center justify-between w-full max-w-md mt-5 px-4">
            <button
              id="flip-camera-btn"
              type="button"
              onClick={toggleFacingMode}
              className="w-12 h-12 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-colors cursor-pointer"
              title="Switch camera"
            >
              <RefreshCw className="w-5 h-5" />
            </button>

            <button
              id="capture-shutter-btn"
              type="button"
              onClick={handleCapture}
              disabled={isLoading}
              className="w-16 h-16 rounded-full bg-white hover:bg-stone-100 flex items-center justify-center transition-transform active:scale-95 ring-4 ring-white/30 cursor-pointer disabled:opacity-50"
              title="Snap photo"
            >
              <Camera className="w-7 h-7 text-stone-900" />
            </button>

            {capturedPhotos.length > 0 ? (
              <button
                id="camera-done-btn"
                type="button"
                onClick={handleFinish}
                className="h-11 px-4 rounded-full bg-emerald-500 hover:bg-emerald-600 text-white flex items-center gap-1.5 text-xs font-semibold shadow-lg transition-transform active:scale-95 cursor-pointer"
                title="Use captured photos"
              >
                <Check className="w-4 h-4" />
                Done ({capturedPhotos.length})
              </button>
            ) : (
              <div className="w-12 h-12" />
            )}
          </div>
        </div>
      )}

      <div className="text-stone-400 text-xs text-center pb-2">
        {capturedPhotos.length === 0
          ? 'Tap the shutter button to take a photo'
          : `Tap shutter again to capture more photos for this product`}
      </div>
    </div>
  );
};
