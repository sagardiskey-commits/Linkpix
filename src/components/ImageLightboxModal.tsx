import React, { useState, useEffect, useCallback } from 'react';
import {
  X,
  Download,
  ExternalLink,
  Copy,
  Check,
  Calendar,
  ChevronLeft,
  ChevronRight,
  Plus,
  Trash2,
  Image as ImageIcon,
} from 'lucide-react';
import { ProductItem, ProductPhoto } from '../types';
import { ConfirmModal } from './ConfirmModal';
import { sanitizeExternalUrl, validateImageFile } from '../utils/security';

interface ImageLightboxModalProps {
  product: ProductItem | null;
  initialPhotoIndex?: number;
  onClose: () => void;
  onDeletePhoto?: (productId: string, photoId: string) => Promise<void>;
  onDeleteProduct?: (productId: string) => Promise<void>;
  onAddPhotos?: (productId: string, files: File[]) => Promise<void>;
}

export const ImageLightboxModal: React.FC<ImageLightboxModalProps> = ({
  product,
  initialPhotoIndex = 0,
  onClose,
  onDeletePhoto,
  onDeleteProduct,
  onAddPhotos,
}) => {
  const [photoIndex, setPhotoIndex] = useState(0);
  const [copied, setCopied] = useState(false);
  const [confirmDeleteType, setConfirmDeleteType] = useState<'photo' | 'product' | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const fileInputRef = React.useRef<HTMLInputElement | null>(null);

  // Sync photoIndex when product or initialPhotoIndex changes
  useEffect(() => {
    if (product) {
      const maxIdx = Math.max(0, (product.photos?.length || 1) - 1);
      setPhotoIndex(Math.min(initialPhotoIndex, maxIdx));
    }
  }, [product, initialPhotoIndex]);

  const photos: ProductPhoto[] = product?.photos && product.photos.length > 0
    ? product.photos
    : product?.image_data
    ? [
        {
          id: product.id,
          image_data: product.image_data,
          filename: product.filename,
          file_size: product.file_size,
          created_at: product.created_at,
        },
      ]
    : [];

  const currentPhoto = photos[photoIndex] || photos[0];

  const handlePrev = useCallback(() => {
    if (photos.length <= 1) return;
    setPhotoIndex((prev) => (prev > 0 ? prev - 1 : photos.length - 1));
  }, [photos.length]);

  const handleNext = useCallback(() => {
    if (photos.length <= 1) return;
    setPhotoIndex((prev) => (prev < photos.length - 1 ? prev + 1 : 0));
  }, [photos.length]);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!product) return;
      if (e.key === 'ArrowLeft') {
        handlePrev();
      } else if (e.key === 'ArrowRight') {
        handleNext();
      } else if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [product, handlePrev, handleNext, onClose]);

  if (!product || !currentPhoto) return null;

  const copyUrl = async () => {
    try {
      await navigator.clipboard.writeText(product.amazon_url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback
    }
  };

  const handleDownload = () => {
    const link = document.createElement('a');
    link.href = currentPhoto.image_data;
    link.download =
      currentPhoto.filename ||
      `product-${product.asin || 'photo'}-${photoIndex + 1}.jpg`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleConfirmDelete = async () => {
    if (!product) return;
    setIsDeleting(true);
    try {
      if (confirmDeleteType === 'product') {
        if (onDeleteProduct) {
          await onDeleteProduct(product.id);
        }
        setConfirmDeleteType(null);
        onClose();
      } else if (confirmDeleteType === 'photo') {
        if (onDeletePhoto && currentPhoto) {
          await onDeletePhoto(product.id, currentPhoto.id);
        }
        // If there were only 1 photo, the whole product will be gone
        if (photos.length <= 1) {
          setConfirmDeleteType(null);
          onClose();
        } else {
          setPhotoIndex((prev) => Math.max(0, prev - 1));
          setConfirmDeleteType(null);
        }
      }
    } finally {
      setIsDeleting(false);
    }
  };

  const handleAddPhotosInput = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const rawFiles = Array.from(e.target.files || []);
    const validFiles = rawFiles.filter((f) => validateImageFile(f).valid);
    if (validFiles.length > 0 && onAddPhotos && product) {
      await onAddPhotos(product.id, validFiles);
    }
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const formattedDate = new Date(currentPhoto.created_at || product.created_at).toLocaleDateString(
    undefined,
    {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    }
  );

  return (
    <>
      <div
        id="lightbox-backdrop"
        className="fixed inset-0 z-50 bg-black/85 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6"
        onClick={onClose}
      >
        <div
          id="lightbox-container"
          className="relative max-w-4xl w-full bg-white rounded-2xl overflow-hidden shadow-2xl flex flex-col max-h-[92vh]"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header bar */}
          <div className="flex items-center justify-between px-5 py-3 border-b border-stone-200 bg-stone-50">
            <div className="flex items-center gap-2.5 min-w-0 pr-4">
              <span className="font-semibold text-stone-900 text-sm truncate">
                {product.title || (product.asin ? `ASIN: ${product.asin}` : 'Product Photos')}
              </span>
              {product.asin && (
                <span className="px-2 py-0.5 rounded-md bg-amber-50 text-amber-800 text-[11px] font-mono border border-amber-200/60 flex-shrink-0">
                  {product.asin}
                </span>
              )}
              {photos.length > 1 && (
                <span className="px-2 py-0.5 rounded-full bg-stone-200 text-stone-700 text-xs font-medium flex-shrink-0">
                  {photoIndex + 1} of {photos.length}
                </span>
              )}
            </div>

            <div className="flex items-center gap-1">
              <button
                id="lightbox-close-btn"
                type="button"
                onClick={onClose}
                className="w-8 h-8 rounded-lg flex items-center justify-center text-stone-500 hover:text-stone-900 hover:bg-stone-200/60 transition-colors cursor-pointer"
                title="Close"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Image viewport with next/prev arrows */}
          <div className="relative bg-stone-950 flex items-center justify-center flex-1 overflow-hidden min-h-[260px] max-h-[56vh]">
            <img
              src={currentPhoto.image_data}
              alt={product.title || 'Product Photo'}
              className="max-h-[56vh] w-auto max-w-full object-contain select-none"
            />

            {/* Navigation arrows for multiple photos */}
            {photos.length > 1 && (
              <>
                <button
                  id="lightbox-prev-btn"
                  type="button"
                  onClick={handlePrev}
                  className="absolute left-3 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-black/60 hover:bg-black/80 text-white flex items-center justify-center transition-transform active:scale-95 cursor-pointer shadow-lg"
                  title="Previous photo (Left arrow)"
                >
                  <ChevronLeft className="w-6 h-6" />
                </button>
                <button
                  id="lightbox-next-btn"
                  type="button"
                  onClick={handleNext}
                  className="absolute right-3 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-black/60 hover:bg-black/80 text-white flex items-center justify-center transition-transform active:scale-95 cursor-pointer shadow-lg"
                  title="Next photo (Right arrow)"
                >
                  <ChevronRight className="w-6 h-6" />
                </button>
              </>
            )}
          </div>

          {/* Multiple Photos Thumbnail Strip */}
          <div className="bg-stone-900 px-4 py-2 flex items-center gap-2 overflow-x-auto border-t border-stone-800">
            {photos.map((photo, idx) => (
              <button
                key={photo.id}
                type="button"
                onClick={() => setPhotoIndex(idx)}
                className={`relative w-12 h-12 rounded-lg overflow-hidden flex-shrink-0 transition-all cursor-pointer border-2 ${
                  idx === photoIndex
                    ? 'border-amber-400 scale-105 shadow-md'
                    : 'border-transparent opacity-60 hover:opacity-100'
                }`}
              >
                <img
                  src={photo.image_data}
                  alt={`Thumbnail ${idx + 1}`}
                  className="w-full h-full object-cover"
                />
                <span className="absolute bottom-0 right-0 bg-black/70 text-[9px] text-white px-1 font-mono">
                  {idx + 1}
                </span>
              </button>
            ))}

            {/* Add more photos button */}
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept="image/*"
              className="hidden"
              onChange={handleAddPhotosInput}
            />
            <button
              id="lightbox-add-photo-btn"
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="w-12 h-12 rounded-lg border-2 border-dashed border-stone-600 hover:border-stone-400 flex flex-col items-center justify-center text-stone-400 hover:text-white transition-colors flex-shrink-0 cursor-pointer text-[10px]"
              title="Add another photo to this product"
            >
              <Plus className="w-4 h-4" />
              <span>Add</span>
            </button>
          </div>

          {/* Footer info & action toolbar */}
          <div className="p-4 sm:p-5 bg-white border-t border-stone-200 space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="min-w-0 flex-1">
                <span className="text-xs text-stone-400 block mb-0.5">Amazon Product URL</span>
                <a
                  href={sanitizeExternalUrl(product.amazon_url)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs sm:text-sm text-stone-800 hover:text-amber-700 truncate font-mono block underline decoration-stone-300 underline-offset-2"
                >
                  {product.amazon_url}
                </a>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-2 flex-wrap">
                <button
                  id="lightbox-copy-btn"
                  onClick={copyUrl}
                  type="button"
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-stone-200 text-xs font-medium text-stone-700 hover:bg-stone-50 cursor-pointer transition-colors"
                >
                  {copied ? (
                    <Check className="w-3.5 h-3.5 text-emerald-600" />
                  ) : (
                    <Copy className="w-3.5 h-3.5" />
                  )}
                  {copied ? 'Copied' : 'Copy link'}
                </button>

                <a
                  href={sanitizeExternalUrl(product.amazon_url)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-stone-900 text-white text-xs font-medium hover:bg-stone-800 cursor-pointer transition-colors"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  Open Amazon
                </a>

                <button
                  id="lightbox-download-btn"
                  onClick={handleDownload}
                  type="button"
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-stone-200 text-xs font-medium text-stone-700 hover:bg-stone-50 cursor-pointer transition-colors"
                  title="Download active photo"
                >
                  <Download className="w-3.5 h-3.5" />
                  Download
                </button>

                {/* Delete Photo Button */}
                <button
                  id="lightbox-delete-photo-btn"
                  onClick={() => setConfirmDeleteType('photo')}
                  type="button"
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-red-200 bg-red-50 text-xs font-medium text-red-700 hover:bg-red-100 cursor-pointer transition-colors"
                  title="Delete this photo"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  Delete photo
                </button>
              </div>
            </div>

            {(product.notes || (product.tags && product.tags.length > 0)) && (
              <div className="pt-2 border-t border-stone-100 flex flex-wrap items-center justify-between gap-2 text-xs text-stone-500">
                {product.notes && (
                  <div className="italic text-stone-600 max-w-lg truncate">
                    "{product.notes}"
                  </div>
                )}
                {product.tags && product.tags.length > 0 && (
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {product.tags.map((tag, idx) => (
                      <span
                        key={idx}
                        className="px-2 py-0.5 rounded-md bg-stone-100 text-stone-600 text-[11px] font-medium"
                      >
                        #{tag}
                      </span>
                    ))}
                  </div>
                )}
                <div className="inline-flex items-center gap-1 text-[11px] text-stone-400">
                  <Calendar className="w-3 h-3" />
                  <span>Saved {formattedDate}</span>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* In-app safe Confirmation Modal for Deletion */}
      <ConfirmModal
        isOpen={confirmDeleteType !== null}
        title={confirmDeleteType === 'photo' ? 'Delete this photo?' : 'Delete this product?'}
        message={
          confirmDeleteType === 'photo'
            ? photos.length > 1
              ? `This will remove photo #${photoIndex + 1} from this product (${photos.length - 1} other photos will remain).`
              : 'This is the only photo for this product. Deleting it will remove the product entry from LinkPix.'
            : 'Are you sure you want to delete this product and all stored photos? This action cannot be undone.'
        }
        confirmLabel={confirmDeleteType === 'photo' ? 'Delete Photo' : 'Delete Product'}
        isLoading={isDeleting}
        onConfirm={handleConfirmDelete}
        onCancel={() => setConfirmDeleteType(null)}
      />
    </>
  );
};
