/**
 * Security & Sanitization Utilities for LinkPix
 */

const ALLOWED_IMAGE_MIME_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'image/heic',
  'image/heif',
]);

const VERIFIED_AMAZON_DOMAINS = [
  'amazon.com',
  'amazon.ca',
  'amazon.co.uk',
  'amazon.de',
  'amazon.fr',
  'amazon.it',
  'amazon.es',
  'amazon.co.jp',
  'amazon.in',
  'amazon.com.au',
  'amazon.com.mx',
  'amazon.com.br',
  'amzn.to',
  'amzn.com',
  'amzn.eu',
  'amzn.asia',
  'a.co',
];

/**
 * Sanitize an external URL to prevent XSS (javascript:, vbscript:, data:, etc.)
 * Only allows http: and https: protocols.
 */
export function sanitizeExternalUrl(url: string | undefined | null): string {
  if (!url) return '#';
  const trimmed = url.trim();

  // If it's a raw 10-char ASIN, build a clean Amazon URL
  if (/^[A-Z0-9]{10}$/i.test(trimmed)) {
    return `https://www.amazon.com/dp/${trimmed.toUpperCase()}`;
  }

  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol === 'http:' || parsed.protocol === 'https:') {
      return parsed.href;
    }
  } catch {
    // If missing protocol but looks like a domain, prefix https://
    if (/^[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}(\/.*)?$/.test(trimmed)) {
      try {
        const parsed = new URL(`https://${trimmed}`);
        if (parsed.protocol === 'https:') {
          return parsed.href;
        }
      } catch {
        // invalid
      }
    }
  }

  return '#';
}

/**
 * Checks whether a URL is from an official verified Amazon domain
 */
export function isVerifiedAmazonHost(url: string): boolean {
  if (!url) return false;
  const safe = sanitizeExternalUrl(url);
  if (safe === '#') return false;

  try {
    const parsed = new URL(safe);
    const host = parsed.hostname.toLowerCase();

    return VERIFIED_AMAZON_DOMAINS.some(
      (domain) => host === domain || host.endsWith(`.${domain}`)
    );
  } catch {
    return false;
  }
}

/**
 * Validates an uploaded file for MIME type, size, and extension to prevent malicious uploads.
 * Explicitly rejects SVG (script injection vector), HTML, executables, scripts.
 */
export function validateImageFile(file: File, maxSizeBytes = 20 * 1024 * 1024): {
  valid: boolean;
  error?: string;
} {
  if (!file) {
    return { valid: false, error: 'No file provided.' };
  }

  // Check MIME type
  const type = file.type.toLowerCase();
  if (!type || !ALLOWED_IMAGE_MIME_TYPES.has(type)) {
    if (type.includes('svg')) {
      return {
        valid: false,
        error: 'SVG files are restricted for security reasons. Please upload JPG, PNG, or WebP images.',
      };
    }
    return {
      valid: false,
      error: 'Invalid file format. Please upload valid image files (JPG, PNG, WebP, GIF).',
    };
  }

  // Check File Size
  if (file.size > maxSizeBytes) {
    const maxMb = Math.round(maxSizeBytes / (1024 * 1024));
    return {
      valid: false,
      error: `File "${file.name}" exceeds the maximum size limit of ${maxMb}MB.`,
    };
  }

  return { valid: true };
}

/**
 * Sanitizes a filename to prevent path traversal and unusual control characters
 */
export function sanitizeFilename(filename: string): string {
  if (!filename) return 'photo.jpg';
  // Remove path traversal and control characters
  const clean = filename
    .replace(/[/\\?%*:|"<>]/g, '_')
    .replace(/\.\./g, '_')
    .trim();
  return clean.slice(0, 100) || 'photo.jpg';
}

/**
 * Safe text truncation and control character removal
 */
export function sanitizeText(text: string, maxLength = 2000): string {
  if (!text) return '';
  return text.slice(0, maxLength);
}
