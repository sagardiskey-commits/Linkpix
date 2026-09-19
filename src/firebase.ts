import { initializeApp } from 'firebase/app';
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signOut as firebaseSignOut,
  onAuthStateChanged,
  User,
} from 'firebase/auth';
import {
  getFirestore,
  doc,
  setDoc,
  deleteDoc,
  collection,
  onSnapshot,
  getDocFromServer,
  getDoc,
  getDocs,
} from 'firebase/firestore';
import firebaseConfig from '../firebase-applet-config.json';
import { ProductItem, VaultSettingDoc } from './types';
import { compressImageData } from './utils/imageCompressor';

// Initialize Firebase App
export const app = initializeApp(firebaseConfig);

// Initialize Auth
export const auth = getAuth(app);

// Initialize Firestore with custom database ID (CRITICAL)
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);

export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({
  prompt: 'select_account',
});

// Operation Types for Error Handling
export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(
  error: unknown,
  operationType: OperationType,
  path: string | null
): never {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo:
        auth.currentUser?.providerData?.map((provider) => ({
          providerId: provider.providerId,
          email: provider.email,
        })) || [],
    },
    operationType,
    path,
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

// Validate connection to Firestore on boot
export async function testFirestoreConnection(): Promise<boolean> {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
    return true;
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.warn('Firebase: client is offline or network is restricted.');
    }
    return false;
  }
}

// Trigger connection test in background
testFirestoreConnection();

/**
 * Sign in with Google Popup
 */
export async function signInWithGoogle(): Promise<User | null> {
  try {
    const result = await signInWithPopup(auth, googleProvider);
    return result.user;
  } catch (error) {
    console.error('Error signing in with Google:', error);
    throw error;
  }
}

/**
 * Sign out
 */
export async function signOut(): Promise<void> {
  await firebaseSignOut(auth);
}

/**
 * Recursively remove any keys with undefined values to prevent Firestore's
 * "Unsupported field value: undefined" errors.
 */
export function sanitizeForFirestore<T>(data: T): T {
  if (data === null || data === undefined) {
    return null as any;
  }
  if (Array.isArray(data)) {
    return data
      .filter((item) => item !== undefined)
      .map((item) => sanitizeForFirestore(item)) as any;
  }
  if (typeof data === 'object') {
    const clean: Record<string, any> = {};
    for (const [key, value] of Object.entries(data as Record<string, any>)) {
      if (value !== undefined) {
        clean[key] = sanitizeForFirestore(value);
      }
    }
    return clean as any;
  }
  return data;
}

/**
 * Ensures each photo has only defined, valid fields and compresses heavy data URIs.
 */
async function cleanAndOptimizePhotos(
  photos: any[] = []
): Promise<Array<Record<string, any>>> {
  if (!Array.isArray(photos)) return [];

  return Promise.all(
    photos.slice(0, 50).map(async (photo, idx) => {
      let compressedData = photo?.image_data || '';
      if (typeof compressedData === 'string' && compressedData.startsWith('data:image/')) {
        try {
          compressedData = await compressImageData(compressedData, 1200, 0.82);
        } catch {
          // fall back to uncompressed
        }
      }

      const cleanPhoto: Record<string, any> = {
        id: String(photo?.id || `photo_${Date.now()}_${idx}`),
        image_data: compressedData,
        created_at: String(photo?.created_at || new Date().toISOString()),
      };

      if (photo?.filename !== undefined && photo?.filename !== null && photo?.filename !== '') {
        cleanPhoto.filename = String(photo.filename);
      }
      if (typeof photo?.file_size === 'number' && !isNaN(photo.file_size)) {
        cleanPhoto.file_size = photo.file_size;
      }

      return cleanPhoto;
    })
  );
}

/**
 * Save / Update a product in Firestore under the authenticated user's collection
 */
export async function saveProductToFirestore(
  userId: string,
  product: ProductItem
): Promise<void> {
  const path = `users/${userId}/products/${product.id}`;

  try {
    const optimizedPhotos = await cleanAndOptimizePhotos(product.photos || []);

    let cleanAmazonUrl = (product.amazon_url || '').trim();
    if (!cleanAmazonUrl && product.asin) {
      cleanAmazonUrl = `https://www.amazon.com/dp/${product.asin}`;
    } else if (
      cleanAmazonUrl &&
      !cleanAmazonUrl.startsWith('http://') &&
      !cleanAmazonUrl.startsWith('https://')
    ) {
      if (/^[A-Z0-9]{10}$/i.test(cleanAmazonUrl)) {
        cleanAmazonUrl = `https://www.amazon.com/dp/${cleanAmazonUrl.toUpperCase()}`;
      } else {
        cleanAmazonUrl = `https://${cleanAmazonUrl}`;
      }
    }
    if (!cleanAmazonUrl) {
      cleanAmazonUrl = 'https://www.amazon.com';
    }

    let createdAt = product.created_at || new Date().toISOString();
    try {
      const existingSnap = await getDoc(doc(db, 'users', userId, 'products', product.id));
      if (existingSnap.exists()) {
        const existingData = existingSnap.data();
        if (existingData?.createdAt) {
          createdAt = existingData.createdAt;
        }
      }
    } catch {
      // ignore
    }

    const rawDocData = {
      id: product.id,
      userId,
      amazon_url: cleanAmazonUrl.slice(0, 2048),
      asin: (product.asin || '').trim().slice(0, 30),
      title: (product.title || '').trim().slice(0, 1000),
      notes: (product.notes || '').trim().slice(0, 5000),
      tags: Array.isArray(product.tags)
        ? product.tags.filter((t) => typeof t === 'string').slice(0, 50)
        : [],
      photos: optimizedPhotos,
      createdAt,
      updatedAt: new Date().toISOString(),
    };

    const docData = sanitizeForFirestore(rawDocData);
    await setDoc(doc(db, 'users', userId, 'products', product.id), docData);
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

/**
 * Delete a product from Firestore
 */
export async function deleteProductFromFirestore(
  userId: string,
  productId: string
): Promise<void> {
  const path = `users/${userId}/products/${productId}`;
  try {
    await deleteDoc(doc(db, 'users', userId, 'products', productId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

/**
 * Subscribe to real-time updates of user products
 */
export function subscribeToUserProducts(
  userId: string,
  onUpdate: (products: ProductItem[]) => void,
  onError?: (err: Error) => void
): () => void {
  const path = `users/${userId}/products`;
  const colRef = collection(db, 'users', userId, 'products');

  const unsubscribe = onSnapshot(
    colRef,
    (snapshot) => {
      const items: ProductItem[] = [];
      snapshot.forEach((docSnap) => {
        const data = docSnap.data();
        items.push({
          id: data.id || docSnap.id,
          amazon_url: data.amazon_url || '',
          asin: data.asin || '',
          title: data.title || '',
          notes: data.notes || '',
          tags: Array.isArray(data.tags) ? data.tags : [],
          photos: Array.isArray(data.photos) ? data.photos : [],
          created_at: data.createdAt || new Date().toISOString(),
          updated_at: data.updatedAt || new Date().toISOString(),
        });
      });
      // Sort newest first
      items.sort(
        (a, b) =>
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );
      onUpdate(items);
    },
    (error) => {
      console.error('Snapshot error on', path, error);
      if (onError) {
        onError(error);
      }
      handleFirestoreError(error, OperationType.LIST, path);
    }
  );

  return unsubscribe;
}

/**
 * Delete all products for a user from Firestore (Full Vault Wipe)
 */
export async function deleteAllUserProductsFromFirestore(userId: string): Promise<void> {
  const path = `users/${userId}/products`;
  try {
    const colRef = collection(db, 'users', userId, 'products');
    const snapshot = await getDocs(colRef);
    const deletePromises: Promise<void>[] = [];
    snapshot.forEach((d) => {
      deletePromises.push(deleteDoc(d.ref));
    });
    await Promise.all(deletePromises);
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

/**
 * ============================================================================
 * SHARED VAULT PRODUCTS
 * Allows any user with the master vault passcode to store, search, and view
 * pictures across phones, tablets, and computers.
 * ============================================================================
 */

/**
 * Save / Update a product in the shared LinkPix products collection
 */
export async function saveSharedProductToFirestore(
  product: ProductItem,
  creatorEmail?: string | null
): Promise<void> {
  const path = `products/${product.id}`;

  try {
    const optimizedPhotos = await cleanAndOptimizePhotos(product.photos || []);

    // Format safe URL
    let cleanAmazonUrl = (product.amazon_url || '').trim();
    if (!cleanAmazonUrl && product.asin) {
      cleanAmazonUrl = `https://www.amazon.com/dp/${product.asin}`;
    } else if (
      cleanAmazonUrl &&
      !cleanAmazonUrl.startsWith('http://') &&
      !cleanAmazonUrl.startsWith('https://')
    ) {
      if (/^[A-Z0-9]{10}$/i.test(cleanAmazonUrl)) {
        cleanAmazonUrl = `https://www.amazon.com/dp/${cleanAmazonUrl.toUpperCase()}`;
      } else {
        cleanAmazonUrl = `https://${cleanAmazonUrl}`;
      }
    }
    if (!cleanAmazonUrl) {
      cleanAmazonUrl = 'https://www.amazon.com';
    }

    // Try to preserve existing createdAt if updating
    let createdAt = product.created_at || new Date().toISOString();
    try {
      const existingSnap = await getDoc(doc(db, 'products', product.id));
      if (existingSnap.exists()) {
        const existingData = existingSnap.data();
        if (existingData?.createdAt) {
          createdAt = existingData.createdAt;
        }
      }
    } catch {
      // ignore getDoc error
    }

    const rawDocData = {
      id: product.id,
      amazon_url: cleanAmazonUrl.slice(0, 2048),
      asin: (product.asin || '').trim().slice(0, 30),
      title: (product.title || '').trim().slice(0, 1000),
      notes: (product.notes || '').trim().slice(0, 5000),
      tags: Array.isArray(product.tags)
        ? product.tags.filter((t) => typeof t === 'string').slice(0, 50)
        : [],
      photos: optimizedPhotos,
      createdBy: creatorEmail || product.createdBy || 'vault_user',
      createdAt,
      updatedAt: new Date().toISOString(),
    };

    const docData = sanitizeForFirestore(rawDocData);
    await setDoc(doc(db, 'products', product.id), docData);
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

/**
 * Delete a product from the shared products collection
 */
export async function deleteSharedProductFromFirestore(productId: string): Promise<void> {
  const path = `products/${productId}`;
  try {
    await deleteDoc(doc(db, 'products', productId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

/**
 * Subscribe to real-time updates of all shared LinkPix vault products
 */
export function subscribeToSharedProducts(
  onUpdate: (products: ProductItem[]) => void,
  onError?: (err: Error) => void
): () => void {
  const path = 'products';
  const colRef = collection(db, 'products');

  const unsubscribe = onSnapshot(
    colRef,
    (snapshot) => {
      const items: ProductItem[] = [];
      snapshot.forEach((docSnap) => {
        const data = docSnap.data();
        items.push({
          id: data.id || docSnap.id,
          amazon_url: data.amazon_url || '',
          asin: data.asin || '',
          title: data.title || '',
          notes: data.notes || '',
          tags: Array.isArray(data.tags) ? data.tags : [],
          photos: Array.isArray(data.photos) ? data.photos : [],
          createdBy: data.createdBy,
          created_at: data.createdAt || new Date().toISOString(),
          updated_at: data.updatedAt || new Date().toISOString(),
        });
      });
      // Sort newest first
      items.sort(
        (a, b) =>
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );
      onUpdate(items);
    },
    (error) => {
      console.error('Shared products snapshot error on', path, error);
      if (onError) {
        onError(error);
      }
      handleFirestoreError(error, OperationType.LIST, path);
    }
  );

  return unsubscribe;
}

/**
 * Delete all shared products (Master Vault Wipe)
 */
export async function deleteAllSharedProductsFromFirestore(): Promise<void> {
  const path = 'products';
  try {
    const colRef = collection(db, 'products');
    const snapshot = await getDocs(colRef);
    const deletePromises: Promise<void>[] = [];
    snapshot.forEach((d) => {
      deletePromises.push(deleteDoc(d.ref));
    });
    await Promise.all(deletePromises);
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

/**
 * ============================================================================
 * VAULT SECURITY SETTINGS PERSISTENCE
 * Persists the master vault passcode hash & salt in Firestore so that password
 * changes persist across sessions, browsers, devices, and reloads.
 * ============================================================================
 */

/**
 * Fetch master vault settings from Firestore
 */
export async function fetchVaultSettingFromFirestore(): Promise<VaultSettingDoc | null> {
  const docRef = doc(db, 'settings', 'vault');
  try {
    // 1. Standard getDoc attempts server fetch and falls back seamlessly to cache if offline
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
      return docSnap.data() as VaultSettingDoc;
    }
  } catch (error) {
    console.warn('Initial getDoc for vault setting had error, falling back to server query:', error);
  }

  try {
    // 2. Direct server query fallback
    const serverSnap = await getDocFromServer(docRef);
    if (serverSnap.exists()) {
      return serverSnap.data() as VaultSettingDoc;
    }
  } catch (serverError) {
    console.warn('Could not fetch vault setting from server:', serverError);
  }

  return null;
}

/**
 * Save master vault settings to Firestore
 */
export async function saveVaultSettingToFirestore(setting: VaultSettingDoc): Promise<void> {
  const path = 'settings/vault';
  try {
    await setDoc(doc(db, 'settings', 'vault'), sanitizeForFirestore(setting));
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

/**
 * Subscribe to real-time changes to the vault passcode settings
 */
export function subscribeToVaultSetting(
  onUpdate: (setting: VaultSettingDoc | null) => void
): () => void {
  const docRef = doc(db, 'settings', 'vault');
  return onSnapshot(
    docRef,
    (docSnap) => {
      if (docSnap.exists()) {
        onUpdate(docSnap.data() as VaultSettingDoc);
      } else {
        onUpdate(null);
      }
    },
    (error) => {
      console.warn('Vault settings subscription warning:', error);
    }
  );
}


