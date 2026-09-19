import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  Search,
  ExternalLink,
  Trash2,
  Copy,
  Check,
  Download,
  Link2,
  Plus,
  Images,
  Tag,
  Loader2,
  Sparkles,
} from 'lucide-react';
import { ProductItem, ProductPhoto } from '../types';
import { extractAsin, matchesAmazonQuery } from '../utils/amazon';
import { ConfirmModal } from './ConfirmModal';
import { sanitizeExternalUrl, validateImageFile } from '../utils/security';

interface LookupViewProps {
  images: ProductItem[];
  onDeleteProduct: (id: string) => Promise<void>;
  onDeletePhoto?: (productId: string, photoId: string) => Promise<void>;
  onAddPhotos?: (productId: string, files: File[]) => Promise<void>;
  onSelectImage: (image: ProductItem, initialPhotoIndex?: number) => void;
  onNavigateUpload: () => void;
  initialQuery?: string;
}

export const LookupView: React.FC<LookupViewProps> = ({
  images,
  onDeleteProduct,
  onDeletePhoto,
  onAddPhotos,
  onSelectImage,
  onNavigateUpload,
  initialQuery = '',
}) => {
  const [query, setQuery] = useState(initialQuery);
  const [hasSearched, setHasSearched] = useState(Boolean(initialQuery.trim()));
  const [isSearching, setIsSearching] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [selectedTag, setSelectedTag] = useState<string | null>(null);

  // Active photo index tracked per product card (map productId -> photoIndex)
  const [activePhotoMap, setActivePhotoMap] = useState<Record<string, number>>({});

  // Safe In-App Confirmation Modal State
  const [deleteTarget, setDeleteTarget] = useState<{
    type: 'product' | 'photo';
    productId: string;
    photoId?: string;
    title?: string;
    photoCount?: number;
  } | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Quick add photo file input ref per product
  const [targetAddProductId, setTargetAddProductId] = useState<string | null>(null);
  const cardFileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (initialQuery) {
      setQuery(initialQuery);
      setHasSearched(true);
    }
  }, [initialQuery]);

  const searchAsin = extractAsin(query);

  const filteredResults = useMemo(() => {
    let list = images;

    if (query.trim()) {
      list = list.filter((img) => matchesAmazonQuery(img.amazon_url, img.asin, query.trim()));
    }

    if (selectedTag) {
      list = list.filter((img) => img.tags?.includes(selectedTag));
    }

    return list;
  }, [images, query, selectedTag]);

  // Extract unique tags
  const allTags = useMemo(() => {
    const set = new Set<string>();
    images.forEach((img) => {
      img.tags?.forEach((t) => set.add(t));
    });
    return Array.from(set);
  }, [images]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;

    setIsSearching(true);
    setHasSearched(true);
    setTimeout(() => {
      setIsSearching(false);
    }, 200);
  };

  const handleCopyUrl = async (e: React.MouseEvent, img: ProductItem) => {
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(img.amazon_url);
      setCopiedId(img.id);
      setTimeout(() => setCopiedId(null), 2000);
    } catch {
      // ignore
    }
  };

  const handleDownloadActivePhoto = (e: React.MouseEvent, img: ProductItem) => {
    e.stopPropagation();
    const activeIdx = activePhotoMap[img.id] || 0;
    const photo = img.photos[activeIdx] || img.photos[0];
    if (!photo) return;

    const a = document.createElement('a');
    a.href = photo.image_data;
    a.download = photo.filename || `product-${img.asin || 'photo'}-${activeIdx + 1}.jpg`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const triggerDeleteProduct = (e: React.MouseEvent, item: ProductItem) => {
    e.stopPropagation();
    setDeleteTarget({
      type: 'product',
      productId: item.id,
      title: item.title || item.asin || 'this product',
      photoCount: item.photos.length,
    });
  };

  const triggerDeletePhoto = (
    e: React.MouseEvent,
    item: ProductItem,
    photo: ProductPhoto
  ) => {
    e.stopPropagation();
    setDeleteTarget({
      type: 'photo',
      productId: item.id,
      photoId: photo.id,
      title: item.title || item.asin || 'this product',
      photoCount: item.photos.length,
    });
  };

  const executeDelete = async () => {
    if (!deleteTarget) return;
    setIsDeleting(true);
    try {
      if (deleteTarget.type === 'product') {
        await onDeleteProduct(deleteTarget.productId);
      } else if (deleteTarget.type === 'photo' && deleteTarget.photoId && onDeletePhoto) {
        await onDeletePhoto(deleteTarget.productId, deleteTarget.photoId);
        // Reset active index if needed
        setActivePhotoMap((prev) => ({
          ...prev,
          [deleteTarget.productId]: 0,
        }));
      }
      setDeleteTarget(null);
    } finally {
      setIsDeleting(false);
    }
  };

  const handleTriggerAddPhoto = (e: React.MouseEvent, productId: string) => {
    e.stopPropagation();
    setTargetAddProductId(productId);
    cardFileInputRef.current?.click();
  };

  const handleCardFileInputChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const rawFiles = Array.from(e.target.files || []);
    // Filter and sanitize files
    const validFiles = rawFiles.filter((f) => validateImageFile(f).valid);
    if (validFiles.length > 0 && targetAddProductId && onAddPhotos) {
      await onAddPhotos(targetAddProductId, validFiles);
    }
    setTargetAddProductId(null);
    if (cardFileInputRef.current) {
      cardFileInputRef.current.value = '';
    }
  };

  const clearFilter = () => {
    setQuery('');
    setSelectedTag(null);
    setHasSearched(false);
  };

  return (
    <div className="max-w-3xl mx-auto">
      {/* Hidden file input for quick adding photos to any product */}
      <input
        ref={cardFileInputRef}
        type="file"
        multiple
        accept="image/*"
        className="hidden"
        onChange={handleCardFileInputChange}
      />

      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-stone-900 tracking-tight mb-2">
          Look up a photo
        </h1>
        <p className="text-stone-500 text-base">
          Paste an Amazon link or ASIN to find stored pictures.
        </p>
      </div>

      {/* Search Form */}
      <form onSubmit={handleSearchSubmit} className="flex gap-2 mb-4">
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400" />
          <input
            id="lookup-search-input"
            type="text"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setHasSearched(true);
            }}
            placeholder="Paste Amazon link or ASIN (e.g. B09XS7JWHH)..."
            className="w-full pl-10 pr-4 py-3 rounded-xl border border-stone-200 bg-white text-stone-900 placeholder-stone-400 focus:outline-none focus:ring-2 focus:ring-stone-900 focus:border-transparent transition-all font-mono text-sm"
          />
          {query && (
            <button
              type="button"
              onClick={() => {
                setQuery('');
                setHasSearched(false);
              }}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-stone-400 hover:text-stone-600 px-1.5 py-0.5 rounded cursor-pointer"
            >
              Clear
            </button>
          )}
        </div>

        <button
          id="lookup-submit-btn"
          type="submit"
          disabled={isSearching}
          className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-stone-900 text-white font-medium hover:bg-stone-800 transition-colors cursor-pointer shadow-xs disabled:opacity-50"
        >
          {isSearching ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Search className="w-4 h-4" />
          )}
          Search
        </button>
      </form>

      {/* Detected ASIN badge in query */}
      {searchAsin && (
        <div className="mb-4 flex items-center gap-2 text-xs text-stone-600 px-3 py-1.5 rounded-lg bg-stone-100 border border-stone-200/80">
          <Sparkles className="w-3.5 h-3.5 text-amber-600" />
          <span>
            Searching by detected Amazon ASIN:{' '}
            <strong className="font-mono text-stone-900">{searchAsin}</strong>
          </span>
        </div>
      )}

      {/* Filter / Category Pills */}
      <div className="flex items-center justify-between gap-2 mb-6 flex-wrap">
        <div className="flex items-center gap-1.5 flex-wrap">
          <button
            onClick={() => setSelectedTag(null)}
            className={`px-3 py-1 rounded-full text-xs font-medium transition-colors cursor-pointer ${
              selectedTag === null
                ? 'bg-stone-900 text-white'
                : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
            }`}
          >
            All ({images.length})
          </button>
          {allTags.map((tag) => (
            <button
              key={tag}
              onClick={() => setSelectedTag(tag === selectedTag ? null : tag)}
              className={`px-3 py-1 rounded-full text-xs font-medium transition-colors cursor-pointer ${
                selectedTag === tag
                  ? 'bg-stone-900 text-white'
                  : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
              }`}
            >
              #{tag}
            </button>
          ))}
        </div>

        <div className="text-xs text-stone-500">
          {filteredResults.length} {filteredResults.length === 1 ? 'product' : 'products'} found
        </div>
      </div>

      {/* Empty State */}
      {filteredResults.length === 0 && (
        <div className="text-center py-16 px-4 bg-white border border-stone-200 rounded-2xl">
          <div className="w-14 h-14 rounded-full bg-stone-100 flex items-center justify-center mx-auto mb-4 text-stone-300">
            <Search className="w-7 h-7" />
          </div>
          <h2 className="text-lg font-semibold text-stone-900 mb-1">No matches found</h2>
          <p className="text-stone-500 text-sm max-w-sm mx-auto mb-6">
            No photos stored for that link. Try pasting the full Amazon URL or 10-character ASIN.
          </p>

          <div className="flex items-center justify-center gap-3">
            <button
              onClick={clearFilter}
              className="px-4 py-2 rounded-lg border border-stone-200 text-stone-700 text-sm font-medium hover:bg-stone-50 transition-colors cursor-pointer"
            >
              View all stored products
            </button>
            <button
              onClick={onNavigateUpload}
              className="px-4 py-2 rounded-lg bg-stone-900 text-white text-sm font-medium hover:bg-stone-800 transition-colors cursor-pointer"
            >
              Upload this link now
            </button>
          </div>
        </div>
      )}

      {/* Results List */}
      {filteredResults.length > 0 && (
        <div className="space-y-5">
          {filteredResults.map((item) => {
            const activeIdx = activePhotoMap[item.id] || 0;
            const currentPhoto = item.photos[activeIdx] || item.photos[0];
            const hasMultiplePhotos = item.photos.length > 1;

            return (
              <div
                key={item.id}
                onClick={() => onSelectImage(item, activeIdx)}
                className="group rounded-2xl overflow-hidden bg-white border border-stone-200 hover:border-stone-300 hover:shadow-md transition-all cursor-pointer"
              >
                <div className="flex flex-col sm:flex-row">
                  {/* Image preview column with active photo display */}
                  <div className="sm:w-64 bg-stone-100 flex flex-col justify-between flex-shrink-0 border-b sm:border-b-0 sm:border-r border-stone-200">
                    <div className="relative aspect-square sm:aspect-auto sm:h-52 overflow-hidden bg-stone-200">
                      {currentPhoto && (
                        <img
                          src={currentPhoto.image_data}
                          alt={item.title || 'Product'}
                          className="w-full h-full object-cover group-hover:scale-102 transition-transform duration-300"
                          loading="lazy"
                        />
                      )}

                      {/* ASIN badge */}
                      {item.asin && (
                        <span className="absolute top-2 left-2 px-2 py-0.5 rounded-md bg-stone-900/80 backdrop-blur-xs text-white text-[10px] font-mono">
                          {item.asin}
                        </span>
                      )}

                      {/* Photo Count badge */}
                      <span className="absolute bottom-2 left-2 px-2 py-0.5 rounded-md bg-black/70 backdrop-blur-xs text-white text-[11px] font-medium flex items-center gap-1">
                        <Images className="w-3 h-3" />
                        {item.photos.length} {item.photos.length === 1 ? 'photo' : 'photos'}
                      </span>
                    </div>

                    {/* Thumbnail strip on the card if multiple photos */}
                    <div className="p-2 bg-stone-50 border-t border-stone-200 flex items-center gap-1.5 overflow-x-auto">
                      {item.photos.map((photo, pIdx) => (
                        <button
                          key={photo.id}
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setActivePhotoMap((prev) => ({
                              ...prev,
                              [item.id]: pIdx,
                            }));
                          }}
                          className={`relative w-9 h-9 rounded-md overflow-hidden flex-shrink-0 border-2 transition-all cursor-pointer ${
                            pIdx === activeIdx
                              ? 'border-stone-900 scale-105'
                              : 'border-transparent opacity-60 hover:opacity-100'
                          }`}
                        >
                          <img
                            src={photo.image_data}
                            alt={`Thumb ${pIdx + 1}`}
                            className="w-full h-full object-cover"
                          />
                        </button>
                      ))}

                      {/* Quick Add photo button directly on the card */}
                      <button
                        type="button"
                        onClick={(e) => handleTriggerAddPhoto(e, item.id)}
                        className="w-9 h-9 rounded-md border border-dashed border-stone-300 hover:border-stone-500 flex items-center justify-center text-stone-500 hover:text-stone-900 bg-white hover:bg-stone-100 transition-colors flex-shrink-0 cursor-pointer"
                        title="Add another photo to this product"
                      >
                        <Plus className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* Content details */}
                  <div className="p-4 sm:p-5 flex-1 flex flex-col justify-between">
                    <div>
                      <div className="flex items-start justify-between gap-3 mb-2">
                        <h3 className="font-semibold text-stone-900 text-sm sm:text-base group-hover:text-stone-700 transition-colors">
                          {item.title || (item.asin ? `Product ASIN: ${item.asin}` : 'Product Photos')}
                        </h3>

                        {/* Top action icons */}
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={(e) => handleTriggerAddPhoto(e, item.id)}
                            className="w-8 h-8 rounded-lg flex items-center justify-center text-stone-500 hover:bg-stone-100 hover:text-stone-900 transition-colors cursor-pointer"
                            title="Add another picture for this product"
                          >
                            <Plus className="w-4 h-4" />
                          </button>

                          <button
                            type="button"
                            onClick={(e) => handleDownloadActivePhoto(e, item)}
                            className="w-8 h-8 rounded-lg flex items-center justify-center text-stone-400 hover:bg-stone-100 hover:text-stone-700 transition-colors cursor-pointer"
                            title="Download active photo"
                          >
                            <Download className="w-4 h-4" />
                          </button>

                          {/* Delete entire product button */}
                          <button
                            type="button"
                            onClick={(e) => triggerDeleteProduct(e, item)}
                            className="w-8 h-8 rounded-lg flex items-center justify-center text-stone-400 hover:bg-red-50 hover:text-red-600 transition-colors cursor-pointer"
                            title="Delete this product from storage"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>

                      {/* Amazon URL link */}
                      <div className="mb-3">
                        <span className="text-[11px] text-stone-400 block mb-0.5">
                          Amazon link
                        </span>
                        <div className="flex items-center gap-2">
                          <a
                            href={sanitizeExternalUrl(item.amazon_url)}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={(e) => e.stopPropagation()}
                            className="text-xs text-stone-800 hover:text-amber-700 truncate font-mono flex items-center gap-1.5 underline decoration-stone-200 underline-offset-2 flex-1"
                          >
                            <Link2 className="w-3.5 h-3.5 flex-shrink-0 text-stone-400" />
                            <span className="truncate">{item.amazon_url}</span>
                            <ExternalLink className="w-3 h-3 flex-shrink-0 text-stone-400" />
                          </a>

                          <button
                            type="button"
                            onClick={(e) => handleCopyUrl(e, item)}
                            className="px-2.5 py-1 rounded-md text-[11px] font-medium border border-stone-200 hover:bg-stone-100 text-stone-700 transition-colors flex items-center gap-1 cursor-pointer flex-shrink-0"
                          >
                            {copiedId === item.id ? (
                              <>
                                <Check className="w-3 h-3 text-emerald-600" />
                                <span className="text-emerald-700">Copied</span>
                              </>
                            ) : (
                              <>
                                <Copy className="w-3 h-3" />
                                <span>Copy</span>
                              </>
                            )}
                          </button>
                        </div>
                      </div>

                      {item.notes && (
                        <p className="text-xs text-stone-500 line-clamp-2 italic mb-3">
                          "{item.notes}"
                        </p>
                      )}
                    </div>

                    {/* Tags, Photos count & Date */}
                    <div className="flex items-center justify-between gap-2 pt-2.5 border-t border-stone-100 text-[11px] text-stone-400 flex-wrap">
                      <div className="flex items-center gap-1 flex-wrap">
                        {item.tags?.map((tag) => (
                          <span
                            key={tag}
                            className="px-2 py-0.5 rounded bg-stone-100 text-stone-600 font-medium text-[10px]"
                          >
                            #{tag}
                          </span>
                        ))}
                      </div>

                      <div className="flex items-center gap-2">
                        <span>
                          {item.photos.length} {item.photos.length === 1 ? 'picture' : 'pictures'}
                        </span>
                        <span>•</span>
                        <span>Added {new Date(item.created_at).toLocaleDateString()}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* In-app safe Confirmation Modal */}
      <ConfirmModal
        isOpen={deleteTarget !== null}
        title={
          deleteTarget?.type === 'product'
            ? 'Delete this product?'
            : 'Delete this photo?'
        }
        message={
          deleteTarget?.type === 'product'
            ? `Are you sure you want to delete "${deleteTarget.title}" and all ${deleteTarget.photoCount} stored photos? This action cannot be undone.`
            : 'Are you sure you want to delete this photo from the product?'
        }
        confirmLabel={deleteTarget?.type === 'product' ? 'Delete Product' : 'Delete Photo'}
        isLoading={isDeleting}
        onConfirm={executeDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
};
