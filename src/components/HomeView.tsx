import React from 'react';
import {
  Upload,
  Search,
  Link2,
  Sparkles,
  Copy,
  Check,
  Images,
  FolderOpen,
  ArrowRight,
} from 'lucide-react';
import { ProductItem } from '../types';

interface HomeViewProps {
  onUpload: () => void;
  onLookup: () => void;
  recentImages: ProductItem[];
  onSelectImage: (image: ProductItem) => void;
  onQuickLookup: (urlOrAsin: string) => void;
}

export const HomeView: React.FC<HomeViewProps> = ({
  onUpload,
  onLookup,
  recentImages,
  onSelectImage,
  onQuickLookup,
}) => {
  const [copiedId, setCopiedId] = React.useState<string | null>(null);

  const handleCopy = (e: React.MouseEvent, img: ProductItem) => {
    e.stopPropagation();
    navigator.clipboard.writeText(img.amazon_url);
    setCopiedId(img.id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const totalPhotosCount = recentImages.reduce((acc, curr) => acc + curr.photos.length, 0);

  return (
    <div className="space-y-14">
      {/* Hero Section */}
      <section className="text-center pt-6 sm:pt-10">
        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-stone-100 border border-stone-200 text-sm text-stone-600 mb-6 shadow-2xs">
          <Sparkles className="w-3.5 h-3.5 text-amber-500" />
          <span>Save multiple product photos with their Amazon links</span>
        </div>

        <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-stone-900 tracking-tight leading-[1.1] mb-4">
          Store your pictures.
          <br />
          <span className="text-stone-400">Find them by link later.</span>
        </h1>

        <p className="text-base sm:text-lg text-stone-500 max-w-lg mx-auto mb-8 leading-relaxed">
          Upload pictures of packaging, serial numbers, and unboxing for any Amazon product.
          Search by link or ASIN anytime to get all your photos back.
        </p>

        <div className="flex flex-wrap items-center justify-center gap-3">
          <button
            id="home-cta-upload-btn"
            onClick={onUpload}
            className="inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-stone-900 text-white font-medium hover:bg-stone-800 transition-all shadow-sm hover:shadow-md cursor-pointer active:scale-98"
          >
            <Upload className="w-4 h-4" />
            Upload pictures
          </button>
          <button
            id="home-cta-lookup-btn"
            onClick={onLookup}
            className="inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-white text-stone-700 font-medium border border-stone-200 hover:bg-stone-50 hover:border-stone-300 transition-all shadow-2xs cursor-pointer active:scale-98"
          >
            <Search className="w-4 h-4" />
            Look up a link
          </button>
        </div>
      </section>

      {/* Recently Added Products Section */}
      {recentImages.length > 0 && (
        <section className="pt-2">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <h2 className="text-xs sm:text-sm font-semibold text-stone-500 uppercase tracking-wider">
                Stored Products ({recentImages.length})
              </h2>
              <span className="text-xs text-stone-400">
                • {totalPhotosCount} {totalPhotosCount === 1 ? 'photo' : 'photos'} total
              </span>
            </div>

            <button
              onClick={onLookup}
              className="text-xs font-medium text-stone-600 hover:text-stone-900 transition-colors cursor-pointer inline-flex items-center gap-1"
            >
              View all <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {recentImages.slice(0, 6).map((img) => {
              const firstPhoto = img.photos[0];
              return (
                <div
                  key={img.id}
                  onClick={() => onSelectImage(img)}
                  className="group rounded-2xl overflow-hidden bg-white border border-stone-200 hover:border-stone-300 hover:shadow-lg transition-all cursor-pointer flex flex-col"
                >
                  <div className="aspect-[4/3] overflow-hidden bg-stone-100 relative">
                    {firstPhoto && (
                      <img
                        src={firstPhoto.image_data}
                        alt={img.title || 'Product photo'}
                        className="w-full h-full object-cover group-hover:scale-103 transition-transform duration-300"
                        loading="lazy"
                      />
                    )}

                    {img.asin && (
                      <span className="absolute top-2.5 left-2.5 px-2 py-0.5 rounded-md bg-stone-900/80 backdrop-blur-xs text-white text-[10px] font-mono">
                        {img.asin}
                      </span>
                    )}

                    {/* Photos Count Badge */}
                    <span className="absolute bottom-2.5 left-2.5 px-2 py-0.5 rounded-md bg-black/70 backdrop-blur-xs text-white text-[11px] font-medium flex items-center gap-1">
                      <Images className="w-3 h-3" />
                      {img.photos.length} {img.photos.length === 1 ? 'photo' : 'photos'}
                    </span>

                    <button
                      onClick={(e) => handleCopy(e, img)}
                      title="Copy Amazon link"
                      className="absolute top-2.5 right-2.5 w-7 h-7 rounded-md bg-white/90 backdrop-blur-xs flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity text-stone-700 hover:bg-white shadow-xs"
                    >
                      {copiedId === img.id ? (
                        <Check className="w-3.5 h-3.5 text-emerald-600" />
                      ) : (
                        <Copy className="w-3.5 h-3.5" />
                      )}
                    </button>
                  </div>

                  <div className="p-3.5 bg-white flex-1 flex flex-col justify-between">
                    <div>
                      <p className="text-sm font-semibold text-stone-900 truncate mb-1">
                        {img.title || (img.asin ? `Product ${img.asin}` : 'Product Photo')}
                      </p>
                      <p className="text-xs text-stone-400 truncate flex items-center gap-1.5 font-mono mb-2">
                        <Link2 className="w-3 h-3 flex-shrink-0 text-stone-400" />
                        <span className="truncate">{img.amazon_url}</span>
                      </p>
                    </div>

                    {img.photos.length > 1 && (
                      <div className="flex items-center gap-1.5 overflow-hidden pt-1.5 border-t border-stone-100">
                        {img.photos.slice(0, 4).map((p, i) => (
                          <img
                            key={p.id || i}
                            src={p.image_data}
                            alt="Thumb"
                            className="w-7 h-7 rounded object-cover border border-stone-200"
                          />
                        ))}
                        {img.photos.length > 4 && (
                          <span className="text-[10px] text-stone-500 font-medium pl-0.5">
                            +{img.photos.length - 4} more
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Quick lookup suggestion banner */}
          <div className="mt-5 p-3 rounded-xl bg-stone-100/70 border border-stone-200/80 flex flex-wrap items-center justify-between gap-2 text-xs text-stone-600">
            <span className="text-stone-500">Quick Test: Click any sample ASIN to look up:</span>
            <div className="flex items-center gap-2 flex-wrap">
              {recentImages.slice(0, 3).map(
                (item) =>
                  item.asin && (
                    <button
                      key={item.id}
                      onClick={() => onQuickLookup(item.asin!)}
                      className="px-2.5 py-1 rounded-md bg-white border border-stone-200 text-stone-700 font-mono text-[11px] hover:border-stone-400 hover:bg-stone-50 transition-colors cursor-pointer"
                    >
                      {item.asin}
                    </button>
                  )
              )}
            </div>
          </div>
        </section>
      )}

      {/* 3-Step Process Cards */}
      <section className="grid grid-cols-1 sm:grid-cols-3 gap-6 pt-4">
        {[
          {
            icon: Upload,
            title: '1. Upload pictures',
            desc: 'Snap or pick photos of packaging, serial numbers, and condition.',
          },
          {
            icon: Link2,
            title: '2. Attach Amazon link',
            desc: 'Paste the product link or 10-digit ASIN to securely bind the photos.',
          },
          {
            icon: Search,
            title: '3. Instant lookup',
            desc: 'Paste the link anytime to view, browse, and download all photos.',
          },
        ].map((step, idx) => {
          const Icon = step.icon;
          return (
            <div
              key={idx}
              className="p-6 rounded-2xl bg-white border border-stone-200 shadow-2xs text-left"
            >
              <div className="w-10 h-10 rounded-xl bg-stone-100 flex items-center justify-center text-stone-700 mb-4">
                <Icon className="w-5 h-5" />
              </div>
              <h3 className="font-semibold text-stone-900 text-base mb-1.5">{step.title}</h3>
              <p className="text-stone-500 text-sm leading-relaxed">{step.desc}</p>
            </div>
          );
        })}
      </section>
    </div>
  );
};
