import { ProductItem, ProductPhoto } from '../types';
import { extractAsin } from './amazon';

const DB_NAME = 'linkpix_db';
const STORE_NAME = 'product_images';
const DB_VERSION = 1;
const LOCALSTORAGE_KEY = 'linkpix_fallback_items_v2';
const LEGACY_LOCALSTORAGE_KEY = 'linkpix_fallback_images';

// Open IndexedDB database
function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !window.indexedDB) {
      reject(new Error('IndexedDB is not supported'));
      return;
    }
    const request = window.indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
        store.createIndex('amazon_url', 'amazon_url', { unique: false });
        store.createIndex('created_at', 'created_at', { unique: false });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

// Convert any legacy or raw record into a guaranteed ProductItem with multiple photos
export function normalizeProduct(raw: any): ProductItem {
  let photos: ProductPhoto[] = [];

  if (Array.isArray(raw.photos) && raw.photos.length > 0) {
    photos = raw.photos.map((p: any, idx: number) => ({
      id: p.id || `photo_${Date.now()}_${idx}`,
      image_data: p.image_data || '',
      filename: p.filename,
      file_size: p.file_size,
      created_at: p.created_at || raw.created_at || new Date().toISOString(),
    }));
  } else if (raw.image_data) {
    // Legacy single image format
    photos = [
      {
        id: `photo_${raw.id || Date.now()}`,
        image_data: raw.image_data,
        filename: raw.filename,
        file_size: raw.file_size,
        created_at: raw.created_at || new Date().toISOString(),
      },
    ];
  }

  const amazonUrl = raw.amazon_url || '';
  const asin = raw.asin || extractAsin(amazonUrl) || undefined;

  return {
    id: raw.id || `prod_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    amazon_url: amazonUrl,
    asin,
    title: raw.title,
    notes: raw.notes,
    tags: Array.isArray(raw.tags) ? raw.tags : [],
    photos,
    created_at: raw.created_at || new Date().toISOString(),
    updated_at: raw.updated_at || raw.created_at || new Date().toISOString(),
    // Keep backward compat image_data getter
    get image_data() {
      return photos[0]?.image_data || '';
    },
  };
}

// Fallback to localStorage if IndexedDB fails or is unavailable
function getFallbackProducts(): ProductItem[] {
  try {
    const raw = localStorage.getItem(LOCALSTORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed.map(normalizeProduct) : [];
    }

    // Check legacy storage key
    const legacyRaw = localStorage.getItem(LEGACY_LOCALSTORAGE_KEY);
    if (legacyRaw) {
      const legacyParsed = JSON.parse(legacyRaw);
      if (Array.isArray(legacyParsed)) {
        const normalized = legacyParsed.map(normalizeProduct);
        saveFallbackProducts(normalized);
        return normalized;
      }
    }

    return [];
  } catch {
    return [];
  }
}

function saveFallbackProducts(items: ProductItem[]) {
  try {
    localStorage.setItem(LOCALSTORAGE_KEY, JSON.stringify(items));
  } catch (err) {
    console.warn('LocalStorage save failed:', err);
  }
}

// Sample starter products, each demonstrating multiple photos!
const SAMPLE_PRODUCTS: Array<{
  amazon_url: string;
  asin: string;
  title: string;
  notes: string;
  tags: string[];
  photos: Array<{ image_data: string; filename: string }>;
}> = [
  {
    amazon_url: 'https://www.amazon.com/dp/B09XS7JWHH',
    asin: 'B09XS7JWHH',
    title: 'Sony WH-1000XM5 Noise Canceling Headphones',
    notes: 'Checked security seal on outer box, headphones condition, and audio cable.',
    tags: ['Packaging', 'Unboxing', 'Serial No'],
    photos: [
      {
        image_data: 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?auto=format&fit=crop&w=800&q=80',
        filename: 'sony-xm5-box.jpg',
      },
      {
        image_data: 'https://images.unsplash.com/photo-1546435770-a3e426bf472b?auto=format&fit=crop&w=800&q=80',
        filename: 'sony-xm5-earcups.jpg',
      },
    ],
  },
  {
    amazon_url: 'https://www.amazon.com/dp/B09HM94VDS',
    asin: 'B09HM94VDS',
    title: 'Logitech MX Master 3S Ergonomic Mouse',
    notes: 'Pale Grey edition, verified optical sensor and USB Logi Bolt receiver.',
    tags: ['Accessories', 'Condition'],
    photos: [
      {
        image_data: 'https://images.unsplash.com/photo-1615663245857-ac93bb7c39e7?auto=format&fit=crop&w=800&q=80',
        filename: 'mx-master-top.jpg',
      },
      {
        image_data: 'https://images.unsplash.com/photo-1527864550417-7fd91fc51a46?auto=format&fit=crop&w=800&q=80',
        filename: 'mx-master-desk.jpg',
      },
    ],
  },
  {
    amazon_url: 'https://www.amazon.com/dp/B08KTZ8249',
    asin: 'B08KTZ8249',
    title: 'Kindle Paperwhite (16 GB) 6.8" display',
    notes: 'Display check before packaging inspection.',
    tags: ['Inspection', 'Screen Test'],
    photos: [
      {
        image_data: 'https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?auto=format&fit=crop&w=800&q=80',
        filename: 'kindle-paperwhite-front.jpg',
      },
    ],
  },
];

export async function getAllProducts(): Promise<ProductItem[]> {
  try {
    const db = await openDB();
    return new Promise((resolve) => {
      const transaction = db.transaction(STORE_NAME, 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.getAll();

      request.onsuccess = () => {
        const rawResults = (request.result as any[]) || [];
        const normalized = rawResults.map(normalizeProduct);
        // sort by newest updated_at or created_at descending
        normalized.sort(
          (a, b) =>
            new Date(b.updated_at || b.created_at).getTime() -
            new Date(a.updated_at || a.created_at).getTime()
        );
        // Keep fallback in sync
        saveFallbackProducts(normalized);
        resolve(normalized);
      };

      request.onerror = () => {
        resolve(getFallbackProducts());
      };
    });
  } catch {
    return getFallbackProducts();
  }
}

// Backward compatibility alias
export const getAllImages = getAllProducts;

export interface SaveProductInput {
  id?: string;
  amazon_url: string;
  asin?: string;
  title?: string;
  notes?: string;
  tags?: string[];
  photos: Array<{
    image_data: string;
    filename?: string;
    file_size?: number;
  }>;
}

export async function saveProduct(input: SaveProductInput): Promise<ProductItem> {
  const asin = input.asin || extractAsin(input.amazon_url) || undefined;
  const now = new Date().toISOString();

  const formattedPhotos: ProductPhoto[] = input.photos.map((p, idx) => ({
    id: `photo_${Date.now()}_${idx}_${Math.random().toString(36).slice(2, 6)}`,
    image_data: p.image_data,
    filename: p.filename,
    file_size: p.file_size,
    created_at: now,
  }));

  const newProduct: ProductItem = {
    id: input.id || `prod_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    amazon_url: input.amazon_url.trim(),
    asin,
    title: input.title?.trim() || undefined,
    notes: input.notes?.trim() || undefined,
    tags: input.tags || [],
    photos: formattedPhotos,
    created_at: now,
    updated_at: now,
  };

  try {
    const db = await openDB();
    await new Promise<void>((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.put(newProduct);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  } catch (err) {
    console.warn('IndexedDB put error:', err);
  }

  // Update fallback
  const list = getFallbackProducts().filter((p) => p.id !== newProduct.id);
  list.unshift(newProduct);
  saveFallbackProducts(list);

  return newProduct;
}

// Backward compatibility alias for single image save
export async function saveImage(data: any): Promise<ProductItem> {
  const photo = {
    image_data: data.image_data,
    filename: data.filename,
    file_size: data.file_size,
  };
  return saveProduct({
    amazon_url: data.amazon_url,
    asin: data.asin,
    title: data.title,
    notes: data.notes,
    tags: data.tags,
    photos: [photo],
  });
}

// Add more photos to an existing product
export async function addPhotosToProduct(
  productId: string,
  newPhotos: Array<{ image_data: string; filename?: string; file_size?: number }>
): Promise<ProductItem | null> {
  const currentProducts = await getAllProducts();
  const product = currentProducts.find((p) => p.id === productId);
  if (!product) return null;

  const now = new Date().toISOString();
  const added: ProductPhoto[] = newPhotos.map((p, idx) => ({
    id: `photo_${Date.now()}_${idx}_${Math.random().toString(36).slice(2, 6)}`,
    image_data: p.image_data,
    filename: p.filename,
    file_size: p.file_size,
    created_at: now,
  }));

  const updatedProduct: ProductItem = {
    ...product,
    photos: [...product.photos, ...added],
    updated_at: now,
  };

  try {
    const db = await openDB();
    await new Promise<void>((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.put(updatedProduct);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  } catch (err) {
    console.warn('IndexedDB update error:', err);
  }

  const list = currentProducts.map((p) => (p.id === productId ? updatedProduct : p));
  saveFallbackProducts(list);

  return updatedProduct;
}

// Delete an entire product
export async function deleteProduct(productId: string): Promise<void> {
  try {
    const db = await openDB();
    await new Promise<void>((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.delete(productId);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  } catch (err) {
    console.warn('IndexedDB delete error:', err);
  }

  // Always delete from localStorage fallback as well
  const current = getFallbackProducts();
  const filtered = current.filter((item) => item.id !== productId);
  saveFallbackProducts(filtered);
}

// Delete a single photo from a product
export async function deletePhotoFromProduct(
  productId: string,
  photoId: string
): Promise<{ productDeleted: boolean; updatedProduct?: ProductItem }> {
  const currentProducts = await getAllProducts();
  const product = currentProducts.find((p) => p.id === productId);

  if (!product) {
    // If productId doesn't match, maybe it was called with photoId as itemId
    await deleteProduct(productId);
    return { productDeleted: true };
  }

  const remainingPhotos = product.photos.filter((p) => p.id !== photoId);

  // If no photos left, remove the product entirely
  if (remainingPhotos.length === 0) {
    await deleteProduct(productId);
    return { productDeleted: true };
  }

  const updatedProduct: ProductItem = {
    ...product,
    photos: remainingPhotos,
    updated_at: new Date().toISOString(),
  };

  try {
    const db = await openDB();
    await new Promise<void>((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.put(updatedProduct);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  } catch (err) {
    console.warn('IndexedDB update on photo delete error:', err);
  }

  const list = currentProducts.map((p) => (p.id === productId ? updatedProduct : p));
  saveFallbackProducts(list);

  return { productDeleted: false, updatedProduct };
}

// Backward compatibility: deleteImage can handle either a product ID or a photo ID
export async function deleteImage(id: string): Promise<void> {
  const currentProducts = await getAllProducts();
  // Check if id matches any product
  const prodMatch = currentProducts.find((p) => p.id === id);
  if (prodMatch) {
    await deleteProduct(id);
    return;
  }

  // Check if id is a photo inside any product
  for (const prod of currentProducts) {
    const photoMatch = prod.photos.find((ph) => ph.id === id);
    if (photoMatch) {
      await deletePhotoFromProduct(prod.id, id);
      return;
    }
  }

  // Fallback
  await deleteProduct(id);
}

export async function seedInitialDataIfEmpty(): Promise<ProductItem[]> {
  const current = await getAllProducts();
  if (current.length > 0) {
    return current;
  }

  const seeded: ProductItem[] = [];
  for (let i = 0; i < SAMPLE_PRODUCTS.length; i++) {
    const item = SAMPLE_PRODUCTS[i];
    const now = new Date(Date.now() - (i + 1) * 3600 * 1000 * 5).toISOString();
    const product: ProductItem = {
      id: `sample_prod_${i + 1}`,
      amazon_url: item.amazon_url,
      asin: item.asin,
      title: item.title,
      notes: item.notes,
      tags: item.tags,
      photos: item.photos.map((p, pIdx) => ({
        id: `sample_photo_${i + 1}_${pIdx + 1}`,
        image_data: p.image_data,
        filename: p.filename,
        created_at: now,
      })),
      created_at: now,
      updated_at: now,
    };

    try {
      const db = await openDB();
      await new Promise<void>((resolve, reject) => {
        const transaction = db.transaction(STORE_NAME, 'readwrite');
        const store = transaction.objectStore(STORE_NAME);
        const request = store.put(product);
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
      });
    } catch {
      // fallback handled below
    }
    seeded.push(product);
  }

  if (seeded.length > 0) {
    saveFallbackProducts(seeded);
    return seeded;
  }

  return current;
}

/**
 * Completely wipe local storage (IndexedDB and localStorage fallback)
 * Used when signing out on shared computers or wiping all private data.
 */
export async function clearAllLocalProducts(): Promise<void> {
  try {
    const db = await openDB();
    await new Promise<void>((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.clear();
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  } catch (err) {
    console.warn('Error clearing IndexedDB store:', err);
  }

  try {
    localStorage.removeItem(LOCALSTORAGE_KEY);
    localStorage.removeItem(LEGACY_LOCALSTORAGE_KEY);
  } catch {
    // ignore
  }
}

/**
 * Export all products as JSON for privacy backup / data portability
 */
export async function exportProductsAsJson(): Promise<string> {
  const all = await getAllProducts();
  return JSON.stringify(
    {
      app: 'LinkPix',
      version: '2.0',
      exportedAt: new Date().toISOString(),
      itemCount: all.length,
      products: all,
    },
    null,
    2
  );
}

