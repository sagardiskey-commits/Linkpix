import React, { useState, useRef, useMemo } from 'react';
import {
  Upload,
  Camera,
  CheckCircle2,
  X,
  Link2,
  AlertCircle,
  Loader2,
  Tag,
  Sparkles,
  Plus,
  Images,
} from 'lucide-react';
import { CameraModal } from './CameraModal';
import { extractAsin } from '../utils/amazon';
import { saveProduct, addPhotosToProduct, getAllProducts } from '../utils/storage';
import { ProductItem } from '../types';
import {
  validateImageFile,
  sanitizeFilename,
  sanitizeExternalUrl,
  isVerifiedAmazonHost,
} from '../utils/security';

interface StagedPhoto {
  id: string;
  file?: File;
  preview: string;
  name: string;
  size?: number;
}

interface UploadViewProps {
  onUploaded: (savedItem: ProductItem) => void;
  onNavigateLookup: (urlOrAsin: string) => void;
  existingProducts?: ProductItem[];
}

const SAMPLE_AMAZON_LINKS = [
  { label: 'Sony Headphones', url: 'https://www.amazon.com/dp/B09XS7JWHH' },
  { label: 'Logitech Mouse', url: 'https://www.amazon.com/dp/B09HM94VDS' },
  { label: 'Kindle Paperwhite', url: 'https://www.amazon.com/dp/B08KTZ8249' },
  { label: 'Anker Power Bank', url: 'https://www.amazon.com/dp/B07S829LBX' },
];

const QUICK_TAGS = ['Packaging', 'Unboxing', 'Serial No', 'Accessories', 'Inspection', 'Return'];

export const UploadView: React.FC<UploadViewProps> = ({
  onUploaded,
  onNavigateLookup,
  existingProducts = [],
}) => {
  const [amazonUrl, setAmazonUrl] = useState('');
  const [title, setTitle] = useState('');
  const [notes, setNotes] = useState('');
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [stagedPhotos, setStagedPhotos] = useState<StagedPhoto[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successItem, setSuccessItem] = useState<ProductItem | null>(null);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const detectedAsin = extractAsin(amazonUrl);

  // Check if this Amazon URL or ASIN already exists in storage
  const matchingExistingProduct = useMemo(() => {
    if (!amazonUrl.trim() && !detectedAsin) return null;
    return (
      existingProducts.find(
        (p) =>
          (detectedAsin && p.asin?.toUpperCase() === detectedAsin.toUpperCase()) ||
          (p.amazon_url && amazonUrl.trim() && p.amazon_url.toLowerCase() === amazonUrl.trim().toLowerCase())
      ) || null
    );
  }, [amazonUrl, detectedAsin, existingProducts]);

  const processFiles = (files: FileList | File[]) => {
    const fileList = Array.from(files);
    if (fileList.length === 0) return;

    for (const file of fileList) {
      const check = validateImageFile(file, 20 * 1024 * 1024);
      if (!check.valid) {
        setErrorMessage(check.error || 'Invalid file detected.');
        return;
      }
    }

    setErrorMessage(null);

    fileList.forEach((file) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const preview = e.target?.result as string;
        const cleanName = sanitizeFilename(file.name);
        setStagedPhotos((prev) => [
          ...prev,
          {
            id: `staged_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
            file,
            preview,
            name: cleanName,
            size: file.size,
          },
        ]);
      };
      reader.readAsDataURL(file);
    });
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      processFiles(e.target.files);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      processFiles(e.dataTransfer.files);
    }
  };

  const handleRemoveStagedPhoto = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setStagedPhotos((prev) => prev.filter((p) => p.id !== id));
  };

  const handleCameraCapture = (files: File[]) => {
    processFiles(files);
  };

  const toggleTag = (tag: string) => {
    setSelectedTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
    );
  };

  const handleResetForm = () => {
    setAmazonUrl('');
    setTitle('');
    setNotes('');
    setSelectedTags([]);
    setStagedPhotos([]);
    setErrorMessage(null);
    setSuccessItem(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (stagedPhotos.length === 0) {
      setErrorMessage('Please choose or take at least one product picture.');
      return;
    }

    const trimmedUrl = amazonUrl.trim();
    if (!trimmedUrl) {
      setErrorMessage('Please paste the Amazon product link or ASIN.');
      return;
    }

    const safeUrl = sanitizeExternalUrl(trimmedUrl);
    if (safeUrl === '#') {
      setErrorMessage('Invalid or unsafe link protocol. Please provide a standard URL (https://) or 10-character ASIN.');
      return;
    }

    setIsSaving(true);
    try {
      let resultProduct: ProductItem;

      // If matching existing product, append new photos to it!
      if (matchingExistingProduct) {
        const appended = await addPhotosToProduct(
          matchingExistingProduct.id,
          stagedPhotos.map((p) => ({
            image_data: p.preview,
            filename: p.name,
            file_size: p.size,
          }))
        );
        resultProduct = appended || matchingExistingProduct;
      } else {
        // Save as new product with all staged photos and validated safe URL
        resultProduct = await saveProduct({
          amazon_url: safeUrl,
          asin: detectedAsin || undefined,
          title: title.trim() || (detectedAsin ? `Amazon Product (${detectedAsin})` : undefined),
          notes: notes.trim() || undefined,
          tags: selectedTags.length > 0 ? selectedTags : undefined,
          photos: stagedPhotos.map((p) => ({
            image_data: p.preview,
            filename: p.name,
            file_size: p.size,
          })),
        });
      }

      setSuccessItem(resultProduct);
      onUploaded(resultProduct);
    } catch (err: any) {
      console.error('Save failed:', err);
      setErrorMessage(err?.message || 'Failed to save photos. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-stone-900 tracking-tight mb-2">
          Upload product photos
        </h1>
        <p className="text-stone-500 text-base">
          Add one or multiple pictures for an Amazon product.
        </p>
      </div>

      {/* Success View */}
      {successItem ? (
        <div className="rounded-2xl bg-white border border-stone-200 p-8 sm:p-10 text-center shadow-xs">
          <div className="w-16 h-16 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto mb-4 border border-emerald-100">
            <CheckCircle2 className="w-8 h-8" />
          </div>
          <h2 className="text-2xl font-bold text-stone-900 mb-1">Saved successfully</h2>
          <p className="text-stone-500 text-sm max-w-md mx-auto mb-6">
            Stored{' '}
            <strong className="text-stone-800 font-semibold">
              {successItem.photos.length} {successItem.photos.length === 1 ? 'picture' : 'pictures'}
            </strong>{' '}
            for this product. You can look them up anytime by link or ASIN.
          </p>

          {/* Mini preview grid */}
          <div className="max-w-md mx-auto mb-8 p-3.5 rounded-xl bg-stone-50 border border-stone-200 text-left">
            <div className="flex items-center gap-2 mb-2.5 overflow-x-auto pb-1">
              {successItem.photos.map((photo, idx) => (
                <div
                  key={photo.id || idx}
                  className="w-16 h-16 rounded-lg overflow-hidden flex-shrink-0 border border-stone-200 bg-stone-200 relative"
                >
                  <img
                    src={photo.image_data}
                    alt={`Photo ${idx + 1}`}
                    className="w-full h-full object-cover"
                  />
                  <span className="absolute bottom-0 right-0 bg-black/70 text-white text-[9px] px-1 font-mono">
                    #{idx + 1}
                  </span>
                </div>
              ))}
            </div>

            <div className="min-w-0">
              <span className="text-xs font-semibold text-stone-800 block truncate">
                {successItem.title || 'Product Photos'}
              </span>
              <span className="text-[11px] font-mono text-stone-400 block truncate">
                {successItem.amazon_url}
              </span>
              {successItem.asin && (
                <span className="inline-block mt-1 px-2 py-0.5 rounded bg-amber-100 text-amber-800 text-[10px] font-mono">
                  ASIN: {successItem.asin}
                </span>
              )}
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-3">
            <button
              id="upload-another-btn"
              onClick={handleResetForm}
              type="button"
              className="px-5 py-2.5 rounded-xl bg-stone-900 text-white font-medium text-sm hover:bg-stone-800 transition-colors cursor-pointer"
            >
              Upload more photos
            </button>
            <button
              id="view-in-lookup-btn"
              onClick={() => onNavigateLookup(successItem.asin || successItem.amazon_url)}
              type="button"
              className="px-5 py-2.5 rounded-xl bg-white text-stone-700 font-medium text-sm border border-stone-200 hover:bg-stone-50 transition-colors cursor-pointer"
            >
              View in Lookup &rarr;
            </button>
          </div>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Hidden file input with MULTIPLE enabled */}
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept="image/*"
            className="hidden"
            onChange={handleFileChange}
          />

          {/* Photo Drop Zone & Staged Gallery */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label className="block text-sm font-medium text-stone-700">
                Product Pictures{' '}
                <span className="text-stone-400 font-normal">
                  (add one or multiple photos)
                </span>
              </label>
              {stagedPhotos.length > 0 && (
                <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-stone-900 text-white">
                  {stagedPhotos.length} {stagedPhotos.length === 1 ? 'photo' : 'photos'} ready
                </span>
              )}
            </div>

            {/* If photos are staged: show gallery + add more button */}
            {stagedPhotos.length > 0 ? (
              <div className="p-4 rounded-2xl bg-stone-50 border border-stone-200 space-y-3">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {stagedPhotos.map((photo, index) => (
                    <div
                      key={photo.id}
                      className="group relative aspect-square rounded-xl overflow-hidden bg-stone-200 border border-stone-300 shadow-xs"
                    >
                      <img
                        src={photo.preview}
                        alt={`Staged ${index + 1}`}
                        className="w-full h-full object-cover"
                      />
                      <span className="absolute top-1.5 left-1.5 px-1.5 py-0.5 rounded bg-black/70 text-white text-[10px] font-mono">
                        #{index + 1}
                      </span>
                      <button
                        type="button"
                        onClick={(e) => handleRemoveStagedPhoto(photo.id, e)}
                        className="absolute top-1.5 right-1.5 w-6 h-6 rounded-full bg-white/90 hover:bg-white text-stone-700 flex items-center justify-center shadow-md transition-transform active:scale-95 cursor-pointer"
                        title="Remove photo"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}

                  {/* Add more photo card */}
                  <div
                    onClick={() => fileInputRef.current?.click()}
                    className="aspect-square rounded-xl border-2 border-dashed border-stone-300 hover:border-stone-400 bg-white hover:bg-stone-50 flex flex-col items-center justify-center text-stone-500 transition-colors cursor-pointer p-2 text-center"
                  >
                    <Plus className="w-6 h-6 mb-1 text-stone-400" />
                    <span className="text-xs font-medium">Add more</span>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-1 border-t border-stone-200 text-xs">
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="text-xs text-stone-600 hover:text-stone-900 font-medium inline-flex items-center gap-1 cursor-pointer"
                    >
                      <Upload className="w-3.5 h-3.5" /> Choose more files
                    </button>
                    <span className="text-stone-300">•</span>
                    <button
                      type="button"
                      onClick={() => setIsCameraOpen(true)}
                      className="text-xs text-stone-600 hover:text-stone-900 font-medium inline-flex items-center gap-1 cursor-pointer"
                    >
                      <Camera className="w-3.5 h-3.5" /> Take photo
                    </button>
                  </div>

                  <button
                    type="button"
                    onClick={() => setStagedPhotos([])}
                    className="text-xs text-red-600 hover:text-red-700 font-medium cursor-pointer"
                  >
                    Clear all
                  </button>
                </div>
              </div>
            ) : (
              /* Empty drop zone */
              <div
                onClick={() => fileInputRef.current?.click()}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                className={`relative rounded-2xl border-2 border-dashed cursor-pointer transition-all overflow-hidden ${
                  isDragging
                    ? 'border-stone-900 bg-stone-100/80 scale-[1.01]'
                    : 'border-stone-300 bg-stone-50/70 hover:border-stone-400 hover:bg-stone-50'
                }`}
              >
                <div className="py-12 sm:py-14 px-6 text-center">
                  <div className="w-12 h-12 rounded-xl bg-stone-100 flex items-center justify-center mx-auto mb-3 text-stone-500">
                    <Images className="w-6 h-6" />
                  </div>
                  <p className="text-stone-800 font-medium mb-1 text-sm sm:text-base">
                    Click to upload or drag & drop multiple pictures
                  </p>
                  <p className="text-xs sm:text-sm text-stone-400 mb-5">
                    Select multiple PNG, JPG, WebP photos (packaging, serial label, accessories)
                  </p>

                  <div className="flex items-center justify-center gap-3">
                    <button
                      id="take-photo-btn"
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setIsCameraOpen(true);
                      }}
                      className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-stone-900 text-white text-sm font-medium hover:bg-stone-800 transition-colors cursor-pointer shadow-xs active:scale-98"
                    >
                      <Camera className="w-4 h-4" />
                      Take photos
                    </button>
                    <button
                      id="choose-file-btn"
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        fileInputRef.current?.click();
                      }}
                      className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-white text-stone-700 text-sm font-medium border border-stone-200 hover:bg-stone-50 transition-colors cursor-pointer shadow-2xs active:scale-98"
                    >
                      <Upload className="w-4 h-4" />
                      Choose pictures
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Amazon Link Input */}
          <div>
            <label
              htmlFor="amazon-url-input"
              className="block text-sm font-medium text-stone-700 mb-1.5"
            >
              Amazon link <span className="text-stone-400 font-normal">(required)</span>
            </label>
            <div className="relative">
              <Link2 className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400" />
              <input
                id="amazon-url-input"
                type="text"
                value={amazonUrl}
                onChange={(e) => setAmazonUrl(e.target.value)}
                placeholder="https://www.amazon.com/dp/B0... or ASIN"
                className="w-full pl-10 pr-4 py-3 rounded-xl border border-stone-200 bg-white text-stone-900 placeholder-stone-400 focus:outline-none focus:ring-2 focus:ring-stone-900 focus:border-transparent transition-all text-sm font-mono"
              />
            </div>

            {/* Existing Product Notification if matching */}
            {matchingExistingProduct && (
              <div className="mt-2.5 flex items-start gap-2 text-xs text-blue-900 bg-blue-50 border border-blue-200 px-3.5 py-2 rounded-xl">
                <Images className="w-4 h-4 text-blue-600 flex-shrink-0 mt-0.5" />
                <div>
                  <span className="font-semibold">Existing Product Found: </span>
                  <span>
                    "{matchingExistingProduct.title || matchingExistingProduct.asin}" already has{' '}
                    <strong>{matchingExistingProduct.photos.length} photos</strong>. Uploading will
                    add these new pictures to this product!
                  </span>
                </div>
              </div>
            )}

            {/* Live ASIN feedback */}
            {detectedAsin && !matchingExistingProduct && (
              <div className="mt-2 flex items-center gap-1.5 text-xs text-amber-800 bg-amber-50 border border-amber-200/70 px-3 py-1.5 rounded-lg">
                <Sparkles className="w-3.5 h-3.5 text-amber-600 flex-shrink-0" />
                <span>
                  Detected ASIN: <strong className="font-mono">{detectedAsin}</strong>
                </span>
              </div>
            )}

            {/* Quick Sample Links */}
            <div className="mt-2 flex items-center gap-2 flex-wrap text-xs text-stone-500">
              <span className="text-stone-400">Sample link:</span>
              {SAMPLE_AMAZON_LINKS.map((sample) => (
                <button
                  key={sample.label}
                  type="button"
                  onClick={() => setAmazonUrl(sample.url)}
                  className="px-2 py-0.5 rounded bg-stone-100 hover:bg-stone-200 text-stone-600 transition-colors cursor-pointer"
                >
                  {sample.label}
                </button>
              ))}
            </div>
          </div>

          {/* Optional Title */}
          <div>
            <label
              htmlFor="product-title-input"
              className="block text-sm font-medium text-stone-700 mb-1.5"
            >
              Product Label / Title <span className="text-stone-400 font-normal">(optional)</span>
            </label>
            <input
              id="product-title-input"
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Sony WH-1000XM5, Logitech MX Master 3S"
              className="w-full px-4 py-2.5 rounded-xl border border-stone-200 bg-white text-stone-900 placeholder-stone-400 focus:outline-none focus:ring-2 focus:ring-stone-900 focus:border-transparent transition-all text-sm"
            />
          </div>

          {/* Quick Tags */}
          <div>
            <label className="block text-xs font-medium text-stone-500 mb-1.5 flex items-center gap-1">
              <Tag className="w-3 h-3" />
              Tags
            </label>
            <div className="flex items-center gap-1.5 flex-wrap">
              {QUICK_TAGS.map((tag) => {
                const active = selectedTags.includes(tag);
                return (
                  <button
                    key={tag}
                    type="button"
                    onClick={() => toggleTag(tag)}
                    className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                      active
                        ? 'bg-stone-900 text-white'
                        : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
                    }`}
                  >
                    #{tag}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Optional Notes */}
          <div>
            <label
              htmlFor="product-notes-input"
              className="block text-sm font-medium text-stone-700 mb-1.5"
            >
              Notes <span className="text-stone-400 font-normal">(optional)</span>
            </label>
            <textarea
              id="product-notes-input"
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Add condition details, serial numbers, date of inspection..."
              className="w-full px-4 py-2.5 rounded-xl border border-stone-200 bg-white text-stone-900 placeholder-stone-400 focus:outline-none focus:ring-2 focus:ring-stone-900 focus:border-transparent transition-all text-sm resize-none"
            />
          </div>

          {/* Error Message */}
          {errorMessage && (
            <div className="rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Submit Button */}
          <button
            id="save-photo-submit-btn"
            type="submit"
            disabled={isSaving}
            className="w-full inline-flex items-center justify-center gap-2 px-5 py-3.5 rounded-xl bg-stone-900 text-white font-medium hover:bg-stone-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer shadow-sm active:scale-99"
          >
            {isSaving ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Upload className="w-4 h-4" />
                {stagedPhotos.length > 1
                  ? `Save ${stagedPhotos.length} photos`
                  : 'Save photo'}
              </>
            )}
          </button>
        </form>
      )}

      {/* Camera Capture Modal */}
      <CameraModal
        isOpen={isCameraOpen}
        onClose={() => setIsCameraOpen(false)}
        onCapture={handleCameraCapture}
      />
    </div>
  );
};
