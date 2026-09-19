import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Navbar } from './components/Navbar';
import { HomeView } from './components/HomeView';
import { UploadView } from './components/UploadView';
import { LookupView } from './components/LookupView';
import { ImageLightboxModal } from './components/ImageLightboxModal';
import { ShareDeviceModal } from './components/ShareDeviceModal';
import { SecurityModal } from './components/SecurityModal';
import { PasswordWall } from './components/PasswordWall';
import { ProductItem, ActiveTab } from './types';
import {
  getAllProducts,
  saveProduct,
  deleteProduct as deleteProductFromDB,
  deletePhotoFromProduct as deletePhotoFromDB,
  addPhotosToProduct as addPhotosToDB,
  seedInitialDataIfEmpty,
  clearAllLocalProducts,
} from './utils/storage';
import {
  isSiteUnlocked,
  lockSite as authLockSite,
  initializeVaultCredentials,
  applyCloudVaultSetting,
  getActiveVaultHash,
} from './utils/vaultAuth';
import {
  auth,
  signInWithGoogle,
  signOut as firebaseSignOut,
  saveSharedProductToFirestore,
  deleteSharedProductFromFirestore,
  subscribeToSharedProducts,
  deleteAllSharedProductsFromFirestore,
  deleteAllUserProductsFromFirestore,
  subscribeToVaultSetting,
} from './firebase';
import { onAuthStateChanged, User } from 'firebase/auth';
import { Cloud, Smartphone, CheckCircle, AlertCircle } from 'lucide-react';

export default function App() {
  const [activeTab, setActiveTab] = useState<ActiveTab>('home');
  const [products, setProducts] = useState<ProductItem[]>([]);
  const [selectedProduct, setSelectedProduct] = useState<ProductItem | null>(null);
  const [selectedPhotoIndex, setSelectedPhotoIndex] = useState<number>(0);
  const [lookupQuery, setLookupQuery] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  // User Authentication & Cloud Sync
  const [user, setUser] = useState<User | null>(null);
  const [isAuthLoading, setIsAuthLoading] = useState(true);
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);
  const [isSecurityModalOpen, setIsSecurityModalOpen] = useState(false);
  const [isSiteWalled, setIsSiteWalled] = useState<boolean>(() => !isSiteUnlocked());
  const [syncToast, setSyncToast] = useState<string | null>(null);

  // Initial local loading fallback
  const refreshLocalProducts = useCallback(async () => {
    try {
      const list = await seedInitialDataIfEmpty();
      setProducts(list);
    } catch (err) {
      console.error('Error loading local products:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Monitor master vault passcode from Firestore in real-time across devices
  useEffect(() => {
    initializeVaultCredentials().then(() => {
      if (!isSiteUnlocked()) {
        setIsSiteWalled(true);
      }
    });

    const unsubVault = subscribeToVaultSetting((cloudSetting) => {
      if (cloudSetting) {
        const previousHash = getActiveVaultHash();
        applyCloudVaultSetting(cloudSetting);

        // If the passcode hash changed on another device, check if our session is still valid
        if (previousHash && previousHash !== cloudSetting.hash) {
          if (!isSiteUnlocked()) {
            setIsSiteWalled(true);
            setSyncToast('Vault passcode was updated on another device. Please enter the new passcode.');
          }
        }
      }
    });

    return () => unsubVault();
  }, []);

  // Monitor Firebase Auth State
  useEffect(() => {
    const unsubAuth = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      setIsAuthLoading(false);
    });

    return () => unsubAuth();
  }, []);

  // Real-time Shared Products Synchronization
  // Connects all devices and users with the shared link to the exact same live catalog
  useEffect(() => {
    setIsLoading(true);

    const unsubProducts = subscribeToSharedProducts(
      async (sharedProducts) => {
        if (sharedProducts.length > 0) {
          setProducts(sharedProducts);
          // Mirror into local storage for speed and offline availability
          for (const p of sharedProducts) {
            await saveProduct(p).catch(() => {});
          }
        } else {
          // If cloud has no products yet, seed initial data or sync local items
          const localList = await seedInitialDataIfEmpty();
          if (localList.length > 0) {
            setProducts(localList);
            for (const p of localList) {
              await saveSharedProductToFirestore(p, user?.email).catch(() => {});
            }
          } else {
            setProducts([]);
          }
        }
        setIsLoading(false);
      },
      (err) => {
        console.warn('Realtime shared cloud sync error:', err);
        refreshLocalProducts();
      }
    );

    return () => {
      unsubProducts();
    };
  }, [refreshLocalProducts, user?.email]);

  const showToast = (message: string) => {
    setSyncToast(message);
    setTimeout(() => setSyncToast(null), 3000);
  };

  const handleTabChange = (tab: ActiveTab) => {
    setActiveTab(tab);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleQuickLookup = (urlOrAsin: string) => {
    setLookupQuery(urlOrAsin);
    setActiveTab('lookup');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleUploaded = async (savedProduct: ProductItem) => {
    // Update local state immediately
    setProducts((prev) => [
      savedProduct,
      ...prev.filter((p) => p.id !== savedProduct.id),
    ]);

    // Save to shared Firestore so everyone with the link sees it immediately
    try {
      await saveSharedProductToFirestore(savedProduct, user?.email);
      showToast('Saved to Shared Vault (Synced)');
    } catch (err) {
      console.error('Failed to sync product to shared vault:', err);
    }
  };

  const handleDeleteProduct = async (productId: string) => {
    // Delete from local IndexedDB
    await deleteProductFromDB(productId);

    // Delete from shared cloud collection
    try {
      await deleteSharedProductFromFirestore(productId);
    } catch (err) {
      console.error('Failed to delete product from shared Firestore:', err);
    }

    setProducts((prev) => prev.filter((p) => p.id !== productId));
    if (selectedProduct?.id === productId) {
      setSelectedProduct(null);
    }
    showToast('Product deleted from vault');
  };

  const handleDeletePhoto = async (productId: string, photoId: string) => {
    const result = await deletePhotoFromDB(productId, photoId);
    if (result.productDeleted) {
      await deleteSharedProductFromFirestore(productId).catch(console.error);
      setProducts((prev) => prev.filter((p) => p.id !== productId));
      if (selectedProduct?.id === productId) {
        setSelectedProduct(null);
      }
    } else if (result.updatedProduct) {
      await saveSharedProductToFirestore(result.updatedProduct, user?.email).catch(console.error);
      setProducts((prev) =>
        prev.map((p) => (p.id === productId ? result.updatedProduct! : p))
      );
      if (selectedProduct?.id === productId) {
        setSelectedProduct(result.updatedProduct);
      }
    }
    showToast('Photo removed');
  };

  const handleAddPhotosToProduct = async (productId: string, files: File[]) => {
    const converted = await Promise.all(
      files.map((file) => {
        return new Promise<{ image_data: string; filename: string; file_size: number }>(
          (resolve) => {
            const reader = new FileReader();
            reader.onload = (e) => {
              resolve({
                image_data: e.target?.result as string,
                filename: file.name,
                file_size: file.size,
              });
            };
            reader.readAsDataURL(file);
          }
        );
      })
    );

    const updated = await addPhotosToDB(productId, converted);
    if (updated) {
      await saveSharedProductToFirestore(updated, user?.email).catch(console.error);
      setProducts((prev) => prev.map((p) => (p.id === productId ? updated : p)));
      if (selectedProduct?.id === productId) {
        setSelectedProduct(updated);
      }
      showToast(`${files.length} photo${files.length > 1 ? 's' : ''} added & synced`);
    }
  };

  const handleOpenLightbox = (product: ProductItem, initialIndex = 0) => {
    setSelectedProduct(product);
    setSelectedPhotoIndex(initialIndex);
  };

  const handleSignIn = async () => {
    try {
      await signInWithGoogle();
      showToast('Signed in with Google');
    } catch (err) {
      console.error('Sign-in error:', err);
    }
  };

  const handleSignOut = async () => {
    try {
      await firebaseSignOut();
      showToast('Signed out from Google account');
    } catch (err) {
      console.error('Sign-out error:', err);
    }
  };

  const handleClearLocalCache = async () => {
    await clearAllLocalProducts();
    showToast('Local device cache cleared. Refreshing from vault cloud...');
    refreshLocalProducts();
  };

  const handleWipeAllData = async () => {
    await deleteAllSharedProductsFromFirestore().catch(console.error);
    if (user) {
      await deleteAllUserProductsFromFirestore(user.uid).catch(console.error);
    }
    await clearAllLocalProducts();
    setProducts([]);
    setSelectedProduct(null);
    showToast('All vault data has been erased.');
  };

  const handleLockSite = () => {
    authLockSite();
    setIsSiteWalled(true);
    showToast('LinkPix locked with master passcode.');
  };

  const handleUnlockSite = () => {
    setIsSiteWalled(false);
    showToast('Master passcode verified. Vault unlocked.');
  };

  // If the site is walled with password, block all access until unlocked
  if (isSiteWalled) {
    return (
      <PasswordWall
        onUnlock={handleUnlockSite}
        notificationMessage={syncToast}
      />
    );
  }

  return (
    <div className="min-h-screen bg-stone-50 text-stone-900 flex flex-col selection:bg-stone-200">
      {/* Top Navigation */}
      <Navbar
        activeTab={activeTab}
        onTabChange={handleTabChange}
        totalCount={products.length}
        user={user}
        onSignIn={handleSignIn}
        onSignOut={handleSignOut}
        onOpenShareModal={() => setIsShareModalOpen(true)}
        onOpenSecurityModal={() => setIsSecurityModalOpen(true)}
        onLockSite={handleLockSite}
        isAuthLoading={isAuthLoading}
      />

      {/* Cloud Sync Announcement Banner if not signed in */}
      {!user && !isAuthLoading && (
        <div className="bg-stone-900 text-stone-200 text-xs py-2 px-4 border-b border-stone-800">
          <div className="max-w-5xl mx-auto flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Cloud className="w-3.5 h-3.5 text-sky-400" />
              <span>
                Want to access your photos on your phone or another device?
              </span>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={() => setIsShareModalOpen(true)}
                className="text-stone-300 hover:text-white underline underline-offset-2 cursor-pointer flex items-center gap-1"
              >
                <Smartphone className="w-3 h-3" />
                Scan QR Code
              </button>
              <button
                onClick={handleSignIn}
                className="px-2.5 py-0.5 rounded bg-white text-stone-900 font-medium hover:bg-stone-100 transition-colors cursor-pointer"
              >
                Sign In with Google
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Main Viewport */}
      <main className="flex-1 max-w-5xl w-full mx-auto px-4 sm:px-6 py-8 sm:py-10">
        {activeTab === 'home' && (
          <HomeView
            onUpload={() => handleTabChange('upload')}
            onLookup={() => {
              setLookupQuery('');
              handleTabChange('lookup');
            }}
            recentImages={products}
            onSelectImage={(product) => handleOpenLightbox(product, 0)}
            onQuickLookup={handleQuickLookup}
          />
        )}

        {activeTab === 'upload' && (
          <UploadView
            onUploaded={handleUploaded}
            onNavigateLookup={(urlOrAsin) => handleQuickLookup(urlOrAsin)}
            existingProducts={products}
          />
        )}

        {activeTab === 'lookup' && (
          <LookupView
            images={products}
            onDeleteProduct={handleDeleteProduct}
            onDeletePhoto={handleDeletePhoto}
            onAddPhotos={handleAddPhotosToProduct}
            onSelectImage={handleOpenLightbox}
            onNavigateUpload={() => handleTabChange('upload')}
            initialQuery={lookupQuery}
          />
        )}
      </main>

      {/* Lightbox Modal with multi-photo gallery & safe delete */}
      <ImageLightboxModal
        product={selectedProduct}
        initialPhotoIndex={selectedPhotoIndex}
        onClose={() => setSelectedProduct(null)}
        onDeleteProduct={handleDeleteProduct}
        onDeletePhoto={handleDeletePhoto}
        onAddPhotos={handleAddPhotosToProduct}
      />

      {/* Share / Open on Another Device Modal */}
      <ShareDeviceModal
        isOpen={isShareModalOpen}
        onClose={() => setIsShareModalOpen(false)}
        userEmail={user?.email}
      />

      {/* Security & Privacy Center Modal */}
      <SecurityModal
        isOpen={isSecurityModalOpen}
        onClose={() => setIsSecurityModalOpen(false)}
        user={user}
        onClearLocalCache={handleClearLocalCache}
        onWipeAllData={handleWipeAllData}
        onLockSite={handleLockSite}
        productCount={products.length}
      />

      {/* Floating Notification Toast */}
      {syncToast && (
        <div className="fixed bottom-6 right-6 z-50 px-4 py-2.5 rounded-xl bg-stone-900 text-white text-xs font-medium shadow-xl flex items-center gap-2 animate-in fade-in slide-in-from-bottom-2 duration-200">
          <CheckCircle className="w-4 h-4 text-emerald-400" />
          <span>{syncToast}</span>
        </div>
      )}

      {/* Footer */}
      <footer className="border-t border-stone-200/80 bg-stone-50 py-8 px-5 mt-auto">
        <div className="max-w-5xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-stone-400">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-stone-600">LinkPix</span>
            <span>— store product photos, find them by Amazon link</span>
          </div>
          <div className="flex items-center gap-3 text-stone-400 flex-wrap justify-center">
            <button
              onClick={() => setIsShareModalOpen(true)}
              className="hover:text-stone-700 underline underline-offset-2 cursor-pointer flex items-center gap-1"
            >
              <Smartphone className="w-3.5 h-3.5" />
              Open on Phone
            </button>
            <span>•</span>
            <button
              onClick={() => setIsSecurityModalOpen(true)}
              className="hover:text-stone-700 underline underline-offset-2 cursor-pointer"
            >
              Security & Privacy
            </button>
            <span>•</span>
            <button
              onClick={handleLockSite}
              className="hover:text-stone-700 underline underline-offset-2 cursor-pointer text-amber-700 font-medium"
            >
              Lock Site
            </button>
            <span>•</span>
            <span>{user ? `Cloud Sync: ${user.email}` : 'Local & Cloud Ready'}</span>
            <span>•</span>
            <span>Multiple photos supported</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
