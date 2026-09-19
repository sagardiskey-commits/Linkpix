export interface ProductPhoto {
  id: string;
  image_data: string; // Base64 or URL
  filename?: string;
  file_size?: number;
  created_at: string;
}

export interface ProductItem {
  id: string;
  amazon_url: string;
  asin?: string;
  title?: string;
  notes?: string;
  tags?: string[];
  photos: ProductPhoto[];
  createdBy?: string;
  created_at: string;
  updated_at?: string;
  // Deprecated backward-compatibility fields:
  image_data?: string;
  filename?: string;
  file_size?: number;
}

export interface VaultSettingDoc {
  id: string;
  hash: string;
  salt: string;
  isCustom: boolean;
  updatedAt: string;
  updatedBy?: string;
}

// Type alias for backward compatibility if needed
export type ProductImage = ProductItem;

export type ActiveTab = 'home' | 'upload' | 'lookup';
